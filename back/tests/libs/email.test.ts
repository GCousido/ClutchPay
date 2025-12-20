// tests/libs/email.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Email Service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetAllMocks();
  });

  describe('sendEmail without Resend configured (simulation mode)', () => {
    beforeEach(() => {
      delete process.env.RESEND_API_KEY;
    });

    it('should simulate email sending when Resend is not configured', async () => {
      vi.resetModules();
      const { sendEmail } = await import('@/libs/email');

      const mockReactElement = { 
        type: function TestComponent() { return null; }, 
        props: {}, 
        key: null 
      } as any;
      
      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Test Subject',
        react: mockReactElement,
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toContain('simulated-');
    });

    it('should handle react element without type.name', async () => {
      vi.resetModules();
      const { sendEmail } = await import('@/libs/email');

      const mockReactElement = { 
        type: 'div',  // String type instead of function
        props: {}, 
        key: null 
      } as any;
      
      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Test Subject',
        react: mockReactElement,
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toContain('simulated-');
    });
  });

  describe('FROM_EMAIL configuration', () => {
    it('should use configured FROM_EMAIL', async () => {
      process.env.RESEND_FROM_EMAIL = 'Custom <custom@example.com>';
      
      vi.resetModules();
      const { FROM_EMAIL } = await import('@/libs/email');

      expect(FROM_EMAIL).toBe('Custom <custom@example.com>');
    });

    it('should use default FROM_EMAIL when not configured', async () => {
      delete process.env.RESEND_FROM_EMAIL;
      
      vi.resetModules();
      const { FROM_EMAIL } = await import('@/libs/email');

      expect(FROM_EMAIL).toBe('ClutchPay <noreply@clutchpay.com>');
    });
  });

  describe('resend client configuration', () => {
    it('should be null when RESEND_API_KEY is not set', async () => {
      delete process.env.RESEND_API_KEY;
      
      vi.resetModules();
      const { resend } = await import('@/libs/email');

      expect(resend).toBeNull();
    });
  });
});

// Note: Tests for real Resend API (lines 85-108) require actual API credentials
// and are not included in automated tests. The simulation mode provides coverage
// for the happy path, and the real Resend integration is tested manually.
