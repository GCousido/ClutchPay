import { InvoiceStatus } from '@prisma/client';
import { z } from 'zod';

// Decimal amount validation
const amountValidation = z
  .number()
  .positive('Amount must be positive')
  .multipleOf(0.01, 'Amount must have at most 2 decimal places')
  .max(99999999.99, 'Amount must not exceed 99,999,999.99');

// Date validations
const futureDateValidation = z
  .string()
  .datetime('Invalid date format')
  .refine(
    (date) => new Date(date) > new Date(),
    { message: 'Date must be in the future' }
  );

const pastOrPresentDateValidation = z
  .string()
  .datetime('Invalid date format')
  .refine(
    (date) => new Date(date) <= new Date(),
    { message: 'Date cannot be in the future' }
  );

// Schema to create an invoice
export const invoiceCreateSchema = z
  .object({
    invoiceNumber: z
      .string()
      .min(1, 'Invoice number is required')
      .max(50, 'Invoice number must not exceed 50 characters')
      .trim()
      .regex(/^[A-Z0-9-]+$/, 'Invoice number can only contain uppercase letters, numbers and dashes'),
    issuerUserId: z
      .number()
      .int()
      .positive('Invalid issuer ID'),
    debtorUserId: z
      .number()
      .int()
      .positive('Invalid debtor ID'),
    subject: z
      .string()
      .min(5, 'Subject must be at least 5 characters')
      .max(500, 'Subject must not exceed 500 characters')
      .trim(),
    description: z
      .string()
      .min(10, 'Description must be at least 10 characters')
      .max(5000, 'Description must not exceed 5000 characters')
      .trim(),
    amount: amountValidation,
    status: z
      .enum(InvoiceStatus)
      .default(InvoiceStatus.PENDING),
    issueDate: pastOrPresentDateValidation,
    dueDate: z
      .string()
      .datetime('Invalid date format')
      .optional()
      .nullable(),
    invoicePdfUrl: z
      .string()
      .url('Invalid PDF URL')
      .endsWith('.pdf', 'File must be a PDF'),
  })
  .refine(
    (data) => data.issuerUserId !== data.debtorUserId,
    {
      message: 'Issuer and debtor cannot be the same user',
      path: ['debtorUserId'],
    }
  )
  .refine(
    (data) => {
      if (!data.dueDate) return true;
      return new Date(data.dueDate) >= new Date(data.issueDate);
    },
    {
      message: 'Due date must be after the issue date',
      path: ['dueDate'],
    }
  );

// Schema to update an invoice
export const invoiceUpdateSchema = z
  .object({
    subject: z
      .string()
      .min(5, 'Subject must be at least 5 characters')
      .max(500, 'Subject must not exceed 500 characters')
      .trim()
      .optional(),
    description: z
      .string()
      .min(10, 'Description must be at least 10 characters')
      .max(5000, 'Description must not exceed 5000 characters')
      .trim()
      .optional(),
    amount: amountValidation.optional(),
    status: z.enum(InvoiceStatus).optional(),
    dueDate: z
      .string()
      .datetime('Invalid date format')
      .optional()
      .nullable(),
    invoicePdfUrl: z
      .string()
      .url('Invalid PDF URL')
      .endsWith('.pdf', 'File must be a PDF')
      .optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: 'You must provide at least one field to update' }
  );

// Schema to change status
export const invoiceStatusUpdateSchema = z.object({
  status: z.enum(InvoiceStatus),
});

// Schema for search filters
export const invoiceFilterSchema = z.object({
  status: z.enum(InvoiceStatus).optional(),
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
