// app/api/payments/stripe/webhook/route.ts
import { db } from '@/libs/db';
import {
    createPayPalPayout,
    StripePaymentMetadata,
    verifyWebhookSignature
} from '@/libs/stripe';
import { InvoiceStatus, PaymentMethod } from '@prisma/client';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

/**
 * POST /api/payments/stripe/webhook
 * Handles Stripe webhook events for payment processing
 * 
 * This endpoint receives events from Stripe when:
 * - A checkout session is completed (payment successful)
 * - A checkout session expires
 * - An async payment succeeds (e.g., PayPal confirmation)
 * - A payment fails
 * 
 * When a payment is completed:
 * 1. Creates a Payment record in the database
 * 2. Updates the Invoice status to PAID
 * 3. Initiates a PayPal payout to the invoice receiver
 * 
 * @param {Request} request - Raw HTTP request from Stripe
 * @returns {Promise<NextResponse>} Acknowledgment response
 * 
 * Note: This endpoint does NOT require authentication as it's called by Stripe.
 * Security is ensured through webhook signature verification.
 */
export async function POST(request: Request) {
  try {
    // Get raw body for signature verification
    const payload = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      console.error('[Stripe Webhook] Missing signature header');
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = verifyWebhookSignature(payload, signature);
    } catch (err) {
      console.error('[Stripe Webhook] Signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    console.log(`[Stripe Webhook] Received event: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
        break;

      case 'checkout.session.async_payment_succeeded':
        // PayPal payments may be confirmed asynchronously
        await handleAsyncPaymentSuccess(event.data.object as Stripe.Checkout.Session);
        break;

      case 'checkout.session.async_payment_failed':
        await handleAsyncPaymentFailed(event.data.object as Stripe.Checkout.Session);
        break;

      case 'checkout.session.expired':
        await handleSessionExpired(event.data.object as Stripe.Checkout.Session);
        break;

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook] Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Handles successful checkout completion
 * For PayPal, payment_status might be 'unpaid' initially (async payment)
 */
async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const metadata = session.metadata as unknown as StripePaymentMetadata;
  
  console.log('[Stripe Webhook] Checkout completed:', {
    sessionId: session.id,
    paymentStatus: session.payment_status,
    invoiceId: metadata?.invoiceId,
  });

  // For PayPal, we need to wait for async_payment_succeeded
  // Only process if payment is already confirmed
  if (session.payment_status === 'paid') {
    await processSuccessfulPayment(session);
  } else {
    console.log('[Stripe Webhook] Payment pending (async), waiting for confirmation...');
  }
}

/**
 * Handles successful async payment (e.g., PayPal confirmation)
 */
async function handleAsyncPaymentSuccess(session: Stripe.Checkout.Session) {
  console.log('[Stripe Webhook] Async payment succeeded:', session.id);
  await processSuccessfulPayment(session);
}

/**
 * Handles failed async payment
 */
async function handleAsyncPaymentFailed(session: Stripe.Checkout.Session) {
  const metadata = session.metadata as unknown as StripePaymentMetadata;
  
  console.log('[Stripe Webhook] Async payment failed:', {
    sessionId: session.id,
    invoiceId: metadata?.invoiceId,
  });

  // Log the failure - invoice remains in original status
  // Could send notification to user here
}

/**
 * Handles expired checkout session
 */
async function handleSessionExpired(session: Stripe.Checkout.Session) {
  const metadata = session.metadata as unknown as StripePaymentMetadata;
  
  console.log('[Stripe Webhook] Session expired:', {
    sessionId: session.id,
    invoiceId: metadata?.invoiceId,
  });

  // Session expired without payment
  // Could send notification to user here
}

/**
 * Processes a successful payment:
 * 1. Creates Payment record
 * 2. Updates Invoice status
 * 3. Initiates payout to receiver
 */
async function processSuccessfulPayment(session: Stripe.Checkout.Session) {
  const metadata = session.metadata as unknown as StripePaymentMetadata;

  if (!metadata?.invoiceId) {
    console.error('[Stripe Webhook] Missing invoice metadata');
    return;
  }

  const invoiceId = parseInt(metadata.invoiceId, 10);

  // Check if payment already exists (idempotency)
  const existingPayment = await db.payment.findUnique({
    where: { invoiceId },
  });

  if (existingPayment) {
    console.log('[Stripe Webhook] Payment already exists for invoice:', invoiceId);
    return;
  }

  // Get invoice to verify it's still payable
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      status: true,
      amount: true,
      issuerUser: {
        select: { email: true },
      },
    },
  });

  if (!invoice) {
    console.error('[Stripe Webhook] Invoice not found:', invoiceId);
    return;
  }

  if (invoice.status === InvoiceStatus.PAID) {
    console.log('[Stripe Webhook] Invoice already paid:', invoiceId);
    return;
  }

  // Create payment record and update invoice in a transaction
  const payment = await db.$transaction(async (tx) => {
    // Create the payment record
    const newPayment = await tx.payment.create({
      data: {
        invoiceId,
        paymentDate: new Date(),
        paymentMethod: PaymentMethod.PAYPAL, // Payment via Stripe-PayPal integration
        paymentReference: session.payment_intent as string || session.id,
        receiptPdfUrl: `stripe://session/${session.id}`, // Placeholder - receipt from Stripe
        subject: `Payment via Stripe Checkout - Session ${session.id}`,
      },
    });

    // Update invoice status to PAID
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { status: InvoiceStatus.PAID },
    });

    return newPayment;
  });

  console.log('[Stripe Webhook] Payment created:', payment.id);

  // Initiate payout to receiver (PayPal)
  // In production, this would transfer funds to the invoice issuer
  try {
    const amountInCents = session.amount_total || 0;
    const payout = await createPayPalPayout({
      receiverEmail: metadata.receiverEmail,
      amount: amountInCents,
      currency: session.currency || 'eur',
      invoiceNumber: metadata.invoiceNumber,
    });
    
    console.log('[Stripe Webhook] Payout initiated:', payout);
  } catch (payoutError) {
    // Log payout error but don't fail the webhook
    // Payout can be retried later
    console.error('[Stripe Webhook] Payout failed:', payoutError);
  }
}
