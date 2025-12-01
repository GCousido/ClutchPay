// tests/libs/validations/payment.test.ts
import { paymentCreateSchema, paymentListQuerySchema } from '@/libs/validations/payment';
import { PaymentMethod } from '@prisma/client';
import { describe, expect, it } from 'vitest';

describe('Payment Validations', () => {
  describe('paymentCreateSchema', () => {
    const validPaymentData = {
      invoiceId: 1,
      paymentMethod: PaymentMethod.PAYPAL,
      subject: 'Payment for services',
      receiptPdf: 'data:application/pdf;base64,JVBERi0xLjQKJeLjz9M=',
      paymentReference: 'STRIPE-TXN-123456',
    };

    describe('invoiceId validation', () => {
      it('should accept valid positive integer invoiceId', () => {
        const result = paymentCreateSchema.safeParse(validPaymentData);
        expect(result.success).toBe(true);
      });

      it('should reject missing invoiceId', () => {
        const { invoiceId, ...data } = validPaymentData;
        const result = paymentCreateSchema.safeParse(data);
        expect(result.success).toBe(false);
      });

      it('should reject negative invoiceId', () => {
        const result = paymentCreateSchema.safeParse({ ...validPaymentData, invoiceId: -1 });
        expect(result.success).toBe(false);
      });

      it('should reject zero invoiceId', () => {
        const result = paymentCreateSchema.safeParse({ ...validPaymentData, invoiceId: 0 });
        expect(result.success).toBe(false);
      });

      it('should reject non-integer invoiceId', () => {
        const result = paymentCreateSchema.safeParse({ ...validPaymentData, invoiceId: 1.5 });
        expect(result.success).toBe(false);
      });
    });

    describe('paymentMethod validation', () => {
      it.each([PaymentMethod.PAYPAL, PaymentMethod.VISA, PaymentMethod.MASTERCARD, PaymentMethod.OTHER])(
        'should accept %s as payment method',
        (method) => {
          const result = paymentCreateSchema.safeParse({ ...validPaymentData, paymentMethod: method });
          expect(result.success).toBe(true);
        }
      );

      it('should reject invalid payment method', () => {
        const result = paymentCreateSchema.safeParse({ ...validPaymentData, paymentMethod: 'BITCOIN' });
        expect(result.success).toBe(false);
      });

      it('should reject missing payment method', () => {
        const { paymentMethod, ...data } = validPaymentData;
        const result = paymentCreateSchema.safeParse(data);
        expect(result.success).toBe(false);
      });
    });

    describe('subject validation', () => {
      it('should accept valid subject', () => {
        const result = paymentCreateSchema.safeParse(validPaymentData);
        expect(result.success).toBe(true);
      });

      it('should accept null subject', () => {
        const result = paymentCreateSchema.safeParse({ ...validPaymentData, subject: null });
        expect(result.success).toBe(true);
      });

      it('should accept missing subject (optional)', () => {
        const { subject, ...data } = validPaymentData;
        const result = paymentCreateSchema.safeParse(data);
        expect(result.success).toBe(true);
      });

      it('should reject subject exceeding 500 characters', () => {
        const result = paymentCreateSchema.safeParse({ ...validPaymentData, subject: 'a'.repeat(501) });
        expect(result.success).toBe(false);
      });

      it('should trim whitespace from subject', () => {
        const result = paymentCreateSchema.safeParse({ ...validPaymentData, subject: '  trimmed subject  ' });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.subject).toBe('trimmed subject');
        }
      });
    });

    describe('receiptPdf validation', () => {
      it('should accept valid base64 PDF', () => {
        const result = paymentCreateSchema.safeParse(validPaymentData);
        expect(result.success).toBe(true);
      });

      it('should reject missing receiptPdf', () => {
        const { receiptPdf, ...data } = validPaymentData;
        const result = paymentCreateSchema.safeParse(data);
        expect(result.success).toBe(false);
      });

      it('should reject empty receiptPdf', () => {
        const result = paymentCreateSchema.safeParse({ ...validPaymentData, receiptPdf: '' });
        expect(result.success).toBe(false);
      });

      it('should reject receiptPdf without proper prefix', () => {
        const result = paymentCreateSchema.safeParse({ ...validPaymentData, receiptPdf: 'JVBERi0xLjQKJeLjz9M=' });
        expect(result.success).toBe(false);
      });

      it('should reject receiptPdf with wrong content type prefix', () => {
        const result = paymentCreateSchema.safeParse({
          ...validPaymentData,
          receiptPdf: 'data:image/png;base64,JVBERi0xLjQKJeLjz9M=',
        });
        expect(result.success).toBe(false);
      });
    });

    describe('paymentReference validation', () => {
      it('should accept valid paymentReference', () => {
        const result = paymentCreateSchema.safeParse(validPaymentData);
        expect(result.success).toBe(true);
      });

      it('should accept null paymentReference', () => {
        const result = paymentCreateSchema.safeParse({ ...validPaymentData, paymentReference: null });
        expect(result.success).toBe(true);
      });

      it('should accept missing paymentReference (optional)', () => {
        const { paymentReference, ...data } = validPaymentData;
        const result = paymentCreateSchema.safeParse(data);
        expect(result.success).toBe(true);
      });

      it('should reject paymentReference exceeding 255 characters', () => {
        const result = paymentCreateSchema.safeParse({ ...validPaymentData, paymentReference: 'a'.repeat(256) });
        expect(result.success).toBe(false);
      });

      it('should trim whitespace from paymentReference', () => {
        const result = paymentCreateSchema.safeParse({ ...validPaymentData, paymentReference: '  REF-123  ' });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.paymentReference).toBe('REF-123');
        }
      });
    });
  });

  describe('paymentListQuerySchema', () => {
    describe('role validation', () => {
      it('should default role to "payer"', () => {
        const result = paymentListQuerySchema.safeParse({});
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.role).toBe('payer');
        }
      });

      it('should accept "payer" role', () => {
        const result = paymentListQuerySchema.safeParse({ role: 'payer' });
        expect(result.success).toBe(true);
      });

      it('should accept "receiver" role', () => {
        const result = paymentListQuerySchema.safeParse({ role: 'receiver' });
        expect(result.success).toBe(true);
      });

      it('should reject invalid role', () => {
        const result = paymentListQuerySchema.safeParse({ role: 'admin' });
        expect(result.success).toBe(false);
      });
    });

    describe('paymentMethod validation', () => {
      it('should accept valid paymentMethod (case insensitive)', () => {
        const result = paymentListQuerySchema.safeParse({ paymentMethod: 'paypal' });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.paymentMethod).toBe(PaymentMethod.PAYPAL);
        }
      });

      it('should accept uppercase paymentMethod', () => {
        const result = paymentListQuerySchema.safeParse({ paymentMethod: 'VISA' });
        expect(result.success).toBe(true);
      });

      it('should reject invalid paymentMethod', () => {
        const result = paymentListQuerySchema.safeParse({ paymentMethod: 'BITCOIN' });
        expect(result.success).toBe(false);
      });

      it('should ignore empty paymentMethod', () => {
        const result = paymentListQuerySchema.safeParse({ paymentMethod: '' });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.paymentMethod).toBeUndefined();
        }
      });
    });

    describe('amount range validation', () => {
      it('should accept valid minAmount', () => {
        const result = paymentListQuerySchema.safeParse({ minAmount: '100' });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.minAmount).toBe(100);
        }
      });

      it('should accept valid maxAmount', () => {
        const result = paymentListQuerySchema.safeParse({ maxAmount: '5000' });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.maxAmount).toBe(5000);
        }
      });

      it('should accept valid amount range', () => {
        const result = paymentListQuerySchema.safeParse({ minAmount: '100', maxAmount: '5000' });
        expect(result.success).toBe(true);
      });

      it('should reject when minAmount > maxAmount', () => {
        const result = paymentListQuerySchema.safeParse({ minAmount: '5000', maxAmount: '100' });
        expect(result.success).toBe(false);
      });

      it('should ignore empty amount strings', () => {
        const result = paymentListQuerySchema.safeParse({ minAmount: '', maxAmount: '' });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.minAmount).toBeUndefined();
          expect(result.data.maxAmount).toBeUndefined();
        }
      });

      it('should reject negative amounts', () => {
        const result = paymentListQuerySchema.safeParse({ minAmount: '-100' });
        expect(result.success).toBe(false);
      });
    });

    describe('date range validation', () => {
      it('should accept valid paymentDateFrom', () => {
        const result = paymentListQuerySchema.safeParse({ paymentDateFrom: '2024-01-01T00:00:00Z' });
        expect(result.success).toBe(true);
      });

      it('should accept valid paymentDateTo', () => {
        const result = paymentListQuerySchema.safeParse({ paymentDateTo: '2024-12-31T23:59:59Z' });
        expect(result.success).toBe(true);
      });

      it('should accept valid date range', () => {
        const result = paymentListQuerySchema.safeParse({
          paymentDateFrom: '2024-01-01T00:00:00Z',
          paymentDateTo: '2024-12-31T23:59:59Z',
        });
        expect(result.success).toBe(true);
      });

      it('should reject when paymentDateFrom > paymentDateTo', () => {
        const result = paymentListQuerySchema.safeParse({
          paymentDateFrom: '2024-12-31T23:59:59Z',
          paymentDateTo: '2024-01-01T00:00:00Z',
        });
        expect(result.success).toBe(false);
      });

      it('should reject invalid date format', () => {
        const result = paymentListQuerySchema.safeParse({ paymentDateFrom: 'invalid-date' });
        expect(result.success).toBe(false);
      });

      it('should ignore empty date strings', () => {
        const result = paymentListQuerySchema.safeParse({ paymentDateFrom: '', paymentDateTo: '' });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.paymentDateFrom).toBeUndefined();
          expect(result.data.paymentDateTo).toBeUndefined();
        }
      });
    });

    describe('sorting validation', () => {
      it('should default sortBy to "paymentDate"', () => {
        const result = paymentListQuerySchema.safeParse({});
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.sortBy).toBe('paymentDate');
        }
      });

      it('should default sortOrder to "desc"', () => {
        const result = paymentListQuerySchema.safeParse({});
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.sortOrder).toBe('desc');
        }
      });

      it('should accept "createdAt" as sortBy', () => {
        const result = paymentListQuerySchema.safeParse({ sortBy: 'createdAt' });
        expect(result.success).toBe(true);
      });

      it('should accept "asc" as sortOrder', () => {
        const result = paymentListQuerySchema.safeParse({ sortOrder: 'asc' });
        expect(result.success).toBe(true);
      });

      it('should reject invalid sortBy', () => {
        const result = paymentListQuerySchema.safeParse({ sortBy: 'amount' });
        expect(result.success).toBe(false);
      });

      it('should reject invalid sortOrder', () => {
        const result = paymentListQuerySchema.safeParse({ sortOrder: 'random' });
        expect(result.success).toBe(false);
      });
    });
  });
});
