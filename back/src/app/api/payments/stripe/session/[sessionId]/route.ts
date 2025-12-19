// app/api/payments/stripe/session/[sessionId]/route.ts
import { BadRequestError, ForbiddenError, handleError, NotFoundError, requireAuth } from '@/libs/api-helpers';
import { db } from '@/libs/db';
import { logger } from '@/libs/logger';
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

    logger.debug('Stripe', 'GET /api/payments/stripe/session/:sessionId - Fetching session status', { sessionId, requestedBy: sessionUser.id });

    // Validate session ID format
    if (!sessionId || !sessionId.startsWith('cs_')) {
      throw new BadRequestError('Invalid session ID format');
    }

    // Retrieve session from Stripe
    let session: Awaited<ReturnType<typeof getCheckoutSession>>;
    try {
      session = await getCheckoutSession(sessionId);
    } catch (err) {
      // Check if it's a Stripe "not found" error
      if (err instanceof Error && err.message.includes('No such checkout.session')) {
        throw new NotFoundError('Checkout session not found');
      }
      throw err;
    }
    
    const metadata = session.metadata as unknown as StripePaymentMetadata;

    if (!metadata?.invoiceId) {
      throw new BadRequestError('Session metadata is missing');
    }

    // Verify user is involved in this payment
    const payerId = parseInt(metadata.payerId, 10);
    const receiverId = parseInt(metadata.receiverId, 10);

    if (sessionUser.id !== payerId && sessionUser.id !== receiverId) {
      throw new ForbiddenError();
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
    return handleError(error);
  }
}
