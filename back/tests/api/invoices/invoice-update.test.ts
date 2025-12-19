// tests/api/invoices/invoice-update.test.ts
import * as cloudinaryLib from '@/libs/cloudinary';
import { db } from '@/libs/db';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { testApiHandler } from '../../helpers/request';

// Mock Cloudinary functions
vi.mock('@/libs/cloudinary', async () => {
  const actual = await vi.importActual('@/libs/cloudinary');
  return {
    ...actual,
    uploadPdf: vi.fn(),
    deletePdf: vi.fn(),
    extractPublicId: vi.fn(),
  };
});

// Mock database
vi.mock('@/libs/db', () => ({
  db: {
    invoice: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('PUT /api/invoices/:id - Update Invoice', () => {
  const mockInvoice = {
    id: 1,
    invoiceNumber: 'INV-001',
    issuerUserId: 1,
    debtorUserId: 2,
    subject: 'Website Development Services',
    description: 'Full stack web development for company website',
    amount: new Prisma.Decimal('1500.00'),
    status: InvoiceStatus.PENDING,
    issueDate: new Date('2024-01-15'),
    dueDate: new Date('2024-02-15'),
    invoicePdfUrl: 'https://res.cloudinary.com/test/raw/upload/v123/ClutchPay/invoices/inv001.pdf',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
    payment: null,
  };

  const newPdfUrl = 'https://res.cloudinary.com/test/raw/upload/v123/ClutchPay/invoices/inv001-new.pdf';
  const newPublicId = 'ClutchPay/invoices/inv001-new';

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(cloudinaryLib.uploadPdf).mockResolvedValue({
      url: newPdfUrl,
      publicId: newPublicId,
    });

    vi.mocked(cloudinaryLib.deletePdf).mockResolvedValue({ result: 'ok' } as any);

    vi.mocked(cloudinaryLib.extractPublicId).mockImplementation((url: string) => {
      if (url && url.includes('cloudinary')) {
        return 'ClutchPay/invoices/inv001';
      }
      return null;
    });
  });

  it('should update invoice fields successfully', async () => {
    vi.spyOn(db.invoice, 'findUnique').mockResolvedValue(mockInvoice as any);
    vi.spyOn(db.invoice, 'update').mockResolvedValue({
      ...mockInvoice,
      subject: 'Updated Subject',
      amount: new Prisma.Decimal('2000.00'),
    } as any);

    const response = await testApiHandler({
      method: 'PUT',
      url: '/api/invoices/1',
      body: {
        subject: 'Updated Subject',
        amount: 2000,
      },
      userId: 1,
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.subject).toBe('Updated Subject');

    expect(db.invoice.update).toHaveBeenCalled();
  });

  it('should update PDF and delete old one', async () => {
    vi.spyOn(db.invoice, 'findUnique').mockResolvedValue(mockInvoice as any);
    vi.spyOn(db.invoice, 'update').mockResolvedValue({
      ...mockInvoice,
      invoicePdfUrl: newPdfUrl,
    } as any);

    const response = await testApiHandler({
      method: 'PUT',
      url: '/api/invoices/1',
      body: {
        invoicePdf: 'data:application/pdf;base64,JVBERi0xLjQKJeLjz9MK...',
      },
      userId: 1,
    });

    expect(response.status).toBe(200);

    expect(cloudinaryLib.extractPublicId).toHaveBeenCalledWith(mockInvoice.invoicePdfUrl);
    expect(cloudinaryLib.deletePdf).toHaveBeenCalledWith('ClutchPay/invoices/inv001');
    expect(cloudinaryLib.uploadPdf).toHaveBeenCalled();

    const data = await response.json();
    expect(data.invoicePdfUrl).toBe(newPdfUrl);
  });

  it('should reject update if user is not the issuer', async () => {
    vi.spyOn(db.invoice, 'findUnique').mockResolvedValue(mockInvoice as any);

    const response = await testApiHandler({
      method: 'PUT',
      url: '/api/invoices/1',
      body: {
        subject: 'Hacked Subject',
      },
      userId: 2, // Debtor, not issuer
    });

    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data.message).toBe('Invoice not found');

    expect(db.invoice.update).not.toHaveBeenCalled();
  });

  it('should reject update if invoice has payment', async () => {
    const paidInvoice = {
      ...mockInvoice,
      status: InvoiceStatus.PAID,
      payment: { id: 1 },
    };

    vi.spyOn(db.invoice, 'findUnique').mockResolvedValue(paidInvoice as any);

    const response = await testApiHandler({
      method: 'PUT',
      url: '/api/invoices/1',
      body: {
        subject: 'Updated Subject',
      },
      userId: 1,
    });

    expect(response.status).toBe(400);

    expect(db.invoice.update).not.toHaveBeenCalled();
  });

  it('should return 404 for non-existent invoice', async () => {
    vi.spyOn(db.invoice, 'findUnique').mockResolvedValue(null);

    const response = await testApiHandler({
      method: 'PUT',
      url: '/api/invoices/999',
      body: {
        subject: 'Updated Subject',
      },
      userId: 1,
    });

    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data.message).toBe('Invoice not found');
  });

  it('should require authentication', async () => {
    const response = await testApiHandler({
      method: 'PUT',
      url: '/api/invoices/1',
      body: {
        subject: 'Updated Subject',
      },
      userId: null,
    });

    expect(response.status).toBe(401);
  });

  it('should validate updated fields', async () => {
    vi.spyOn(db.invoice, 'findUnique').mockResolvedValue(mockInvoice as any);

    const response = await testApiHandler({
      method: 'PUT',
      url: '/api/invoices/1',
      body: {
        subject: 'abc', // Too short
      },
      userId: 1,
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.errors).toBeDefined();

    expect(db.invoice.update).not.toHaveBeenCalled();
  });
});
