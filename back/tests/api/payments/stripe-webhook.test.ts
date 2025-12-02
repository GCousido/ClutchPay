// tests/api/payments/stripe-webhook.test.ts
import { InvoiceStatus, PaymentMethod } from '@prisma/client';
import type Stripe from 'stripe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../../src/libs/db';
import * as paypalLib from '../../../src/libs/paypal';
import * as stripeLib from '../../../src/libs/stripe';

// Mock Stripe library
vi.mock('../../../src/libs/stripe', () => ({
  verifyWebhookSignature: vi.fn(),
  fromCents: vi.fn((cents: number) => cents / 100),
}));

// Mock PayPal library
vi.mock('../../../src/libs/paypal', () => ({
  createPayPalPayout: vi.fn().mockResolvedValue({
    payoutBatchId: 'PAYOUT_TEST_123',
    status: 'PENDING',
  }),
}));

// Import route handler after mocking
import { POST } from '../../../src/app/api/payments/stripe/webhook/route';

describe('POST /api/payments/stripe/webhook', () => {
  const testUsers = [
    { id: 1, email: 'issuer@test.com', name: 'Issuer', surnames: 'User', password: 'hash1' },
    { id: 2, email: 'debtor@test.com', name: 'Debtor', surnames: 'User', password: 'hash2' },
  ];

  let testInvoice: any;

  const createCheckoutSession = (overrides = {}): Stripe.Checkout.Session => ({
    id: 'cs_test_webhook_123',
    object: 'checkout.session',
    payment_status: 'paid',
    status: 'complete',
    amount_total: 9999,
    currency: 'eur',
    payment_intent: 'pi_test_123',
    metadata: {
      invoiceId: testInvoice?.id?.toString() || '1',
      payerId: '2',
      receiverId: '1',
      invoiceNumber: 'INV-WEBHOOK-001',
      payerEmail: 'debtor@test.com',
      receiverEmail: 'issuer@test.com',
    },
    ...overrides,
  } as unknown as Stripe.Checkout.Session);

  const createEvent = (type: string, data: any): Stripe.Event => ({
    id: 'evt_test_123',
    object: 'event',
    type,
    data: { object: data },
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: { id: 'req_test', idempotency_key: null },
    api_version: '2023-10-16',
  } as Stripe.Event);

  beforeEach(async () => {
    // Create test users
    await db.user.createMany({ data: testUsers });

    // Create test invoice
    testInvoice = await db.invoice.create({
      data: {
        invoiceNumber: 'INV-WEBHOOK-001',
        issuerUserId: 1,
        debtorUserId: 2,
        subject: 'Test Invoice for Webhook',
        description: 'Payment for services',
        amount: 99.99,
        status: InvoiceStatus.PENDING,
        issueDate: new Date(),
        invoicePdfUrl: 'https://example.com/invoice.pdf',
      },
    });

    // Reset mocks
    vi.clearAllMocks();
    vi.mocked(paypalLib.createPayPalPayout).mockResolvedValue({
      payoutBatchId: 'PAYOUT_TEST_123',
      status: 'PENDING',
    });
  });

  afterEach(async () => {
    await db.payment.deleteMany({});
    await db.invoice.deleteMany({});
    await db.user.deleteMany({});
  });

  it('should return 400 when stripe-signature header is missing', async () => {
    const request = new Request('http://localhost:3000/api/payments/stripe/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Missing stripe-signature header');
  });

  it('should return 400 when signature verification fails', async () => {
    vi.mocked(stripeLib.verifyWebhookSignature).mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const request = new Request('http://localhost:3000/api/payments/stripe/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'invalid_signature',
      },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid signature');
  });

  it('should process checkout.session.completed event successfully', async () => {
    const session = createCheckoutSession({
      metadata: {
        invoiceId: testInvoice.id.toString(),
        payerId: '2',
        receiverId: '1',
        invoiceNumber: 'INV-WEBHOOK-001',
        payerEmail: 'debtor@test.com',
        receiverEmail: 'issuer@test.com',
      },
    });
    const event = createEvent('checkout.session.completed', session);

    vi.mocked(stripeLib.verifyWebhookSignature).mockReturnValue(event);

    const request = new Request('http://localhost:3000/api/payments/stripe/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'valid_signature',
      },
      body: JSON.stringify(event),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);

    // Verify payment was created
    const payment = await db.payment.findUnique({
      where: { invoiceId: testInvoice.id },
    });

    expect(payment).not.toBeNull();
    expect(payment?.paymentMethod).toBe(PaymentMethod.PAYPAL);
    // Payment reference now includes payout ID after processing
    expect(payment?.paymentReference).toContain('pi_test_123');

    // Verify invoice status was updated
    const invoice = await db.invoice.findUnique({
      where: { id: testInvoice.id },
    });

    expect(invoice?.status).toBe(InvoiceStatus.PAID);

    // Verify payout was initiated
    expect(paypalLib.createPayPalPayout).toHaveBeenCalledWith(
      expect.objectContaining({
        receiverEmail: 'issuer@test.com',
        invoiceNumber: 'INV-WEBHOOK-001',
      })
    );
  });

  it('should handle async_payment_succeeded event (PayPal confirmation)', async () => {
    const session = createCheckoutSession({
      metadata: {
        invoiceId: testInvoice.id.toString(),
        payerId: '2',
        receiverId: '1',
        invoiceNumber: 'INV-WEBHOOK-001',
        payerEmail: 'debtor@test.com',
        receiverEmail: 'issuer@test.com',
      },
    });
    const event = createEvent('checkout.session.async_payment_succeeded', session);

    vi.mocked(stripeLib.verifyWebhookSignature).mockReturnValue(event);

    const request = new Request('http://localhost:3000/api/payments/stripe/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'valid_signature',
      },
      body: JSON.stringify(event),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);

    // Verify payment was created
    const payment = await db.payment.findUnique({
      where: { invoiceId: testInvoice.id },
    });

    expect(payment).not.toBeNull();
  });

  it('should not create duplicate payments (idempotency)', async () => {
    // Create existing payment
    await db.payment.create({
      data: {
        invoiceId: testInvoice.id,
        paymentDate: new Date(),
        paymentMethod: PaymentMethod.PAYPAL,
        receiptPdfUrl: 'https://example.com/receipt.pdf',
        paymentReference: 'existing_payment',
      },
    });

    await db.invoice.update({
      where: { id: testInvoice.id },
      data: { status: InvoiceStatus.PAID },
    });

    const session = createCheckoutSession({
      metadata: {
        invoiceId: testInvoice.id.toString(),
        payerId: '2',
        receiverId: '1',
        invoiceNumber: 'INV-WEBHOOK-001',
        payerEmail: 'debtor@test.com',
        receiverEmail: 'issuer@test.com',
      },
    });
    const event = createEvent('checkout.session.completed', session);

    vi.mocked(stripeLib.verifyWebhookSignature).mockReturnValue(event);

    const request = new Request('http://localhost:3000/api/payments/stripe/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'valid_signature',
      },
      body: JSON.stringify(event),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);

    // Verify only one payment exists
    const payments = await db.payment.findMany({
      where: { invoiceId: testInvoice.id },
    });

    expect(payments.length).toBe(1);
    expect(payments[0].paymentReference).toBe('existing_payment');
  });

  it('should handle checkout.session.expired event gracefully', async () => {
    const session = createCheckoutSession({
      status: 'expired',
      payment_status: 'unpaid',
      metadata: {
        invoiceId: testInvoice.id.toString(),
        payerId: '2',
        receiverId: '1',
        invoiceNumber: 'INV-WEBHOOK-001',
        payerEmail: 'debtor@test.com',
        receiverEmail: 'issuer@test.com',
      },
    });
    const event = createEvent('checkout.session.expired', session);

    vi.mocked(stripeLib.verifyWebhookSignature).mockReturnValue(event);

    const request = new Request('http://localhost:3000/api/payments/stripe/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'valid_signature',
      },
      body: JSON.stringify(event),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);

    // Verify no payment was created
    const payment = await db.payment.findUnique({
      where: { invoiceId: testInvoice.id },
    });

    expect(payment).toBeNull();

    // Verify invoice status unchanged
    const invoice = await db.invoice.findUnique({
      where: { id: testInvoice.id },
    });

    expect(invoice?.status).toBe(InvoiceStatus.PENDING);
  });

  it('should handle async_payment_failed event gracefully', async () => {
    const session = createCheckoutSession({
      payment_status: 'unpaid',
      metadata: {
        invoiceId: testInvoice.id.toString(),
        payerId: '2',
        receiverId: '1',
        invoiceNumber: 'INV-WEBHOOK-001',
        payerEmail: 'debtor@test.com',
        receiverEmail: 'issuer@test.com',
      },
    });
    const event = createEvent('checkout.session.async_payment_failed', session);

    vi.mocked(stripeLib.verifyWebhookSignature).mockReturnValue(event);

    const request = new Request('http://localhost:3000/api/payments/stripe/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'valid_signature',
      },
      body: JSON.stringify(event),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);

    // Verify no payment was created
    const payment = await db.payment.findUnique({
      where: { invoiceId: testInvoice.id },
    });

    expect(payment).toBeNull();
  });

  it('should handle unrecognized event types gracefully', async () => {
    const event = createEvent('some.unhandled.event', { id: 'unknown' });

    vi.mocked(stripeLib.verifyWebhookSignature).mockReturnValue(event);

    const request = new Request('http://localhost:3000/api/payments/stripe/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'valid_signature',
      },
      body: JSON.stringify(event),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
  });

  it('should wait for async payment when checkout is complete but unpaid', async () => {
    const session = createCheckoutSession({
      payment_status: 'unpaid', // PayPal pending
      metadata: {
        invoiceId: testInvoice.id.toString(),
        payerId: '2',
        receiverId: '1',
        invoiceNumber: 'INV-WEBHOOK-001',
        payerEmail: 'debtor@test.com',
        receiverEmail: 'issuer@test.com',
      },
    });
    const event = createEvent('checkout.session.completed', session);

    vi.mocked(stripeLib.verifyWebhookSignature).mockReturnValue(event);

    const request = new Request('http://localhost:3000/api/payments/stripe/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'valid_signature',
      },
      body: JSON.stringify(event),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);

    // Verify no payment was created yet (waiting for async confirmation)
    const payment = await db.payment.findUnique({
      where: { invoiceId: testInvoice.id },
    });

    expect(payment).toBeNull();
  });

  it('should handle payout errors without failing the webhook', async () => {
    vi.mocked(paypalLib.createPayPalPayout).mockRejectedValue(
      new Error('PayPal API error')
    );

    const session = createCheckoutSession({
      metadata: {
        invoiceId: testInvoice.id.toString(),
        payerId: '2',
        receiverId: '1',
        invoiceNumber: 'INV-WEBHOOK-001',
        payerEmail: 'debtor@test.com',
        receiverEmail: 'issuer@test.com',
      },
    });
    const event = createEvent('checkout.session.completed', session);

    vi.mocked(stripeLib.verifyWebhookSignature).mockReturnValue(event);

    const request = new Request('http://localhost:3000/api/payments/stripe/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'valid_signature',
      },
      body: JSON.stringify(event),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);

    // Payment should still be created despite payout failure
    const payment = await db.payment.findUnique({
      where: { invoiceId: testInvoice.id },
    });

    expect(payment).not.toBeNull();
  });
});
