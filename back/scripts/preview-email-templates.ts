/**
 * Email Template Preview Generator
 * 
 * Generates HTML previews of all email templates with sample data.
 * Optionally converts them to PDF using Puppeteer.
 * 
 * Usage:
 *   npx tsx scripts/preview-email-templates.ts           # Generate HTML files
 *   npx tsx scripts/preview-email-templates.ts --pdf     # Generate HTML + PDF files
 * 
 * Output: back/email-previews/ directory
 */

// Forzar la variable ANTES de cualquier import
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'; // O tu URL de producción si la imagen está subida

import { render } from '@react-email/components';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
    InvoiceCanceledEmail,
    InvoiceIssuedEmail,
    PaymentDueEmail,
    PaymentOverdueEmail,
    PaymentReceivedEmail,
} from '../src/libs/email/templates/index.ts';

// Output directory for generated previews
const OUTPUT_DIR = join(__dirname, '..', 'email-previews');

// Sample data for email templates
const SAMPLE_DATA = {
  invoiceIssued: {
    recipientName: 'Juan García López',
    invoiceNumber: 'INV-2025-001',
    issuerName: 'María Rodríguez Sánchez',
    amount: '1,500.00',
    currency: 'EUR',
    dueDate: '15 de Enero, 2025',
    subject: 'Servicios de desarrollo web - Diciembre 2024',
    invoiceUrl: 'https://clutchpay.com/invoices/123',
  },
  paymentReceived: {
    recipientName: 'María Rodríguez Sánchez',
    invoiceNumber: 'INV-2025-001',
    payerName: 'Juan García López',
    amount: '1,500.00',
    currency: 'EUR',
    paymentDate: '10 de Enero, 2025',
    paymentMethod: 'PayPal',
    invoiceUrl: 'https://clutchpay.com/invoices/123',
  },
  paymentDue: {
    recipientName: 'Juan García López',
    invoiceNumber: 'INV-2025-002',
    issuerName: 'Carlos Martínez Pérez',
    amount: '2,800.00',
    currency: 'EUR',
    dueDate: '20 de Enero, 2025',
    daysUntilDue: 3,
    invoiceUrl: 'https://clutchpay.com/invoices/456',
  },
  paymentOverdue: {
    recipientName: 'Juan García López',
    invoiceNumber: 'INV-2024-089',
    issuerName: 'Ana López García',
    amount: '950.00',
    currency: 'EUR',
    dueDate: '1 de Enero, 2025',
    daysOverdue: 17,
    invoiceUrl: 'https://clutchpay.com/invoices/789',
  },
  invoiceCanceled: {
    recipientName: 'Juan García López',
    invoiceNumber: 'INV-2025-003',
    issuerName: 'Pedro Sánchez Ruiz',
    amount: '500.00',
    currency: 'EUR',
    reason: 'Proyecto cancelado por mutuo acuerdo',
    dashboardUrl: 'https://clutchpay.com/dashboard',
  },
};

/**
 * Email template configurations for generation
 */
const TEMPLATES = [
  {
    name: 'invoice-issued',
    title: 'Nueva Factura Emitida',
    component: InvoiceIssuedEmail(SAMPLE_DATA.invoiceIssued),
  },
  {
    name: 'payment-received',
    title: 'Pago Recibido',
    component: PaymentReceivedEmail(SAMPLE_DATA.paymentReceived),
  },
  {
    name: 'payment-due',
    title: 'Recordatorio de Pago',
    component: PaymentDueEmail(SAMPLE_DATA.paymentDue),
  },
  {
    name: 'payment-overdue',
    title: 'Factura Vencida',
    component: PaymentOverdueEmail(SAMPLE_DATA.paymentOverdue),
  },
  {
    name: 'invoice-canceled',
    title: 'Factura Cancelada',
    component: InvoiceCanceledEmail(SAMPLE_DATA.invoiceCanceled),
  },
];

/**
 * Generates HTML preview files for all email templates.
 */
async function generateHtmlPreviews(): Promise<void> {
  // Create output directory if it doesn't exist
  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('📧 Generating email template previews...\n');

  for (const template of TEMPLATES) {
    try {
      const html = await render(template.component);
      const filePath = join(OUTPUT_DIR, `${template.name}.html`);
      writeFileSync(filePath, html);
      console.log(`  ✅ ${template.title} → ${template.name}.html`);
    } catch (error) {
      console.error(`  ❌ ${template.title}: ${error}`);
    }
  }

  console.log(`\n📁 HTML files saved to: ${OUTPUT_DIR}`);
}

/**
 * Converts HTML files to PDF using Puppeteer.
 */
async function generatePdfPreviews(): Promise<void> {
  let puppeteer;
  try {
    puppeteer = await import('puppeteer');
  } catch {
    console.error('\n❌ Puppeteer not found. Install it with: pnpm add -D puppeteer');
    return;
  }

  console.log('\n📄 Converting to PDF...\n');

  const browser = await puppeteer.default.launch();
  const page = await browser.newPage();

  for (const template of TEMPLATES) {
    try {
      const htmlPath = join(OUTPUT_DIR, `${template.name}.html`);
      const pdfPath = join(OUTPUT_DIR, `${template.name}.pdf`);

      await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });
      await page.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' },
      });

      console.log(`  ✅ ${template.title} → ${template.name}.pdf`);
    } catch (error) {
      console.error(`  ❌ ${template.title}: ${error}`);
    }
  }

  await browser.close();
  console.log(`\n📁 PDF files saved to: ${OUTPUT_DIR}`);
}

/**
 * Generates an index HTML page with links to all previews.
 */
function generateIndexPage(): void {
  const indexHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ClutchPay - Email Templates Preview</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      background: #f5f5f5;
    }
    h1 {
      color: #1a1a2e;
      margin-bottom: 8px;
    }
    p.subtitle {
      color: #666;
      margin-bottom: 32px;
    }
    .templates {
      display: grid;
      gap: 16px;
    }
    .template-card {
      background: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .template-card h2 {
      margin: 0 0 8px;
      color: #333;
      font-size: 18px;
    }
    .template-card p {
      margin: 0 0 16px;
      color: #666;
      font-size: 14px;
    }
    .template-card a {
      display: inline-block;
      padding: 8px 16px;
      background: #556cd6;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-size: 14px;
      margin-right: 8px;
    }
    .template-card a:hover {
      background: #4555b5;
    }
    .template-card a.pdf {
      background: #dc3545;
    }
    .template-card a.pdf:hover {
      background: #c82333;
    }
  </style>
</head>
<body>
  <h1>📧 ClutchPay Email Templates</h1>
  <p class="subtitle">Preview de los templates de correo electrónico</p>
  
  <div class="templates">
    ${TEMPLATES.map(t => `
    <div class="template-card">
      <h2>${t.title}</h2>
      <p>Template: ${t.name}</p>
      <a href="${t.name}.html" target="_blank">Ver HTML</a>
      <a href="${t.name}.pdf" target="_blank" class="pdf">Ver PDF</a>
    </div>
    `).join('')}
  </div>
  
  <p style="margin-top: 32px; color: #999; font-size: 12px;">
    Generado el ${new Date().toLocaleString('es-ES')}
  </p>
</body>
</html>
  `.trim();

  writeFileSync(join(OUTPUT_DIR, 'index.html'), indexHtml);
  console.log('\n📋 Index page generated: index.html');
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const generatePdf = process.argv.includes('--pdf');

  console.log('═══════════════════════════════════════════════');
  console.log('       ClutchPay Email Template Generator       ');
  console.log('═══════════════════════════════════════════════\n');

  await generateHtmlPreviews();
  generateIndexPage();

  if (generatePdf) {
    await generatePdfPreviews();
  } else {
    console.log('\n💡 Tip: Use --pdf flag to also generate PDF files');
  }

  console.log('\n✨ Done!\n');
}

main().catch(console.error);
