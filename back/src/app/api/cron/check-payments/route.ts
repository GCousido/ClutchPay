// app/api/cron/check-payments/route.ts
import { handleError } from '@/libs/api-helpers';
import {
    checkAndNotifyPaymentDue,
    checkAndNotifyPaymentOverdue,
    cleanupOldReadNotifications,
} from '@/libs/notifications';
import { NextResponse } from 'next/server';

/**
 * GET /api/cron/check-payments
 * Manual trigger for scheduled payment notifications
 * 
 * This endpoint allows manual execution of scheduled tasks:
 * - Check and notify payment due
 * - Check and notify payment overdue
 * - Cleanup old read notifications
 * 
 * Protected with CRON_SECRET header in production.
 * 
 * @param {Request} request - HTTP request with optional query params
 * @param {string} [request.query.task] - Optional task to execute. If omitted, all tasks run:
 *   - 'due': Check invoices due in 3 days and send notifications
 *     * Searches for PENDING/OVERDUE invoices with dueDate within next 3 days
 *     * Creates in-app notification if debtorUser.emailNotifications is enabled
 *     * Sends email notification with PaymentDueEmail template
 *     * Prevents duplicate notifications (checks for existing PAYMENT_DUE notification)
 *     * Example response: { paymentDue: 5 }
 *   
 *   - 'overdue': Check overdue invoices and send notifications
 *     * Searches for PENDING/OVERDUE invoices with dueDate in the past
 *     * Creates in-app notification if debtorUser.emailNotifications is enabled
 *     * Sends email notification with PaymentOverdueEmail template
 *     * Prevents duplicate notifications (checks for existing PAYMENT_OVERDUE notification)
 *     * Example response: { paymentOverdue: 3 }
 *   
 *   - 'cleanup': Delete old read notifications
 *     * Deletes notifications that are read AND updated more than 60 days ago
 *     * Useful for periodic cleanup to reduce database size
 *     * Does NOT delete unread notifications
 *     * Example response: { cleanupOldNotifications: 12 }
 * 
 * @returns {Promise<NextResponse>} JSON response with execution results:
 *   - success: boolean - Whether execution was successful
 *   - message: string - Human readable message
 *   - results: object - Count of items processed per task:
 *     * paymentDue: number (if task='due' or no task specified)
 *     * paymentOverdue: number (if task='overdue' or no task specified)
 *     * cleanupOldNotifications: number (if task='cleanup' or no task specified)
 *   - timestamp: ISO string - When the request was processed
 * 
 * @example
 * // Execute all tasks
 * GET /api/cron/check-payments
 * // Response: { success: true, results: { paymentDue: 2, paymentOverdue: 1, cleanupOldNotifications: 0 }, ... }
 * 
 * @example
 * // Execute only payment due check
 * GET /api/cron/check-payments?task=due
 * // Response: { success: true, results: { paymentDue: 2 }, ... }
 * 
 * @example
 * // With authentication (production)
 * GET /api/cron/check-payments?task=cleanup \
 *   -H "x-cron-secret: your-cron-secret"
 */
export async function GET(request: Request) {
  try {
    // Verify authorization in production
    const isProduction = process.env.NODE_ENV === 'production';
    const cronSecret = process.env.CRON_SECRET;
    
    if (isProduction && cronSecret) {
      const authHeader = request.headers.get('x-cron-secret');
      
      if (!authHeader || authHeader !== cronSecret) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    const { searchParams } = new URL(request.url);
    const task = searchParams.get('task');

    const results: Record<string, number> = {};

    if (!task || task === 'due') {
      const dueCount = await checkAndNotifyPaymentDue(3);
      results.paymentDue = dueCount;
    }

    if (!task || task === 'overdue') {
      const overdueCount = await checkAndNotifyPaymentOverdue();
      results.paymentOverdue = overdueCount;
    }

    if (!task || task === 'cleanup') {
      const cleanupCount = await cleanupOldReadNotifications(60);
      results.cleanupOldNotifications = cleanupCount;
    }

    return NextResponse.json({
      success: true,
      message: 'Scheduled tasks executed',
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleError(error);
  }
}
