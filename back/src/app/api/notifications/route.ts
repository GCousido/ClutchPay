import { handleError, requireAuth, validateBody } from '@/libs/api-helpers';
import { db } from '@/libs/db';
import { formatNotificationResponse } from '@/libs/notifications';
import {
    notificationBulkDeleteSchema,
    notificationBulkReadSchema,
    notificationListQuerySchema,
} from '@/libs/validations/notification';
import { NextResponse } from 'next/server';

/**
 * GET /api/notifications
 * 
 * Retrieves a paginated list of notifications for the authenticated user.
 * Supports filtering by read status and notification type, with sorting options.
 * 
 * @param request - The incoming request with query parameters
 * @returns Paginated list of notifications with constructed messages
 * 
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - read: Filter by read status (true/false)
 * - type: Filter by notification type
 * - sortBy: Sort field (createdAt, type, read)
 * - sortOrder: Sort direction (asc, desc)
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    
    const url = new URL(request.url);
    const searchParams = Object.fromEntries(url.searchParams);
    const query = notificationListQuerySchema.parse(searchParams);

    // Build where clause
    const where: Record<string, unknown> = {
      userId: user.id,
    };

    if (query.read !== undefined) {
      where.read = query.read;
    }

    if (query.type) {
      where.type = query.type;
    }

    // Calculate pagination
    const skip = (query.page - 1) * query.limit;

    // Fetch notifications with related data
    const [notifications, total] = await Promise.all([
      db.notification.findMany({
        where,
        include: {
          invoice: {
            include: {
              issuerUser: true,
              debtorUser: true,
            },
          },
        },
        orderBy: {
          [query.sortBy]: query.sortOrder,
        },
        skip,
        take: query.limit,
      }),
      db.notification.count({ where }),
    ]);

    // Format notifications with messages
    const formattedNotifications = notifications.map(formatNotificationResponse);

    // Count unread for convenience
    const unreadCount = await db.notification.count({
      where: { userId: user.id, read: false },
    });

    return NextResponse.json({
      notifications: formattedNotifications,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
      unreadCount,
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PATCH /api/notifications
 * 
 * Marks multiple notifications as read for the authenticated user.
 * Can mark specific notifications by ID or all notifications at once.
 * 
 * @param request - The incoming request with notification IDs or markAllAsRead flag
 * @returns Count of updated notifications
 * 
 * Body:
 * - notificationIds: Array of notification IDs to mark as read
 * - markAllAsRead: Boolean to mark all user notifications as read
 */
export async function PATCH(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const data = validateBody(notificationBulkReadSchema, body);

    let updatedCount = 0;

    if (data.markAllAsRead) {
      // Mark all user notifications as read
      const result = await db.notification.updateMany({
        where: { userId: user.id, read: false },
        data: { read: true },
      });
      updatedCount = result.count;
    } else if (data.notificationIds) {
      // Mark specific notifications as read (only if they belong to the user)
      const result = await db.notification.updateMany({
        where: {
          id: { in: data.notificationIds },
          userId: user.id,
        },
        data: { read: true },
      });
      updatedCount = result.count;
    }

    return NextResponse.json({
      message: 'Notifications updated successfully',
      updatedCount,
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * DELETE /api/notifications
 * 
 * Deletes multiple notifications for the authenticated user.
 * Can delete specific notifications by ID or all read notifications.
 * 
 * @param request - The incoming request with notification IDs or deleteAllRead flag
 * @returns Count of deleted notifications
 * 
 * Body:
 * - notificationIds: Array of notification IDs to delete
 * - deleteAllRead: Boolean to delete all read notifications
 */
export async function DELETE(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const data = validateBody(notificationBulkDeleteSchema, body);

    let deletedCount = 0;

    if (data.deleteAllRead) {
      // Delete all read notifications for the user
      const result = await db.notification.deleteMany({
        where: { userId: user.id, read: true },
      });
      deletedCount = result.count;
    } else if (data.notificationIds) {
      // Delete specific notifications (only if they belong to the user)
      const result = await db.notification.deleteMany({
        where: {
          id: { in: data.notificationIds },
          userId: user.id,
        },
      });
      deletedCount = result.count;
    }

    return NextResponse.json({
      message: 'Notifications deleted successfully',
      deletedCount,
    });
  } catch (error) {
    return handleError(error);
  }
}
