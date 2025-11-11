import { InvoiceStatus } from '@prisma/client';
import { z } from 'zod';

// Decimal amount validation
const amountValidation = z.preprocess(
  (val) => {
    if (val === '' || val == null) return undefined;
    if (typeof val === 'string') {
      const parsed = Number(val);
      return Number.isNaN(parsed) ? val : parsed;
    }
    return val;
  },
  z.number('Amount must be a number')
    .positive('Amount must be greater than zero')
    .multipleOf(0.01, 'Amount must have at most 2 decimal places')
    .max(99_999_999.99, 'Amount must not exceed 99,999,999.99')
);

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

// Query schema to validate and transform listing filters
export const invoiceListQuerySchema = z
  .object({
    role: z.enum(['issuer', 'debtor']).default('issuer'),
    status: z
      .preprocess(
        (val) => (typeof val === 'string' && val.trim() ? val.toUpperCase() : undefined),
        z.nativeEnum(InvoiceStatus)
      )
      .optional(),
    subject: z
      .string()
      .trim()
      .min(1)
      .optional(),
    minAmount: z
      .preprocess((val) => {
        if (typeof val !== 'string' || !val.trim()) return undefined;
        const parsed = Number(val);
        return Number.isNaN(parsed) ? undefined : parsed;
      }, z.number().nonnegative())
      .optional(),
    maxAmount: z
      .preprocess((val) => {
        if (typeof val !== 'string' || !val.trim()) return undefined;
        const parsed = Number(val);
        return Number.isNaN(parsed) ? undefined : parsed;
      }, z.number().nonnegative())
      .optional(),
    issueDateFrom: z
      .preprocess((val) => (typeof val === 'string' && val.trim() ? val : undefined), z.string().datetime())
      .optional(),
    issueDateTo: z
      .preprocess((val) => (typeof val === 'string' && val.trim() ? val : undefined), z.string().datetime())
      .optional(),
    dueDateFrom: z
      .preprocess((val) => (typeof val === 'string' && val.trim() ? val : undefined), z.string().datetime())
      .optional(),
    dueDateTo: z
      .preprocess((val) => (typeof val === 'string' && val.trim() ? val : undefined), z.string().datetime())
      .optional(),
    sortBy: z.enum(['issueDate', 'dueDate', 'createdAt']).default('issueDate'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .transform((val) => {
    // Ensure numeric filters are valid numbers when provided
    const safeMin = val.minAmount !== undefined && !Number.isNaN(val.minAmount) ? val.minAmount : undefined;
    const safeMax = val.maxAmount !== undefined && !Number.isNaN(val.maxAmount) ? val.maxAmount : undefined;

    return {
      ...val,
      minAmount: safeMin,
      maxAmount: safeMax,
    };
  })
  .superRefine((data, ctx) => {
    if (data.minAmount !== undefined && data.maxAmount !== undefined && data.minAmount > data.maxAmount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minAmount'],
        message: 'Minimum amount cannot be greater than maximum amount',
      });
    }

    const parseDate = (value?: string) => (value ? new Date(value) : undefined);
    const issueFrom = parseDate(data.issueDateFrom);
    const issueTo = parseDate(data.issueDateTo);
    const dueFrom = parseDate(data.dueDateFrom);
    const dueTo = parseDate(data.dueDateTo);

    if (issueFrom && issueTo && issueFrom > issueTo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['issueDateFrom'],
        message: 'Issue start date cannot be after issue end date',
      });
    }

    if (dueFrom && dueTo && dueFrom > dueTo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dueDateFrom'],
        message: 'Due start date cannot be after due end date',
      });
    }
  });

// TypeScript Types
export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;
export type InvoiceUpdateInput = z.infer<typeof invoiceUpdateSchema>;
export type InvoiceStatusUpdateInput = z.infer<typeof invoiceStatusUpdateSchema>;
export type InvoiceFilterInput = z.infer<typeof invoiceFilterSchema>;
export type InvoiceListQueryInput = z.infer<typeof invoiceListQuerySchema>;