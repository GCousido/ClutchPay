// app/api/invoices/route.ts
import { getPagination, handleError, requireAuth, validateBody } from '@/libs/api-helpers';
import { uploadPdf } from '@/libs/cloudinary';
import { db } from '@/libs/db';
import { invoiceCreateSchema, invoiceListQuerySchema } from '@/libs/validations/invoice';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
	try {
		const sessionUser = await requireAuth();

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

		return NextResponse.json({
			meta: {
				total,
				totalPages,
				page,
				limit,
				nextPage: page < totalPages ? page + 1 : null,
				prevPage: page > 1 ? page - 1 : null,
			},
			data: invoices,
		});
	} catch (error) {
		return handleError(error);
	}
}

export async function POST(request: Request) {
	try {
		const sessionUser = await requireAuth();

		const body = await request.json();
		const parsed = validateBody(invoiceCreateSchema, body);

		if (parsed.issuerUserId !== sessionUser.id) {
			// Enforce that the current user can only issue invoices on their own behalf
			return NextResponse.json({ message: 'You can only issue invoices as yourself' }, { status: 403 });
		}

		if (parsed.debtorUserId === sessionUser.id) {
			return NextResponse.json({ message: 'You cannot issue an invoice to yourself' }, { status: 400 });
		}

		const debtorExists = await db.user.findUnique({
			where: { id: parsed.debtorUserId },
			select: { id: true },
		});

		if (!debtorExists) {
			return NextResponse.json({ message: 'Debtor not found' }, { status: 404 });
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
		});

		return NextResponse.json(invoice, { status: 201 });
	} catch (error) {
		return handleError(error);
	}
}