
import { InvoiceStatus, PaymentMethod, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function randInt(min: number, max: number) {
	return Math.floor(Math.random() * (max - min + 1)) + min
}

function sample<T>(arr: T[]) {
	return arr[Math.floor(Math.random() * arr.length)]
}

function randomPhone() {
	return `+34${randInt(600000000, 699999999)}`
}

function formatInvoiceNumber(n: number) {
	return `INV-${String(n).padStart(5, '0')}`
}

function randomAmount(min = 50, max = 5000) {
	return (Math.round((Math.random() * (max - min) + min) * 100) / 100).toFixed(2)
}

async function main() {
	console.log('Seeding database...')

	// 20 usuarios de ejemplo
	const userDatas = Array.from({ length: 20 }).map((_, i) => ({
		email: `user${i + 1}@example.com`,
		name: `User${i + 1}`,
		surnames: `Surname${i + 1}`,
		phone: i % 2 === 0 ? randomPhone() : null,
		country: sample(['ES', 'US', 'MX', 'AR', 'CL', 'CO']),
		imageUrl: `https://picsum.photos/seed/user${i + 1}/200/200`,
	}))

	const users = [] as any[]
	for (const u of userDatas) {
		const created = await prisma.user.create({ data: u })
		users.push(created)
	}

	// Crear facturas: cada usuario emite entre 1 y 8 facturas
	let invoiceCounter = 1
	const allInvoices: any[] = []

	for (const issuer of users) {
		const count = randInt(1, 8)
		for (let j = 0; j < count; j++) {
			// elegir deudor distinto del emisor
			let debtor = sample(users)
			while (debtor.id === issuer.id) debtor = sample(users)

			const total = randomAmount(20, 3000)
			const tax = (Math.round((Number(total) * 0.21) * 100) / 100).toFixed(2) // ejemplo IVA 21%
			const issueDate = new Date()
			issueDate.setDate(issueDate.getDate() - randInt(0, 180))
			const dueDate = new Date(issueDate)
			dueDate.setDate(issueDate.getDate() + randInt(7, 60))

			const invoiceNumber = formatInvoiceNumber(invoiceCounter++)

			const invoice = await prisma.invoice.create({
				data: {
					invoiceNumber,
					issuerUserId: issuer.id,
					debtorUserId: debtor.id,
					description: `Servicio prestado - ${invoiceNumber}`,
					totalAmount: String(total),
					tax: String(tax),
					status: InvoiceStatus.PENDING,
					issueDate,
					dueDate,
					pdfUrl: `https://example.com/invoices/${invoiceNumber}.pdf`,
				},
			})

			allInvoices.push({ invoice, issuer, debtor })
		}
	}

	// Asociar pagos a un porcentaje de facturas (por ejemplo 40%)
	for (const entry of allInvoices) {
		const willBePaid = Math.random() < 0.4
		if (!willBePaid) continue

		const { invoice } = entry
		const amountPaid = invoice.totalAmount // pagado íntegro para simplificar
		const paymentDate = new Date(invoice.issueDate)
		paymentDate.setDate(paymentDate.getDate() + randInt(1, Math.max(1, Math.floor((new Date(invoice.dueDate).getTime() - new Date(invoice.issueDate).getTime()) / (1000 * 3600 * 24)))))

		await prisma.payment.create({
			data: {
				invoiceId: invoice.id,
				amountPaid: String(amountPaid),
				paymentDate,
				paymentMethod: sample([PaymentMethod.PAYPAL, PaymentMethod.VISA, PaymentMethod.MASTERCARD, PaymentMethod.OTHER]),
				paymentReference: `REF-${invoice.invoiceNumber}-${randInt(1000, 9999)}`,
				pdfReceiptUrl: `https://example.com/receipts/${invoice.invoiceNumber}.pdf`,
				subject: `Pago de ${invoice.invoiceNumber}`,
			},
		})

		// Actualizar estado de la factura a PAID
		await prisma.invoice.update({ where: { id: invoice.id }, data: { status: InvoiceStatus.PAID } })
	}

	console.log(`Seed completo: ${users.length} usuarios, ${allInvoices.length} facturas (con pagos en ~40%).`)
}

main()
	.catch((e) => {
		console.error(e)
		process.exit(1)
	})
	.finally(async () => {
		await prisma.$disconnect()
	})
