import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import SVGtoPDF from 'svg-to-pdfkit';

// Brand colors
const COLORS = {
  primary: '#22c55e',      // Green 500
  primaryLight: '#4ade80', // Green 400
  primaryDark: '#16a34a',  // Green 600
  text: '#1f2937',         // Gray 800
  textLight: '#6b7280',    // Gray 500
  background: '#f0fdf4',   // Green 50
  white: '#ffffff',
};

interface ReceiptData {
  paymentReference: string;
  paymentDate: Date;
  amount: number;
  currency: string;
  paymentMethod: string;
  invoiceNumber: string;
  subject: string;
  payerName: string;
  payerEmail: string;
  receiverName: string;
  receiverEmail: string;
}

/**
 * Generates an elegant PDF receipt for a payment with ClutchPay branding
 * @param data Payment and invoice data
 * @returns Promise resolving to a Buffer containing the PDF
 */
export async function generateReceiptPdf(data: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ 
      margin: 50,
      size: 'A4',
      bufferPages: true,
    });
    const buffers: Buffer[] = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err) => reject(err));

    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - 100; // 50px margins on each side

    // ===== HEADER WITH GRADIENT EFFECT =====
    // Draw header background
    doc
      .rect(0, 0, pageWidth, 120)
      .fill(COLORS.primary);

    // Add subtle gradient overlay
    const gradient = doc.linearGradient(0, 0, pageWidth, 120);
    gradient.stop(0, COLORS.primaryLight, 0.3);
    gradient.stop(1, COLORS.primaryDark, 0.3);
    doc.rect(0, 0, pageWidth, 120).fill(gradient);

    // Try to add logo with white background
    try {
      const logoPath = path.join(process.cwd(), 'src', 'public', 'logo.svg');
      if (fs.existsSync(logoPath)) {
        // White rounded background for logo
        doc
          .roundedRect(45, 30, 160, 60, 8)
          .fill(COLORS.white);
        const svgContent = fs.readFileSync(logoPath, 'utf-8');
        SVGtoPDF(doc, svgContent, 50, 35, { width: 150, height: 50 });
      }
    } catch {
      // Fallback: text logo with white background
      doc
        .roundedRect(45, 30, 160, 60, 8)
        .fill(COLORS.white);
      doc
        .fontSize(28)
        .fillColor(COLORS.primary)
        .text('ClutchPay', 50, 45, { continued: false });
    }

    // Receipt title
    doc
      .fontSize(16)
      .fillColor(COLORS.white)
      .text('PAYMENT RECEIPT', pageWidth - 200, 50, { 
        width: 150,
        align: 'right',
      });

    // ===== MAIN CONTENT =====
    doc.y = 150;

    // ===== PAYMENT DETAILS SECTION =====
    const sectionY = doc.y;
    
    // Left column - Payment Details
    doc
      .fontSize(14)
      .fillColor(COLORS.primary)
      .text('Payment Details', 50, sectionY);
    
    doc.y = sectionY + 25;
    const detailsStartY = doc.y;
    
    const addDetailRow = (label: string, value: string, x: number, y: number) => {
      doc
        .fontSize(10)
        .fillColor(COLORS.textLight)
        .text(label, x, y);
      doc
        .fontSize(11)
        .fillColor(COLORS.text)
        .text(value, x, y + 14);
    };

    addDetailRow('Reference', data.paymentReference, 50, detailsStartY);
    addDetailRow('Date', data.paymentDate.toLocaleString('es-ES', {
      dateStyle: 'long',
      timeStyle: 'short',
    }), 50, detailsStartY + 40);
    addDetailRow('Method', data.paymentMethod, 50, detailsStartY + 80);
    addDetailRow('Amount', `${(data.amount / 100).toFixed(2)} ${data.currency.toUpperCase()}`, 50, detailsStartY + 120);
    addDetailRow('Status', 'COMPLETED', 50, detailsStartY + 160);

    // Right column - Invoice Details
    doc
      .fontSize(14)
      .fillColor(COLORS.primary)
      .text('Invoice Information', 320, sectionY);

    addDetailRow('Invoice Number', data.invoiceNumber, 320, detailsStartY);
    addDetailRow('Subject', data.subject, 320, detailsStartY + 40);

    doc.y = detailsStartY + 200;

    // Divider
    doc
      .moveTo(50, doc.y)
      .lineTo(pageWidth - 50, doc.y)
      .strokeColor(COLORS.primaryLight)
      .lineWidth(1)
      .stroke();

    doc.moveDown(0.5);

    // ===== PARTIES SECTION =====
    const partiesY = doc.y;

    // Payer box
    doc
      .roundedRect(50, partiesY, contentWidth / 2 - 20, 70, 8)
      .fillColor(COLORS.background)
      .fill();

    doc
      .fontSize(11)
      .fillColor(COLORS.primary)
      .text('From (Payer)', 65, partiesY + 10);
    doc
      .fontSize(10)
      .fillColor(COLORS.text)
      .text(data.payerName, 65, partiesY + 28);
    doc
      .fontSize(9)
      .fillColor(COLORS.textLight)
      .text(data.payerEmail, 65, partiesY + 43);

    // Receiver box
    const receiverX = 50 + contentWidth / 2 + 10;
    doc
      .roundedRect(receiverX, partiesY, contentWidth / 2 - 10, 70, 8)
      .fillColor(COLORS.background)
      .fill();

    doc
      .fontSize(11)
      .fillColor(COLORS.primary)
      .text('To (Receiver)', receiverX + 15, partiesY + 10);
    doc
      .fontSize(10)
      .fillColor(COLORS.text)
      .text(data.receiverName, receiverX + 15, partiesY + 28);
    doc
      .fontSize(9)
      .fillColor(COLORS.textLight)
      .text(data.receiverEmail, receiverX + 15, partiesY + 43);

    // ===== FOOTER =====
    // Position footer right after parties section
    const footerY = partiesY + 90;
    
    // Footer line
    doc
      .moveTo(50, footerY)
      .lineTo(pageWidth - 50, footerY)
      .strokeColor(COLORS.primaryLight)
      .lineWidth(1)
      .stroke();

    doc
      .fontSize(8)
      .fillColor(COLORS.textLight)
      .text(
        'This is an electronically generated receipt. No signature required.',
        50,
        footerY + 10,
        { align: 'center', width: contentWidth }
      );

    doc
      .fontSize(8)
      .fillColor(COLORS.primary)
      .text(
        'ClutchPay © 2025 | Secure Payment Processing',
        50,
        footerY + 25,
        { align: 'center', width: contentWidth }
      );

    doc.end();
  });
}
