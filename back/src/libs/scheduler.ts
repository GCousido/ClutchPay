// libs/scheduler.ts
import cron from 'node-cron';
import {
  checkAndNotifyPaymentDue,
  checkAndNotifyPaymentOverdue,
  cleanupOldReadNotifications,
} from './notifications';
import { logger } from './logger';

/**
 * Starts all scheduled tasks for the application.
 * These tasks run automatically in the background.
 * 
 * Scheduled tasks:
 * - Check payment due: Daily at 9:00 AM
 * - Check payment overdue: Daily at 9:00 AM
 * - Cleanup old notifications: Weekly on Sundays at 2:00 AM
 */
export function startScheduler() {
  logger.info('Scheduler', 'Starting scheduled tasks');

  // Check for invoices due soon (within 3 days) - Daily at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    logger.info('Scheduler', 'Running payment due check');
    try {
      const count = await checkAndNotifyPaymentDue(3);
      logger.info('Scheduler', 'Payment due check completed', { notificationsSent: count });
    } catch (error) {
      logger.error('Scheduler', 'Error checking payment due', error);
    }
  });

  // Check for overdue invoices - Daily at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    logger.info('Scheduler', 'Running payment overdue check');
    try {
      const count = await checkAndNotifyPaymentOverdue();
      logger.info('Scheduler', 'Payment overdue check completed', { notificationsSent: count });
    } catch (error) {
      logger.error('Scheduler', 'Error checking payment overdue', error);
    }
  });

  // Cleanup old read notifications (older than 60 days) - Weekly on Sundays at 2:00 AM
  cron.schedule('0 2 * * 0', async () => {
    logger.info('Scheduler', 'Running notification cleanup');
    try {
      const count = await cleanupOldReadNotifications(60);
      logger.info('Scheduler', 'Notification cleanup completed', { deletedCount: count });
    } catch (error) {
      logger.error('Scheduler', 'Error cleaning up notifications', error);
    }
  });

  logger.info('Scheduler', 'All scheduled tasks registered', {
    tasks: [
      { name: 'paymentDueCheck', schedule: 'Daily at 9:00 AM' },
      { name: 'paymentOverdueCheck', schedule: 'Daily at 9:00 AM' },
      { name: 'notificationCleanup', schedule: 'Sundays at 2:00 AM' },
    ]
  });
}
