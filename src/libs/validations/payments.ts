import { PaymentMethod } from '@prisma/client';
import { z } from 'zod';

// Validación de montos
const amountValidation = z
  .number()
  .positive('El monto debe ser positivo')
  .multipleOf(0.01, 'El monto debe tener máximo 2 decimales')
  .max(99999999.99, 'El monto no puede exceder 99,999,999.99');

// Schema para crear pago
export const paymentCreateSchema = z.object({
  invoiceId: z
    .number()
    .int()
    .positive('ID de factura inválido'),
  paymentDate: z
    .string()
    .datetime('Formato de fecha inválido')
    .refine(
      (date) => new Date(date) <= new Date(),
      { message: 'La fecha de pago no puede ser futura' }
    ),
  paymentMethod: z.nativeEnum(PaymentMethod, {
    errorMap: () => ({ message: 'Método de pago inválido' }),
  }),
  paymentReference: z
    .string()
    .min(3, 'La referencia debe tener al menos 3 caracteres')
    .max(100, 'La referencia no puede exceder 100 caracteres')
    .trim()
    .optional()
    .nullable(),
  receiptPdfUrl: z
    .string()
    .url('URL del recibo inválida')
    .endsWith('.pdf', 'El archivo debe ser un PDF'),
  subject: z
    .string()
    .max(500, 'El asunto no puede exceder 500 caracteres')
    .trim()
    .optional()
    .nullable(),
});

// Schema para actualizar pago
export const paymentUpdateSchema = z
  .object({
    paymentDate: z
      .string()
      .datetime('Formato de fecha inválido')
      .refine(
        (date) => new Date(date) <= new Date(),
        { message: 'La fecha de pago no puede ser futura' }
      )
      .optional(),
    paymentMethod: z.nativeEnum(PaymentMethod).optional(),
    paymentReference: z
      .string()
      .min(3, 'La referencia debe tener al menos 3 caracteres')
      .max(100, 'La referencia no puede exceder 100 caracteres')
      .trim()
      .optional()
      .nullable(),
    receiptPdfUrl: z
      .string()
      .url('URL del recibo inválida')
      .endsWith('.pdf', 'El archivo debe ser un PDF')
      .optional(),
    subject: z
      .string()
      .max(500, 'El asunto no puede exceder 500 caracteres')
      .trim()
      .optional()
      .nullable(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: 'Debe proporcionar al menos un campo para actualizar' }
  );

// Schema para validar que el pago no exceda el monto de la factura
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
    message: 'El total de pagos excede el monto de la factura',
    path: ['amount'],
  }
);

// Tipos TypeScript
export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;
export type PaymentUpdateInput = z.infer<typeof paymentUpdateSchema>;
