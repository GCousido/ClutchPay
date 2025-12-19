// libs/email/templates/invoice-canceled.tsx
import { Button, Section, Text } from '@react-email/components';
import { BaseLayout } from './base-layout';

/**
 * Props for the InvoiceCanceledEmail component.
 */
export interface InvoiceCanceledEmailProps {
  /** Name of the recipient (debtor) */
  recipientName: string;
  /** Invoice number identifier */
  invoiceNumber: string;
  /** Name of the invoice issuer who canceled the invoice */
  issuerName: string;
  /** Invoice amount formatted as string (e.g., "100.00") */
  amount: string;
  /** Currency code (e.g., "EUR", "USD") */
  currency: string;
  /** Optional reason for cancellation */
  reason?: string;
  /** URL to the dashboard */
  dashboardUrl: string;
}

/**
 * Email template for INVOICE_CANCELED notification.
 * Sent to the debtor when an invoice issued to them has been canceled.
 *
 * @param props - Component props with cancellation details
 * @returns React element for the invoice canceled email
 */
export function InvoiceCanceledEmail({
  recipientName,
  invoiceNumber,
  issuerName,
  amount,
  currency,
  reason,
  dashboardUrl,
}: InvoiceCanceledEmailProps) {
  const previewText = `Invoice ${invoiceNumber} has been canceled`;

  return (
    <BaseLayout preview={previewText} heading="Invoice Canceled">
      <Text style={paragraph}>Hi {recipientName},</Text>

      <Text style={paragraph}>
        We wanted to inform you that an invoice from <strong>{issuerName}</strong>{' '}
        has been canceled.
      </Text>

      <Section style={canceledBadge}>
        <Text style={canceledText}>✕ Invoice Canceled</Text>
      </Section>

      <Section style={invoiceDetails}>
        <Text style={detailRow}>
          <strong>Invoice Number:</strong> {invoiceNumber}
        </Text>
        <Text style={detailRow}>
          <strong>Original Amount:</strong> {amount} {currency}
        </Text>
        <Text style={detailRow}>
          <strong>Issued By:</strong> {issuerName}
        </Text>
        {reason && (
          <Text style={detailRow}>
            <strong>Reason:</strong> {reason}
          </Text>
        )}
      </Section>

      <Text style={paragraph}>
        You no longer need to make any payment for this invoice. If you have
        already made a payment, please contact the issuer directly to arrange a
        refund.
      </Text>

      <Section style={buttonContainer}>
        <Button style={button} href={dashboardUrl}>
          Go to Dashboard
        </Button>
      </Section>

      <Text style={paragraph}>
        If you have any questions about this cancellation, please reach out to{' '}
        <strong>{issuerName}</strong> directly.
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

const canceledBadge = {
  backgroundColor: '#e2e3e5',
  borderRadius: '4px',
  padding: '12px',
  margin: '16px 0',
  textAlign: 'center' as const,
};

const canceledText = {
  color: '#383d41',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0',
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

export default InvoiceCanceledEmail;
