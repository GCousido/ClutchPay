// libs/email/index.ts
import { logger } from '@/libs/logger';
import { Resend } from 'resend';

/**
 * Check if Resend is properly configured with API credentials.
 */
const isResendConfigured = Boolean(process.env.RESEND_API_KEY);

/**
 * Resend client instance configured with API key from environment variables.
 * Returns null if API key is not configured (development/testing mode).
 *
 * Required environment variables:
 * - RESEND_API_KEY: Your Resend API key
 * - RESEND_FROM_EMAIL: The verified sender email address (e.g., 'ClutchPay <noreply@clutchpay.com>')
 */
export const resend = isResendConfigured ? new Resend(process.env.RESEND_API_KEY) : null;

/**
 * Default sender email address for all outgoing emails.
 * Falls back to a development address if not configured.
 */
export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'ClutchPay <noreply@clutchpay.com>';

/**
 * Result of sending an email
 */
export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Parameters for sending an email
 */
export interface SendEmailParams {
  /** Recipient email address */
  to: string;
  /** Email subject line */
  subject: string;
  /** React Email component to render as email body */
  react: React.ReactElement;
}

/**
 * Sends an email using Resend with a React Email template.
 *
 * @param params - Parameters for the email
 * @param params.to - Recipient email address
 * @param params.subject - Email subject line
 * @param params.react - React Email component to render
 * @returns Promise with send result including success status and message ID
 *
 * @example
 * ```typescript
 * import { sendEmail } from '@/libs/email';
 * import { InvoiceIssuedEmail } from '@/libs/email/templates/invoice-issued';
 *
 * await sendEmail({
 *   to: 'user@example.com',
 *   subject: 'New Invoice Issued',
 *   react: InvoiceIssuedEmail({ invoiceNumber: 'INV-001', ... }),
 * });
 * ```
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const { to, subject, react } = params;

  // If Resend is not configured, simulate email sending (development/testing mode)
  if (!resend) {
    const componentName = typeof react?.type === 'function' ? react.type.name : 'Unknown';
    logger.info('Email', 'SIMULATED email (Resend not configured)', {
      to,
      subject,
      component: componentName,
    });
    return {
      success: true,
      messageId: `simulated-${Date.now()}`,
    };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      react,
    });

    if (error) {
      logger.error('Email', 'Failed to send email', { to, subject, error: error.message });
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      messageId: data?.id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Email', 'Exception while sending email', { to, subject, error: errorMessage });
    return {
      success: false,
      error: errorMessage,
    };
  }
}

// Re-export templates for convenience
export * from './templates';

