// libs/email/templates/payment-overdue.tsx
import { Button, Section, Text } from '@react-email/components';
import { BaseLayout } from './base-layout';

/**
 * Props for the PaymentOverdueEmail component.
 */
export interface PaymentOverdueEmailProps {
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
  /** Original invoice due date formatted as string */
  dueDate: string;
  /** Number of days the payment is overdue */
  daysOverdue: number;
  /** URL to view and pay the invoice */
  invoiceUrl: string;
}

/**
 * Email template for PAYMENT_OVERDUE notification.
 * Sent to the debtor when an invoice payment is past due.
 *
 * @param props - Component props with overdue payment details
 * @returns React element for the payment overdue email
 */
export function PaymentOverdueEmail({
  recipientName,
  invoiceNumber,
  issuerName,
  amount,
  currency,
  dueDate,
  daysOverdue,
  invoiceUrl,
}: PaymentOverdueEmailProps) {
  const previewText = `Urgent: Invoice ${invoiceNumber} is ${daysOverdue} days overdue`;

  return (
    <BaseLayout preview={previewText} heading="Payment Overdue">
      <Text style={paragraph}>Hi {recipientName},</Text>

      <Text style={paragraph}>
        Your payment for an invoice from <strong>{issuerName}</strong> is now
        overdue. Please settle this payment as soon as possible.
      </Text>

      <Section style={alertBanner}>
        <Text style={alertText}>
          ⚠️ {daysOverdue} {daysOverdue === 1 ? 'day' : 'days'} overdue
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
          <strong>Original Due Date:</strong> {dueDate}
        </Text>
        <Text style={detailRowWarning}>
          <strong>Status:</strong> OVERDUE
        </Text>
      </Section>

      <Section style={buttonContainer}>
        <Button style={buttonUrgent} href={invoiceUrl}>
          Pay Now
        </Button>
      </Section>

      <Text style={paragraph}>
        Please make the payment immediately to avoid any additional penalties or
        actions. If you are experiencing difficulties making the payment, please
        contact the issuer directly.
      </Text>

      <Text style={paragraph}>
        If you have already made this payment, please disregard this notice and
        allow a few business days for processing.
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

const alertBanner = {
  backgroundColor: '#f8d7da',
  borderRadius: '4px',
  padding: '12px',
  margin: '16px 0',
  textAlign: 'center' as const,
};

const alertText = {
  color: '#721c24',
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

const detailRowWarning = {
  color: '#dc3545',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '8px 0',
  fontWeight: '600',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '24px 0',
};

const buttonUrgent = {
  backgroundColor: '#dc3545',
  borderRadius: '4px',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
};

export default PaymentOverdueEmail;
