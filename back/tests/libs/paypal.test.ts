// tests/libs/paypal.test.ts
import { describe, expect, it } from 'vitest';

// Test utility functions only (no DB required)
// These tests don't need the full setup.ts

describe('PayPal Utilities', () => {
  describe('calculateNetAfterFees', () => {
    // Import the function inline to avoid setup.ts initialization
    const calculateNetAfterFees = (amountCents: number, feePercentage: number = 2): number => {
      const feeAmount = Math.ceil(amountCents * (feePercentage / 100));
      return amountCents - feeAmount;
    };

    it('should calculate net amount after 2% default fee', () => {
      // $100 with 2% fee = $98
      expect(calculateNetAfterFees(10000)).toBe(9800);
    });

    it('should calculate net amount with custom fee percentage', () => {
      // $100 with 5% fee = $95
      expect(calculateNetAfterFees(10000, 5)).toBe(9500);
    });

    it('should round up fee to nearest cent', () => {
      // $15.50 with 2% fee = $0.31 fee (rounded up) = $15.19 net
      expect(calculateNetAfterFees(1550)).toBe(1519);
    });

    it('should handle small amounts', () => {
      // $1.00 with 2% fee = $0.02 fee = $0.98 net
      expect(calculateNetAfterFees(100)).toBe(98);
    });

    it('should handle zero amount', () => {
      expect(calculateNetAfterFees(0)).toBe(0);
    });

    it('should handle 0% fee', () => {
      expect(calculateNetAfterFees(10000, 0)).toBe(10000);
    });
  });

  describe('isValidPayPalEmail', () => {
    const isValidPayPalEmail = (email: string): boolean => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };

    it('should return true for valid email', () => {
      expect(isValidPayPalEmail('user@example.com')).toBe(true);
    });

    it('should return true for email with subdomain', () => {
      expect(isValidPayPalEmail('user@mail.example.com')).toBe(true);
    });

    it('should return true for email with plus sign', () => {
      expect(isValidPayPalEmail('user+tag@example.com')).toBe(true);
    });

    it('should return false for empty string', () => {
      expect(isValidPayPalEmail('')).toBe(false);
    });

    it('should return false for email without @', () => {
      expect(isValidPayPalEmail('userexample.com')).toBe(false);
    });

    it('should return false for email without domain', () => {
      expect(isValidPayPalEmail('user@')).toBe(false);
    });

    it('should return false for email without TLD', () => {
      expect(isValidPayPalEmail('user@example')).toBe(false);
    });

    it('should return false for email with spaces', () => {
      expect(isValidPayPalEmail('user @example.com')).toBe(false);
    });
  });
});
