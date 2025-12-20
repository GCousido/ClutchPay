// tests/api/invoices/invoices-create.test.ts
import * as cloudinaryLib from '@/libs/cloudinary';
import { db } from '@/libs/db';
import { InvoiceStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { testApiHandler } from '../../helpers/request';

// Mock Cloudinary functions
vi.mock('@/libs/cloudinary', async () => {
  const actual = await vi.importActual('@/libs/cloudinary');
  return {
    ...actual,
    uploadPdf: vi.fn(),
  };
});

// Mock database
vi.mock('@/libs/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
    invoice: {
      create: vi.fn(),
    },
  },
}));

describe('POST /api/invoices - Create Invoice', () => {
  const mockPdfUrl = 'https://res.cloudinary.com/test/raw/upload/v123/ClutchPay/invoices/inv001.pdf';
  const mockPublicId = 'ClutchPay/invoices/inv001';

  const validInvoiceData = {
    invoiceNumber: 'INV-001',
    issuerUserId: 1,
    debtorUserId: 2,
    subject: 'Website Development Services',
    description: 'Full stack web development for company website',
    amount: 1500.50,
    status: InvoiceStatus.PENDING,
    issueDate: new Date('2024-01-15').toISOString(),
    dueDate: new Date('2024-02-15').toISOString(),
    invoicePdf: 'data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC9UeXBlL0NhdGFsb2c...',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(cloudinaryLib.uploadPdf).mockResolvedValue({
      url: mockPdfUrl,
      publicId: mockPublicId,
    });
  });

  it('should create an invoice successfully', async () => {
    const createdInvoice = {
      id: 1,
      ...validInvoiceData,
      invoicePdfUrl: mockPdfUrl,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.spyOn(db.user, 'findUnique').mockResolvedValue({ id: 2 } as any);
    vi.spyOn(db.invoice, 'create').mockResolvedValue(createdInvoice as any);

    const response = await testApiHandler({
      method: 'POST',
      url: '/api/invoices',
      body: validInvoiceData,
      userId: 1,
    });

    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.invoiceNumber).toBe('INV-001');
    expect(data.invoicePdfUrl).toBe(mockPdfUrl);

    expect(cloudinaryLib.uploadPdf).toHaveBeenCalledWith(validInvoiceData.invoicePdf);
    expect(db.invoice.create).toHaveBeenCalled();
  });

  it('should reject if user tries to issue invoice as someone else', async () => {
    const response = await testApiHandler({
      method: 'POST',
      url: '/api/invoices',
      body: {
        ...validInvoiceData,
        issuerUserId: 2, // Different from session user
      },
      userId: 1,
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.errors).toBeDefined();
    expect(data.errors[0].message).toContain('Issuer and debtor cannot be the same user');

    expect(cloudinaryLib.uploadPdf).not.toHaveBeenCalled();
  });

  it('should reject if user tries to invoice themselves', async () => {
    const response = await testApiHandler({
      method: 'POST',
      url: '/api/invoices',
      body: {
        ...validInvoiceData,
        debtorUserId: 1, // Same as issuer
      },
      userId: 1,
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.errors).toBeDefined();
    expect(data.errors[0].message).toContain('Issuer and debtor cannot be the same user');

    expect(cloudinaryLib.uploadPdf).not.toHaveBeenCalled();
  });

  it('should reject if debtor does not exist', async () => {
    vi.spyOn(db.user, 'findUnique').mockResolvedValue(null);

    const response = await testApiHandler({
      method: 'POST',
      url: '/api/invoices',
      body: validInvoiceData,
      userId: 1,
    });

    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data.message).toBe('Debtor not found');

    expect(cloudinaryLib.uploadPdf).not.toHaveBeenCalled();
  });

  it('should require authentication', async () => {
    const response = await testApiHandler({
      method: 'POST',
      url: '/api/invoices',
      body: validInvoiceData,
      userId: null,
    });

    expect(response.status).toBe(401);
  });

  it('should validate invoice number format', async () => {
    const response = await testApiHandler({
      method: 'POST',
      url: '/api/invoices',
      body: {
        ...validInvoiceData,
        invoiceNumber: 'invalid number!', // Contains invalid characters
      },
      userId: 1,
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.errors).toBeDefined();
  });

  it('should validate required fields', async () => {
    const response = await testApiHandler({
      method: 'POST',
      url: '/api/invoices',
      body: {
        invoiceNumber: 'INV-001',
        // Missing required fields
      },
      userId: 1,
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.errors).toBeDefined();
  });

  it('should validate PDF format', async () => {
    const response = await testApiHandler({
      method: 'POST',
      url: '/api/invoices',
      body: {
        ...validInvoiceData,
        invoicePdf: 'data:image/jpeg;base64,/9j/4AAQ...', // Wrong format
      },
      userId: 1,
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.errors).toBeDefined();
  });

  it('should validate amount is positive', async () => {
    const response = await testApiHandler({
      method: 'POST',
      url: '/api/invoices',
      body: {
        ...validInvoiceData,
        amount: -100,
      },
      userId: 1,
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.errors).toBeDefined();
  });

  it('should validate subject length', async () => {
    const response = await testApiHandler({
      method: 'POST',
      url: '/api/invoices',
      body: {
        ...validInvoiceData,
        subject: 'abc', // Too short
      },
      userId: 1,
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.errors).toBeDefined();
  });

  it('should validate description length', async () => {
    const response = await testApiHandler({
      method: 'POST',
      url: '/api/invoices',
      body: {
        ...validInvoiceData,
        description: 'short', // Too short
      },
      userId: 1,
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.errors).toBeDefined();
  });

  it('should handle Cloudinary upload errors', async () => {
    vi.mocked(cloudinaryLib.uploadPdf).mockRejectedValue(
      new Error('Failed to upload PDF to Cloudinary')
    );

    vi.spyOn(db.user, 'findUnique').mockResolvedValue({ id: 2 } as any);

    const response = await testApiHandler({
      method: 'POST',
      url: '/api/invoices',
      body: validInvoiceData,
      userId: 1,
    });

    expect(response.status).toBe(500);

    expect(db.invoice.create).not.toHaveBeenCalled();
  });
});
