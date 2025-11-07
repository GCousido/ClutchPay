import { InvoiceStatus } from '@prisma/client';
import { z } from 'zod';

// Validación de montos decimales
const amountValidation = z
  .number()
  .positive('El monto debe ser positivo')
  .multipleOf(0.01, 'El monto debe tener máximo 2 decimales')
  .max(99999999.99, 'El monto no puede exceder 99,999,999.99');

// Validación de fechas
const futureDateValidation = z
  .string()
  .datetime('Formato de fecha inválido')
  .refine(
    (date) => new Date(date) > new Date(),
    { message: 'La fecha debe ser futura' }
  );

const pastOrPresentDateValidation = z
  .string()
  .datetime('Formato de fecha inválido')
  .refine(
    (date) => new Date(date) <= new Date(),
    { message: 'La fecha no puede ser futura' }
  );

// Schema para crear factura
export const invoiceCreateSchema = z
  .object({
    invoiceNumber: z
      .string()
      .min(1, 'El número de factura es requerido')
      .max(50, 'El número de factura no puede exceder 50 caracteres')
      .trim()
      .regex(/^[A-Z0-9-]+$/, 'El número de factura solo puede contener letras mayúsculas, números y guiones'),
    issuerUserId: z
      .number()
      .int()
      .positive('ID de emisor inválido'),
    debtorUserId: z
      .number()
      .int()
      .positive('ID de deudor inválido'),
    subject: z
      .string()
      .min(5, 'El asunto debe tener al menos 5 caracteres')
      .max(500, 'El asunto no puede exceder 500 caracteres')
      .trim(),
    description: z
      .string()
      .min(10, 'La descripción debe tener al menos 10 caracteres')
      .max(5000, 'La descripción no puede exceder 5000 caracteres')
      .trim(),
    amount: amountValidation,
    status: z
      .nativeEnum(InvoiceStatus)
      .default(InvoiceStatus.PENDING),
    issueDate: pastOrPresentDateValidation,
    dueDate: z
      .string()
      .datetime('Formato de fecha inválido')
      .optional()
      .nullable(),
    invoicePdfUrl: z
      .string()
      .url('URL del PDF inválida')
      .endsWith('.pdf', 'El archivo debe ser un PDF'),
  })
  .refine(
    (data) => data.issuerUserId !== data.debtorUserId,
    {
      message: 'El emisor y el deudor no pueden ser el mismo usuario',
      path: ['debtorUserId'],
    }
  )
  .refine(
    (data) => {
      if (!data.dueDate) return true;
      return new Date(data.dueDate) >= new Date(data.issueDate);
    },
    {
      message: 'La fecha de vencimiento debe ser posterior a la fecha de emisión',
      path: ['dueDate'],
    }
  );

// Schema para actualizar factura
export const invoiceUpdateSchema = z
  .object({
    subject: z
      .string()
      .min(5, 'El asunto debe tener al menos 5 caracteres')
      .max(500, 'El asunto no puede exceder 500 caracteres')
      .trim()
      .optional(),
    description: z
      .string()
      .min(10, 'La descripción debe tener al menos 10 caracteres')
      .max(5000, 'La descripción no puede exceder 5000 caracteres')
      .trim()
      .optional(),
    amount: amountValidation.optional(),
    status: z.nativeEnum(InvoiceStatus).optional(),
    dueDate: z
      .string()
      .datetime('Formato de fecha inválido')
      .optional()
      .nullable(),
    invoicePdfUrl: z
      .string()
      .url('URL del PDF inválida')
      .endsWith('.pdf', 'El archivo debe ser un PDF')
      .optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: 'Debe proporcionar al menos un campo para actualizar' }
  );

// Schema para cambiar estado
export const invoiceStatusUpdateSchema = z.object({
  status: z.nativeEnum(InvoiceStatus),
});

// Schema para filtros de búsqueda
export const invoiceFilterSchema = z.object({
  status: z.nativeEnum(InvoiceStatus).optional(),
  issuerUserId: z.number().int().positive().optional(),
  debtorUserId: z.number().int().positive().optional(),
  minAmount: z.number().positive().optional(),
  maxAmount: z.number().positive().optional(),
  issueDateFrom: z.string().datetime().optional(),
  issueDateTo: z.string().datetime().optional(),
  dueDateFrom: z.string().datetime().optional(),
  dueDateTo: z.string().datetime().optional(),
});

// Tipos TypeScript
export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;
export type InvoiceUpdateInput = z.infer<typeof invoiceUpdateSchema>;
export type InvoiceStatusUpdateInput = z.infer<typeof invoiceStatusUpdateSchema>;
export type InvoiceFilterInput = z.infer<typeof invoiceFilterSchema>;
