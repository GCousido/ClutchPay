import { writeFileSync } from 'fs';
import { generateReceiptPdf } from './src/libs/pdf-generator';

async function main() {
  const pdf = await generateReceiptPdf({
    paymentReference: 'pi_test_1234567890',
    paymentDate: new Date(),
    amount: 15000,
    currency: 'eur',
    paymentMethod: 'PAYPAL',
    invoiceNumber: 'INV-2025-001',
    subject: 'Pago por servicios de desarrollo web',
    payerName: 'Juan García López',
    payerEmail: 'juan.garcia@example.com',
    receiverName: 'María Rodríguez Sánchez',
    receiverEmail: 'maria.rodriguez@example.com',
  });
  writeFileSync('example-receipt.pdf', pdf);
  console.log('PDF generado: example-receipt.pdf');
}

main();
