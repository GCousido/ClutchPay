// app/api/invoices/[id]/route.ts
import { handleError, requireAuth, validateBody } from '@/libs/api-helpers';
import { deletePdf, extractPublicId, uploadPdf } from '@/libs/cloudinary';
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

		return NextResponse.json(invoice);
	} catch (error) {
		return handleError(error);
	}
}

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
