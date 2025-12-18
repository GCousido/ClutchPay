// libs/scheduler.ts
import cron from 'node-cron';
import {
  checkAndNotifyPaymentDue,
  checkAndNotifyPaymentOverdue,
  cleanupOldReadNotifications,
} from './notifications';

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
  console.log('[Scheduler] Starting scheduled tasks...');

  // Check for invoices due soon (within 3 days) - Daily at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('[Scheduler] Running payment due check...');
    try {
      await checkAndNotifyPaymentDue(3);
    } catch (error) {
      console.error('[Scheduler] Error checking payment due:', error);
    }
  });

  // Check for overdue invoices - Daily at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('[Scheduler] Running payment overdue check...');
    try {
      await checkAndNotifyPaymentOverdue();
    } catch (error) {
      console.error('[Scheduler] Error checking payment overdue:', error);
    }
  });

  // Cleanup old read notifications (older than 60 days) - Weekly on Sundays at 2:00 AM
  cron.schedule('0 2 * * 0', async () => {
    console.log('[Scheduler] Running notification cleanup...');
    try {
      const count = await cleanupOldReadNotifications(60);
      console.log(`[Scheduler] Deleted ${count} old read notifications`);
    } catch (error) {
      console.error('[Scheduler] Error cleaning up notifications:', error);
    }
  });

  console.log('[Scheduler] All scheduled tasks started successfully');
  console.log('  - Payment due check: Daily at 9:00 AM');
  console.log('  - Payment overdue check: Daily at 9:00 AM');
  console.log('  - Notification cleanup: Sundays at 2:00 AM (60 days old)');
}
