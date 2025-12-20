// app/api/invoices/[id]/route.ts
import { handleError, requireAuth, validateBody } from '@/libs/api-helpers';
import { deletePdf, extractPublicId, getSignedPdfUrl, uploadPdf } from '@/libs/cloudinary';
import { db } from '@/libs/db';
import { invoiceUpdateSchema } from '@/libs/validations/invoice';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const invoiceSelect = {
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
    // Payment details
	payment: {
		select: {
			id: true,
			paymentDate: true,
			paymentMethod: true,
		},
	},
};

/**
 * Builds update data object from validated payload
 * @param {z.infer<typeof invoiceUpdateSchema>} payload - Validated update data
 * @returns {Prisma.InvoiceUpdateInput} Prisma update input object
 */
function buildUpdateData(payload: z.infer<typeof invoiceUpdateSchema>) {
	const data: Prisma.InvoiceUpdateInput = {};

	if (payload.subject !== undefined) {
		data.subject = payload.subject;
	}

	if (payload.description !== undefined) {
		data.description = payload.description;
	}

	if (payload.amount !== undefined) {
		data.amount = new Prisma.Decimal(payload.amount);
	}

	if (payload.status !== undefined) {
		data.status = payload.status;
	}

	if (payload.dueDate !== undefined) {
		data.dueDate = payload.dueDate ? new Date(payload.dueDate) : null;
	}

	return data;
}

/**
 * GET /api/invoices/:id
 * Retrieves a single invoice by ID with payment details
 * @param {Request} request - HTTP request
 * @param {object} context - Route context with invoice ID
 * @returns {Promise<NextResponse>} Invoice object with payment info
 * @throws {401} If user is not authenticated
 * @throws {400} If invoice ID is invalid
 * @throws {404} If invoice not found or user is not issuer/debtor
 */
export async function GET(
	request: Request,
	context: { params: Promise<{ id: string }> }
) {
	try {
		const sessionUser = await requireAuth();
        const contextResolved = await context.params;

		const invoiceId = Number(contextResolved.id);

		if (Number.isNaN(invoiceId)) {
			return NextResponse.json({ message: 'Invalid invoice id' }, { status: 400 });
		}

		const invoice = await db.invoice.findFirst({
			where: {
				id: invoiceId,
				OR: [
					{ issuerUserId: sessionUser.id },
					{ debtorUserId: sessionUser.id },
				],
			},
			select: invoiceSelect,
		});		if (!invoice) {
			return NextResponse.json({ message: 'Invoice not found' }, { status: 404 });
		}
		// Generate signed URL for PDF if exists
		if (invoice.invoicePdfUrl) {
			invoice.invoicePdfUrl = getSignedPdfUrl(
				extractPublicId(invoice.invoicePdfUrl) || ''
			);
		}

		return NextResponse.json(invoice);
	} catch (error) {
		return handleError(error);
	}
}

/**
 * PUT /api/invoices/:id
 * Updates an invoice (only issuer can update, cannot update paid invoices)
 * Supports PDF replacement (deletes old, uploads new)
 * @param {Request} request - HTTP request with update data
 * @param {object} context - Route context with invoice ID
 * @returns {Promise<NextResponse>} Updated invoice object
 * @throws {401} If user is not authenticated
 * @throws {400} If invoice ID is invalid or invoice has payment
 * @throws {404} If invoice not found or user is not issuer
 */
export async function PUT(
	request: Request,
	context: { params: Promise<{ id: string }> }
) {
	try {
		const sessionUser = await requireAuth();
        const contextResolved = await context.params;
		const invoiceId = Number(contextResolved.id);

		if (Number.isNaN(invoiceId)) {
			return NextResponse.json({ message: 'Invalid invoice id' }, { status: 400 });
		}

		const invoice = await db.invoice.findUnique({
			where: { id: invoiceId },
			select: {
				issuerUserId: true,
				debtorUserId: true,
				invoicePdfUrl: true,
				payment: { select: { id: true } },
			},
		});

		if (!invoice || invoice.issuerUserId !== sessionUser.id) {
			return NextResponse.json({ message: 'Invoice not found' }, { status: 404 });
		}

		if (invoice.payment) {
			return NextResponse.json({ message: 'Invoices with payments cannot be modified' }, { status: 400 });
		}

		const body = await request.json();
		const payload = validateBody(invoiceUpdateSchema, body);

		// Handle PDF update if provided
		let pdfUpdateData: { invoicePdfUrl?: string } = {};
		if (payload.invoicePdf) {
			// Delete old PDF from Cloudinary
			if (invoice.invoicePdfUrl) {
				const oldPublicId = extractPublicId(invoice.invoicePdfUrl);
				if (oldPublicId) {
					await deletePdf(oldPublicId);
				}
			}

			// Upload new PDF
			const { url: invoicePdfUrl } = await uploadPdf(payload.invoicePdf);
			pdfUpdateData = { invoicePdfUrl };
		}

		const data = buildUpdateData(payload);
		Object.assign(data, pdfUpdateData);

		const updated = await db.invoice.update({
			where: { id: invoiceId },
			data,
			select: invoiceSelect,
		});

		return NextResponse.json(updated);
	} catch (error) {
		return handleError(error);
	}
}

/**
 * DELETE /api/invoices/:id
 * Cancels an invoice and deletes its PDF from Cloudinary
 * Only issuer can delete, cannot delete paid invoices
 * @param {Request} request - HTTP request
 * @param {object} context - Route context with invoice ID
 * @returns {Promise<NextResponse>} Success message (200)
 * @throws {401} If user is not authenticated
 * @throws {400} If invoice ID is invalid or invoice has payment
 * @throws {404} If invoice not found or user is not issuer
 */
export async function DELETE(
	request: Request,
	context: { params: Promise<{ id: string }> }
) {
	try {
		const sessionUser = await requireAuth();
        const contextResolved = await context.params;
		const invoiceId = Number(contextResolved.id);

		if (Number.isNaN(invoiceId)) {
			return NextResponse.json({ message: 'Invalid invoice id' }, { status: 400 });
		}

		const invoice = await db.invoice.findUnique({
			where: { id: invoiceId },
			select: {
				issuerUserId: true,
                debtorUserId: true,
				invoicePdfUrl: true,
				payment: { select: { id: true } },
			},
		});

		if (!invoice || invoice.issuerUserId !== sessionUser.id) {
			return NextResponse.json({ message: 'Invoice not found' }, { status: 404 });
		}

		if (invoice.payment) {
			return NextResponse.json({ message: 'Invoices with payments cannot be cancelled' }, { status: 400 });
		}

        // Delete PDF from Cloudinary
		if (invoice.invoicePdfUrl) {
			const publicId = extractPublicId(invoice.invoicePdfUrl);
			if (publicId) {
				await deletePdf(publicId);
			}
		}

        // Delete invoice
		await db.invoice.delete({ where: { id: invoiceId } });


		return NextResponse.json({ message: 'Invoice cancelled' }, { status: 200 });
	} catch (error) {
		return handleError(error);
	}
}