import { NotificationType } from '@prisma/client';
import { z } from 'zod';

/**
 * Schema for listing notifications with optional filters
 * Supports pagination, filtering by read status and notification type
 */
export const notificationListQuerySchema = z.object({
  // Pagination
  page: z.preprocess(
    (val) => (val ? Number(val) : 1),
    z.number().int().positive('Page must be a positive integer').default(1)
  ),
  limit: z.preprocess(
    (val) => (val ? Number(val) : 20),
    z.number().int().min(1).max(100, 'Limit must be between 1 and 100').default(20)
  ),
  // Filters
  read: z.preprocess(
    (val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    },
    z.boolean().optional()
  ),
  type: z.enum(NotificationType).optional(),
  // Sorting
  sortBy: z.enum(['createdAt', 'type', 'read']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Schema for marking a single notification as read/unread
 */
export const notificationUpdateSchema = z.object({
  read: z.boolean({ message: 'Read status is required' }),
});

/**
 * Schema for bulk marking notifications as read
 * Can mark specific IDs or all notifications
 */
export const notificationBulkReadSchema = z.object({
  notificationIds: z
    .array(z.number().int().positive('Invalid notification ID'))
    .min(1, 'At least one notification ID is required')
    .optional(),
  markAllAsRead: z.boolean().optional(),
}).refine(
  (data) => data.notificationIds !== undefined || data.markAllAsRead === true,
  {
    message: 'Either notificationIds or markAllAsRead must be provided',
    path: ['notificationIds'],
  }
);

/**
 * Schema for deleting multiple notifications
 * Can delete specific IDs or all read notifications
 */
export const notificationBulkDeleteSchema = z.object({
  notificationIds: z
    .array(z.number().int().positive('Invalid notification ID'))
    .min(1, 'At least one notification ID is required')
    .optional(),
  deleteAllRead: z.boolean().optional(),
}).refine(
  (data) => data.notificationIds !== undefined || data.deleteAllRead === true,
  {
    message: 'Either notificationIds or deleteAllRead must be provided',
    path: ['notificationIds'],
  }
);

/**
 * Schema for notification ID parameter validation
 */
export const notificationIdParamSchema = z.object({
  id: z.preprocess(
    (val) => (typeof val === 'string' ? Number(val) : val),
    z.number().int().positive('Invalid notification ID')
  ),
});

// Export types for TypeScript usage
export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
export type NotificationUpdate = z.infer<typeof notificationUpdateSchema>;
export type NotificationBulkRead = z.infer<typeof notificationBulkReadSchema>;
export type NotificationBulkDelete = z.infer<typeof notificationBulkDeleteSchema>;
