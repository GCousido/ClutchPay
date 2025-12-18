// app/api/invoices/route.ts
import { BadRequestError, ForbiddenError, getPagination, handleError, NotFoundError, requireAuth, validateBody } from '@/libs/api-helpers';
import { getSignedPdfUrl, uploadPdf } from '@/libs/cloudinary';
import { db } from '@/libs/db';
import { logger } from '@/libs/logger';
import { notifyInvoiceIssued } from '@/libs/notifications';
import { invoiceCreateSchema, invoiceListQuerySchema } from '@/libs/validations/invoice';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

/**
 * GET /api/invoices
 * Retrieves a paginated list of invoices for the authenticated user
 * @param {Request} request - HTTP request with query parameters
 * @returns {Promise<NextResponse>} Paginated list of invoices with metadata
 * @throws {401} If user is not authenticated
 * @throws {400} If validation fails
 */
export async function GET(request: Request) {
	try {
		const sessionUser = await requireAuth();

		logger.debug('Invoices', 'GET /api/invoices - Listing invoices', { userId: sessionUser.id });

		const searchParams = new URL(request.url).searchParams;
		const filters = invoiceListQuerySchema.parse(Object.fromEntries(searchParams));
		const { page, limit, skip } = getPagination(searchParams);

		// Build base where clause based on ownership
		const where: Prisma.InvoiceWhereInput = filters.role === 'issuer'
			? { issuerUserId: sessionUser.id }
			: { debtorUserId: sessionUser.id };

			if (filters.status) {
				where.status = filters.status;
		}

		if (filters.subject) {
			where.subject = { contains: filters.subject, mode: 'insensitive' };
		}

		if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
			where.amount = {
				...(filters.minAmount !== undefined ? { gte: new Prisma.Decimal(filters.minAmount) } : {}),
				...(filters.maxAmount !== undefined ? { lte: new Prisma.Decimal(filters.maxAmount) } : {}),
			};
		}

		if (filters.issueDateFrom || filters.issueDateTo) {
			where.issueDate = {
				...(filters.issueDateFrom ? { gte: new Date(filters.issueDateFrom) } : {}),
				...(filters.issueDateTo ? { lte: new Date(filters.issueDateTo) } : {}),
			};
		}

		if (filters.dueDateFrom || filters.dueDateTo) {
			where.dueDate = {
				...(filters.dueDateFrom ? { gte: new Date(filters.dueDateFrom) } : {}),
				...(filters.dueDateTo ? { lte: new Date(filters.dueDateTo) } : {}),
			};
		}

		// Build sorting configuration
		const orderBy: Prisma.InvoiceOrderByWithRelationInput = {
			[filters.sortBy]: filters.sortOrder,
		};

		const [total, invoices] = await Promise.all([
			db.invoice.count({ where }),
			db.invoice.findMany({
				where,
				orderBy,
				skip,
				take: limit,
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
				},
			}),
		]);

		const totalPages = Math.max(1, Math.ceil(total / limit));
		// Generate signed URLs for PDFs
		const invoicesWithSignedUrls = invoices.map(invoice => ({
			...invoice,
			invoicePdfUrl: invoice.invoicePdfUrl 
				? getSignedPdfUrl(invoice.invoicePdfUrl)
				: null
		}));

		logger.debug('Invoices', 'Invoices list retrieved', { total, page, role: filters.role });

		return NextResponse.json({
			meta: {
				total,
				totalPages,
				page,
				limit,
				nextPage: page < totalPages ? page + 1 : null,
				prevPage: page > 1 ? page - 1 : null,
			},
			data: invoicesWithSignedUrls,
		});
	} catch (error) {
		return handleError(error);
	}
}

/**
 * POST /api/invoices
 * Creates a new invoice with PDF upload to Cloudinary
 * @param {Request} request - HTTP request with invoice data in body
 * @returns {Promise<NextResponse>} Created invoice object (201)
 * @throws {401} If user is not authenticated
 * @throws {403} If user tries to issue invoice as someone else
 * @throws {400} If user tries to invoice themselves or validation fails
 * @throws {404} If debtor user not found
 */
export async function POST(request: Request) {
	try {
		const sessionUser = await requireAuth();

		logger.debug('Invoices', 'POST /api/invoices - Creating invoice', { issuerId: sessionUser.id });

		const body = await request.json();
		const parsed = validateBody(invoiceCreateSchema, body);

		if (parsed.issuerUserId !== sessionUser.id) {
			// Enforce that the current user can only issue invoices on their own behalf
			throw new ForbiddenError('Forbidden');
		}

		if (parsed.debtorUserId === sessionUser.id) {
			throw new BadRequestError('Cannot issue an invoice to yourself');
		}

		const debtorExists = await db.user.findUnique({
			where: { id: parsed.debtorUserId },
			select: { id: true },
		});

		if (!debtorExists) {
			throw new NotFoundError('Debtor not found');
		}

		// Upload PDF to Cloudinary
		const { url: invoicePdfUrl } = await uploadPdf(parsed.invoicePdf);

		const invoice = await db.invoice.create({
			data: {
				invoiceNumber: parsed.invoiceNumber,
				issuerUserId: parsed.issuerUserId,
				debtorUserId: parsed.debtorUserId,
				subject: parsed.subject,
				description: parsed.description,
				amount: new Prisma.Decimal(parsed.amount),
				status: parsed.status,
				issueDate: new Date(parsed.issueDate),
				dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null,
				invoicePdfUrl,
			},
			include: {
				issuerUser: true,
				debtorUser: true,
			},
		});

		// Create notification for debtor about the new invoice
		try {
			await notifyInvoiceIssued(invoice);
		} catch (notificationError) {
			// Log but don't fail the request if notification creation fails
			logger.error('Invoice', 'Failed to create notification on invoice create', notificationError);
		}

		// Return only the invoice data without user relations
		const { issuerUser, debtorUser, ...invoiceData } = invoice;

		logger.info('Invoices', 'Invoice created successfully', { 
			invoiceId: invoice.id, 
			invoiceNumber: invoice.invoiceNumber,
			issuerId: invoice.issuerUserId,
			debtorId: invoice.debtorUserId,
			amount: invoice.amount.toString()
		});

		return NextResponse.json(invoiceData, { status: 201 });
	} catch (error) {
		return handleError(error);
	}
}