// tests/libs/validations/stripe.test.ts
import { describe, expect, it } from 'vitest';
import {
    stripeCheckoutCreateSchema,
    stripeSessionQuerySchema,
} from '../../../src/libs/validations/stripe';

describe('Stripe Validation Schemas', () => {
  describe('stripeCheckoutCreateSchema', () => {
    it('should validate minimal valid input', () => {
      const input = { invoiceId: 1 };
      const result = stripeCheckoutCreateSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.invoiceId).toBe(1);
        expect(result.data.successUrl).toBeUndefined();
        expect(result.data.cancelUrl).toBeUndefined();
      }
    });

    it('should validate input with optional URLs', () => {
      const input = {
        invoiceId: 123,
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      };
      const result = stripeCheckoutCreateSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.invoiceId).toBe(123);
        expect(result.data.successUrl).toBe('https://example.com/success');
        expect(result.data.cancelUrl).toBe('https://example.com/cancel');
      }
    });

    it('should reject non-integer invoiceId', () => {
      const input = { invoiceId: 1.5 };
      const result = stripeCheckoutCreateSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invoice ID must be an integer');
      }
    });

    it('should reject non-positive invoiceId', () => {
      const input = { invoiceId: 0 };
      const result = stripeCheckoutCreateSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid invoice ID');
      }
    });

    it('should reject negative invoiceId', () => {
      const input = { invoiceId: -1 };
      const result = stripeCheckoutCreateSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it('should reject string invoiceId', () => {
      const input = { invoiceId: 'abc' };
      const result = stripeCheckoutCreateSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it('should reject invalid successUrl format', () => {
      const input = {
        invoiceId: 1,
        successUrl: 'not-a-valid-url',
      };
      const result = stripeCheckoutCreateSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Success URL must be a valid URL');
      }
    });

    it('should reject invalid cancelUrl format', () => {
      const input = {
        invoiceId: 1,
        cancelUrl: 'also-not-a-url',
      };
      const result = stripeCheckoutCreateSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Cancel URL must be a valid URL');
      }
    });

    it('should accept http URLs', () => {
      const input = {
        invoiceId: 1,
        successUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel',
      };
      const result = stripeCheckoutCreateSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it('should reject missing invoiceId', () => {
      const input = {};
      const result = stripeCheckoutCreateSchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });

  describe('stripeSessionQuerySchema', () => {
    it('should validate valid session ID', () => {
      const input = { sessionId: 'cs_test_abc123' };
      const result = stripeSessionQuerySchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sessionId).toBe('cs_test_abc123');
      }
    });

    it('should validate live session ID', () => {
      const input = { sessionId: 'cs_live_xyz789' };
      const result = stripeSessionQuerySchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it('should reject empty session ID', () => {
      const input = { sessionId: '' };
      const result = stripeSessionQuerySchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Session ID is required');
      }
    });

    it('should reject session ID without cs_ prefix', () => {
      const input = { sessionId: 'invalid_session_id' };
      const result = stripeSessionQuerySchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid Stripe session ID format');
      }
    });

    it('should reject session ID with wrong prefix', () => {
      const input = { sessionId: 'pi_test_123' };
      const result = stripeSessionQuerySchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it('should reject missing sessionId', () => {
      const input = {};
      const result = stripeSessionQuerySchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });
});
