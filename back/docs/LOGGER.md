# Logger Utility

ClutchPay uses a simple, zero-dependency logging utility that provides structured logging with timestamps and levels.

## Overview

The logger is designed to:

- Output structured logs with ISO timestamps
- Support configurable log levels
- Serialize JSON data automatically
- Handle Error objects with stack traces
- Work seamlessly with systemd journal in production

## Usage

### Basic Import

```typescript
import { logger } from '@/libs/logger';
```

### Log Methods

The logger provides four methods corresponding to log levels:

```typescript
// Debug level - verbose development information
logger.debug('Context', 'Message');

// Info level - general operational information
logger.info('Context', 'Message');

// Warn level - warnings that don't prevent operation
logger.warn('Context', 'Message');

// Error level - errors that affect operation
logger.error('Context', 'Message');
```

### Parameters

All log methods accept the same signature:

```typescript
logger.{level}(context: string, message: string, data?: unknown)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `context` | `string` | The component or area of the application (e.g., 'Auth', 'Stripe Webhook', 'Scheduler') |
| `message` | `string` | A human-readable description of the event |
| `data` | `unknown` | Optional additional data - objects, arrays, primitives, or Error objects |

## Output Format

All logs follow this format:

```
[TIMESTAMP] [LEVEL] [CONTEXT] MESSAGE | DATA
```

### Examples

**Simple log:**
```typescript
logger.info('Server', 'Application started');
// [2024-12-18T22:30:00.000Z] [INFO] [Server] Application started
```

**Log with data object:**
```typescript
logger.info('Auth', 'User logged in', { userId: 123, email: 'user@example.com' });
// [2024-12-18T22:30:00.000Z] [INFO] [Auth] User logged in | {"userId":123,"email":"user@example.com"}
```

**Log with error:**
```typescript
logger.error('Payment', 'Stripe webhook failed', error);
// [2024-12-18T22:30:00.000Z] [ERROR] [Payment] Stripe webhook failed | Error message here
// <stack trace>
```

## Configuration

### Log Level

The minimum log level is controlled by the `LOG_LEVEL` environment variable:

| Value | Logs Displayed |
|-------|----------------|
| `DEBUG` | DEBUG, INFO, WARN, ERROR |
| `INFO` | INFO, WARN, ERROR (default) |
| `WARN` | WARN, ERROR |
| `ERROR` | ERROR only |

### Setting Log Level

**In `.env` file:**
```env
LOG_LEVEL=DEBUG
```

**In production (systemd):**
```bash
LOG_LEVEL=WARN
```

### Default Behavior

If `LOG_LEVEL` is not set or has an invalid value, the logger defaults to `INFO` level.

## Data Serialization

The logger automatically handles different data types:

### Objects and Arrays

Serialized to JSON:
```typescript
logger.info('Test', 'Data', { key: 'value' });
// ... | {"key":"value"}

logger.info('Test', 'Items', [1, 2, 3]);
// ... | [1,2,3]
```

### Primitives

Converted to string:
```typescript
logger.info('Test', 'Count', 42);
// ... | 42

logger.info('Test', 'Status', true);
// ... | true
```

### Error Objects

Error message extracted and stack trace appended:
```typescript
const error = new Error('Connection failed');
logger.error('DB', 'Query failed', error);
// ... | Connection failed
// Error: Connection failed
//     at Object.<anonymous> (file.ts:10:15)
//     ...
```

### Circular References

Handled gracefully with fallback:
```typescript
const obj = { name: 'test' };
obj.self = obj;
logger.info('Test', 'Circular', obj);
// ... | [Object]
```

## Best Practices

### Context Naming

Use consistent, descriptive context names:

| Context | Use Case |
|---------|----------|
| `Auth` | Authentication/authorization events |
| `API` | General API request/response logging |
| `Stripe Webhook` | Stripe payment events |
| `PayPal Payout` | PayPal payout operations |
| `Scheduler` | Scheduled task execution |
| `Notification` | In-app notification events |
| `Email` | Email sending events |
| `Cloudinary` | Image/PDF upload/delete |
| `User` | User profile operations |
| `Invoice` | Invoice CRUD operations |

### What to Log

**INFO level:**
- Successful operations (login, payment, payout)
- Scheduled task completions
- Important state changes

**WARN level:**
- Non-critical failures (old image deletion failed)
- Missing optional configurations
- Retryable errors

**ERROR level:**
- Failed operations that affect functionality
- Authentication failures
- API errors
- Database errors

**DEBUG level:**
- Verbose diagnostic information
- Request/response details
- Internal state for troubleshooting

### Include Relevant Data

Always include identifiers and relevant context:

```typescript
// Good - includes identifiable data
logger.info('Auth', 'User logged in', { userId: 123, email: 'user@example.com' });

// Bad - no way to trace the event
logger.info('Auth', 'User logged in');
```

### Don't Log Sensitive Data

Never log passwords, tokens, or full credit card numbers:

```typescript
// Good
logger.info('Payment', 'Card processed', { last4: '4242' });

// Bad - never do this
logger.info('Payment', 'Card processed', { cardNumber: '4242424242424242' });
```

## Production Considerations

### Systemd Journal

In production, logs are captured by systemd journal. The `installer.sh` configures:

```ini
StandardOutput=journal
StandardError=journal
```

### Viewing Logs

```bash
# All logs
journalctl -u clutchpay-backend

# Real-time
journalctl -u clutchpay-backend -f

# Filter by priority
journalctl -u clutchpay-backend -p err  # Only errors

# Last hour
journalctl -u clutchpay-backend --since "1 hour ago"

# JSON output
journalctl -u clutchpay-backend -o json
```

### Log Rotation

Systemd journal handles log rotation automatically. Default settings keep logs for 4 weeks or until disk space is needed.

## Testing

The logger has comprehensive tests in `tests/libs/logger.test.ts` covering:

- Log level filtering
- Output format
- Data serialization
- Error handling
- Console method mapping
- Edge cases

Run tests:
```bash
pnpm test -- tests/libs/logger.test.ts
```

## Architecture

```
┌─────────────────┐
│  Application    │
│   Code          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  logger.ts      │
│  - format       │
│  - level check  │
│  - serialize    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  console.log/   │
│  warn/error     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  stdout/stderr  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  systemd        │
│  journal        │
└─────────────────┘
```

## API Reference

### Logger Class

```typescript
class Logger {
  debug(context: string, message: string, data?: unknown): void;
  info(context: string, message: string, data?: unknown): void;
  warn(context: string, message: string, data?: unknown): void;
  error(context: string, message: string, data?: unknown): void;
}
```

### Exported Instance

```typescript
export const logger: Logger;
```

A singleton instance is exported for use throughout the application.

## Migration from console.log

Replace direct console calls with logger:

**Before:**
```typescript
console.log('[Auth] User logged in:', userId);
console.error('[Payment] Failed:', error);
```

**After:**
```typescript
logger.info('Auth', 'User logged in', { userId });
logger.error('Payment', 'Payment failed', error);
```
