// tests/libs/logger.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// We need to test the Logger class directly to test different configurations
// So we'll import and re-instantiate with different options

describe('Logger Utility', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let originalLogLevel: string | undefined;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    originalLogLevel = process.env.LOG_LEVEL;
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    if (originalLogLevel !== undefined) {
      process.env.LOG_LEVEL = originalLogLevel;
    } else {
      delete process.env.LOG_LEVEL;
    }
    vi.resetModules();
  });

  describe('Log Levels', () => {
    it('should log at DEBUG level when LOG_LEVEL is DEBUG', async () => {
      process.env.LOG_LEVEL = 'DEBUG';
      vi.resetModules();
      const { logger } = await import('@/libs/logger');
      
      logger.debug('Test', 'Debug message');
      logger.info('Test', 'Info message');
      logger.warn('Test', 'Warn message');
      logger.error('Test', 'Error message');

      expect(consoleLogSpy).toHaveBeenCalledTimes(2); // debug + info
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should not log DEBUG when LOG_LEVEL is INFO (default)', async () => {
      process.env.LOG_LEVEL = 'INFO';
      vi.resetModules();
      const { logger } = await import('@/libs/logger');
      
      logger.debug('Test', 'Debug message');
      logger.info('Test', 'Info message');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1); // only info
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO]'));
    });

    it('should only log WARN and ERROR when LOG_LEVEL is WARN', async () => {
      process.env.LOG_LEVEL = 'WARN';
      vi.resetModules();
      const { logger } = await import('@/libs/logger');
      
      logger.debug('Test', 'Debug message');
      logger.info('Test', 'Info message');
      logger.warn('Test', 'Warn message');
      logger.error('Test', 'Error message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should only log ERROR when LOG_LEVEL is ERROR', async () => {
      process.env.LOG_LEVEL = 'ERROR';
      vi.resetModules();
      const { logger } = await import('@/libs/logger');
      
      logger.debug('Test', 'Debug message');
      logger.info('Test', 'Info message');
      logger.warn('Test', 'Warn message');
      logger.error('Test', 'Error message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should default to INFO when LOG_LEVEL is not set', async () => {
      delete process.env.LOG_LEVEL;
      vi.resetModules();
      const { logger } = await import('@/libs/logger');
      
      logger.debug('Test', 'Debug message');
      logger.info('Test', 'Info message');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO]'));
    });

    it('should handle lowercase LOG_LEVEL', async () => {
      process.env.LOG_LEVEL = 'debug';
      vi.resetModules();
      const { logger } = await import('@/libs/logger');
      
      logger.debug('Test', 'Debug message');

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[DEBUG]'));
    });
  });

  describe('Log Format', () => {
    beforeEach(async () => {
      process.env.LOG_LEVEL = 'DEBUG';
      vi.resetModules();
    });

    it('should include ISO timestamp in log output', async () => {
      const { logger } = await import('@/libs/logger');
      
      logger.info('Test', 'Message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\]/)
      );
    });

    it('should include log level in output', async () => {
      const { logger } = await import('@/libs/logger');
      
      logger.info('Test', 'Message');

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO]'));
    });

    it('should include context in output', async () => {
      const { logger } = await import('@/libs/logger');
      
      logger.info('MyContext', 'Message');

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[MyContext]'));
    });

    it('should include message in output', async () => {
      const { logger } = await import('@/libs/logger');
      
      logger.info('Test', 'My log message');

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('My log message'));
    });

    it('should format output as [TIMESTAMP] [LEVEL] [CONTEXT] MESSAGE', async () => {
      const { logger } = await import('@/libs/logger');
      
      logger.info('Server', 'Starting up');

      const call = consoleLogSpy.mock.calls[0][0] as string;
      expect(call).toMatch(/^\[\d{4}-\d{2}-\d{2}T.+\] \[INFO\] \[Server\] Starting up$/);
    });
  });

  describe('Data Serialization', () => {
    beforeEach(async () => {
      process.env.LOG_LEVEL = 'DEBUG';
      vi.resetModules();
    });

    it('should append JSON data with pipe separator', async () => {
      const { logger } = await import('@/libs/logger');
      
      logger.info('Test', 'Message', { key: 'value' });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(' | {"key":"value"}')
      );
    });

    it('should serialize objects to JSON', async () => {
      const { logger } = await import('@/libs/logger');
      
      logger.info('Test', 'User data', { userId: 123, email: 'test@example.com' });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('{"userId":123,"email":"test@example.com"}')
      );
    });

    it('should serialize arrays to JSON', async () => {
      const { logger } = await import('@/libs/logger');
      
      logger.info('Test', 'Items', [1, 2, 3]);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[1,2,3]')
      );
    });

    it('should convert primitives to string', async () => {
      const { logger } = await import('@/libs/logger');
      
      logger.info('Test', 'Count', 42);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(' | 42')
      );
    });

    it('should convert boolean to string', async () => {
      const { logger } = await import('@/libs/logger');
      
      logger.info('Test', 'Status', true);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(' | true')
      );
    });

    it('should handle null data', async () => {
      const { logger } = await import('@/libs/logger');
      
      logger.info('Test', 'Value', null);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(' | null')
      );
    });

    it('should handle undefined data (no data appended)', async () => {
      const { logger } = await import('@/libs/logger');
      
      logger.info('Test', 'Message');

      const call = consoleLogSpy.mock.calls[0][0] as string;
      expect(call).not.toContain(' | ');
    });

    it('should handle nested objects', async () => {
      const { logger } = await import('@/libs/logger');
      
      logger.info('Test', 'Data', { user: { id: 1, profile: { name: 'John' } } });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('{"user":{"id":1,"profile":{"name":"John"}}}')
      );
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      process.env.LOG_LEVEL = 'DEBUG';
      vi.resetModules();
    });

    it('should extract message from Error object', async () => {
      const { logger } = await import('@/libs/logger');
      const error = new Error('Something went wrong');
      
      logger.error('Test', 'Operation failed', error);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Something went wrong')
      );
    });

    it('should include stack trace from Error object', async () => {
      const { logger } = await import('@/libs/logger');
      const error = new Error('Test error');
      
      logger.error('Test', 'Failed', error);

      const call = consoleErrorSpy.mock.calls[0][0] as string;
      expect(call).toContain('Error: Test error');
      expect(call).toContain('\n'); // Stack trace has newlines
    });

    it('should handle Error without stack gracefully', async () => {
      const { logger } = await import('@/libs/logger');
      const error = new Error('No stack');
      error.stack = undefined;
      
      logger.error('Test', 'Failed', error);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('No stack')
      );
    });

    it('should handle circular references gracefully', async () => {
      const { logger } = await import('@/libs/logger');
      const circular: Record<string, unknown> = { name: 'test' };
      circular.self = circular;
      
      // Should not throw, should log [Object] fallback
      expect(() => logger.info('Test', 'Circular', circular)).not.toThrow();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Object]')
      );
    });
  });

  describe('Console Method Mapping', () => {
    beforeEach(async () => {
      process.env.LOG_LEVEL = 'DEBUG';
      vi.resetModules();
    });

    it('should use console.log for DEBUG level', async () => {
      const { logger } = await import('@/libs/logger');
      
      logger.debug('Test', 'Debug message');

      expect(consoleLogSpy).toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should use console.log for INFO level', async () => {
      const { logger } = await import('@/libs/logger');
      
      logger.info('Test', 'Info message');

      expect(consoleLogSpy).toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should use console.warn for WARN level', async () => {
      const { logger } = await import('@/libs/logger');
      
      logger.warn('Test', 'Warning message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should use console.error for ERROR level', async () => {
      const { logger } = await import('@/libs/logger');
      
      logger.error('Test', 'Error message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      process.env.LOG_LEVEL = 'DEBUG';
      vi.resetModules();
    });

    it('should handle empty context string', async () => {
      const { logger } = await import('@/libs/logger');
      
      logger.info('', 'Message');

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[]'));
    });

    it('should handle empty message string', async () => {
      const { logger } = await import('@/libs/logger');
      
      logger.info('Test', '');

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[Test] '));
    });

    it('should handle special characters in context', async () => {
      const { logger } = await import('@/libs/logger');
      
      logger.info('Stripe Webhook', 'Event received');

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[Stripe Webhook]'));
    });

    it('should handle special characters in message', async () => {
      const { logger } = await import('@/libs/logger');
      
      logger.info('Test', 'User "john" logged in with email <john@test.com>');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('User "john" logged in with email <john@test.com>')
      );
    });

    it('should handle very long messages', async () => {
      const { logger } = await import('@/libs/logger');
      const longMessage = 'A'.repeat(10000);
      
      logger.info('Test', longMessage);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(longMessage));
    });

    it('should handle invalid LOG_LEVEL by defaulting to INFO', async () => {
      process.env.LOG_LEVEL = 'INVALID';
      vi.resetModules();
      const { logger } = await import('@/libs/logger');
      
      logger.debug('Test', 'Debug');
      logger.info('Test', 'Info');

      // Invalid level defaults to INFO, so debug shouldn't log
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO]'));
    });
  });

  describe('Real-world Usage Patterns', () => {
    beforeEach(async () => {
      process.env.LOG_LEVEL = 'DEBUG';
      vi.resetModules();
    });

    it('should log authentication events correctly', async () => {
      const { logger } = await import('@/libs/logger');
      
      logger.info('Auth', 'User logged in successfully', { userId: 123, email: 'user@example.com' });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Auth] User logged in successfully')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"userId":123')
      );
    });

    it('should log payment events correctly', async () => {
      const { logger } = await import('@/libs/logger');
      
      logger.info('Stripe Webhook', 'Payment completed', {
        invoiceId: 456,
        amount: 15000,
        currency: 'EUR',
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Stripe Webhook] Payment completed')
      );
    });

    it('should log scheduler events correctly', async () => {
      const { logger } = await import('@/libs/logger');
      
      logger.info('Scheduler', 'Payment due check completed', { notificationsSent: 5 });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Scheduler] Payment due check completed')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"notificationsSent":5')
      );
    });

    it('should log API errors correctly', async () => {
      const { logger } = await import('@/libs/logger');
      const error = new Error('Database connection failed');
      
      logger.error('API', 'Request failed', error);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[API] Request failed')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Database connection failed')
      );
    });
  });
});
