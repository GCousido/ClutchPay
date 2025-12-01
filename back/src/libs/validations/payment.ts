import { PaymentMethod } from '@prisma/client';
import { z } from 'zod';

/**
 * Base64 PDF validation schema
 * Validates that the string is a valid base64 PDF with proper prefix
 */
const pdfBase64Validation = z
  .string()
  .min(1, 'Receipt PDF is required')
  .refine(
    (val) => val.startsWith('data:application/pdf;base64,'),
    { message: 'PDF must be a valid base64 string with data:application/pdf;base64, prefix' }
  );

/**
 * Schema for creating a new payment
 * Used when processing a payment for an invoice
 */
export const paymentCreateSchema = z.object({
  invoiceId: z
    .number()
    .int('Invoice ID must be an integer')
    .positive('Invalid invoice ID'),
  paymentMethod: z.enum(PaymentMethod, {
    message: 'Invalid payment method. Valid options: PAYPAL, VISA, MASTERCARD, OTHER',
  }),
  subject: z
    .string()
    .min(1, 'Subject must be at least 1 character')
    .max(500, 'Subject must not exceed 500 characters')
    .trim()
    .optional()
    .nullable(),
  receiptPdf: pdfBase64Validation,
  // Optional payment reference (e.g., Stripe/PayPal transaction ID)
  paymentReference: z
    .string()
    .max(255, 'Payment reference must not exceed 255 characters')
    .trim()
    .optional()
    .nullable(),
});

/**
 * Schema for payment list query parameters
 * Used when fetching paginated list of payments with filters
 */
export const paymentListQuerySchema = z
  .object({
    // Role filter: 'payer' = payments made by user, 'receiver' = payments received by user
    role: z.enum(['payer', 'receiver']).default('payer'),
    // Payment method filter
    paymentMethod: z
      .string()
      .optional()
      .transform((val) => (val && val.trim() ? val.toUpperCase() : undefined))
      .pipe(z.enum(PaymentMethod).optional()),
    // Amount range filters (based on invoice amount)
    minAmount: z
      .string()
      .optional()
      .transform((val) => {
        if (!val || !val.trim()) return undefined;
        const parsed = Number(val);
        return Number.isNaN(parsed) ? undefined : parsed;
      })
      .pipe(z.number().nonnegative().optional()),
    maxAmount: z
      .string()
      .optional()
      .transform((val) => {
        if (!val || !val.trim()) return undefined;
        const parsed = Number(val);
        return Number.isNaN(parsed) ? undefined : parsed;
      })
      .pipe(z.number().nonnegative().optional()),
    // Payment date range filters
    paymentDateFrom: z
      .string()
      .optional()
      .transform((val) => (val && val.trim() ? val : undefined))
      .pipe(z.string().datetime().optional()),
    paymentDateTo: z
      .string()
      .optional()
      .transform((val) => (val && val.trim() ? val : undefined))
      .pipe(z.string().datetime().optional()),
    // Sorting options
    sortBy: z.enum(['paymentDate', 'createdAt']).default('paymentDate'),
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
    // Validate min/max amount range
    if (data.minAmount !== undefined && data.maxAmount !== undefined && data.minAmount > data.maxAmount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minAmount'],
        message: 'Minimum amount cannot be greater than maximum amount',
      });
    }

    // Validate date range
    const parseDate = (value?: string) => (value ? new Date(value) : undefined);
    const dateFrom = parseDate(data.paymentDateFrom);
    const dateTo = parseDate(data.paymentDateTo);

    if (dateFrom && dateTo && dateFrom > dateTo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['paymentDateFrom'],
        message: 'Start date cannot be after end date',
      });
    }
  });

// TypeScript Types
export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;
export type PaymentListQueryInput = z.infer<typeof paymentListQuerySchema>;
