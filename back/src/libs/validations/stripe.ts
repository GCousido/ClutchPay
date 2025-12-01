// libs/validations/stripe.ts
import { z } from 'zod';

/**
 * Schema for creating a Stripe checkout session
 * Used when initiating a payment for an invoice through Stripe
 */
export const stripeCheckoutCreateSchema = z.object({
  invoiceId: z
    .number()
    .int('Invoice ID must be an integer')
    .positive('Invalid invoice ID'),
  successUrl: z
    .url('Success URL must be a valid URL')
    .optional(),
  cancelUrl: z
    .url('Cancel URL must be a valid URL')
    .optional(),
});

/**
 * Schema for retrieving Stripe session status
 */
export const stripeSessionQuerySchema = z.object({
  sessionId: z
    .string()
    .min(1, 'Session ID is required')
    .regex(/^cs_/, 'Invalid Stripe session ID format'),
});

/**
 * Schema for Stripe webhook events we handle
 */
export const stripeWebhookEventTypes = [
  'checkout.session.completed',
  'checkout.session.expired',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
] as const;

export type StripeWebhookEventType = typeof stripeWebhookEventTypes[number];

// TypeScript Types
export type StripeCheckoutCreateInput = z.infer<typeof stripeCheckoutCreateSchema>;
export type StripeSessionQueryInput = z.infer<typeof stripeSessionQuerySchema>;
