// libs/email/templates/index.ts
/**
 * React Email templates for ClutchPay notifications.
 * Each template corresponds to a NotificationType and provides
 * a consistent, branded email experience.
 */

export {
    InvoiceCanceledEmail,
    type InvoiceCanceledEmailProps
} from './invoice-canceled';

export {
    InvoiceIssuedEmail,
    type InvoiceIssuedEmailProps
} from './invoice-issued';

export {
    PaymentDueEmail,
    type PaymentDueEmailProps
} from './payment-due';

export {
    PaymentOverdueEmail,
    type PaymentOverdueEmailProps
} from './payment-overdue';

export {
    PaymentReceivedEmail,
    type PaymentReceivedEmailProps
} from './payment-received';

export { BaseLayout, type BaseLayoutProps } from './base-layout';

