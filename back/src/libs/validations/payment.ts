import { PaymentMethod } from '@prisma/client';
import { z } from 'zod';

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
        code: "custom",
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
        code: "custom",
        path: ['paymentDateFrom'],
        message: 'Start date cannot be after end date',
      });
    }
  });

// TypeScript Types
export type PaymentListQueryInput = z.infer<typeof paymentListQuerySchema>;
