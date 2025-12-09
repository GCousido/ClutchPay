// tests/api/payments/stripe-session.test.ts
import { InvoiceStatus, PaymentMethod } from '@prisma/client';
import type Stripe from 'stripe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../../src/libs/db';
import * as stripeLib from '../../../src/libs/stripe';
import { clearMockSession, setMockSession } from '../../setup';

// Mock Stripe library
vi.mock('../../../src/libs/stripe', () => ({
  getCheckoutSession: vi.fn(),
  mapSessionStatus: vi.fn(),
  fromCents: vi.fn((cents: number) => cents / 100),
}));

// Import route handler after mocking
import { GET } from '../../../src/app/api/payments/stripe/session/[sessionId]/route';

describe('GET /api/payments/stripe/session/:sessionId', () => {
  const testUsers = [
    { id: 1, email: 'issuer@test.com', name: 'Issuer', surnames: 'User', password: 'hash1' },
    { id: 2, email: 'debtor@test.com', name: 'Debtor', surnames: 'User', password: 'hash2' },
    { id: 3, email: 'other@test.com', name: 'Other', surnames: 'User', password: 'hash3' },
  ];

  let testInvoice: any;

  const createMockSession = (overrides = {}): Stripe.Checkout.Session => ({
    id: 'cs_test_session_123',
    object: 'checkout.session',
    payment_status: 'paid',
    status: 'complete',
    currency: 'eur',
    created: Math.floor(Date.now() / 1000),
    expires_at: Math.floor(Date.now() / 1000) + 1800,
    metadata: {
      invoiceId: testInvoice?.id?.toString() || '1',
      payerId: '2',
      receiverId: '1',
      invoiceNumber: 'INV-SESSION-001',
      payerEmail: 'debtor@test.com',
      receiverEmail: 'issuer@test.com',
    },
    line_items: {
      data: [{ amount_total: 9999 }],
    },
    ...overrides,
  } as unknown as Stripe.Checkout.Session);

  beforeEach(async () => {
    // Create test users
    await db.user.createMany({ data: testUsers });

    // Create test invoice
    testInvoice = await db.invoice.create({
      data: {
        invoiceNumber: 'INV-SESSION-001',
        issuerUserId: 1,
        debtorUserId: 2,
        subject: 'Test Invoice for Session',
        description: 'Payment for services',
        amount: 99.99,
        status: InvoiceStatus.PENDING,
        issueDate: new Date(),
        invoicePdfUrl: 'https://example.com/invoice.pdf',
      },
    });

    // Reset mocks
    vi.clearAllMocks();
    vi.mocked(stripeLib.mapSessionStatus).mockReturnValue('completed');
  });

  afterEach(async () => {
    clearMockSession();
    await db.payment.deleteMany({});
    await db.invoice.deleteMany({});
    await db.user.deleteMany({});
  });

  it('should return session details for the payer', async () => {
    setMockSession({ user: { id: 2, email: 'debtor@test.com' } });

    const mockSession = createMockSession({
      metadata: {
        invoiceId: testInvoice.id.toString(),
        payerId: '2',
        receiverId: '1',
        invoiceNumber: 'INV-SESSION-001',
        payerEmail: 'debtor@test.com',
        receiverEmail: 'issuer@test.com',
      },
    });
    vi.mocked(stripeLib.getCheckoutSession).mockResolvedValue(mockSession);

    const request = new Request('http://localhost:3000/api/payments/stripe/session/cs_test_session_123', {
      method: 'GET',
    });

    const response = await GET(request, { 
      params: Promise.resolve({ sessionId: 'cs_test_session_123' }) 
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessionId).toBe('cs_test_session_123');
    expect(data.status).toBe('completed');
    expect(data.amount).toBe(99.99);
    expect(data.currency).toBe('EUR');
    expect(data.invoice.invoiceNumber).toBe('INV-SESSION-001');
  });

  it('should return session details for the receiver', async () => {
    setMockSession({ user: { id: 1, email: 'issuer@test.com' } });

    const mockSession = createMockSession({
      metadata: {
        invoiceId: testInvoice.id.toString(),
        payerId: '2',
        receiverId: '1',
        invoiceNumber: 'INV-SESSION-001',
        payerEmail: 'debtor@test.com',
        receiverEmail: 'issuer@test.com',
      },
    });
    vi.mocked(stripeLib.getCheckoutSession).mockResolvedValue(mockSession);

    const request = new Request('http://localhost:3000/api/payments/stripe/session/cs_test_session_123', {
      method: 'GET',
    });

    const response = await GET(request, { 
      params: Promise.resolve({ sessionId: 'cs_test_session_123' }) 
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessionId).toBe('cs_test_session_123');
  });

  it('should return 401 when not authenticated', async () => {
    clearMockSession();

    const request = new Request('http://localhost:3000/api/payments/stripe/session/cs_test_123', {
      method: 'GET',
    });

    const response = await GET(request, { 
      params: Promise.resolve({ sessionId: 'cs_test_123' }) 
    });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 403 when user is not involved in the payment', async () => {
    setMockSession({ user: { id: 3, email: 'other@test.com' } });

    const mockSession = createMockSession({
      metadata: {
        invoiceId: testInvoice.id.toString(),
        payerId: '2',
        receiverId: '1',
        invoiceNumber: 'INV-SESSION-001',
        payerEmail: 'debtor@test.com',
        receiverEmail: 'issuer@test.com',
      },
    });
    vi.mocked(stripeLib.getCheckoutSession).mockResolvedValue(mockSession);

    const request = new Request('http://localhost:3000/api/payments/stripe/session/cs_test_123', {
      method: 'GET',
    });

    const response = await GET(request, { 
      params: Promise.resolve({ sessionId: 'cs_test_123' }) 
    });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.message).toBe('You are not authorized to view this payment session');
  });

  it('should return 400 for invalid session ID format', async () => {
    setMockSession({ user: { id: 2, email: 'debtor@test.com' } });

    const request = new Request('http://localhost:3000/api/payments/stripe/session/invalid_id', {
      method: 'GET',
    });

    const response = await GET(request, { 
      params: Promise.resolve({ sessionId: 'invalid_id' }) 
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe('Invalid session ID format');
  });

  it('should return 400 when session has no metadata', async () => {
    setMockSession({ user: { id: 2, email: 'debtor@test.com' } });

    const mockSession = createMockSession({
      metadata: {},
    });
    vi.mocked(stripeLib.getCheckoutSession).mockResolvedValue(mockSession);

    const request = new Request('http://localhost:3000/api/payments/stripe/session/cs_test_no_meta', {
      method: 'GET',
    });

    const response = await GET(request, { 
      params: Promise.resolve({ sessionId: 'cs_test_no_meta' }) 
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe('Session metadata is missing');
  });

  it('should return 404 when session is not found in Stripe', async () => {
    setMockSession({ user: { id: 2, email: 'debtor@test.com' } });

    vi.mocked(stripeLib.getCheckoutSession).mockRejectedValue(
      new Error('No such checkout.session: cs_test_not_found')
    );

    const request = new Request('http://localhost:3000/api/payments/stripe/session/cs_test_not_found', {
      method: 'GET',
    });

    const response = await GET(request, { 
      params: Promise.resolve({ sessionId: 'cs_test_not_found' }) 
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.message).toBe('Checkout session not found');
  });

  it('should include payment details when invoice is already paid', async () => {
    // Create payment
    await db.payment.create({
      data: {
        invoiceId: testInvoice.id,
        paymentDate: new Date(),
        paymentMethod: PaymentMethod.PAYPAL,
        receiptPdfUrl: 'https://example.com/receipt.pdf',
        paymentReference: 'stripe_pi_123',
      },
    });

    await db.invoice.update({
      where: { id: testInvoice.id },
      data: { status: InvoiceStatus.PAID },
    });

    setMockSession({ user: { id: 2, email: 'debtor@test.com' } });

    const mockSession = createMockSession({
      metadata: {
        invoiceId: testInvoice.id.toString(),
        payerId: '2',
        receiverId: '1',
        invoiceNumber: 'INV-SESSION-001',
        payerEmail: 'debtor@test.com',
        receiverEmail: 'issuer@test.com',
      },
    });
    vi.mocked(stripeLib.getCheckoutSession).mockResolvedValue(mockSession);

    const request = new Request('http://localhost:3000/api/payments/stripe/session/cs_test_paid', {
      method: 'GET',
    });

    const response = await GET(request, { 
      params: Promise.resolve({ sessionId: 'cs_test_paid' }) 
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.invoice.status).toBe(InvoiceStatus.PAID);
    expect(data.invoice.payment).toBeDefined();
    expect(data.invoice.payment.paymentReference).toBe('stripe_pi_123');
  });

  it('should handle different session statuses correctly', async () => {
    setMockSession({ user: { id: 2, email: 'debtor@test.com' } });

    vi.mocked(stripeLib.mapSessionStatus).mockReturnValue('pending');

    const mockSession = createMockSession({
      payment_status: 'unpaid',
      status: 'open',
      metadata: {
        invoiceId: testInvoice.id.toString(),
        payerId: '2',
        receiverId: '1',
        invoiceNumber: 'INV-SESSION-001',
        payerEmail: 'debtor@test.com',
        receiverEmail: 'issuer@test.com',
      },
    });
    vi.mocked(stripeLib.getCheckoutSession).mockResolvedValue(mockSession);

    const request = new Request('http://localhost:3000/api/payments/stripe/session/cs_test_pending', {
      method: 'GET',
    });

    const response = await GET(request, { 
      params: Promise.resolve({ sessionId: 'cs_test_pending' }) 
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('pending');
    expect(data.paymentStatus).toBe('unpaid');
  });
});
