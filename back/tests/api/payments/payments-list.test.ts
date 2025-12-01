// tests/api/payments/payments-list.test.ts
import { db } from '@/libs/db';
import { InvoiceStatus, PaymentMethod, Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { testApiHandler } from '../../helpers/request';

// Mock database
vi.mock('@/libs/db', () => ({
  db: {
    payment: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe('GET /api/payments - List Payments', () => {
  const mockPayments = [
    {
      id: 1,
      invoiceId: 1,
      paymentDate: new Date('2024-01-15T10:00:00Z'),
      paymentMethod: PaymentMethod.PAYPAL,
      paymentReference: 'PAY-001',
      receiptPdfUrl: 'https://res.cloudinary.com/test/raw/upload/ClutchPay/invoices/receipt1.pdf',
      subject: 'Payment for services',
      createdAt: new Date('2024-01-15T10:00:00Z'),
      updatedAt: new Date('2024-01-15T10:00:00Z'),
      invoice: {
        id: 1,
        invoiceNumber: 'INV-001',
        issuerUserId: 2,
        debtorUserId: 1,
        subject: 'Web Development',
        amount: new Prisma.Decimal(1500.00),
        status: InvoiceStatus.PAID,
        issueDate: new Date('2024-01-01'),
        dueDate: new Date('2024-02-01'),
      },
    },
    {
      id: 2,
      invoiceId: 2,
      paymentDate: new Date('2024-01-20T14:00:00Z'),
      paymentMethod: PaymentMethod.VISA,
      paymentReference: 'PAY-002',
      receiptPdfUrl: 'https://res.cloudinary.com/test/raw/upload/ClutchPay/invoices/receipt2.pdf',
      subject: 'Consulting fee payment',
      createdAt: new Date('2024-01-20T14:00:00Z'),
      updatedAt: new Date('2024-01-20T14:00:00Z'),
      invoice: {
        id: 2,
        invoiceNumber: 'INV-002',
        issuerUserId: 3,
        debtorUserId: 1,
        subject: 'Consulting Services',
        amount: new Prisma.Decimal(2500.00),
        status: InvoiceStatus.PAID,
        issueDate: new Date('2024-01-10'),
        dueDate: new Date('2024-02-10'),
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 if not authenticated', async () => {
      const response = await testApiHandler({
        method: 'GET',
        url: '/api/payments',
        userId: null,
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Basic Listing', () => {
    it('should return paginated list of payments as payer (default role)', async () => {
      vi.spyOn(db.payment, 'count').mockResolvedValue(2);
      vi.spyOn(db.payment, 'findMany').mockResolvedValue(mockPayments as any);

      const response = await testApiHandler({
        method: 'GET',
        url: '/api/payments',
        userId: 1,
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.meta).toBeDefined();
      expect(data.meta.total).toBe(2);
      expect(data.data).toHaveLength(2);
      expect(data.data[0].invoice).toBeDefined();
    });

    it('should return payments as receiver when role=receiver', async () => {
      vi.spyOn(db.payment, 'count').mockResolvedValue(1);
      vi.spyOn(db.payment, 'findMany').mockResolvedValue([mockPayments[0]] as any);

      const response = await testApiHandler({
        method: 'GET',
        url: '/api/payments?role=receiver',
        userId: 2, // User 2 is the issuer of invoice 1
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data).toHaveLength(1);
    });

    it('should return empty list when no payments exist', async () => {
      vi.spyOn(db.payment, 'count').mockResolvedValue(0);
      vi.spyOn(db.payment, 'findMany').mockResolvedValue([]);

      const response = await testApiHandler({
        method: 'GET',
        url: '/api/payments',
        userId: 1,
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.meta.total).toBe(0);
      expect(data.data).toHaveLength(0);
    });
  });

  describe('Filtering', () => {
    it('should filter by payment method', async () => {
      vi.spyOn(db.payment, 'count').mockResolvedValue(1);
      vi.spyOn(db.payment, 'findMany').mockResolvedValue([mockPayments[0]] as any);

      const response = await testApiHandler({
        method: 'GET',
        url: '/api/payments?paymentMethod=PAYPAL',
        userId: 1,
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data).toHaveLength(1);
      expect(data.data[0].paymentMethod).toBe(PaymentMethod.PAYPAL);
    });

    it('should filter by minimum amount', async () => {
      vi.spyOn(db.payment, 'count').mockResolvedValue(1);
      vi.spyOn(db.payment, 'findMany').mockResolvedValue([mockPayments[1]] as any);

      const response = await testApiHandler({
        method: 'GET',
        url: '/api/payments?minAmount=2000',
        userId: 1,
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data).toHaveLength(1);
    });

    it('should filter by maximum amount', async () => {
      vi.spyOn(db.payment, 'count').mockResolvedValue(1);
      vi.spyOn(db.payment, 'findMany').mockResolvedValue([mockPayments[0]] as any);

      const response = await testApiHandler({
        method: 'GET',
        url: '/api/payments?maxAmount=2000',
        userId: 1,
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data).toHaveLength(1);
    });

    it('should filter by amount range', async () => {
      vi.spyOn(db.payment, 'count').mockResolvedValue(2);
      vi.spyOn(db.payment, 'findMany').mockResolvedValue(mockPayments as any);

      const response = await testApiHandler({
        method: 'GET',
        url: '/api/payments?minAmount=1000&maxAmount=3000',
        userId: 1,
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data).toHaveLength(2);
    });

    it('should filter by payment date from', async () => {
      vi.spyOn(db.payment, 'count').mockResolvedValue(1);
      vi.spyOn(db.payment, 'findMany').mockResolvedValue([mockPayments[1]] as any);

      const response = await testApiHandler({
        method: 'GET',
        url: '/api/payments?paymentDateFrom=2024-01-16T00:00:00Z',
        userId: 1,
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data).toHaveLength(1);
    });

    it('should filter by payment date range', async () => {
      vi.spyOn(db.payment, 'count').mockResolvedValue(2);
      vi.spyOn(db.payment, 'findMany').mockResolvedValue(mockPayments as any);

      const response = await testApiHandler({
        method: 'GET',
        url: '/api/payments?paymentDateFrom=2024-01-01T00:00:00Z&paymentDateTo=2024-01-31T23:59:59Z',
        userId: 1,
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data).toHaveLength(2);
    });
  });

  describe('Validation Errors', () => {
    it('should return 400 for invalid payment method', async () => {
      const response = await testApiHandler({
        method: 'GET',
        url: '/api/payments?paymentMethod=INVALID',
        userId: 1,
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 when minAmount is greater than maxAmount', async () => {
      const response = await testApiHandler({
        method: 'GET',
        url: '/api/payments?minAmount=3000&maxAmount=1000',
        userId: 1,
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.errors).toBeDefined();
    });

    it('should return 400 when paymentDateFrom is after paymentDateTo', async () => {
      const response = await testApiHandler({
        method: 'GET',
        url: '/api/payments?paymentDateFrom=2024-02-01T00:00:00Z&paymentDateTo=2024-01-01T00:00:00Z',
        userId: 1,
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.errors).toBeDefined();
    });

    it('should return 400 for invalid role', async () => {
      const response = await testApiHandler({
        method: 'GET',
        url: '/api/payments?role=invalid',
        userId: 1,
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Pagination', () => {
    it('should respect pagination parameters', async () => {
      vi.spyOn(db.payment, 'count').mockResolvedValue(10);
      vi.spyOn(db.payment, 'findMany').mockResolvedValue([mockPayments[0]] as any);

      const response = await testApiHandler({
        method: 'GET',
        url: '/api/payments?page=2&limit=1',
        userId: 1,
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.meta.page).toBe(2);
      expect(data.meta.limit).toBe(1);
      expect(data.meta.total).toBe(10);
      expect(data.meta.totalPages).toBe(10);
      expect(data.meta.prevPage).toBe(1);
      expect(data.meta.nextPage).toBe(3);
    });

    it('should use default pagination when not provided', async () => {
      vi.spyOn(db.payment, 'count').mockResolvedValue(2);
      vi.spyOn(db.payment, 'findMany').mockResolvedValue(mockPayments as any);

      const response = await testApiHandler({
        method: 'GET',
        url: '/api/payments',
        userId: 1,
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.meta.page).toBe(1);
      expect(data.meta.limit).toBe(10);
    });
  });

  describe('Sorting', () => {
    it('should sort by paymentDate desc by default', async () => {
      vi.spyOn(db.payment, 'count').mockResolvedValue(2);
      vi.spyOn(db.payment, 'findMany').mockResolvedValue(mockPayments as any);

      const response = await testApiHandler({
        method: 'GET',
        url: '/api/payments',
        userId: 1,
      });

      expect(response.status).toBe(200);
      expect(db.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { paymentDate: 'desc' },
        })
      );
    });

    it('should allow sorting by createdAt ascending', async () => {
      vi.spyOn(db.payment, 'count').mockResolvedValue(2);
      vi.spyOn(db.payment, 'findMany').mockResolvedValue(mockPayments as any);

      const response = await testApiHandler({
        method: 'GET',
        url: '/api/payments?sortBy=createdAt&sortOrder=asc',
        userId: 1,
      });

      expect(response.status).toBe(200);
      expect(db.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'asc' },
        })
      );
    });
  });
});
