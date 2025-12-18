// libs/email/templates/payment-due.tsx
import { Button, Section, Text } from '@react-email/components';
import { BaseLayout } from './base-layout';

/**
 * Props for the PaymentDueEmail component.
 */
export interface PaymentDueEmailProps {
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
  dueDate: string;
  /** Number of days until the due date */
  daysUntilDue: number;
  /** URL to view and pay the invoice */
  invoiceUrl: string;
}

/**
 * Email template for PAYMENT_DUE notification.
 * Sent to the debtor when an invoice payment deadline is approaching.
 *
 * @param props - Component props with payment reminder details
 * @returns React element for the payment due reminder email
 */
export function PaymentDueEmail({
  recipientName,
  invoiceNumber,
  issuerName,
  amount,
  currency,
  dueDate,
  daysUntilDue,
  invoiceUrl,
}: PaymentDueEmailProps) {
  const previewText = `Reminder: Invoice ${invoiceNumber} is due in ${daysUntilDue} days`;

  return (
    <BaseLayout preview={previewText} heading="Payment Reminder">
      <Text style={paragraph}>Hi {recipientName},</Text>

      <Text style={paragraph}>
        This is a friendly reminder that your payment for an invoice from{' '}
        <strong>{issuerName}</strong> is due soon.
      </Text>

      <Section style={warningBanner}>
        <Text style={warningText}>
          ⏰ Due in {daysUntilDue} {daysUntilDue === 1 ? 'day' : 'days'}
        </Text>
      </Section>

      <Section style={invoiceDetails}>
        <Text style={detailRow}>
          <strong>Invoice Number:</strong> {invoiceNumber}
        </Text>
        <Text style={detailRow}>
          <strong>Amount Due:</strong> {amount} {currency}
        </Text>
        <Text style={detailRow}>
          <strong>Due Date:</strong> {dueDate}
        </Text>
      </Section>

      <Section style={buttonContainer}>
        <Button style={button} href={invoiceUrl}>
          Pay Now
        </Button>
      </Section>

      <Text style={paragraph}>
        Please make sure to complete the payment before the due date to avoid
        any late fees or penalties.
      </Text>

      <Text style={paragraph}>
        If you have already made this payment, please disregard this reminder.
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

const warningBanner = {
  backgroundColor: '#fff3cd',
  borderRadius: '4px',
  padding: '12px',
  margin: '16px 0',
  textAlign: 'center' as const,
};

const warningText = {
  color: '#856404',
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

export default PaymentDueEmail;
