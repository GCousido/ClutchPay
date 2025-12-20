// libs/email/templates/payment-received.tsx
import { Button, Section, Text } from '@react-email/components';
import { BaseLayout } from './base-layout';

/**
 * Props for the PaymentReceivedEmail component.
 */
export interface PaymentReceivedEmailProps {
  /** Name of the recipient (invoice issuer) */
  recipientName: string;
  /** Invoice number identifier */
  invoiceNumber: string;
  /** Name of the payer (debtor) */
  payerName: string;
  /** Payment amount formatted as string (e.g., "100.00") */
  amount: string;
  /** Currency code (e.g., "EUR", "USD") */
  currency: string;
  /** Payment date formatted as string */
  paymentDate: string;
  /** Payment method used (e.g., "PayPal", "Visa") */
  paymentMethod: string;
  /** URL to view the invoice/payment details */
  invoiceUrl: string;
}

/**
 * Email template for PAYMENT_RECEIVED notification.
 * Sent to the invoice issuer when a payment is received for their invoice.
 *
 * @param props - Component props with payment details
 * @returns React element for the payment received email
 */
export function PaymentReceivedEmail({
  recipientName,
  invoiceNumber,
  payerName,
  amount,
  currency,
  paymentDate,
  paymentMethod,
  invoiceUrl,
}: PaymentReceivedEmailProps) {
  const previewText = `Payment received for invoice ${invoiceNumber}`;

  return (
    <BaseLayout preview={previewText} heading="Payment Received">
      <Text style={paragraph}>Hi {recipientName},</Text>

      <Text style={paragraph}>
        Great news! You have received a payment from <strong>{payerName}</strong>.
      </Text>

      <Section style={paymentDetails}>
        <Text style={detailRow}>
          <strong>Invoice Number:</strong> {invoiceNumber}
        </Text>
        <Text style={detailRow}>
          <strong>Amount Received:</strong> {amount} {currency}
        </Text>
        <Text style={detailRow}>
          <strong>Payment Date:</strong> {paymentDate}
        </Text>
        <Text style={detailRow}>
          <strong>Payment Method:</strong> {paymentMethod}
        </Text>
      </Section>

      <Section style={successBadge}>
        <Text style={successText}>✓ Payment Confirmed</Text>
      </Section>

      <Section style={buttonContainer}>
        <Button style={button} href={invoiceUrl}>
          View Details
        </Button>
      </Section>

      <Text style={paragraph}>
        The payment has been processed successfully. You can view the full
        details and download the receipt from your dashboard.
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

const paymentDetails = {
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

const successBadge = {
  backgroundColor: '#d4edda',
  borderRadius: '4px',
  padding: '12px',
  margin: '16px 0',
  textAlign: 'center' as const,
};

const successText = {
  color: '#155724',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0',
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

export default PaymentReceivedEmail;
