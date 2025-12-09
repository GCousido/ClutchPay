// tests/api/payments/stripe-checkout.test.ts
import { InvoiceStatus } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../../src/libs/db';
import * as stripeLib from '../../../src/libs/stripe';
import { clearMockSession, setMockSession } from '../../setup';

// Mock Stripe library
vi.mock('../../../src/libs/stripe', () => ({
  createCheckoutSession: vi.fn(),
  toCents: vi.fn((amount: number | string) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return Math.round(numAmount * 100);
  }),
}));

// Import route handler after mocking
import { POST } from '../../../src/app/api/payments/stripe/checkout/route';

describe('POST /api/payments/stripe/checkout', () => {
  const testUsers = [
    { id: 1, email: 'issuer@test.com', name: 'Issuer', surnames: 'User', password: 'hash1' },
    { id: 2, email: 'debtor@test.com', name: 'Debtor', surnames: 'User', password: 'hash2' },
    { id: 3, email: 'other@test.com', name: 'Other', surnames: 'User', password: 'hash3' },
  ];

  let testInvoice: any;

  beforeEach(async () => {
    // Create test users
    await db.user.createMany({ data: testUsers });

    // Create test invoice
    testInvoice = await db.invoice.create({
      data: {
        invoiceNumber: 'INV-STRIPE-001',
        issuerUserId: 1,
        debtorUserId: 2,
        subject: 'Test Invoice for Stripe',
        description: 'Payment for services',
        amount: 99.99,
        status: InvoiceStatus.PENDING,
        issueDate: new Date(),
        invoicePdfUrl: 'https://example.com/invoice.pdf',
      },
    });

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    clearMockSession();
    await db.payment.deleteMany({});
    await db.invoice.deleteMany({});
    await db.user.deleteMany({});
  });

  it('should create checkout session for valid invoice', async () => {
    setMockSession({ user: { id: 2, email: 'debtor@test.com' } });

    vi.mocked(stripeLib.createCheckoutSession).mockResolvedValue({
      sessionId: 'cs_test_123',
      checkoutUrl: 'https://checkout.stripe.com/pay/cs_test_123',
    });

    const request = new Request('http://localhost:3000/api/payments/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId: testInvoice.id }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.sessionId).toBe('cs_test_123');
    expect(data.checkoutUrl).toBe('https://checkout.stripe.com/pay/cs_test_123');
    expect(data.invoice.invoiceNumber).toBe('INV-STRIPE-001');

    expect(stripeLib.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceId: testInvoice.id,
        invoiceNumber: 'INV-STRIPE-001',
        amount: 9999, // 99.99 * 100
        payerId: 2,
        payerEmail: 'debtor@test.com',
        receiverId: 1,
        receiverEmail: 'issuer@test.com',
      })
    );
  });

  it('should accept custom success and cancel URLs', async () => {
    setMockSession({ user: { id: 2, email: 'debtor@test.com' } });

    vi.mocked(stripeLib.createCheckoutSession).mockResolvedValue({
      sessionId: 'cs_test_456',
      checkoutUrl: 'https://checkout.stripe.com/pay/cs_test_456',
    });

    const request = new Request('http://localhost:3000/api/payments/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceId: testInvoice.id,
        successUrl: 'https://myapp.com/success',
        cancelUrl: 'https://myapp.com/cancel',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(stripeLib.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        successUrl: 'https://myapp.com/success',
        cancelUrl: 'https://myapp.com/cancel',
      })
    );
  });

  it('should return 401 when not authenticated', async () => {
    clearMockSession();

    const request = new Request('http://localhost:3000/api/payments/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId: testInvoice.id }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 404 when invoice not found', async () => {
    setMockSession({ user: { id: 2, email: 'debtor@test.com' } });

    const request = new Request('http://localhost:3000/api/payments/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId: 99999 }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.message).toBe('Invoice not found');
  });

  it('should return 403 when user is not the debtor', async () => {
    setMockSession({ user: { id: 3, email: 'other@test.com' } });

    const request = new Request('http://localhost:3000/api/payments/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId: testInvoice.id }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.message).toBe('You can only pay invoices where you are the debtor');
  });

  it('should return 403 when issuer tries to pay own invoice', async () => {
    setMockSession({ user: { id: 1, email: 'issuer@test.com' } });

    const request = new Request('http://localhost:3000/api/payments/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId: testInvoice.id }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.message).toBe('You can only pay invoices where you are the debtor');
  });

  it('should return 400 when invoice is already paid', async () => {
    // Create payment for the invoice
    await db.payment.create({
      data: {
        invoiceId: testInvoice.id,
        paymentDate: new Date(),
        paymentMethod: 'PAYPAL',
        receiptPdfUrl: 'https://example.com/receipt.pdf',
      },
    });

    setMockSession({ user: { id: 2, email: 'debtor@test.com' } });

    const request = new Request('http://localhost:3000/api/payments/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId: testInvoice.id }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe('This invoice has already been paid');
  });

  it('should return 400 when invoice is canceled', async () => {
    await db.invoice.update({
      where: { id: testInvoice.id },
      data: { status: InvoiceStatus.CANCELED },
    });

    setMockSession({ user: { id: 2, email: 'debtor@test.com' } });

    const request = new Request('http://localhost:3000/api/payments/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId: testInvoice.id }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toContain('Cannot pay an invoice with status: CANCELED');
  });

  it('should allow payment for OVERDUE invoices', async () => {
    await db.invoice.update({
      where: { id: testInvoice.id },
      data: { status: InvoiceStatus.OVERDUE },
    });

    setMockSession({ user: { id: 2, email: 'debtor@test.com' } });

    vi.mocked(stripeLib.createCheckoutSession).mockResolvedValue({
      sessionId: 'cs_test_overdue',
      checkoutUrl: 'https://checkout.stripe.com/pay/cs_test_overdue',
    });

    const request = new Request('http://localhost:3000/api/payments/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId: testInvoice.id }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.sessionId).toBe('cs_test_overdue');
  });

  it('should return 400 for invalid invoiceId format', async () => {
    setMockSession({ user: { id: 2, email: 'debtor@test.com' } });

    const request = new Request('http://localhost:3000/api/payments/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId: 'invalid' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toBeDefined();
  });

  it('should return 400 for negative invoiceId', async () => {
    setMockSession({ user: { id: 2, email: 'debtor@test.com' } });

    const request = new Request('http://localhost:3000/api/payments/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId: -1 }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toBeDefined();
  });

  it('should return 400 for invalid success URL', async () => {
    setMockSession({ user: { id: 2, email: 'debtor@test.com' } });

    const request = new Request('http://localhost:3000/api/payments/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceId: testInvoice.id,
        successUrl: 'not-a-valid-url',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toBeDefined();
  });

  it('should handle Stripe API errors gracefully', async () => {
    setMockSession({ user: { id: 2, email: 'debtor@test.com' } });

    vi.mocked(stripeLib.createCheckoutSession).mockRejectedValue(
      new Error('Stripe API error: rate limit exceeded')
    );

    const request = new Request('http://localhost:3000/api/payments/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId: testInvoice.id }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('Stripe API error');
  });
});
