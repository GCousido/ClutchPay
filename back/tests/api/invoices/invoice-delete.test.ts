// tests/api/invoices/invoice-delete.test.ts
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
    deletePdf: vi.fn(),
    extractPublicId: vi.fn(),
  };
});

// Mock database
vi.mock('@/libs/db', () => ({
  db: {
    invoice: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

describe('DELETE /api/invoices/:id - Delete Invoice', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(cloudinaryLib.deletePdf).mockResolvedValue({ result: 'ok' } as any);

    vi.mocked(cloudinaryLib.extractPublicId).mockImplementation((url: string) => {
      if (url && url.includes('cloudinary')) {
        return 'ClutchPay/invoices/inv001';
      }
      return null;
    });
  });

  it('should delete invoice and PDF successfully', async () => {
    vi.spyOn(db.invoice, 'findUnique').mockResolvedValue(mockInvoice as any);
    vi.spyOn(db.invoice, 'delete').mockResolvedValue(mockInvoice as any);

    const response = await testApiHandler({
      method: 'DELETE',
      url: '/api/invoices/1',
      userId: 1,
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.message).toBe('Invoice cancelled');

    expect(cloudinaryLib.extractPublicId).toHaveBeenCalledWith(mockInvoice.invoicePdfUrl);
    expect(cloudinaryLib.deletePdf).toHaveBeenCalledWith('ClutchPay/invoices/inv001');
    expect(db.invoice.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('should delete invoice even if PDF deletion fails gracefully', async () => {
    vi.mocked(cloudinaryLib.extractPublicId).mockReturnValue(null);
    
    vi.spyOn(db.invoice, 'findUnique').mockResolvedValue(mockInvoice as any);
    vi.spyOn(db.invoice, 'delete').mockResolvedValue(mockInvoice as any);

    const response = await testApiHandler({
      method: 'DELETE',
      url: '/api/invoices/1',
      userId: 1,
    });

    expect(response.status).toBe(200);

    expect(cloudinaryLib.deletePdf).not.toHaveBeenCalled();
    expect(db.invoice.delete).toHaveBeenCalled();
  });

  it('should reject delete if user is not the issuer', async () => {
    vi.spyOn(db.invoice, 'findUnique').mockResolvedValue(mockInvoice as any);

    const response = await testApiHandler({
      method: 'DELETE',
      url: '/api/invoices/1',
      userId: 2, // Debtor, not issuer
    });

    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data.message).toBe('Invoice not found');

    expect(db.invoice.delete).not.toHaveBeenCalled();
    expect(cloudinaryLib.deletePdf).not.toHaveBeenCalled();
  });

  it('should reject delete if invoice has payment', async () => {
    const paidInvoice = {
      ...mockInvoice,
      status: InvoiceStatus.PAID,
      payment: { id: 1 },
    };

    vi.spyOn(db.invoice, 'findUnique').mockResolvedValue(paidInvoice as any);

    const response = await testApiHandler({
      method: 'DELETE',
      url: '/api/invoices/1',
      userId: 1,
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.message).toBe('Invoices with payments cannot be cancelled');

    expect(db.invoice.delete).not.toHaveBeenCalled();
    expect(cloudinaryLib.deletePdf).not.toHaveBeenCalled();
  });

  it('should return 404 for non-existent invoice', async () => {
    vi.spyOn(db.invoice, 'findUnique').mockResolvedValue(null);

    const response = await testApiHandler({
      method: 'DELETE',
      url: '/api/invoices/999',
      userId: 1,
    });

    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data.message).toBe('Invoice not found');

    expect(db.invoice.delete).not.toHaveBeenCalled();
  });

  it('should require authentication', async () => {
    const response = await testApiHandler({
      method: 'DELETE',
      url: '/api/invoices/1',
      userId: null,
    });

    expect(response.status).toBe(401);
  });
});
