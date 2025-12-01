// app/api/payments/route.ts
import { getPagination, handleError, requireAuth, validateBody } from '@/libs/api-helpers';
import { uploadPdf } from '@/libs/cloudinary';
import { db } from '@/libs/db';
import { paymentCreateSchema, paymentListQuerySchema } from '@/libs/validations/payment';
import { InvoiceStatus, Prisma } from '@prisma/client';
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

/**
 * POST /api/payments
 * Creates a new payment for an invoice
 * 
 * Only the debtor (person who owes the invoice) can create a payment.
 * The invoice must be in PENDING status to be paid.
 * Upon successful payment:
 * - Receipt PDF is uploaded to Cloudinary
 * - Payment record is created
 * - Invoice status is updated to PAID
 * 
 * @param {Request} request - HTTP request with payment data in body
 * @returns {Promise<NextResponse>} Created payment object (201)
 * @throws {401} If user is not authenticated
 * @throws {403} If user is not the debtor of the invoice
 * @throws {404} If invoice not found
 * @throws {400} If invoice is not in PENDING status or validation fails
 * 
 * @example
 * POST /api/payments
 * {
 *   "invoiceId": 1,
 *   "paymentMethod": "PAYPAL",
 *   "receiptPdf": "data:application/pdf;base64,...",
 *   "subject": "Payment for web development services",
 *   "paymentReference": "STRIPE-TXN-123456"
 * }
 */
export async function POST(request: Request) {
	try {
		const sessionUser = await requireAuth();

		const body = await request.json();
		const parsed = validateBody(paymentCreateSchema, body);

		// Find the invoice and verify ownership
		const invoice = await db.invoice.findUnique({
			where: { id: parsed.invoiceId },
			select: {
				id: true,
				invoiceNumber: true,
				issuerUserId: true,
				debtorUserId: true,
				amount: true,
				status: true,
				payment: {
					select: { id: true },
				},
			},
		});

		if (!invoice) {
			return NextResponse.json({ message: 'Invoice not found' }, { status: 404 });
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

		// Check if invoice is in a payable status
		if (invoice.status !== InvoiceStatus.PENDING && invoice.status !== InvoiceStatus.OVERDUE) {
			return NextResponse.json(
				{ message: `Cannot pay an invoice with status: ${invoice.status}. Only PENDING or OVERDUE invoices can be paid` },
				{ status: 400 }
			);
		}

		// Upload receipt PDF to Cloudinary
		const { url: receiptPdfUrl } = await uploadPdf(parsed.receiptPdf, 'ClutchPay/payment_receipts');

		// Create payment and update invoice status in a transaction
		const payment = await db.$transaction(async (tx) => {
			// Create the payment record
			const newPayment = await tx.payment.create({
				data: {
					invoiceId: parsed.invoiceId,
					paymentDate: new Date(),
					paymentMethod: parsed.paymentMethod,
					paymentReference: parsed.paymentReference || null,
					receiptPdfUrl,
					subject: parsed.subject || null,
				},
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
			});

			// Update invoice status to PAID
			await tx.invoice.update({
				where: { id: parsed.invoiceId },
				data: { status: InvoiceStatus.PAID },
			});

			return newPayment;
		});

		// Return payment with updated invoice status
		const paymentWithUpdatedInvoice = {
			...payment,
			invoice: {
				...payment.invoice,
				status: InvoiceStatus.PAID,
			},
		};

		return NextResponse.json(paymentWithUpdatedInvoice, { status: 201 });
	} catch (error) {
		return handleError(error);
	}
}
