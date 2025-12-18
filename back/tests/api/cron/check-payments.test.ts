// tests/api/cron/check-payments.test.ts
import { db } from '@/libs/db';
import { GET } from '@/app/api/cron/check-payments/route';
import { InvoiceStatus, NotificationType } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock email sending
vi.mock('@/libs/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

// Helper to make authenticated cron requests
async function makeCronRequest(url: string) {
  // In tests, NODE_ENV is already 'test', so no auth needed
  // In production, you'd need to set x-cron-secret header
  return GET(new Request(url));
}

describe('GET /api/cron/check-payments', () => {
  let testUser1: any;
  let testUser2: any;

  beforeAll(async () => {
    // Create test users
    testUser1 = await db.user.create({
      data: {
        email: 'cron1@test.com',
        name: 'Cron',
        surnames: 'User One',
        password: 'hashedpassword',
        emailNotifications: true,
      },
    });

    testUser2 = await db.user.create({
      data: {
        email: 'cron2@test.com',
        name: 'Cron',
        surnames: 'User Two',
        password: 'hashedpassword',
        emailNotifications: true,
      },
    });
  });

  afterAll(async () => {
    await db.notification.deleteMany({
      where: {
        invoice: {
          OR: [
            { issuerUserId: testUser1.id },
            { debtorUserId: testUser1.id },
            { issuerUserId: testUser2.id },
            { debtorUserId: testUser2.id },
          ],
        },
      },
    });

    await db.invoice.deleteMany({
      where: {
        OR: [
          { issuerUserId: testUser1.id },
          { debtorUserId: testUser1.id },
          { issuerUserId: testUser2.id },
          { debtorUserId: testUser2.id },
        ],
      },
    });

    await db.user.deleteMany({
      where: {
        id: {
          in: [testUser1.id, testUser2.id],
        },
      },
    });
  });

  beforeEach(async () => {
    // Clean notifications and invoices before each test
    await db.notification.deleteMany({
      where: {
        invoice: {
          OR: [
            { issuerUserId: testUser1.id },
            { debtorUserId: testUser1.id },
            { issuerUserId: testUser2.id },
            { debtorUserId: testUser2.id },
          ],
        },
      },
    });

    await db.invoice.deleteMany({
      where: {
        OR: [
          { issuerUserId: testUser1.id },
          { debtorUserId: testUser1.id },
          { issuerUserId: testUser2.id },
          { debtorUserId: testUser2.id },
        ],
      },
    });
  });

  it('should execute all tasks by default', async () => {
    // Create test data for all three tasks
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);

    const overdueDate = new Date();
    overdueDate.setDate(overdueDate.getDate() - 5);

    // Invoice due soon
    await db.invoice.create({
      data: {
        invoiceNumber: 'INV-DUE-CRON',
        issuerUserId: testUser1.id,
        debtorUserId: testUser2.id,
        subject: 'Test Invoice Due',
        description: 'Test description',
        amount: 100,
        status: InvoiceStatus.PENDING,
        issueDate: new Date(),
        invoicePdfUrl: 'https://example.com/test.pdf',
        dueDate,
      },
    });

    // Invoice overdue
    await db.invoice.create({
      data: {
        invoiceNumber: 'INV-OVERDUE-CRON',
        issuerUserId: testUser1.id,
        debtorUserId: testUser2.id,
        subject: 'Test Invoice Overdue',
        description: 'Test description',
        amount: 200,
        status: InvoiceStatus.OVERDUE,
        issueDate: new Date(),
        invoicePdfUrl: 'https://example.com/test.pdf',
        dueDate: overdueDate,
      },
    });

    const response = await makeCronRequest('http://localhost:3000/api/cron/check-payments');

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.results.paymentDue).toBe(1);
    expect(data.results.paymentOverdue).toBe(1);
    expect(data.results.cleanupOldNotifications).toBeGreaterThanOrEqual(0);
    expect(data.timestamp).toBeDefined();
  });

  it('should execute only payment due task when specified', async () => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);

    await db.invoice.create({
      data: {
        invoiceNumber: 'INV-DUE-ONLY',
        issuerUserId: testUser1.id,
        debtorUserId: testUser2.id,
        subject: 'Test Due Only',
        description: 'Test description',
        amount: 100,
        status: InvoiceStatus.PENDING,
        issueDate: new Date(),
        invoicePdfUrl: 'https://example.com/test.pdf',
        dueDate,
      },
    });

    const response = await makeCronRequest('http://localhost:3000/api/cron/check-payments?task=due');

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.results.paymentDue).toBe(1);
    expect(data.results.paymentOverdue).toBeUndefined();
    expect(data.results.cleanupOldNotifications).toBeUndefined();
  });

  it('should execute only payment overdue task when specified', async () => {
    const overdueDate = new Date();
    overdueDate.setDate(overdueDate.getDate() - 5);

    await db.invoice.create({
      data: {
        invoiceNumber: 'INV-OVERDUE-ONLY',
        issuerUserId: testUser1.id,
        debtorUserId: testUser2.id,
        subject: 'Test Overdue Only',
        description: 'Test description',
        amount: 200,
        status: InvoiceStatus.OVERDUE,
        issueDate: new Date(),
        invoicePdfUrl: 'https://example.com/test.pdf',
        dueDate: overdueDate,
      },
    });

    const response = await makeCronRequest('http://localhost:3000/api/cron/check-payments?task=overdue');

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.results.paymentDue).toBeUndefined();
    expect(data.results.paymentOverdue).toBe(1);
    expect(data.results.cleanupOldNotifications).toBeUndefined();
  });

  it('should execute only cleanup task when specified', async () => {
    const response = await makeCronRequest('http://localhost:3000/api/cron/check-payments?task=cleanup');

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.results.paymentDue).toBeUndefined();
    expect(data.results.paymentOverdue).toBeUndefined();
    expect(data.results.cleanupOldNotifications).toBeGreaterThanOrEqual(0);
  });

  it('should handle errors gracefully', async () => {
    // Mock db to throw an error temporarily
    const originalFindMany = db.invoice.findMany;
    db.invoice.findMany = vi.fn().mockRejectedValue(new Error('Database error'));

    const response = await makeCronRequest('http://localhost:3000/api/cron/check-payments');

    expect(response.status).toBe(500);

    // Restore original function
    db.invoice.findMany = originalFindMany;
  });

  it('should return count of 0 when no invoices match criteria', async () => {
    // No invoices created, so all counts should be 0
    const response = await makeCronRequest('http://localhost:3000/api/cron/check-payments');

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.results.paymentDue).toBe(0);
    expect(data.results.paymentOverdue).toBe(0);
    expect(data.results.cleanupOldNotifications).toBeGreaterThanOrEqual(0);
  });

  it('should process multiple invoices in a single run', async () => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);

    // Create multiple invoices due soon
    await db.invoice.create({
      data: {
        invoiceNumber: 'INV-MULTI-1',
        issuerUserId: testUser1.id,
        debtorUserId: testUser2.id,
        subject: 'Test Multi 1',
        description: 'Test',
        amount: 100,
        status: InvoiceStatus.PENDING,
        issueDate: new Date(),
        invoicePdfUrl: 'https://example.com/invoice1.pdf',
        dueDate,
      },
    });

    await db.invoice.create({
      data: {
        invoiceNumber: 'INV-MULTI-2',
        issuerUserId: testUser1.id,
        debtorUserId: testUser2.id,
        subject: 'Test Multi 2',
        description: 'Test',
        amount: 200,
        status: InvoiceStatus.PENDING,
        issueDate: new Date(),
        invoicePdfUrl: 'https://example.com/invoice2.pdf',
        dueDate,
      },
    });

    await db.invoice.create({
      data: {
        invoiceNumber: 'INV-MULTI-3',
        issuerUserId: testUser2.id,
        debtorUserId: testUser1.id,
        subject: 'Test Multi 3',
        description: 'Test',
        amount: 300,
        status: InvoiceStatus.PENDING,
        issueDate: new Date(),
        invoicePdfUrl: 'https://example.com/invoice3.pdf',
        dueDate,
      },
    });

    const response = await makeCronRequest('http://localhost:3000/api/cron/check-payments?task=due');

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.results.paymentDue).toBe(3);

    // Verify all notifications were created
    const notifications = await db.notification.findMany({
      where: {
        type: NotificationType.PAYMENT_DUE,
      },
    });

    expect(notifications).toHaveLength(3);
  });
});
