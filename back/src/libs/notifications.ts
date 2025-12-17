import { Invoice, NotificationType, User } from '@prisma/client';
import { db } from './db';

/**
 * Notification message templates indexed by notification type.
 * Placeholders: {invoiceNumber}, {issuerName}, {debtorName}, {amount}, {currency}, {dueDate}
 */
const NOTIFICATION_MESSAGES: Record<NotificationType, string> = {
  INVOICE_ISSUED: 'New invoice {invoiceNumber} for {amount} has been issued to you by {issuerName}.',
  PAYMENT_DUE: 'Payment for invoice {invoiceNumber} ({amount}) is due on {dueDate}.',
  PAYMENT_OVERDUE: 'Invoice {invoiceNumber} ({amount}) is overdue. Please make payment as soon as possible.',
  PAYMENT_RECEIVED: 'Payment of {amount} for invoice {invoiceNumber} has been received from {debtorName}.',
  INVOICE_CANCELED: 'Invoice {invoiceNumber} ({amount}) has been canceled by {issuerName}.',
};

/**
 * Context data for building notification messages
 */
export interface NotificationContext {
  invoiceNumber?: string;
  issuerName?: string;
  debtorName?: string;
  amount?: string;
  currency?: string;
  dueDate?: string;
}

/**
 * Builds a notification message by replacing placeholders with actual values.
 * 
 * @param type - The notification type
 * @param context - The context data for placeholder replacement
 * @returns The formatted notification message
 */
export function buildNotificationMessage(
  type: NotificationType,
  context: NotificationContext
): string {
  let message = NOTIFICATION_MESSAGES[type];

  // Replace all placeholders with context values
  if (context.invoiceNumber) {
    message = message.replace('{invoiceNumber}', context.invoiceNumber);
  }
  if (context.issuerName) {
    message = message.replace('{issuerName}', context.issuerName);
  }
  if (context.debtorName) {
    message = message.replace('{debtorName}', context.debtorName);
  }
  if (context.amount) {
    const formattedAmount = context.currency 
      ? `${context.amount} ${context.currency.toUpperCase()}`
      : context.amount;
    message = message.replace('{amount}', formattedAmount);
  }
  if (context.dueDate) {
    message = message.replace('{dueDate}', context.dueDate);
  }

  return message;
}

/**
 * Creates a notification for a specific user.
 * 
 * @param userId - The ID of the user to notify
 * @param invoiceId - The ID of the related invoice
 * @param type - The notification type
 * @returns The created notification
 */
export async function createNotification(
  userId: number,
  invoiceId: number,
  type: NotificationType
) {
  return db.notification.create({
    data: {
      userId,
      invoiceId,
      type,
      read: false,
    },
  });
}

/**
 * Creates a notification when a new invoice is issued.
 * Notifies the debtor about the new invoice.
 * 
 * @param invoice - The invoice that was created (with issuerUser and debtorUser relations)
 */
export async function notifyInvoiceIssued(
  invoice: Invoice & { issuerUser: User; debtorUser: User }
) {
  await createNotification(
    invoice.debtorUserId,
    invoice.id,
    NotificationType.INVOICE_ISSUED
  );
}

/**
 * Creates a notification when a payment is received.
 * Notifies the invoice issuer about the received payment.
 * 
 * @param invoice - The invoice that was paid (with issuerUser and debtorUser relations)
 */
export async function notifyPaymentReceived(
  invoice: Invoice & { issuerUser: User; debtorUser: User }
) {
  await createNotification(
    invoice.issuerUserId,
    invoice.id,
    NotificationType.PAYMENT_RECEIVED
  );
}

/**
 * Creates a notification when an invoice is canceled.
 * Notifies the debtor about the cancellation.
 * 
 * @param invoice - The invoice that was canceled (with issuerUser and debtorUser relations)
 */
export async function notifyInvoiceCanceled(
  invoice: Invoice & { issuerUser: User; debtorUser: User }
) {
  await createNotification(
    invoice.debtorUserId,
    invoice.id,
    NotificationType.INVOICE_CANCELED
  );
}

/**
 * Creates a notification when an invoice is approaching its due date.
 * Notifies the debtor about the upcoming payment deadline.
 * 
 * @param invoice - The invoice with upcoming due date (with issuerUser and debtorUser relations)
 */
export async function notifyPaymentDue(
  invoice: Invoice & { issuerUser: User; debtorUser: User }
) {
  await createNotification(
    invoice.debtorUserId,
    invoice.id,
    NotificationType.PAYMENT_DUE
  );
}

/**
 * Creates a notification when an invoice becomes overdue.
 * Notifies the debtor about the overdue status.
 * 
 * @param invoice - The overdue invoice (with issuerUser and debtorUser relations)
 */
export async function notifyPaymentOverdue(
  invoice: Invoice & { issuerUser: User; debtorUser: User }
) {
  await createNotification(
    invoice.debtorUserId,
    invoice.id,
    NotificationType.PAYMENT_OVERDUE
  );
}

/**
 * Formats a notification for API response with the constructed message.
 * 
 * @param notification - The notification from database with invoice and user relations
 * @returns Formatted notification object for API response
 */
export function formatNotificationResponse(
  notification: {
    id: number;
    userId: number;
    invoiceId: number;
    type: NotificationType;
    read: boolean;
    createdAt: Date;
    invoice: Invoice & { issuerUser: User; debtorUser: User };
  }
) {
  const { invoice } = notification;
  
  const context: NotificationContext = {
    invoiceNumber: invoice.invoiceNumber,
    issuerName: `${invoice.issuerUser.name} ${invoice.issuerUser.surnames}`,
    debtorName: `${invoice.debtorUser.name} ${invoice.debtorUser.surnames}`,
    amount: invoice.amount.toString(),
    currency: 'EUR', // Default currency, TODO:
    dueDate: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : undefined,
  };

  return {
    id: notification.id,
    userId: notification.userId,
    invoiceId: notification.invoiceId,
    type: notification.type,
    read: notification.read,
    message: buildNotificationMessage(notification.type, context),
    createdAt: notification.createdAt,
  };
}

/**
 * Deletes read notifications older than the specified number of days.
 * This is used for periodic cleanup of old read notifications.
 * 
 * @param daysOld - Number of days after which read notifications should be deleted (default: 30)
 * @returns The count of deleted notifications
 */
export async function cleanupOldReadNotifications(daysOld: number = 30): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await db.notification.deleteMany({
    where: {
      read: true,
      updatedAt: {
        lt: cutoffDate,
      },
    },
  });

  return result.count;
}
