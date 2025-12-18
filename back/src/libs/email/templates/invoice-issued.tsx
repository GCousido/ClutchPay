// libs/email/templates/invoice-issued.tsx
import { Button, Section, Text } from '@react-email/components';
import { BaseLayout } from './base-layout';

/**
 * Props for the InvoiceIssuedEmail component.
 */
export interface InvoiceIssuedEmailProps {
  /** Name of the recipient (debtor) */
  recipientName: string;
  /** Invoice number identifier */
  invoiceNumber: string;
  /** Name of the invoice issuer */
  issuerName: string;
  /** Invoice amount formatted as string (e.g., "100.00") */
  amount: string;
  /** Currency code (e.g., "EUR", "USD") */
  currency: string;
  /** Invoice due date formatted as string */
  dueDate?: string;
  /** Subject/description of the invoice */
  subject: string;
  /** URL to view the invoice */
  invoiceUrl: string;
}

/**
 * Email template for INVOICE_ISSUED notification.
 * Sent to the debtor when a new invoice is issued to them.
 *
 * @param props - Component props with invoice details
 * @returns React element for the invoice issued email
 */
export function InvoiceIssuedEmail({
  recipientName,
  invoiceNumber,
  issuerName,
  amount,
  currency,
  dueDate,
  subject,
  invoiceUrl,
}: InvoiceIssuedEmailProps) {
  const previewText = `New invoice ${invoiceNumber} from ${issuerName}`;

  return (
    <BaseLayout preview={previewText} heading="New Invoice Received">
      <Text style={paragraph}>Hi {recipientName},</Text>

      <Text style={paragraph}>
        You have received a new invoice from <strong>{issuerName}</strong>.
      </Text>

      <Section style={invoiceDetails}>
        <Text style={detailRow}>
          <strong>Invoice Number:</strong> {invoiceNumber}
        </Text>
        <Text style={detailRow}>
          <strong>Subject:</strong> {subject}
        </Text>
        <Text style={detailRow}>
          <strong>Amount:</strong> {amount} {currency}
        </Text>
        {dueDate && (
          <Text style={detailRow}>
            <strong>Due Date:</strong> {dueDate}
          </Text>
        )}
      </Section>

      <Section style={buttonContainer}>
        <Button style={button} href={invoiceUrl}>
          View Invoice
        </Button>
      </Section>

      <Text style={paragraph}>
        Please review the invoice and make payment before the due date to avoid
        any late fees.
      </Text>

      <Text style={paragraph}>
        Best regards,
        <br />
        The ClutchPay Team
      </Text>
    </BaseLayout>
  );
}

// Styles
const paragraph = {
  color: '#525f7f',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '16px 0',
};

const invoiceDetails = {
  backgroundColor: '#f6f9fc',
  borderRadius: '4px',
  padding: '16px',
  margin: '24px 0',
};

const detailRow = {
  color: '#525f7f',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '8px 0',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '24px 0',
};

const button = {
  backgroundColor: '#10b981',
  borderRadius: '4px',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
};

export default InvoiceIssuedEmail;
