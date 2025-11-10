import { NotificationType } from '@prisma/client';
import { z } from 'zod';

// Schema to create a notification
export const notificationCreateSchema = z.object({
  userId: z
    .number()
    .int()
    .positive('Invalid user ID'),
  invoiceId: z
    .number()
    .int()
    .positive('Invalid invoice ID'),
  type: z.enum(NotificationType),
  read: z.boolean().default(false),
});

// Schema to mark a notification as read/unread
export const notificationMarkAsReadSchema = z.object({
  read: z.boolean(),
});

// Schema to bulk mark notifications as read/unread
export const notificationBulkMarkAsReadSchema = z.object({
  notificationIds: z
    .array(z.number().int().positive())
    .min(1, 'You must provide at least one notification ID'),
  read: z.boolean().default(true),
});

// Schema to filter notifications TODO:
export const notificationFilterSchema = z.object({
  userId: z.number().int().positive().optional(),
  invoiceId: z.number().int().positive().optional(),
  type: z.enum(NotificationType).optional(),
  read: z.boolean().optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
});

// TypeScript types
export type NotificationCreateInput = z.infer<typeof notificationCreateSchema>;
export type NotificationMarkAsReadInput = z.infer<typeof notificationMarkAsReadSchema>;
export type NotificationBulkMarkAsReadInput = z.infer<typeof notificationBulkMarkAsReadSchema>;
export type NotificationFilterInput = z.infer<typeof notificationFilterSchema>;
