// tests/api/invoices/invoice-detail.test.ts
import { db } from '@/libs/db';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { testApiHandler } from '../../helpers/request';

// Mock database
vi.mock('@/libs/db', () => ({
  db: {
    invoice: {
      findFirst: vi.fn(),
    },
  },
}));

describe('GET /api/invoices/:id - Invoice Detail', () => {
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
  });

  it('should return invoice details when user is issuer', async () => {
    vi.spyOn(db.invoice, 'findFirst').mockResolvedValue(mockInvoice as any);

    const response = await testApiHandler({
      method: 'GET',
      url: '/api/invoices/1',
      userId: 1, // Issuer
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.id).toBe(1);
    expect(data.invoiceNumber).toBe('INV-001');
    expect(data.invoicePdfUrl).toBeDefined();
    
    expect(db.invoice.findFirst).toHaveBeenCalledWith({
      where: {
        id: 1,
        OR: [
          { issuerUserId: 1 },
          { debtorUserId: 1 },
        ],
      },
      select: expect.any(Object),
    });
  });

  it('should return invoice details when user is debtor', async () => {
    vi.spyOn(db.invoice, 'findFirst').mockResolvedValue(mockInvoice as any);

    const response = await testApiHandler({
      method: 'GET',
      url: '/api/invoices/1',
      userId: 2, // Debtor
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.id).toBe(1);
    
    expect(db.invoice.findFirst).toHaveBeenCalledWith({
      where: {
        id: 1,
        OR: [
          { issuerUserId: 2 },
          { debtorUserId: 2 },
        ],
      },
      select: expect.any(Object),
    });
  });

  it('should return 404 when invoice does not exist', async () => {
    vi.spyOn(db.invoice, 'findFirst').mockResolvedValue(null);

    const response = await testApiHandler({
      method: 'GET',
      url: '/api/invoices/999',
      userId: 1,
    });

    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data.message).toBe('Invoice not found');
  });

  it('should return 404 when user is not issuer or debtor', async () => {
    vi.spyOn(db.invoice, 'findFirst').mockResolvedValue(null);

    const response = await testApiHandler({
      method: 'GET',
      url: '/api/invoices/1',
      userId: 3, // Neither issuer nor debtor
    });

    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data.message).toBe('Invoice not found');
  });

  it('should require authentication', async () => {
    const response = await testApiHandler({
      method: 'GET',
      url: '/api/invoices/1',
      userId: null,
    });

    expect(response.status).toBe(401);
  });

  it('should include payment details if invoice is paid', async () => {
    const paidInvoice = {
      ...mockInvoice,
      status: InvoiceStatus.PAID,
      payment: {
        id: 1,
        paymentDate: new Date('2024-01-20'),
        paymentMethod: 'PAYPAL',
      },
    };

    vi.spyOn(db.invoice, 'findFirst').mockResolvedValue(paidInvoice as any);

    const response = await testApiHandler({
      method: 'GET',
      url: '/api/invoices/1',
      userId: 1,
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.payment).toBeDefined();
    expect(data.payment.paymentMethod).toBe('PAYPAL');
  });
});
