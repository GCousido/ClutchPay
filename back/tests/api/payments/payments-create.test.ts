// tests/api/payments/payments-create.test.ts
import * as cloudinaryLib from '@/libs/cloudinary';
import { db } from '@/libs/db';
import { InvoiceStatus, PaymentMethod, Prisma } from '@prisma/client';
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
    invoice: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    payment: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

describe('POST /api/payments - Create Payment', () => {
  const mockReceiptPdfUrl = 'https://res.cloudinary.com/test/raw/upload/ClutchPay/invoices/receipt1.pdf';
  const mockPublicId = 'ClutchPay/invoices/receipt1';

  const validPaymentData = {
    invoiceId: 1,
    paymentMethod: PaymentMethod.PAYPAL,
    subject: 'Payment for web development services',
    receiptPdf: 'data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC9UeXBlL0NhdGFsb2c...',
    paymentReference: 'STRIPE-TXN-123456',
  };

  const mockInvoice = {
    id: 1,
    invoiceNumber: 'INV-001',
    issuerUserId: 2,
    debtorUserId: 1,
    amount: new Prisma.Decimal(1500.00),
    status: InvoiceStatus.PENDING,
    payment: null,
  };

  const mockCreatedPayment = {
    id: 1,
    invoiceId: 1,
    paymentDate: new Date('2024-01-15T10:00:00Z'),
    paymentMethod: PaymentMethod.PAYPAL,
    paymentReference: 'STRIPE-TXN-123456',
    receiptPdfUrl: mockReceiptPdfUrl,
    subject: 'Payment for web development services',
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
    invoice: {
      id: 1,
      invoiceNumber: 'INV-001',
      issuerUserId: 2,
      debtorUserId: 1,
      subject: 'Web Development',
      amount: new Prisma.Decimal(1500.00),
      status: InvoiceStatus.PENDING, // Will be updated to PAID in transaction
      issueDate: new Date('2024-01-01'),
      dueDate: new Date('2024-02-01'),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(cloudinaryLib.uploadPdf).mockResolvedValue({
      url: mockReceiptPdfUrl,
      publicId: mockPublicId,
    });
  });

  describe('Authentication', () => {
    it('should return 401 if not authenticated', async () => {
      const response = await testApiHandler({
        method: 'POST',
        url: '/api/payments',
        body: validPaymentData,
        userId: null,
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Successful Payment Creation', () => {
    it('should create a payment successfully for PENDING invoice', async () => {
      vi.spyOn(db.invoice, 'findUnique').mockResolvedValue(mockInvoice as any);
      vi.spyOn(db, '$transaction').mockImplementation(async (callback) => {
        return callback({
          payment: {
            create: vi.fn().mockResolvedValue(mockCreatedPayment),
          },
          invoice: {
            update: vi.fn().mockResolvedValue({ ...mockInvoice, status: InvoiceStatus.PAID }),
          },
        } as any);
      });

      const response = await testApiHandler({
        method: 'POST',
        url: '/api/payments',
        body: validPaymentData,
        userId: 1, // User 1 is the debtor
      });

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.id).toBeDefined();
      expect(data.paymentMethod).toBe(PaymentMethod.PAYPAL);
      expect(data.receiptPdfUrl).toBe(mockReceiptPdfUrl);
      expect(data.invoice.status).toBe(InvoiceStatus.PAID);

      expect(cloudinaryLib.uploadPdf).toHaveBeenCalledWith(validPaymentData.receiptPdf, 'ClutchPay/payment_receipts');
    });

    it('should create a payment for OVERDUE invoice', async () => {
      const overdueInvoice = { ...mockInvoice, status: InvoiceStatus.OVERDUE };
      vi.spyOn(db.invoice, 'findUnique').mockResolvedValue(overdueInvoice as any);
      vi.spyOn(db, '$transaction').mockImplementation(async (callback) => {
        return callback({
          payment: {
            create: vi.fn().mockResolvedValue({ ...mockCreatedPayment, invoice: { ...mockCreatedPayment.invoice, status: InvoiceStatus.OVERDUE } }),
          },
          invoice: {
            update: vi.fn().mockResolvedValue({ ...overdueInvoice, status: InvoiceStatus.PAID }),
          },
        } as any);
      });

      const response = await testApiHandler({
        method: 'POST',
        url: '/api/payments',
        body: validPaymentData,
        userId: 1,
      });

      expect(response.status).toBe(201);
    });

    it('should create a payment without optional paymentReference', async () => {
      const dataWithoutRef = { ...validPaymentData, paymentReference: undefined };
      vi.spyOn(db.invoice, 'findUnique').mockResolvedValue(mockInvoice as any);
      vi.spyOn(db, '$transaction').mockImplementation(async (callback) => {
        return callback({
          payment: {
            create: vi.fn().mockResolvedValue({ ...mockCreatedPayment, paymentReference: null }),
          },
          invoice: {
            update: vi.fn().mockResolvedValue({ ...mockInvoice, status: InvoiceStatus.PAID }),
          },
        } as any);
      });

      const response = await testApiHandler({
        method: 'POST',
        url: '/api/payments',
        body: dataWithoutRef,
        userId: 1,
      });

      expect(response.status).toBe(201);
    });
  });

  describe('Authorization Errors', () => {
    it('should return 403 if user is not the debtor of the invoice', async () => {
      vi.spyOn(db.invoice, 'findUnique').mockResolvedValue(mockInvoice as any);

      const response = await testApiHandler({
        method: 'POST',
        url: '/api/payments',
        body: validPaymentData,
        userId: 2, // User 2 is the issuer, not the debtor
      });

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.message).toBe('You can only pay invoices where you are the debtor');

      expect(cloudinaryLib.uploadPdf).not.toHaveBeenCalled();
    });

    it('should return 403 if user is neither debtor nor issuer', async () => {
      vi.spyOn(db.invoice, 'findUnique').mockResolvedValue(mockInvoice as any);

      const response = await testApiHandler({
        method: 'POST',
        url: '/api/payments',
        body: validPaymentData,
        userId: 3, // User 3 has no relation to the invoice
      });

      expect(response.status).toBe(403);
    });
  });

  describe('Invoice Validation Errors', () => {
    it('should return 404 if invoice does not exist', async () => {
      vi.spyOn(db.invoice, 'findUnique').mockResolvedValue(null);

      const response = await testApiHandler({
        method: 'POST',
        url: '/api/payments',
        body: validPaymentData,
        userId: 1,
      });

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.message).toBe('Invoice not found');

      expect(cloudinaryLib.uploadPdf).not.toHaveBeenCalled();
    });

    it('should return 400 if invoice is already paid', async () => {
      const paidInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.PAID,
        payment: { id: 1 }, // Has existing payment
      };
      vi.spyOn(db.invoice, 'findUnique').mockResolvedValue(paidInvoice as any);

      const response = await testApiHandler({
        method: 'POST',
        url: '/api/payments',
        body: validPaymentData,
        userId: 1,
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.message).toBe('This invoice has already been paid');

      expect(cloudinaryLib.uploadPdf).not.toHaveBeenCalled();
    });

    it('should return 400 if invoice is canceled', async () => {
      const canceledInvoice = { ...mockInvoice, status: InvoiceStatus.CANCELED };
      vi.spyOn(db.invoice, 'findUnique').mockResolvedValue(canceledInvoice as any);

      const response = await testApiHandler({
        method: 'POST',
        url: '/api/payments',
        body: validPaymentData,
        userId: 1,
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.message).toContain('Cannot pay an invoice with status: CANCELED');

      expect(cloudinaryLib.uploadPdf).not.toHaveBeenCalled();
    });
  });

  describe('Validation Errors', () => {
    it('should return 400 for missing invoiceId', async () => {
      const invalidData = { ...validPaymentData, invoiceId: undefined };

      const response = await testApiHandler({
        method: 'POST',
        url: '/api/payments',
        body: invalidData,
        userId: 1,
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid invoiceId', async () => {
      const invalidData = { ...validPaymentData, invoiceId: -1 };

      const response = await testApiHandler({
        method: 'POST',
        url: '/api/payments',
        body: invalidData,
        userId: 1,
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid payment method', async () => {
      const invalidData = { ...validPaymentData, paymentMethod: 'BITCOIN' };

      const response = await testApiHandler({
        method: 'POST',
        url: '/api/payments',
        body: invalidData,
        userId: 1,
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 for missing receiptPdf', async () => {
      const invalidData = { ...validPaymentData, receiptPdf: undefined };

      const response = await testApiHandler({
        method: 'POST',
        url: '/api/payments',
        body: invalidData,
        userId: 1,
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid receiptPdf format', async () => {
      const invalidData = { ...validPaymentData, receiptPdf: 'not-a-valid-base64-pdf' };

      const response = await testApiHandler({
        method: 'POST',
        url: '/api/payments',
        body: invalidData,
        userId: 1,
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 for subject exceeding max length', async () => {
      const invalidData = { ...validPaymentData, subject: 'a'.repeat(501) };

      const response = await testApiHandler({
        method: 'POST',
        url: '/api/payments',
        body: invalidData,
        userId: 1,
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Payment Methods', () => {
    const paymentMethods = [PaymentMethod.PAYPAL, PaymentMethod.VISA, PaymentMethod.MASTERCARD, PaymentMethod.OTHER];

    it.each(paymentMethods)('should accept %s as payment method', async (method) => {
      vi.spyOn(db.invoice, 'findUnique').mockResolvedValue(mockInvoice as any);
      vi.spyOn(db, '$transaction').mockImplementation(async (callback) => {
        return callback({
          payment: {
            create: vi.fn().mockResolvedValue({ ...mockCreatedPayment, paymentMethod: method }),
          },
          invoice: {
            update: vi.fn().mockResolvedValue({ ...mockInvoice, status: InvoiceStatus.PAID }),
          },
        } as any);
      });

      const response = await testApiHandler({
        method: 'POST',
        url: '/api/payments',
        body: { ...validPaymentData, paymentMethod: method },
        userId: 1,
      });

      expect(response.status).toBe(201);
    });
  });
});
