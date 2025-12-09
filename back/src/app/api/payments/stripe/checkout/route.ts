// app/api/payments/stripe/checkout/route.ts
import { handleError, requireAuth, validateBody } from '@/libs/api-helpers';
import { db } from '@/libs/db';
import { createCheckoutSession, toCents } from '@/libs/stripe';
import { stripeCheckoutCreateSchema } from '@/libs/validations/stripe';
import { InvoiceStatus } from '@prisma/client';
import { NextResponse } from 'next/server';

/**
 * POST /api/payments/stripe/checkout
 * Creates a Stripe Checkout session for paying an invoice
 * 
 * Flow: Payer (PayPal) → Stripe Checkout → ClutchPay → Receiver (PayPal)
 * 
 * Only the debtor (person who owes the invoice) can initiate payment.
 * The invoice must be in PENDING or OVERDUE status.
 * 
 * @param {Request} request - HTTP request with invoice ID in body
 * @returns {Promise<NextResponse>} Checkout session details with redirect URL
 * @throws {401} If user is not authenticated
 * @throws {403} If user is not the debtor of the invoice
 * @throws {404} If invoice not found
 * @throws {400} If invoice is not in a payable status
 * 
 * @example
 * POST /api/payments/stripe/checkout
 * {
 *   "invoiceId": 1,
 *   "successUrl": "https://app.clutchpay.com/payments/success",
 *   "cancelUrl": "https://app.clutchpay.com/payments/cancel"
 * }
 * 
 * Response:
 * {
 *   "sessionId": "cs_test_...",
 *   "checkoutUrl": "https://checkout.stripe.com/..."
 * }
 */
export async function POST(request: Request) {
  try {
    const sessionUser = await requireAuth();

    const body = await request.json();
    const parsed = validateBody(stripeCheckoutCreateSchema, body);

    // Find the invoice with related user information
    const invoice = await db.invoice.findUnique({
      where: { id: parsed.invoiceId },
      select: {
        id: true,
        invoiceNumber: true,
        issuerUserId: true,
        debtorUserId: true,
        subject: true,
        description: true,
        amount: true,
        status: true,
        payment: {
          select: { id: true },
        },
        issuerUser: {
          select: {
            id: true,
            email: true,
            name: true,
            surnames: true,
          },
        },
        debtorUser: {
          select: {
            id: true,
            email: true,
            name: true,
            surnames: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { message: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Only the debtor can pay the invoice
    if (invoice.debtorUserId !== sessionUser.id) {
      return NextResponse.json(
        { message: 'You can only pay invoices where you are the debtor' },
        { status: 403 }
      );
    }

    // Check if invoice is already paid
    if (invoice.payment) {
      return NextResponse.json(
        { message: 'This invoice has already been paid' },
        { status: 400 }
      );
    }

    // Check if invoice is in a payable status. TODO: overdue?
    if (invoice.status !== InvoiceStatus.PENDING && invoice.status !== InvoiceStatus.OVERDUE) {
      return NextResponse.json(
        { message: `Cannot pay an invoice with status: ${invoice.status}. Only PENDING or OVERDUE invoices can be paid` },
        { status: 400 }
      );
    }

    // Convert amount to cents for Stripe
    const amountInCents = toCents(invoice.amount.toString());

    // Create Stripe Checkout session
    const checkoutSession = await createCheckoutSession({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amount: amountInCents,
      currency: 'eur',
      description: `${invoice.subject} - ${invoice.description}`.substring(0, 500),
      payerId: sessionUser.id,
      payerEmail: invoice.debtorUser.email,
      receiverId: invoice.issuerUserId,
      receiverEmail: invoice.issuerUser.email,
      successUrl: parsed.successUrl,
      cancelUrl: parsed.cancelUrl,
    });

    return NextResponse.json({
      sessionId: checkoutSession.sessionId,
      checkoutUrl: checkoutSession.checkoutUrl,
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.amount,
        subject: invoice.subject,
      },
    }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
