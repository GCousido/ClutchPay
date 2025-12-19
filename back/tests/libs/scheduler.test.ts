// tests/libs/scheduler.test.ts
import { db } from '@/libs/db';
import {
  checkAndNotifyPaymentDue,
  checkAndNotifyPaymentOverdue,
  cleanupOldReadNotifications,
} from '@/libs/notifications';
import { InvoiceStatus, NotificationType } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock email sending
vi.mock('@/libs/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

describe('Scheduler Notifications', () => {
  let testUser1: any;
  let testUser2: any;

  beforeAll(async () => {
    // Create test users
    testUser1 = await db.user.create({
      data: {
        email: 'user1@scheduler.test',
        name: 'User',
        surnames: 'One',
        password: 'hashedpassword',
        emailNotifications: true,
      },
    });

    testUser2 = await db.user.create({
      data: {
        email: 'user2@scheduler.test',
        name: 'User',
        surnames: 'Two',
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

  describe('checkAndNotifyPaymentDue', () => {
    it('should notify for invoices due in 3 days', async () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);
      dueDate.setHours(12, 0, 0, 0);

      // Create invoice due in 3 days
      await db.invoice.create({
        data: {
          invoiceNumber: 'INV-DUE-3',
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

      const count = await checkAndNotifyPaymentDue(3);

      expect(count).toBe(1);

      // Verify notification was created
      const notifications = await db.notification.findMany({
        where: {
          userId: testUser2.id,
          type: NotificationType.PAYMENT_DUE,
        },
      });

      expect(notifications).toHaveLength(1);
    });

    it('should not notify for invoices due in more than 3 days', async () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 5);

      await db.invoice.create({
        data: {
          invoiceNumber: 'INV-DUE-5',
          issuerUserId: testUser1.id,
          debtorUserId: testUser2.id,
          subject: 'Test Invoice Due Later',
          description: 'Test description',
          amount: 100,
          status: InvoiceStatus.PENDING,
          issueDate: new Date(),
          invoicePdfUrl: 'https://example.com/test.pdf',
          dueDate,
        },
      });

      const count = await checkAndNotifyPaymentDue(3);

      expect(count).toBe(0);
    });

    it('should not notify twice for the same invoice', async () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);

      const invoice = await db.invoice.create({
        data: {
          invoiceNumber: 'INV-DUE-TWICE',
          issuerUserId: testUser1.id,
          debtorUserId: testUser2.id,
          subject: 'Test Invoice No Duplicate',
          description: 'Test description',
          amount: 100,
          status: InvoiceStatus.PENDING,
          issueDate: new Date(),
          invoicePdfUrl: 'https://example.com/test.pdf',
          dueDate,
        },
      });

      // First notification
      const count1 = await checkAndNotifyPaymentDue(3);
      expect(count1).toBe(1);

      // Second attempt should not notify again
      const count2 = await checkAndNotifyPaymentDue(3);
      expect(count2).toBe(0);

      // Verify only one notification exists
      const notifications = await db.notification.findMany({
        where: {
          invoiceId: invoice.id,
          type: NotificationType.PAYMENT_DUE,
        },
      });

      expect(notifications).toHaveLength(1);
    });

    it('should not notify for paid invoices', async () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);

      await db.invoice.create({
        data: {
          invoiceNumber: 'INV-DUE-PAID',
          issuerUserId: testUser1.id,
          debtorUserId: testUser2.id,
          subject: 'Test Paid Invoice',
          description: 'Test description',
          amount: 100,
          status: InvoiceStatus.PAID,
          issueDate: new Date(),
          invoicePdfUrl: 'https://example.com/test.pdf',
          dueDate,
        },
      });

      const count = await checkAndNotifyPaymentDue(3);

      expect(count).toBe(0);
    });

    it('should not notify for invoices without due date', async () => {
      await db.invoice.create({
        data: {
          invoiceNumber: 'INV-NO-DUE',
          issuerUserId: testUser1.id,
          debtorUserId: testUser2.id,
          subject: 'Test Invoice No Due Date',
          description: 'Test description',
          amount: 100,
          status: InvoiceStatus.PENDING,
          issueDate: new Date(),
          invoicePdfUrl: 'https://example.com/test.pdf',
          dueDate: null,
        },
      });

      const count = await checkAndNotifyPaymentDue(3);

      expect(count).toBe(0);
    });
  });

  describe('checkAndNotifyPaymentOverdue', () => {
    it('should notify for overdue invoices', async () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() - 5); // 5 days ago

      await db.invoice.create({
        data: {
          invoiceNumber: 'INV-OVERDUE-1',
          issuerUserId: testUser1.id,
          debtorUserId: testUser2.id,
          subject: 'Test Overdue Invoice',
          description: 'Test description',
          amount: 100,
          status: InvoiceStatus.OVERDUE,
          issueDate: new Date(),
          invoicePdfUrl: 'https://example.com/test.pdf',
          dueDate,
        },
      });

      const count = await checkAndNotifyPaymentOverdue();

      expect(count).toBe(1);

      // Verify notification was created
      const notifications = await db.notification.findMany({
        where: {
          userId: testUser2.id,
          type: NotificationType.PAYMENT_OVERDUE,
        },
      });

      expect(notifications).toHaveLength(1);
    });

    it('should not notify twice for the same overdue invoice', async () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() - 3);

      const invoice = await db.invoice.create({
        data: {
          invoiceNumber: 'INV-OVERDUE-TWICE',
          issuerUserId: testUser1.id,
          debtorUserId: testUser2.id,
          subject: 'Test Overdue No Duplicate',
          description: 'Test description',
          amount: 100,
          status: InvoiceStatus.OVERDUE,
          issueDate: new Date(),
          invoicePdfUrl: 'https://example.com/test.pdf',
          dueDate,
        },
      });

      // First notification
      const count1 = await checkAndNotifyPaymentOverdue();
      expect(count1).toBe(1);

      // Second attempt should not notify again
      const count2 = await checkAndNotifyPaymentOverdue();
      expect(count2).toBe(0);

      // Verify only one notification exists
      const notifications = await db.notification.findMany({
        where: {
          invoiceId: invoice.id,
          type: NotificationType.PAYMENT_OVERDUE,
        },
      });

      expect(notifications).toHaveLength(1);
    });

    it('should not notify for future due dates', async () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 5); // Future date

      await db.invoice.create({
        data: {
          invoiceNumber: 'INV-FUTURE',
          issuerUserId: testUser1.id,
          debtorUserId: testUser2.id,
          subject: 'Test Future Invoice',
          description: 'Test description',
          amount: 100,
          status: InvoiceStatus.PENDING,
          issueDate: new Date(),
          invoicePdfUrl: 'https://example.com/test.pdf',
          dueDate,
        },
      });

      const count = await checkAndNotifyPaymentOverdue();

      expect(count).toBe(0);
    });

    it('should not notify for paid invoices', async () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() - 5);

      await db.invoice.create({
        data: {
          invoiceNumber: 'INV-OVERDUE-PAID',
          issuerUserId: testUser1.id,
          debtorUserId: testUser2.id,
          subject: 'Test Paid Overdue',
          description: 'Test description',
          amount: 100,
          status: InvoiceStatus.PAID,
          issueDate: new Date(),
          invoicePdfUrl: 'https://example.com/test.pdf',
          dueDate,
        },
      });

      const count = await checkAndNotifyPaymentOverdue();

      expect(count).toBe(0);
    });

    it('should handle invoices with PENDING status that are overdue', async () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() - 2);

      await db.invoice.create({
        data: {
          invoiceNumber: 'INV-PENDING-OVERDUE',
          issuerUserId: testUser1.id,
          debtorUserId: testUser2.id,
          subject: 'Test Pending but Overdue',
          description: 'Test description',
          amount: 100,
          status: InvoiceStatus.PENDING,
          issueDate: new Date(),
          invoicePdfUrl: 'https://example.com/test.pdf',
          dueDate,
        },
      });

      const count = await checkAndNotifyPaymentOverdue();

      expect(count).toBe(1);
    });
  });

  describe('cleanupOldReadNotifications', () => {
    it('should delete read notifications older than specified days', async () => {
      const invoice = await db.invoice.create({
        data: {
          invoiceNumber: 'INV-CLEANUP',
          issuerUserId: testUser1.id,
          debtorUserId: testUser2.id,
          subject: 'Test Cleanup',
          description: 'Test description',
          amount: 100,
          status: InvoiceStatus.PENDING,
          issueDate: new Date(),
          invoicePdfUrl: 'https://example.com/test.pdf',
        },
      });

      // Create old read notification (65 days ago)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 65);

      await db.notification.create({
        data: {
          userId: testUser2.id,
          invoiceId: invoice.id,
          type: NotificationType.INVOICE_ISSUED,
          read: true,
          createdAt: oldDate,
          updatedAt: oldDate,
        },
      });

      // Create recent read notification (30 days ago)
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 30);

      await db.notification.create({
        data: {
          userId: testUser2.id,
          invoiceId: invoice.id,
          type: NotificationType.PAYMENT_DUE,
          read: true,
          createdAt: recentDate,
          updatedAt: recentDate,
        },
      });

      // Create unread notification
      await db.notification.create({
        data: {
          userId: testUser2.id,
          invoiceId: invoice.id,
          type: NotificationType.PAYMENT_OVERDUE,
          read: false,
        },
      });

      const count = await cleanupOldReadNotifications(60);

      expect(count).toBe(1); // Only the 65-day-old notification should be deleted

      // Verify remaining notifications
      const remaining = await db.notification.findMany({
        where: {
          invoiceId: invoice.id,
        },
      });

      expect(remaining).toHaveLength(2); // Recent read + unread
    });

    it('should not delete unread notifications', async () => {
      const invoice = await db.invoice.create({
        data: {
          invoiceNumber: 'INV-UNREAD',
          issuerUserId: testUser1.id,
          debtorUserId: testUser2.id,
          subject: 'Test Unread',
          description: 'Test description',
          amount: 100,
          status: InvoiceStatus.PENDING,
          issueDate: new Date(),
          invoicePdfUrl: 'https://example.com/test.pdf',
        },
      });

      // Create old unread notification
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 90);

      await db.notification.create({
        data: {
          userId: testUser2.id,
          invoiceId: invoice.id,
          type: NotificationType.INVOICE_ISSUED,
          read: false,
          createdAt: oldDate,
          updatedAt: oldDate,
        },
      });

      const count = await cleanupOldReadNotifications(60);

      expect(count).toBe(0);

      // Verify notification still exists
      const notifications = await db.notification.findMany({
        where: {
          invoiceId: invoice.id,
        },
      });

      expect(notifications).toHaveLength(1);
    });

    it('should handle custom days parameter', async () => {
      const invoice = await db.invoice.create({
        data: {
          invoiceNumber: 'INV-CUSTOM-DAYS',
          issuerUserId: testUser1.id,
          debtorUserId: testUser2.id,
          subject: 'Test Custom Days',
          description: 'Test description',
          amount: 100,
          status: InvoiceStatus.PENDING,
          issueDate: new Date(),
          invoicePdfUrl: 'https://example.com/test.pdf',
        },
      });

      // Create notification 20 days old
      const date20 = new Date();
      date20.setDate(date20.getDate() - 20);

      await db.notification.create({
        data: {
          userId: testUser2.id,
          invoiceId: invoice.id,
          type: NotificationType.INVOICE_ISSUED,
          read: true,
          createdAt: date20,
          updatedAt: date20,
        },
      });

      // Should be deleted with 15-day threshold
      const count = await cleanupOldReadNotifications(15);

      expect(count).toBe(1);
    });
  });
});
