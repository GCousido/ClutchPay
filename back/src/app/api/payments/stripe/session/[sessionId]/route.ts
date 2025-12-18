// app/api/payments/stripe/session/[sessionId]/route.ts
import { handleError, requireAuth } from '@/libs/api-helpers';
import { db } from '@/libs/db';
import { fromCents, getCheckoutSession, mapSessionStatus, StripePaymentMetadata } from '@/libs/stripe';
import { NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

/**
 * GET /api/payments/stripe/session/:sessionId
 * Retrieves the status and details of a Stripe Checkout session
 * 
 * Only the payer or receiver involved in the payment can access this.
 * 
 * @param {Request} request - HTTP request
 * @param {RouteParams} params - Route parameters containing sessionId
 * @returns {Promise<NextResponse>} Session status and payment details
 * @throws {401} If user is not authenticated
 * @throws {403} If user is not involved in this payment
 * @throws {400} If session ID is invalid
 * 
 * @example
 * GET /api/payments/stripe/session/cs_test_abc123
 * 
 * Response:
 * {
 *   "sessionId": "cs_test_abc123",
 *   "status": "completed",
 *   "paymentStatus": "paid",
 *   "invoice": { ... },
 *   "amount": 99.99,
 *   "currency": "eur"
 * }
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const sessionUser = await requireAuth();
    const { sessionId } = await params;

    // Validate session ID format
    if (!sessionId || !sessionId.startsWith('cs_')) {
      return NextResponse.json(
        { message: 'Invalid session ID format' },
        { status: 400 }
      );
    }

    // Retrieve session from Stripe
    const session = await getCheckoutSession(sessionId);
    const metadata = session.metadata as unknown as StripePaymentMetadata;

    if (!metadata?.invoiceId) {
      return NextResponse.json(
        { message: 'Session metadata is missing' },
        { status: 400 }
      );
    }

    // Verify user is involved in this payment
    const payerId = parseInt(metadata.payerId, 10);
    const receiverId = parseInt(metadata.receiverId, 10);

    if (sessionUser.id !== payerId && sessionUser.id !== receiverId) {
      return NextResponse.json(
        { message: 'You are not authorized to view this payment session' },
        { status: 403 }
      );
    }

    // Get invoice details from database
    const invoiceId = parseInt(metadata.invoiceId, 10);
    const invoice = await db.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        invoiceNumber: true,
        subject: true,
        amount: true,
        status: true,
        payment: {
          select: {
            id: true,
            paymentDate: true,
            paymentMethod: true,
            paymentReference: true,
          },
        },
      },
    });

    // Calculate amount from line items
    const lineItems = session.line_items?.data || [];
    const totalAmount = lineItems.reduce((sum, item) => sum + (item.amount_total || 0), 0);

    return NextResponse.json({
      sessionId: session.id,
      status: mapSessionStatus(session),
      paymentStatus: session.payment_status,
      stripeStatus: session.status,
      amount: fromCents(totalAmount),
      currency: session.currency?.toUpperCase() || 'EUR',
      invoice: invoice || {
        id: invoiceId,
        invoiceNumber: metadata.invoiceNumber,
      },
      payerEmail: metadata.payerEmail,
      createdAt: new Date(session.created * 1000).toISOString(),
      expiresAt: session.expires_at 
        ? new Date(session.expires_at * 1000).toISOString() 
        : null,
    });
  } catch (error) {
    // Handle Stripe-specific errors
    if (error instanceof Error && error.message.includes('No such checkout.session')) {
      return handleError(new Error('Checkout session not found'));
    }
    return handleError(error);
  }
}
