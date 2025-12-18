# Scheduled Tasks (Cron Jobs)

This document describes the automated background tasks that run on a schedule to maintain platform operations and user engagement.

---

## Table of Contents

1. [Overview](#overview)
2. [Scheduled Tasks](#scheduled-tasks)
3. [Architecture](#architecture)
4. [Manual Triggering](#manual-triggering)
5. [Security](#security)
6. [Logging](#logging)
7. [Production Considerations](#production-considerations)

---

## Overview

The ClutchPay scheduler automatically executes recurring tasks that handle payment notifications and database maintenance. Tasks run within the Next.js server process using the `node-cron` library.

**Key Features:**

- Automatic startup with the Next.js server.
- Configurable schedules using cron expressions.
- Duplicate notification prevention.
- Manual trigger endpoint for testing and external schedulers.
- Production-ready authentication.

---

## Scheduled Tasks

Three automated tasks run on predefined schedules:

### Payment Due Notifications

Reminds debtors of invoices approaching their payment deadline.

| Property | Value |
|----------|-------|
| Schedule | Daily at 9:00 AM |
| Cron Expression | `0 9 * * *` |
| Function | `checkAndNotifyPaymentDue(3)` |

**Behavior:**

- Searches for invoices with status PENDING or OVERDUE.
- Filters invoices with due dates within the next 3 days.
- Excludes invoices without due dates.
- Creates an in-app notification of type `PAYMENT_DUE` for each debtor.
- Sends an email using the `PaymentDueEmail` template if the debtor has email notifications enabled.
- Skips invoices that already have a `PAYMENT_DUE` notification to prevent duplicates.

### Payment Overdue Notifications

Alerts debtors about invoices that have passed their due date without payment.

| Property | Value |
|----------|-------|
| Schedule | Daily at 9:00 AM |
| Cron Expression | `0 9 * * *` |
| Function | `checkAndNotifyPaymentOverdue()` |

**Behavior:**

- Searches for invoices with status PENDING or OVERDUE.
- Filters invoices with due dates in the past.
- Creates an in-app notification of type `PAYMENT_OVERDUE` for each debtor.
- Sends an email using the `PaymentOverdueEmail` template if the debtor has email notifications enabled.
- Skips invoices that already have a `PAYMENT_OVERDUE` notification to prevent duplicates.

### Notification Cleanup

Maintains database hygiene by removing old read notifications.

| Property | Value |
|----------|-------|
| Schedule | Sundays at 2:00 AM |
| Cron Expression | `0 2 * * 0` |
| Function | `cleanupOldReadNotifications(60)` |

**Behavior:**

- Targets notifications that meet both criteria:
  - `read: true` (the notification has been viewed by the user)
  - `updatedAt` is older than 60 days
- Deletes matching notifications from the database.
- Preserves unread notifications regardless of age.
- Returns the count of deleted notifications.

---

## Architecture

### Component Files

The scheduler system consists of four main components:

| File | Purpose |
|------|---------|
| `src/libs/scheduler.ts` | Defines and registers all cron tasks with their schedules |
| `src/libs/notifications.ts` | Implements notification check and cleanup functions |
| `instrumentation.ts` | Next.js lifecycle hook that starts the scheduler on server init |
| `src/app/api/cron/check-payments/route.ts` | HTTP endpoint for manual task triggering |

### Startup Flow

When the Next.js server starts:

1. Next.js detects and executes `instrumentation.ts`.
2. The `register()` function checks if running on Node.js runtime.
3. If on Node.js, it imports and calls `startScheduler()`.
4. `startScheduler()` registers all three cron tasks with `node-cron`.
5. The library begins its internal polling loop (checks every minute).
6. Tasks execute automatically when the current time matches their cron expression.

### Cron Expression Reference

The scheduler uses standard 5-field cron expressions:

```text
┌───────────── minute (0-59)
│ ┌─────────── hour (0-23)
│ │ ┌───────── day of month (1-31)
│ │ │ ┌─────── month (1-12)
│ │ │ │ ┌───── day of week (0-7, where 0 and 7 are Sunday)
│ │ │ │ │
* * * * *
```

**Examples:**

| Expression | Schedule |
|------------|----------|
| `0 9 * * *` | Every day at 9:00 AM |
| `0 2 * * 0` | Every Sunday at 2:00 AM |
| `*/15 * * * *` | Every 15 minutes |
| `0 0 1 * *` | First day of every month at midnight |

---

## Manual Triggering

The API provides an endpoint to manually execute scheduled tasks for testing or integration with external schedulers.

### Endpoint

```text
GET /api/cron/check-payments
```

### Query Parameters

| Parameter | Values | Description |
|-----------|--------|-------------|
| `task` | `due`, `overdue`, `cleanup` | Execute a specific task only |
| (none) | - | Execute all tasks in parallel |

### Task: Payment Due (`task=due`)

```bash
GET /api/cron/check-payments?task=due
```

**Response:**

```json
{
  "success": true,
  "message": "Payment due check executed",
  "results": {
    "paymentDue": 5
  },
  "timestamp": "2025-12-18T09:00:00.000Z"
}
```

The `paymentDue` value indicates the number of notifications sent.

### Task: Payment Overdue (`task=overdue`)

```bash
GET /api/cron/check-payments?task=overdue
```

**Response:**

```json
{
  "success": true,
  "message": "Payment overdue check executed",
  "results": {
    "paymentOverdue": 3
  },
  "timestamp": "2025-12-18T09:00:00.000Z"
}
```

The `paymentOverdue` value indicates the number of notifications sent.

### Task: Cleanup (`task=cleanup`)

```bash
GET /api/cron/check-payments?task=cleanup
```

**Response:**

```json
{
  "success": true,
  "message": "Notification cleanup executed",
  "results": {
    "cleanupOldNotifications": 12
  },
  "timestamp": "2025-12-18T02:00:00.000Z"
}
```

The `cleanupOldNotifications` value indicates the number of notifications deleted.

### All Tasks (No Parameter)

```bash
GET /api/cron/check-payments
```

**Response:**

```json
{
  "success": true,
  "message": "Scheduled tasks executed",
  "results": {
    "paymentDue": 5,
    "paymentOverdue": 3,
    "cleanupOldNotifications": 12
  },
  "timestamp": "2025-12-18T09:00:00.000Z"
}
```

---

## Security

The manual trigger endpoint implements environment-based authentication.

### Development and Test Environments

When `NODE_ENV` is not `production`, the endpoint is open without authentication. This simplifies testing and development workflows.

```bash
# No authentication required in development
curl http://localhost:3000/api/cron/check-payments
```

### Production Environment

In production, requests must include a secret header that matches the configured environment variable.

**Configuration:**

1. Generate a secure random secret:

```bash
openssl rand -base64 32
```

2. Add to environment variables:

```bash
CRON_SECRET=your-generated-secret-here
```

3. Include header in requests:

```bash
curl -H "x-cron-secret: your-generated-secret-here" \
  https://your-domain.com/api/cron/check-payments
```

**Error Response (401 Unauthorized):**

```json
{
  "error": "Unauthorized"
}
```

### Integration with External Schedulers

For production deployments, external cron services can trigger the endpoint:

| Service | Configuration |
|---------|---------------|
| Vercel Cron | Add header in `vercel.json` cron configuration |
| GitHub Actions | Store secret in repository secrets, pass in workflow |
| AWS EventBridge | Include header in HTTP target configuration |
| Railway/Render | Use platform's built-in cron with environment variables |

---

## Logging

The scheduler outputs logs to the console for monitoring and debugging.

### Startup Logs

When the server starts, the scheduler announces its initialization:

```log
[Scheduler] Starting scheduled tasks...
[Scheduler] All scheduled tasks started successfully
  - Payment due check: Daily at 9:00 AM
  - Payment overdue check: Daily at 9:00 AM
  - Notification cleanup: Sundays at 2:00 AM (60 days old)
```

### Execution Logs

When tasks execute (either automatically or manually), they log their activity:

```log
[Scheduler] Running payment due check...
[Scheduler] Checked payment due: 3 notifications sent

[Scheduler] Running payment overdue check...
[Scheduler] Checked payment overdue: 1 notifications sent

[Scheduler] Running notification cleanup...
[Scheduler] Deleted 12 old read notifications
```

### Error Logs

If a task encounters an error, it is logged without crashing the scheduler:

```log
[Scheduler] Error checking payment due: [Error details]
```

---

## Production Considerations

### Single Server Deployment

The current implementation is designed for single-server deployments. Tasks run within the Node.js process and execute reliably as long as the server is running.

**Advantages:**

- Simple setup with no external dependencies.
- Tasks survive server restarts (reinitialize on startup).
- Consistent timing with server timezone.

### Multi-Instance Deployment

When running multiple server instances behind a load balancer, additional considerations apply:

**Problem:** Each instance runs its own scheduler, potentially causing duplicate task execution.

**Solutions:**

| Approach | Implementation |
|----------|----------------|
| Disable internal scheduler | Use only the manual trigger endpoint with an external scheduler |
| Distributed locks | Implement Redis-based locks to ensure only one instance executes |
| Dedicated worker | Run a separate service instance solely for scheduled tasks |

### External Scheduler Integration

For deployments using external cron services instead of the internal scheduler:

1. Disable the internal scheduler by commenting out the start call in `instrumentation.ts`:

```typescript
// startScheduler(); // Disabled - using external scheduler
```

2. Configure the external service to call the endpoint at desired intervals.

3. Ensure the `CRON_SECRET` is configured and passed in requests.

### Disabling in Development

To prevent scheduled tasks from running during development:

1. Comment the scheduler initialization in `instrumentation.ts`:

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // const { startScheduler } = await import('./src/libs/scheduler');
    // startScheduler();
  }
}
```

2. Alternatively, check an environment variable before starting:

```typescript
if (process.env.ENABLE_SCHEDULER === 'true') {
  startScheduler();
}
```

### Task Timing Considerations

**Time Zone:** Tasks execute based on the server's system time zone. For consistent behavior across environments, consider setting the `TZ` environment variable.

**Execution Window:** The `node-cron` library checks every minute. Tasks scheduled for specific times will execute within that minute when the condition is met.

**Missed Executions:** If the server is down when a task is scheduled to run, that execution is missed. The task will run at the next scheduled time when the server is available.
