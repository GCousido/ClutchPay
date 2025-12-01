// tests/libs/validations/payment.test.ts
import { paymentListQuerySchema } from '@/libs/validations/payment';
import { PaymentMethod } from '@prisma/client';
import { describe, expect, it } from 'vitest';

describe('Payment Validations', () => {
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
