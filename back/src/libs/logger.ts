/**
 * Simple logging utility for ClutchPay backend
 * 
 * Provides structured logging with timestamps and levels.
 * All logs go to stdout/stderr and are captured by systemd journal in production.
 * 
 * Usage:
 *   import { logger } from '@/libs/logger';
 *   logger.info('Server', 'Application started');
 *   logger.error('Payment', 'Stripe webhook failed', error);
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LoggerOptions {
  minLevel?: LogLevel;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

class Logger {
  private minLevel: number;

  constructor(options: LoggerOptions = {}) {
    const envLevel = (process.env.LOG_LEVEL?.toUpperCase() as LogLevel) || 'INFO';
    this.minLevel = LOG_LEVELS[options.minLevel || envLevel] ?? LOG_LEVELS.INFO;
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= this.minLevel;
  }

  private formatMessage(level: LogLevel, context: string, message: string, data?: unknown): string {
    const timestamp = this.formatTimestamp();
    const base = `[${timestamp}] [${level}] [${context}] ${message}`;
    
    if (data !== undefined) {
      if (data instanceof Error) {
        return `${base} | ${data.message}${data.stack ? `\n${data.stack}` : ''}`;
      }
      if (typeof data === 'object') {
        try {
          return `${base} | ${JSON.stringify(data)}`;
        } catch {
          return `${base} | [Object]`;
        }
      }
      return `${base} | ${String(data)}`;
    }
    
    return base;
  }

  /**
   * Log debug information (only in development or when LOG_LEVEL=DEBUG)
   */
  debug(context: string, message: string, data?: unknown): void {
    if (this.shouldLog('DEBUG')) {
      console.log(this.formatMessage('DEBUG', context, message, data));
    }
  }

  /**
   * Log general information about application operations
   */
  info(context: string, message: string, data?: unknown): void {
    if (this.shouldLog('INFO')) {
      console.log(this.formatMessage('INFO', context, message, data));
    }
  }

  /**
   * Log warnings that don't prevent operation but should be noted
   */
  warn(context: string, message: string, data?: unknown): void {
    if (this.shouldLog('WARN')) {
      console.warn(this.formatMessage('WARN', context, message, data));
    }
  }

  /**
   * Log errors that affect operation
   */
  error(context: string, message: string, data?: unknown): void {
    if (this.shouldLog('ERROR')) {
      console.error(this.formatMessage('ERROR', context, message, data));
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export class for custom instances if needed
export { Logger };

