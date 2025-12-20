import { Invoice, NotificationType, Payment, User } from '@prisma/client';
import { db } from './db';
import { sendEmail } from './email';
import {
  InvoiceCanceledEmail,
  InvoiceIssuedEmail,
  PaymentDueEmail,
  PaymentOverdueEmail,
  PaymentReceivedEmail,
} from './email/templates';
import { logger } from './logger';

/**
 * Default currency for notifications (from STRIPE_CURRENCY env or EUR).
 */
const DEFAULT_CURRENCY = (process.env.STRIPE_CURRENCY || 'EUR').toUpperCase();

/**
 * Base URL for generating links in emails (from FRONTEND_URL env).
 */
const APP_URL = process.env.FRONTEND_URL || 'http://localhost:80';

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
 * Email subject templates indexed by notification type.
 */
const EMAIL_SUBJECTS: Record<NotificationType, string> = {
  INVOICE_ISSUED: 'New Invoice {invoiceNumber} from {issuerName}',
  PAYMENT_DUE: 'Payment Reminder: Invoice {invoiceNumber}',
  PAYMENT_OVERDUE: 'Urgent: Invoice {invoiceNumber} is Overdue',
  PAYMENT_RECEIVED: 'Payment Received for Invoice {invoiceNumber}',
  INVOICE_CANCELED: 'Invoice {invoiceNumber} Canceled',
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
 * Extended invoice type with user relations for notification functions.
 */
export type InvoiceWithUsers = Invoice & {
  issuerUser: User;
  debtorUser: User;
  payment?: Payment | null;
};

/**
 * Formats a user's full name from their name and surnames.
 *
 * @param user - User object with name and surnames
 * @returns Formatted full name
 */
function formatUserName(user: User): string {
  return `${user.name} ${user.surnames}`;
}

/**
 * Calculates the number of days between two dates.
 *
 * @param date1 - First date
 * @param date2 - Second date
 * @returns Number of days difference (can be negative)
 */
function daysDifference(date1: Date, date2: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((date1.getTime() - date2.getTime()) / msPerDay);
}

/**
 * Builds an email subject by replacing placeholders with actual values.
 *
 * @param type - The notification type
 * @param context - The context data for placeholder replacement
 * @returns The formatted email subject
 */
function buildEmailSubject(
  type: NotificationType,
  context: NotificationContext
): string {
  let subject = EMAIL_SUBJECTS[type];

  if (context.invoiceNumber) {
    subject = subject.replace('{invoiceNumber}', context.invoiceNumber);
  }
  if (context.issuerName) {
    subject = subject.replace('{issuerName}', context.issuerName);
  }

  return subject;
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
 * Notifies the debtor about the new invoice and sends email if enabled.
 *
 * @param invoice - The invoice that was created (with issuerUser and debtorUser relations)
 */
export async function notifyInvoiceIssued(
  invoice: InvoiceWithUsers
) {
  // Create in-app notification
  await createNotification(
    invoice.debtorUserId,
    invoice.id,
    NotificationType.INVOICE_ISSUED
  );
  logger.info('Notification', 'Invoice issued notification created', {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    debtorId: invoice.debtorUserId,
  });

  // Send email notification if user has email notifications enabled
  if (invoice.debtorUser.emailNotifications) {
    const context: NotificationContext = {
      invoiceNumber: invoice.invoiceNumber,
      issuerName: formatUserName(invoice.issuerUser),
    };

    await sendEmail({
      to: invoice.debtorUser.email,
      subject: buildEmailSubject(NotificationType.INVOICE_ISSUED, context),
      react: InvoiceIssuedEmail({
        recipientName: formatUserName(invoice.debtorUser),
        invoiceNumber: invoice.invoiceNumber,
        issuerName: formatUserName(invoice.issuerUser),
        amount: invoice.amount.toString(),
        currency: DEFAULT_CURRENCY,
        dueDate: invoice.dueDate
          ? new Date(invoice.dueDate).toLocaleDateString()
          : undefined,
        subject: invoice.subject,
        invoiceUrl: `${APP_URL}/main.html`,
      }),
    });
    logger.info('Email', 'Invoice issued email sent', {
      to: invoice.debtorUser.email,
      invoiceNumber: invoice.invoiceNumber,
    });
  }
}

/**
 * Creates a notification when a payment is received.
 * Notifies the invoice issuer about the received payment and sends email if enabled.
 *
 * @param invoice - The invoice that was paid (with issuerUser and debtorUser relations)
 */
export async function notifyPaymentReceived(
  invoice: InvoiceWithUsers
) {
  // Create in-app notification
  await createNotification(
    invoice.issuerUserId,
    invoice.id,
    NotificationType.PAYMENT_RECEIVED
  );
  logger.info('Notification', 'Payment received notification created', {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    issuerId: invoice.issuerUserId,
  });

  // Send email notification if user has email notifications enabled
  if (invoice.issuerUser.emailNotifications) {
    const context: NotificationContext = {
      invoiceNumber: invoice.invoiceNumber,
      debtorName: formatUserName(invoice.debtorUser),
    };

    const paymentDate = invoice.payment?.paymentDate
      ? new Date(invoice.payment.paymentDate).toLocaleDateString()
      : new Date().toLocaleDateString();

    const paymentMethod = invoice.payment?.paymentMethod || 'OTHER';

    await sendEmail({
      to: invoice.issuerUser.email,
      subject: buildEmailSubject(NotificationType.PAYMENT_RECEIVED, context),
      react: PaymentReceivedEmail({
        recipientName: formatUserName(invoice.issuerUser),
        invoiceNumber: invoice.invoiceNumber,
        payerName: formatUserName(invoice.debtorUser),
        amount: invoice.amount.toString(),
        currency: DEFAULT_CURRENCY,
        paymentDate,
        paymentMethod,
        invoiceUrl: `${APP_URL}/main.html`,
      }),
    });
    logger.info('Email', 'Payment received email sent', {
      to: invoice.issuerUser.email,
      invoiceNumber: invoice.invoiceNumber,
    });
  }
}

/**
 * Creates a notification when an invoice is canceled.
 * Notifies the debtor about the cancellation and sends email if enabled.
 *
 * @param invoice - The invoice that was canceled (with issuerUser and debtorUser relations)
 * @param reason - Optional reason for the cancellation
 */
export async function notifyInvoiceCanceled(
  invoice: InvoiceWithUsers,
  reason?: string
) {
  // Create in-app notification
  await createNotification(
    invoice.debtorUserId,
    invoice.id,
    NotificationType.INVOICE_CANCELED
  );
  logger.info('Notification', 'Invoice canceled notification created', {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    debtorId: invoice.debtorUserId,
    reason,
  });

  // Send email notification if user has email notifications enabled
  if (invoice.debtorUser.emailNotifications) {
    const context: NotificationContext = {
      invoiceNumber: invoice.invoiceNumber,
      issuerName: formatUserName(invoice.issuerUser),
    };

    await sendEmail({
      to: invoice.debtorUser.email,
      subject: buildEmailSubject(NotificationType.INVOICE_CANCELED, context),
      react: InvoiceCanceledEmail({
        recipientName: formatUserName(invoice.debtorUser),
        invoiceNumber: invoice.invoiceNumber,
        issuerName: formatUserName(invoice.issuerUser),
        amount: invoice.amount.toString(),
        currency: DEFAULT_CURRENCY,
        reason,
        dashboardUrl: `${APP_URL}/dashboard`,
      }),
    });
    logger.info('Email', 'Invoice canceled email sent', {
      to: invoice.debtorUser.email,
      invoiceNumber: invoice.invoiceNumber,
    });
  }
}

/**
 * Creates a notification when an invoice is approaching its due date.
 * Notifies the debtor about the upcoming payment deadline and sends email if enabled.
 *
 * @param invoice - The invoice with upcoming due date (with issuerUser and debtorUser relations)
 */
export async function notifyPaymentDue(
  invoice: InvoiceWithUsers
) {
  // Create in-app notification
  await createNotification(
    invoice.debtorUserId,
    invoice.id,
    NotificationType.PAYMENT_DUE
  );
  logger.info('Notification', 'Payment due notification created', {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    debtorId: invoice.debtorUserId,
    dueDate: invoice.dueDate,
  });

  // Send email notification if user has email notifications enabled
  if (invoice.debtorUser.emailNotifications && invoice.dueDate) {
    const context: NotificationContext = {
      invoiceNumber: invoice.invoiceNumber,
      issuerName: formatUserName(invoice.issuerUser),
    };

    const daysUntilDue = daysDifference(new Date(invoice.dueDate), new Date());

    await sendEmail({
      to: invoice.debtorUser.email,
      subject: buildEmailSubject(NotificationType.PAYMENT_DUE, context),
      react: PaymentDueEmail({
        recipientName: formatUserName(invoice.debtorUser),
        invoiceNumber: invoice.invoiceNumber,
        issuerName: formatUserName(invoice.issuerUser),
        amount: invoice.amount.toString(),
        currency: DEFAULT_CURRENCY,
        dueDate: new Date(invoice.dueDate).toLocaleDateString(),
        daysUntilDue: Math.max(0, daysUntilDue),
        invoiceUrl: `${APP_URL}/main.html`,
      }),
    });
    logger.info('Email', 'Payment due email sent', {
      to: invoice.debtorUser.email,
      invoiceNumber: invoice.invoiceNumber,
      daysUntilDue,
    });
  }
}

/**
 * Creates a notification when an invoice becomes overdue.
 * Notifies the debtor about the overdue status and sends email if enabled.
 *
 * @param invoice - The overdue invoice (with issuerUser and debtorUser relations)
 */
export async function notifyPaymentOverdue(
  invoice: InvoiceWithUsers
) {
  // Create in-app notification
  await createNotification(
    invoice.debtorUserId,
    invoice.id,
    NotificationType.PAYMENT_OVERDUE
  );
  logger.info('Notification', 'Payment overdue notification created', {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    debtorId: invoice.debtorUserId,
    dueDate: invoice.dueDate,
  });

  // Send email notification if user has email notifications enabled
  if (invoice.debtorUser.emailNotifications && invoice.dueDate) {
    const context: NotificationContext = {
      invoiceNumber: invoice.invoiceNumber,
      issuerName: formatUserName(invoice.issuerUser),
    };

    const daysOverdue = daysDifference(new Date(), new Date(invoice.dueDate));

    await sendEmail({
      to: invoice.debtorUser.email,
      subject: buildEmailSubject(NotificationType.PAYMENT_OVERDUE, context),
      react: PaymentOverdueEmail({
        recipientName: formatUserName(invoice.debtorUser),
        invoiceNumber: invoice.invoiceNumber,
        issuerName: formatUserName(invoice.issuerUser),
        amount: invoice.amount.toString(),
        currency: DEFAULT_CURRENCY,
        dueDate: new Date(invoice.dueDate).toLocaleDateString(),
        daysOverdue: Math.max(1, daysOverdue),
        invoiceUrl: `${APP_URL}/main.html`,
      }),
    });
    logger.info('Email', 'Payment overdue email sent', {
      to: invoice.debtorUser.email,
      invoiceNumber: invoice.invoiceNumber,
      daysOverdue,
    });
  }
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
    invoice: InvoiceWithUsers;
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

/**
 * Checks for invoices that are due soon (within specified days) and sends notifications.
 * Only notifies once per invoice - checks if a PAYMENT_DUE notification already exists.
 * 
 * @param daysBeforeDue - Number of days before due date to send notification (default: 3)
 * @returns Count of notifications sent
 */
export async function checkAndNotifyPaymentDue(daysBeforeDue: number = 3): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + daysBeforeDue);
  targetDate.setHours(23, 59, 59, 999);

  // Find pending/overdue invoices with due date within the target window
  const invoices = await db.invoice.findMany({
    where: {
      status: {
        in: ['PENDING', 'OVERDUE'],
      },
      dueDate: {
        gte: today,
        lte: targetDate,
      },
    },
    include: {
      issuerUser: true,
      debtorUser: true,
      payment: true,
      notifications: {
        where: {
          type: NotificationType.PAYMENT_DUE,
        },
      },
    },
  });

  let count = 0;
  for (const invoice of invoices) {
    // Skip if already notified about payment due
    if (invoice.notifications.length > 0) {
      continue;
    }

    try {
      await notifyPaymentDue(invoice);
      count++;
    } catch (error) {
      logger.error('Scheduler', `Failed to notify payment due for invoice ${invoice.id}`, error);
    }
  }

  logger.info('Scheduler', 'Payment due check completed', { notificationsSent: count });
  return count;
}

/**
 * Checks for overdue invoices and sends notifications.
 * Only notifies once per invoice - checks if a PAYMENT_OVERDUE notification already exists.
 * 
 * @returns Count of notifications sent
 */
export async function checkAndNotifyPaymentOverdue(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find pending/overdue invoices with due date in the past
  const invoices = await db.invoice.findMany({
    where: {
      status: {
        in: ['PENDING', 'OVERDUE'],
      },
      dueDate: {
        lt: today,
      },
    },
    include: {
      issuerUser: true,
      debtorUser: true,
      payment: true,
      notifications: {
        where: {
          type: NotificationType.PAYMENT_OVERDUE,
        },
      },
    },
  });

  let count = 0;
  for (const invoice of invoices) {
    // Skip if already notified about overdue
    if (invoice.notifications.length > 0) {
      continue;
    }

    try {
      await notifyPaymentOverdue(invoice);
      count++;
    } catch (error) {
      logger.error('Scheduler', `Failed to notify payment overdue for invoice ${invoice.id}`, error);
    }
  }

  logger.info('Scheduler', 'Payment overdue check completed', { notificationsSent: count });
  return count;
}
