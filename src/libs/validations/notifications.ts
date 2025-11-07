import { NotificationType } from '@prisma/client';
import { z } from 'zod';

// Schema para crear notificación
export const notificationCreateSchema = z.object({
  userId: z
    .number()
    .int()
    .positive('ID de usuario inválido'),
  invoiceId: z
    .number()
    .int()
    .positive('ID de factura inválido'),
  type: z.nativeEnum(NotificationType, {
    errorMap: () => ({ message: 'Tipo de notificación inválido' }),
  }),
  read: z.boolean().default(false),
});

// Schema para marcar como leída
export const notificationMarkAsReadSchema = z.object({
  read: z.boolean(),
});

// Schema para marcar múltiples como leídas
export const notificationBulkMarkAsReadSchema = z.object({
  notificationIds: z
    .array(z.number().int().positive())
    .min(1, 'Debe proporcionar al menos un ID de notificación'),
  read: z.boolean().default(true),
});

// Schema para filtros
export const notificationFilterSchema = z.object({
  userId: z.number().int().positive().optional(),
  invoiceId: z.number().int().positive().optional(),
  type: z.nativeEnum(NotificationType).optional(),
  read: z.boolean().optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
});

// Tipos TypeScript
export type NotificationCreateInput = z.infer<typeof notificationCreateSchema>;
export type NotificationMarkAsReadInput = z.infer<typeof notificationMarkAsReadSchema>;
export type NotificationBulkMarkAsReadInput = z.infer<typeof notificationBulkMarkAsReadSchema>;
export type NotificationFilterInput = z.infer<typeof notificationFilterSchema>;
