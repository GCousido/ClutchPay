// tests/libs/stripe-integration.test.ts
import Stripe from 'stripe';
import { beforeAll, describe, expect, it } from 'vitest';

const runIntegration =
  !!process.env.STRIPE_SECRET_KEY &&
  process.env.STRIPE_SECRET_KEY.startsWith('sk_test_') &&
  process.env.RUN_INTEGRATION_TESTS === 'true';

(runIntegration ? describe : describe.skip)('Stripe Integration (real)', () => {
  let stripe: Stripe;

  beforeAll(() => {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-02-24.acacia',
    });
  });

  it('verifies Stripe API key is valid and can retrieve account info', async () => {
    // Retrieve account information to verify authentication
    const account = await stripe.accounts.retrieve();

    expect(account).toHaveProperty('id');
    expect(account.object).toBe('account');
    expect(account).toHaveProperty('email');
    expect(account).toHaveProperty('country');
  }, 15_000);

  it('can create and cancel a test payment intent', async () => {
    const currency = process.env.STRIPE_CURRENCY || 'eur';
    
    // Create a test payment intent (safe in test mode)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1000, // $10.00 or €10.00
      currency,
      description: 'Integration test payment intent',
      metadata: {
        test: 'true',
        purpose: 'integration_testing',
      },
    });

    expect(paymentIntent).toHaveProperty('id');
    expect(paymentIntent.object).toBe('payment_intent');
    expect(paymentIntent.amount).toBe(1000);
    expect(paymentIntent.currency).toBe(currency.toLowerCase());
    expect(paymentIntent.status).toBe('requires_payment_method');

    // Cancel the payment intent (cleanup)
    const cancelled = await stripe.paymentIntents.cancel(paymentIntent.id);
    expect(cancelled.status).toBe('canceled');
  }, 15_000);

  it('can list products (verifies read access)', async () => {
    // List products to verify read access
    const products = await stripe.products.list({ limit: 1 });

    expect(products).toHaveProperty('object');
    expect(products.object).toBe('list');
    expect(products).toHaveProperty('data');
    expect(Array.isArray(products.data)).toBe(true);
  }, 15_000);
});
