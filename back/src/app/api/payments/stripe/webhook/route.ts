// app/api/payments/stripe/webhook/route.ts
import { BadRequestError, handleError } from '@/libs/api-helpers';
import { uploadPdf } from '@/libs/cloudinary';
import { db } from '@/libs/db';
import { logger } from '@/libs/logger';
import { notifyPaymentReceived } from '@/libs/notifications';
import { createPayPalPayout } from '@/libs/paypal';
import { generateReceiptPdf } from '@/libs/pdf-generator';
import {
  stripe,
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
      throw new BadRequestError('stripe-signature header is missing');
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = verifyWebhookSignature(payload, signature);
    } catch (err) {
      logger.error('Stripe Webhook', 'Signature verification failed', err);
      throw new BadRequestError('Invalid webhook signature');
    }

    logger.info('Stripe Webhook', `Received event: ${event.type}`, { eventId: event.id });

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
        logger.debug('Stripe Webhook', `Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error('Stripe Webhook', 'Error processing webhook', error);
    return handleError(error);
  }
}

/**
 * Handles successful checkout completion
 * For PayPal, payment_status might be 'unpaid' initially (async payment)
 */
async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const metadata = session.metadata as unknown as StripePaymentMetadata;
  
  logger.info('Stripe Webhook', 'Checkout completed', {
    sessionId: session.id,
    paymentStatus: session.payment_status,
    invoiceId: metadata?.invoiceId,
  });

  // For PayPal, we need to wait for async_payment_succeeded
  // Only process if payment is already confirmed
  if (session.payment_status === 'paid') {
    await processSuccessfulPayment(session);
  } else {
    logger.info('Stripe Webhook', 'Payment pending (async), waiting for confirmation', { sessionId: session.id });
  }
}

/**
 * Handles successful async payment (e.g., PayPal confirmation)
 */
async function handleAsyncPaymentSuccess(session: Stripe.Checkout.Session) {
  logger.info('Stripe Webhook', 'Async payment succeeded', { sessionId: session.id });
  await processSuccessfulPayment(session);
}

/**
 * Handles failed async payment
 */
async function handleAsyncPaymentFailed(session: Stripe.Checkout.Session) {
  const metadata = session.metadata as unknown as StripePaymentMetadata;
  
  logger.warn('Stripe Webhook', 'Async payment failed', {
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
  
  logger.info('Stripe Webhook', 'Session expired', {
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
    logger.error('Stripe Webhook', 'Missing invoice metadata', { sessionId: session.id });
    return;
  }

  const invoiceId = parseInt(metadata.invoiceId, 10);

  // Check if payment already exists (idempotency)
  const existingPayment = await db.payment.findUnique({
    where: { invoiceId },
  });

  if (existingPayment) {
    logger.info('Stripe Webhook', 'Payment already exists for invoice', { invoiceId });
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
    logger.error('Stripe Webhook', 'Invoice not found', { invoiceId });
    return;
  }

  if (invoice.status === InvoiceStatus.PAID) {
    logger.info('Stripe Webhook', 'Invoice already paid', { invoiceId });
    return;
  }

  // Get or generate receipt URL
  let receiptUrl = '';

  // 1. Try to get receipt from Stripe
  if (session.payment_intent) {
    try {
      const paymentIntentId = typeof session.payment_intent === 'string' 
        ? session.payment_intent 
        : session.payment_intent.id;
        
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (paymentIntent.latest_charge) {
        const chargeId = typeof paymentIntent.latest_charge === 'string'
          ? paymentIntent.latest_charge
          : paymentIntent.latest_charge.id;
          
        const charge = await stripe.charges.retrieve(chargeId);
        if (charge.receipt_url) {
          receiptUrl = charge.receipt_url;
          logger.debug('Stripe Webhook', 'Retrieved Stripe receipt URL', { chargeId });
        }
      }
    } catch (err) {
      logger.error('Stripe Webhook', 'Failed to retrieve Stripe receipt', err);
    }
  }

  // 2. If no Stripe receipt, generate PDF
  if (!receiptUrl) {
    try {
      logger.info('Stripe Webhook', 'Generating PDF receipt', { invoiceId });
      const pdfBuffer = await generateReceiptPdf({
        paymentReference: (session.payment_intent as string) || session.id,
        paymentDate: new Date(),
        amount: session.amount_total || 0,
        currency: session.currency || 'eur',
        paymentMethod: 'PAYPAL',
        invoiceNumber: metadata.invoiceNumber,
        subject: `Payment for Invoice ${metadata.invoiceNumber}`,
        payerName: metadata.payerEmail, // Using email as name fallback
        payerEmail: metadata.payerEmail,
        receiverName: metadata.receiverEmail, // Using email as name fallback
        receiverEmail: metadata.receiverEmail,
      });

      // Convert Buffer to base64 data URI for Cloudinary
      const base64Pdf = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;
      const uploadResult = await uploadPdf(base64Pdf, 'ClutchPay/receipts');
      receiptUrl = uploadResult.url;
      logger.info('Stripe Webhook', 'PDF receipt generated and uploaded', { receiptUrl });
    } catch (err) {
      logger.error('Stripe Webhook', 'Failed to generate/upload receipt PDF', err);
      // Fallback to avoid failing the payment process
      receiptUrl = `unavailable`; 
    }
  }

  // Create payment record and update invoice in a transaction
  const payment = await db.$transaction(async (tx) => {
    // Create the payment record
    const newPayment = await tx.payment.create({
      data: {
        invoiceId,
        paymentDate: new Date(),
        paymentMethod: PaymentMethod.PAYPAL, // Payment via Stripe-PayPal integration
        paymentReference: (session.payment_intent as string) || session.id,
        receiptPdfUrl: receiptUrl,
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

  logger.info('Stripe Webhook', 'Payment created', { paymentId: payment.id, invoiceId });

  // Create notification for the invoice issuer about received payment
  try {
    const invoiceWithUsers = await db.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        issuerUser: true,
        debtorUser: true,
        payment: true,
      },
    });
    if (invoiceWithUsers) {
      await notifyPaymentReceived(invoiceWithUsers);
    }
  } catch (notificationError) {
    // Log but don't fail the webhook if notification creation fails
    logger.error('Stripe Webhook', 'Failed to create notification', notificationError);
  }

  // Initiate payout to receiver (PayPal)
  // This transfers funds from Stripe to the invoice issuer's PayPal account
  try {
    const amountInCents = session.amount_total || 0;
    const payout = await createPayPalPayout({
      receiverEmail: metadata.receiverEmail,
      amount: amountInCents,
      currency: session.currency || 'eur',
      invoiceNumber: metadata.invoiceNumber,
      senderId: parseInt(metadata.payerId, 10),
      receiverId: parseInt(metadata.receiverId, 10),
      note: `Payment for Invoice ${metadata.invoiceNumber} via ClutchPay`,
    });
    
    logger.info('Stripe Webhook', 'PayPal payout initiated', {
      payoutBatchId: payout.payoutBatchId,
      status: payout.batchStatus,
      receiver: metadata.receiverEmail,
    });
    
    // Update payment record with payout reference
    await db.payment.update({
      where: { id: payment.id },
      data: {
        paymentReference: `${payment.paymentReference}|PAYOUT:${payout.payoutBatchId}`,
      },
    });
  } catch (payoutError) {
    // Log payout error but don't fail the webhook
    // Payout can be retried later via admin/cron job
    logger.error('Stripe Webhook', 'PayPal payout failed', payoutError);
    // TODO: Queue for retry or notify admin
  }
}
