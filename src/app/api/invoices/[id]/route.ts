// app/api/invoices/[id]/route.ts
import { handleError, requireAuth, validateBody } from '@/libs/api-helpers';
import { db } from '@/libs/db';
import { invoiceUpdateSchema } from '@/libs/validations/invoice';
import { NotificationType, Prisma } from '@prisma/client';
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

	if (payload.invoicePdfUrl !== undefined) {
		// TODO: Handle PDF storage integration (upload and persist generated URL or path)
		data.invoicePdfUrl = payload.invoicePdfUrl;
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
		// TODO: Remove DEV_ALLOW_BYPASS override before production release
		const devBypass = process.env.DEV_ALLOW_BYPASS === 'true';

		if (Number.isNaN(invoiceId)) {
			return NextResponse.json({ message: 'Invalid invoice id' }, { status: 400 });
		}

		const invoice = await db.invoice.findFirst({
			where: {
				id: invoiceId,
				...(devBypass
					? {}
					: {
							OR: [
								{ issuerUserId: sessionUser.id },
								{ debtorUserId: sessionUser.id },
							],
						}),
			},
			select: invoiceSelect,
		});

		if (!invoice) {
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
				payment: { select: { id: true } },
			},
		});

        // TODO: remove in prod
        const devBypass = process.env.DEV_ALLOW_BYPASS === 'true';
		if (!invoice || (invoice.issuerUserId !== sessionUser.id && !devBypass)) {
			return NextResponse.json({ message: 'Invoice not found' }, { status: 404 });
		}

		if (invoice.payment) {
			return NextResponse.json({ message: 'Invoices with payments cannot be modified' }, { status: 400 });
		}

		const body = await request.json();
		const payload = validateBody(invoiceUpdateSchema, body);
		const data = buildUpdateData(payload);

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
				payment: { select: { id: true } },
			},
		});

        // TODO: remove in prod
        const devBypass = process.env.DEV_ALLOW_BYPASS === 'true';
		if (!invoice || (invoice.issuerUserId !== sessionUser.id && !devBypass)) {
			return NextResponse.json({ message: 'Invoice not found' }, { status: 404 });
		}

		if (invoice.payment) {
			return NextResponse.json({ message: 'Invoices with payments cannot be cancelled' }, { status: 400 });
		}

        
        // Delete associated notifications first (Restrict prevents direct delete)
		await db.notification.deleteMany({
			where: { invoiceId },
		});

        // Create notification for debtor that invoice was cancelled
		await db.notification.create({
			data: {
				userId: invoice.debtorUserId,
				invoiceId,
				type: NotificationType.INVOICE_CANCELED,
				read: false,
			},
		});

        // Delete invoice
		await db.invoice.delete({ where: { id: invoiceId } });

		return NextResponse.json({ message: 'Invoice cancelled' }, { status: 200 });
	} catch (error) {
		return handleError(error);
	}
}
