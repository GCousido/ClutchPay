// tests/api/invoices/invoices-list.test.ts
import { db } from '@/libs/db';
import { InvoiceStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { testApiHandler } from '../../helpers/request';

// Mock database
vi.mock('@/libs/db', () => ({
  db: {
    invoice: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe('GET /api/invoices - Invoice List', () => {
  const mockInvoices = [
    {
      id: 1,
      invoiceNumber: 'INV-001',
      issuerUserId: 1,
      debtorUserId: 2,
      subject: 'Website Development Services',
      description: 'Full stack web development for company website',
      amount: new Decimal('1500.00'),
      status: InvoiceStatus.PENDING,
      issueDate: new Date('2024-01-15'),
      dueDate: new Date('2024-02-15'),
      invoicePdfUrl: 'https://res.cloudinary.com/test/raw/upload/v123/ClutchPay/invoices/inv001.pdf',
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-15'),
    },
    {
      id: 2,
      invoiceNumber: 'INV-002',
      issuerUserId: 1,
      debtorUserId: 3,
      subject: 'Consulting Services',
      description: 'IT consulting and advisory services',
      amount: new Decimal('2500.00'),
      status: InvoiceStatus.PAID,
      issueDate: new Date('2024-01-10'),
      dueDate: new Date('2024-02-10'),
      invoicePdfUrl: 'https://res.cloudinary.com/test/raw/upload/v123/ClutchPay/invoices/inv002.pdf',
      createdAt: new Date('2024-01-10'),
      updatedAt: new Date('2024-01-20'),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return invoices where user is issuer', async () => {
    vi.spyOn(db.invoice, 'count').mockResolvedValue(2);
    vi.spyOn(db.invoice, 'findMany').mockResolvedValue(mockInvoices);

    const response = await testApiHandler({
      method: 'GET',
      url: '/api/invoices?role=issuer',
      userId: 1,
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.meta.total).toBe(2);
    expect(data.data).toHaveLength(2);
    expect(data.data[0].invoiceNumber).toBe('INV-001');
    
    expect(db.invoice.count).toHaveBeenCalledWith({
      where: { issuerUserId: 1 },
    });
  });

  it('should return invoices where user is debtor', async () => {
    const debtorInvoices = [
      {
        ...mockInvoices[0],
        issuerUserId: 3,
        debtorUserId: 1,
      },
    ];

    vi.spyOn(db.invoice, 'count').mockResolvedValue(1);
    vi.spyOn(db.invoice, 'findMany').mockResolvedValue(debtorInvoices);

    const response = await testApiHandler({
      method: 'GET',
      url: '/api/invoices?role=debtor',
      userId: 1,
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.meta.total).toBe(1);
    
    expect(db.invoice.count).toHaveBeenCalledWith({
      where: { debtorUserId: 1 },
    });
  });

  it('should filter by status', async () => {
    const pendingInvoices = [mockInvoices[0]];

    vi.spyOn(db.invoice, 'count').mockResolvedValue(1);
    vi.spyOn(db.invoice, 'findMany').mockResolvedValue(pendingInvoices);

    const response = await testApiHandler({
      method: 'GET',
      url: '/api/invoices?role=issuer&status=PENDING',
      userId: 1,
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data).toHaveLength(1);
    expect(data.data[0].status).toBe('PENDING');
    
    expect(db.invoice.count).toHaveBeenCalledWith({
      where: {
        issuerUserId: 1,
        status: InvoiceStatus.PENDING,
      },
    });
  });

  it('should filter by subject', async () => {
    vi.spyOn(db.invoice, 'count').mockResolvedValue(1);
    vi.spyOn(db.invoice, 'findMany').mockResolvedValue([mockInvoices[0]]);

    const response = await testApiHandler({
      method: 'GET',
      url: '/api/invoices?role=issuer&subject=Website',
      userId: 1,
    });

    expect(response.status).toBe(200);

    expect(db.invoice.count).toHaveBeenCalledWith({
      where: {
        issuerUserId: 1,
        subject: { contains: 'Website', mode: 'insensitive' },
      },
    });
  });

  it('should filter by amount range', async () => {
    vi.spyOn(db.invoice, 'count').mockResolvedValue(1);
    vi.spyOn(db.invoice, 'findMany').mockResolvedValue([mockInvoices[0]]);

    const response = await testApiHandler({
      method: 'GET',
      url: '/api/invoices?role=issuer&minAmount=1000&maxAmount=2000',
      userId: 1,
    });

    expect(response.status).toBe(200);

    expect(db.invoice.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          amount: expect.objectContaining({
            gte: expect.any(Object),
            lte: expect.any(Object),
          }),
        }),
      })
    );
  });

  it('should handle pagination correctly', async () => {
    vi.spyOn(db.invoice, 'count').mockResolvedValue(25);
    vi.spyOn(db.invoice, 'findMany').mockResolvedValue([mockInvoices[0]]);

    const response = await testApiHandler({
      method: 'GET',
      url: '/api/invoices?role=issuer&page=2&limit=10',
      userId: 1,
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.meta.page).toBe(2);
    expect(data.meta.limit).toBe(10);
    expect(data.meta.totalPages).toBe(3);
    expect(data.meta.nextPage).toBe(3);
    expect(data.meta.prevPage).toBe(1);
    
    expect(db.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
      })
    );
  });

  it('should require authentication', async () => {
    const response = await testApiHandler({
      method: 'GET',
      url: '/api/invoices?role=issuer',
      userId: null,
    });

    expect(response.status).toBe(401);
  });

  it('should sort by issueDate descending by default', async () => {
    vi.spyOn(db.invoice, 'count').mockResolvedValue(2);
    vi.spyOn(db.invoice, 'findMany').mockResolvedValue(mockInvoices);

    await testApiHandler({
      method: 'GET',
      url: '/api/invoices?role=issuer',
      userId: 1,
    });

    expect(db.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { issueDate: 'desc' },
      })
    );
  });

  it('should apply custom sorting', async () => {
    vi.spyOn(db.invoice, 'count').mockResolvedValue(2);
    vi.spyOn(db.invoice, 'findMany').mockResolvedValue(mockInvoices);

    await testApiHandler({
      method: 'GET',
      url: '/api/invoices?role=issuer&sortBy=dueDate&sortOrder=asc',
      userId: 1,
    });

    expect(db.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { dueDate: 'asc' },
      })
    );
  });
});
