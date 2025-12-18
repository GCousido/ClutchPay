// app/api/payments/[id]/route.ts
import { BadRequestError, ForbiddenError, handleError, NotFoundError, requireAuth } from '@/libs/api-helpers';
import { db } from '@/libs/db';
import { NextResponse } from 'next/server';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/payments/:id
 * Retrieves detailed information about a specific payment
 * 
 * Only the payer (debtor) or receiver (issuer) of the associated invoice can view the payment.
 * Returns complete payment information including:
 * - Payment details (date, method, reference, receipt PDF URL)
 * - Associated invoice information
 * - Payer and receiver user information
 * 
 * @param {Request} request - HTTP request object
 * @param {RouteParams} context - Route context containing payment ID
 * @returns {Promise<NextResponse>} Payment object with full details
 * @throws {401} If user is not authenticated
 * @throws {403} If user is not the payer or receiver
 * @throws {404} If payment not found
 * @throws {400} If payment ID is invalid
 * 
 * @example
 * GET /api/payments/1
 * 
 * Response:
 * {
 *   "id": 1,
 *   "invoiceId": 5,
 *   "paymentDate": "2024-01-15T10:30:00Z",
 *   "paymentMethod": "PAYPAL",
 *   "paymentReference": "STRIPE-TXN-123456",
 *   "receiptPdfUrl": "https://res.cloudinary.com/.../receipt.pdf",
 *   "subject": "Payment for web development",
 *   "invoice": {
 *     "invoiceNumber": "INV-2024-001",
 *     "amount": "1500.00",
 *     "status": "PAID",
 *     "issuerUser": { "id": 1, "name": "John", "email": "john@example.com" },
 *     "debtorUser": { "id": 2, "name": "Jane", "email": "jane@example.com" }
 *   }
 * }
 */
export async function GET(request: Request, context: RouteParams) {
	try {
		const sessionUser = await requireAuth();
		const { id } = await context.params;

		const paymentId = parseInt(id, 10);
		if (isNaN(paymentId) || paymentId <= 0) {
			throw new BadRequestError('Cannot parse payment ID');
		}

		const payment = await db.payment.findUnique({
			where: { id: paymentId },
			select: {
				id: true,
				invoiceId: true,
				paymentDate: true,
				paymentMethod: true,
				paymentReference: true,
				receiptPdfUrl: true,
				subject: true,
				createdAt: true,
				updatedAt: true,
				invoice: {
					select: {
						id: true,
						invoiceNumber: true,
						issuerUserId: true,
						debtorUserId: true,
						subject: true,
						description: true,
						amount: true,
						status: true,
						issueDate: true,
						dueDate: true,
						invoicePdfUrl: true,
						createdAt: true,
						updatedAt: true,
						issuerUser: {
							select: {
								id: true,
								name: true,
								surnames: true,
								email: true,
								imageUrl: true,
							},
						},
						debtorUser: {
							select: {
								id: true,
								name: true,
								surnames: true,
								email: true,
								imageUrl: true,
							},
						},
					},
				},
			},
		});

		if (!payment) {
			throw new NotFoundError('Payment not found');
		}

		// Check authorization: only payer (debtor) or receiver (issuer) can view
		const isDebtor = payment.invoice.debtorUserId === sessionUser.id;
		const isIssuer = payment.invoice.issuerUserId === sessionUser.id;

		if (!isDebtor && !isIssuer) {
			throw new ForbiddenError('Forbidden');
		}

		return NextResponse.json(payment);
	} catch (error) {
		return handleError(error);
	}
}
