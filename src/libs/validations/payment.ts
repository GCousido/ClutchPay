import { PaymentMethod } from '@prisma/client';
import { z } from 'zod';

// Amount validation
const amountValidation = z
  .number()
  .positive('Amount must be positive')
  .multipleOf(0.01, 'Amount must have at most 2 decimal places')
  .max(99999999.99, 'Amount must not exceed 99,999,999.99');

// Schema to create a payment
export const paymentCreateSchema = z.object({
  invoiceId: z
    .number()
    .int()
    .positive('Invalid invoice ID'),
  paymentDate: z
    .string()
    .datetime('Invalid date format')
    .refine(
      (date) => new Date(date) <= new Date(),
      { message: 'Payment date cannot be in the future' }
    ),
  paymentMethod: z.enum(PaymentMethod, {
    // TODO: enum will validate against PaymentMethod
  }),
  paymentReference: z
    .string()
    .min(3, 'Reference must be at least 3 characters')
    .max(100, 'Reference must not exceed 100 characters')
    .trim()
    .optional()
    .nullable(),
  receiptPdfUrl: z
    .url('Invalid receipt URL')
    .endsWith('.pdf', 'File must be a PDF'),
  subject: z
    .string()
    .max(500, 'Subject must not exceed 500 characters')
    .trim()
    .optional()
    .nullable(),
});

// Schema to update a payment
export const paymentUpdateSchema = z
  .object({
    paymentDate: z
      .string()
      .datetime('Invalid date format')
      .refine(
        (date) => new Date(date) <= new Date(),
        { message: 'Payment date cannot be in the future' }
      )
      .optional(),
    paymentMethod: z.enum(PaymentMethod).optional(),
    paymentReference: z
      .string()
      .min(3, 'Reference must be at least 3 characters')
      .max(100, 'Reference must not exceed 100 characters')
      .trim()
      .optional()
      .nullable(),
    receiptPdfUrl: z
      .url('Invalid receipt URL')
      .endsWith('.pdf', 'File must be a PDF')
      .optional(),
    subject: z
      .string()
      .max(500, 'Subject must not exceed 500 characters')
      .trim()
      .optional()
      .nullable(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: 'You must provide at least one field to update' }
  );

// Validation schema to ensure payment amount does not exceed invoice amount
export const paymentAmountValidationSchema = z.object({
  amount: amountValidation,
  invoiceAmount: z.number(),
  existingPaymentsTotal: z.number(),
}).refine(
  (data) => {
    const totalWithNewPayment = data.existingPaymentsTotal + data.amount;
    return totalWithNewPayment <= data.invoiceAmount;
  },
  {
    message: 'Total payments exceed invoice amount',
    path: ['amount'],
  }
);

// TypeScript types
export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;
export type PaymentUpdateInput = z.infer<typeof paymentUpdateSchema>;
