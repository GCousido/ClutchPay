// tests/libs/stripe.test.ts
import type Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Use vi.hoisted to create mocks that are available before vi.mock runs
const mockStripeApi = vi.hoisted(() => ({
  checkout: {
    sessions: {
      create: vi.fn(),
      retrieve: vi.fn(),
    },
  },
  webhooks: {
    constructEvent: vi.fn(),
  },
}));

// Mock Stripe constructor
vi.mock('stripe', () => {
  return {
    default: class MockStripe {
      checkout = mockStripeApi.checkout;
      webhooks = mockStripeApi.webhooks;
    },
  };
});

// Import after mocking
import {
    createCheckoutSession,
    fromCents,
    getCheckoutSession,
    mapSessionStatus,
    toCents,
    verifyWebhookSignature,
} from '../../src/libs/stripe';

describe('stripe library', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('toCents', () => {
    it('should convert number to cents', () => {
      expect(toCents(99.99)).toBe(9999);
      expect(toCents(100)).toBe(10000);
      expect(toCents(0.01)).toBe(1);
      expect(toCents(0)).toBe(0);
    });

    it('should convert string to cents', () => {
      expect(toCents('99.99')).toBe(9999);
      expect(toCents('100.00')).toBe(10000);
      expect(toCents('0.50')).toBe(50);
    });

    it('should round to nearest cent', () => {
      expect(toCents(99.999)).toBe(10000);
      expect(toCents(99.994)).toBe(9999);
    });
  });

  describe('fromCents', () => {
    it('should convert cents to decimal', () => {
      expect(fromCents(9999)).toBe(99.99);
      expect(fromCents(10000)).toBe(100);
      expect(fromCents(1)).toBe(0.01);
      expect(fromCents(0)).toBe(0);
    });
  });

  describe('mapSessionStatus', () => {
    it('should return completed for complete session with paid status', () => {
      const session = {
        status: 'complete',
        payment_status: 'paid',
      } as Stripe.Checkout.Session;

      expect(mapSessionStatus(session)).toBe('completed');
    });

    it('should return expired for expired session', () => {
      const session = {
        status: 'expired',
        payment_status: 'unpaid',
      } as Stripe.Checkout.Session;

      expect(mapSessionStatus(session)).toBe('expired');
    });

    it('should return pending for unpaid session', () => {
      const session = {
        status: 'open',
        payment_status: 'unpaid',
      } as Stripe.Checkout.Session;

      expect(mapSessionStatus(session)).toBe('pending');
    });

    it('should return completed for no_payment_required', () => {
      const session = {
        status: 'complete',
        payment_status: 'no_payment_required',
      } as Stripe.Checkout.Session;

      expect(mapSessionStatus(session)).toBe('completed');
    });

    it('should return processing as default', () => {
      const session = {
        status: 'complete',
        payment_status: 'processing' as any,
      } as Stripe.Checkout.Session;

      expect(mapSessionStatus(session)).toBe('processing');
    });
  });

  describe('createCheckoutSession', () => {
    it('should create a checkout session with correct parameters', async () => {
      const mockSession = {
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/pay/cs_test_123',
      };

      mockStripeApi.checkout.sessions.create.mockResolvedValue(mockSession);

      const result = await createCheckoutSession({
        invoiceId: 1,
        invoiceNumber: 'INV-001',
        amount: 9999,
        description: 'Test payment',
        payerId: 2,
        payerEmail: 'payer@test.com',
        receiverId: 1,
        receiverEmail: 'receiver@test.com',
      });

      expect(result).toEqual({
        sessionId: 'cs_test_123',
        checkoutUrl: 'https://checkout.stripe.com/pay/cs_test_123',
      });

      expect(mockStripeApi.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_method_types: ['paypal'],
          mode: 'payment',
          customer_email: 'payer@test.com',
          line_items: [
            expect.objectContaining({
              price_data: expect.objectContaining({
                currency: 'eur',
                unit_amount: 9999,
                product_data: expect.objectContaining({
                  name: 'Invoice INV-001',
                }),
              }),
              quantity: 1,
            }),
          ],
          metadata: expect.objectContaining({
            invoiceId: '1',
            payerId: '2',
            receiverId: '1',
          }),
        })
      );
    });

    it('should use custom currency when provided', async () => {
      const mockSession = {
        id: 'cs_test_456',
        url: 'https://checkout.stripe.com/pay/cs_test_456',
      };

      mockStripeApi.checkout.sessions.create.mockResolvedValue(mockSession);

      await createCheckoutSession({
        invoiceId: 1,
        invoiceNumber: 'INV-002',
        amount: 5000,
        currency: 'usd',
        description: 'USD payment',
        payerId: 2,
        payerEmail: 'payer@test.com',
        receiverId: 1,
        receiverEmail: 'receiver@test.com',
      });

      expect(mockStripeApi.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [
            expect.objectContaining({
              price_data: expect.objectContaining({
                currency: 'usd',
              }),
            }),
          ],
        })
      );
    });

    it('should use custom success and cancel URLs when provided', async () => {
      const mockSession = {
        id: 'cs_test_789',
        url: 'https://checkout.stripe.com/pay/cs_test_789',
      };

      mockStripeApi.checkout.sessions.create.mockResolvedValue(mockSession);

      await createCheckoutSession({
        invoiceId: 1,
        invoiceNumber: 'INV-003',
        amount: 1000,
        description: 'Custom URLs',
        payerId: 2,
        payerEmail: 'payer@test.com',
        receiverId: 1,
        receiverEmail: 'receiver@test.com',
        successUrl: 'https://myapp.com/success',
        cancelUrl: 'https://myapp.com/cancel',
      });

      expect(mockStripeApi.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          success_url: 'https://myapp.com/success',
          cancel_url: 'https://myapp.com/cancel',
        })
      );
    });

    it('should throw error when Stripe returns no URL', async () => {
      const mockSession = {
        id: 'cs_test_no_url',
        url: null,
      };

      mockStripeApi.checkout.sessions.create.mockResolvedValue(mockSession);

      await expect(
        createCheckoutSession({
          invoiceId: 1,
          invoiceNumber: 'INV-004',
          amount: 1000,
          description: 'No URL test',
          payerId: 2,
          payerEmail: 'payer@test.com',
          receiverId: 1,
          receiverEmail: 'receiver@test.com',
        })
      ).rejects.toThrow('Failed to create Stripe checkout session: No URL returned');
    });
  });

  describe('getCheckoutSession', () => {
    it('should retrieve session with expanded fields', async () => {
      const mockSession = {
        id: 'cs_test_retrieve',
        payment_intent: { id: 'pi_123' },
        line_items: { data: [] },
      };

      mockStripeApi.checkout.sessions.retrieve.mockResolvedValue(mockSession);

      const result = await getCheckoutSession('cs_test_retrieve');

      expect(result).toEqual(mockSession);
      expect(mockStripeApi.checkout.sessions.retrieve).toHaveBeenCalledWith(
        'cs_test_retrieve',
        { expand: ['payment_intent', 'line_items'] }
      );
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify webhook signature successfully', () => {
      const mockEvent = { type: 'test.event', data: {} };
      mockStripeApi.webhooks.constructEvent.mockReturnValue(mockEvent);

      // Set env variable for test
      const originalEnv = process.env.STRIPE_WEBHOOK_SECRET;
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123';

      try {
        const result = verifyWebhookSignature('payload', 'signature');
        expect(result).toEqual(mockEvent);
      } finally {
        process.env.STRIPE_WEBHOOK_SECRET = originalEnv;
      }
    });

    it('should throw when STRIPE_WEBHOOK_SECRET is not configured', () => {
      const originalEnv = process.env.STRIPE_WEBHOOK_SECRET;
      delete process.env.STRIPE_WEBHOOK_SECRET;

      try {
        expect(() => verifyWebhookSignature('payload', 'signature')).toThrow(
          'STRIPE_WEBHOOK_SECRET is not configured'
        );
      } finally {
        process.env.STRIPE_WEBHOOK_SECRET = originalEnv;
      }
    });
  });
});
