// app/api/payments/route.ts
import { getPagination, handleError, requireAuth } from '@/libs/api-helpers';
import { db } from '@/libs/db';
import { logger } from '@/libs/logger';
import { paymentListQuerySchema } from '@/libs/validations/payment';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

/**
 * GET /api/payments
 * Retrieves a paginated list of payments for the authenticated user
 * 
 * Supports filtering by:
 * - role: 'payer' (payments made by user) or 'receiver' (payments received by user)
 * - paymentMethod: PAYPAL, VISA, MASTERCARD, OTHER
 * - minAmount/maxAmount: Filter by invoice amount range
 * - paymentDateFrom/paymentDateTo: Filter by payment date range
 * 
 * @param {Request} request - HTTP request with query parameters
 * @returns {Promise<NextResponse>} Paginated list of payments with metadata
 * @throws {401} If user is not authenticated
 * @throws {400} If validation fails
 * 
 * @example
 * // Get payments made by user (default)
 * GET /api/payments
 * 
 * // Get payments received by user
 * GET /api/payments?role=receiver
 * 
 * // Filter by payment method and date
 * GET /api/payments?paymentMethod=PAYPAL&paymentDateFrom=2024-01-01T00:00:00Z
 */
export async function GET(request: Request) {
	try {
		const sessionUser = await requireAuth();

		logger.debug('Payments', 'GET /api/payments - Listing payments', { userId: sessionUser.id });

		const searchParams = new URL(request.url).searchParams;
		const filters = paymentListQuerySchema.parse(Object.fromEntries(searchParams));
		const { page, limit, skip } = getPagination(searchParams);

		// Build where clause based on role (payer = debtor, receiver = issuer)
		const invoiceFilter: Prisma.InvoiceWhereInput = filters.role === 'payer'
			? { debtorUserId: sessionUser.id }
			: { issuerUserId: sessionUser.id };

		// Build payment where clause
		const where: Prisma.PaymentWhereInput = {
			invoice: invoiceFilter,
		};

		// Filter by payment method
		if (filters.paymentMethod) {
			where.paymentMethod = filters.paymentMethod;
		}

		// Filter by invoice amount range
		if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
			where.invoice = {
				...invoiceFilter,
				amount: {
					...(filters.minAmount !== undefined ? { gte: new Prisma.Decimal(filters.minAmount) } : {}),
					...(filters.maxAmount !== undefined ? { lte: new Prisma.Decimal(filters.maxAmount) } : {}),
				},
			};
		}

		// Filter by payment date range
		if (filters.paymentDateFrom || filters.paymentDateTo) {
			where.paymentDate = {
				...(filters.paymentDateFrom ? { gte: new Date(filters.paymentDateFrom) } : {}),
				...(filters.paymentDateTo ? { lte: new Date(filters.paymentDateTo) } : {}),
			};
		}

		// Build sorting configuration
		const orderBy: Prisma.PaymentOrderByWithRelationInput = {
			[filters.sortBy]: filters.sortOrder,
		};

		const [total, payments] = await Promise.all([
			db.payment.count({ where }),
			db.payment.findMany({
				where,
				orderBy,
				skip,
				take: limit,
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
							amount: true,
							status: true,
							issueDate: true,
							dueDate: true,
						},
					},
				},
			}),
		]);

		const totalPages = Math.max(1, Math.ceil(total / limit));

		logger.debug('Payments', 'Payments list retrieved', { total, page, role: filters.role });

		return NextResponse.json({
			meta: {
				total,
				totalPages,
				page,
				limit,
				nextPage: page < totalPages ? page + 1 : null,
				prevPage: page > 1 ? page - 1 : null,
			},
			data: payments,
		});
	} catch (error) {
		return handleError(error);
	}
}
