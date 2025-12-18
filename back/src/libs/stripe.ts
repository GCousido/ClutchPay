// libs/stripe.ts
import { InternalServerError } from '@/libs/api-helpers';
import { logger } from '@/libs/logger';
import Stripe from 'stripe';

/**
 * Stripe client instance configured with API key from environment variables.
 * 
 * Required environment variables:
 * - STRIPE_SECRET_KEY: Your Stripe secret API key
 * - STRIPE_WEBHOOK_SECRET: Webhook signing secret for verifying events
 * - NEXT_PUBLIC_APP_URL: Base URL of the application (for redirect URLs)
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover',
  typescript: true,
});

/**
 * Status of a Stripe payment session
 */
export type StripeSessionStatus = 
  | 'pending'      // Session created, awaiting payment
  | 'processing'   // Payment being processed
  | 'completed'    // Payment successful
  | 'failed'       // Payment failed
  | 'expired'      // Session expired without payment
  | 'canceled';    // User canceled the payment

/**
 * Metadata stored in Stripe session for payment tracking
 */
export interface StripePaymentMetadata {
  invoiceId: string;
  payerId: string;
  receiverId: string;
  invoiceNumber: string;
  payerEmail: string;
  receiverEmail: string;
}

/**
 * Result of creating a checkout session
 */
export interface CreateCheckoutSessionResult {
  sessionId: string;
  checkoutUrl: string;
}

/**
 * Creates a Stripe Checkout session for invoice payment
 * 
 * Flow: Payer (PayPal) → Stripe → Receiver (PayPal)
 * Currently only supports PayPal as payment method on both ends
 * 
 * @param params - Parameters for creating the checkout session
 * @param params.invoiceId - ID of the invoice being paid
 * @param params.invoiceNumber - Human-readable invoice number
 * @param params.amount - Amount in the smallest currency unit (cents for USD)
 * @param params.currency - Three-letter ISO currency code (default: 'eur')
 * @param params.description - Description shown to the payer
 * @param params.payerId - ID of the user making the payment
 * @param params.payerEmail - Email of the payer
 * @param params.receiverId - ID of the user receiving the payment (invoice issuer)
 * @param params.receiverEmail - Email of the receiver
 * @param params.successUrl - URL to redirect after successful payment
 * @param params.cancelUrl - URL to redirect if payment is canceled
 * @returns Promise with session ID and checkout URL
 */
export async function createCheckoutSession(params: {
  invoiceId: number;
  invoiceNumber: string;
  amount: number;
  currency?: string;
  description: string;
  payerId: number;
  payerEmail: string;
  receiverId: number;
  receiverEmail: string;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<CreateCheckoutSessionResult> {
  const {
    invoiceId,
    invoiceNumber,
    amount,
    currency = 'eur',
    description,
    payerId,
    payerEmail,
    receiverId,
    receiverEmail,
    successUrl,
    cancelUrl,
  } = params;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  logger.debug('Stripe', 'Creating checkout session', { invoiceId, invoiceNumber, amount, currency, payerId, receiverId });

  // Create Stripe Checkout Session
  // Currently configured to use PayPal as the only payment method
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['paypal'],
    mode: 'payment',
    customer_email: payerEmail,
    line_items: [
      {
        price_data: {
          currency,
          product_data: {
            name: `Invoice ${invoiceNumber}`,
            description,
          },
          unit_amount: amount, // Amount in cents
        },
        quantity: 1,
      },
    ],
    metadata: {
      invoiceId: invoiceId.toString(),
      payerId: payerId.toString(),
      receiverId: receiverId.toString(),
      invoiceNumber,
      payerEmail,
      receiverEmail,
    } satisfies StripePaymentMetadata,
    success_url: successUrl || `${baseUrl}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl || `${baseUrl}/payments/cancel?invoice_id=${invoiceId}`,
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes
  });

  if (!session.url) {
    // Error will be logged by handleError when caught in the API route
    throw new InternalServerError('Failed to create Stripe checkout session: No URL returned');
  }

  logger.debug('Stripe', 'Checkout session created', { sessionId: session.id, invoiceId });

  return {
    sessionId: session.id,
    checkoutUrl: session.url,
  };
}

/**
 * Retrieves a Stripe Checkout session by ID
 * 
 * @param sessionId - The Stripe session ID
 * @returns The checkout session details
 */
export async function getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent', 'line_items'],
  });
}

/**
 * Maps Stripe session status to our internal status
 * 
 * @param session - The Stripe checkout session
 * @returns Mapped status for our system
 */
export function mapSessionStatus(session: Stripe.Checkout.Session): StripeSessionStatus {
  if (session.status === 'complete' && session.payment_status === 'paid') {
    return 'completed';
  }
  if (session.status === 'expired') {
    return 'expired';
  }
  if (session.payment_status === 'unpaid') {
    return 'pending';
  }
  if (session.payment_status === 'no_payment_required') {
    return 'completed';
  }
  return 'processing';
}

/**
 * Verifies Stripe webhook signature and returns the event
 * 
 * @param payload - Raw request body as string
 * @param signature - Stripe-Signature header value
 * @returns Verified Stripe event
 * @throws Error if signature verification fails
 */
export function verifyWebhookSignature(payload: string, signature: string): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    throw new InternalServerError('STRIPE_WEBHOOK_SECRET is not configured');
  }

  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

/**
 * Converts decimal amount to cents for Stripe
 * 
 * @param amount - Amount as decimal (e.g., 99.99)
 * @returns Amount in cents (e.g., 9999)
 */
export function toCents(amount: number | string): number {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return Math.round(numAmount * 100);
}

/**
 * Converts cents to decimal amount
 * 
 * @param cents - Amount in cents
 * @returns Amount as decimal
 */
export function fromCents(cents: number): number {
  return cents / 100;
}
