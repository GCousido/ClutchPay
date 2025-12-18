# Technology Stack Documentation

This document provides a comprehensive overview of the core technologies integrated into the ClutchPay backend application. Each section describes the technology, its purpose within the project, configuration requirements, and integration details.

---

## Table of Contents

- [Technology Stack Documentation](#technology-stack-documentation)
  - [Table of Contents](#table-of-contents)
  - [1. Prisma](#1-prisma)
  - [2. NextAuth.js](#2-nextauthjs)
  - [3. Cloudinary](#3-cloudinary)
  - [4. Stripe](#4-stripe)
  - [5. PayPal](#5-paypal)
  - [6. node-cron](#6-node-cron)
  - [7. Vitest](#7-vitest)
  - [8. Resend and React Email](#8-resend-and-react-email)
  - [Environment Variables Summary](#environment-variables-summary)
  - [Package Dependencies Overview](#package-dependencies-overview)
  - [Architecture Summary](#architecture-summary)

---

## 1. Prisma

**What it is:** Prisma is a modern database toolkit that provides a type-safe query builder, automated migrations, and schema management for relational databases. It acts as an ORM (Object-Relational Mapping) layer that simplifies database operations while maintaining full type safety with TypeScript.

**How it works:** Prisma operates through three main components. The Prisma Schema is a declarative configuration file that defines the data models, relationships, and database connection. The Prisma Client is an auto-generated, type-safe query builder that provides methods for CRUD operations. Prisma Migrate is a migration system that tracks schema changes and applies them to the database. When the schema is modified, Prisma generates TypeScript types and a client library that reflects the current database structure, ensuring compile-time type checking for all database queries.

**Features in ClutchPay:**

- User Management: Storage and retrieval of user profiles, authentication credentials, and preferences.
- Invoice Operations: Creation, querying, and status updates for invoices between users.
- Payment Records: Tracking payment transactions linked to invoices.
- Notification System: Storing in-app notifications with read status and timestamps.
- Contact Relationships: Managing many-to-many user contact associations.

**Configuration:**

| Package | Type |
|---------|------|
| `@prisma/client` | Runtime dependency |
| `prisma` | Development dependency |

| Environment Variable | Description | Example |
|---------------------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/dbname` |
| `TEST_DATABASE_URL` | Separate database for testing | `postgresql://user:pass@localhost:5432/test_db` |

Schema Location: `prisma/schema.prisma`

**Integration:** The Prisma client is instantiated as a singleton in `src/libs/db.ts` to prevent connection pool exhaustion during development hot reloads. All database operations throughout the application import this shared instance. Migrations are stored in `prisma/migrations/` and applied using the Prisma CLI.

---

## 2. NextAuth.js

**What it is:** NextAuth.js is a complete authentication solution for Next.js applications. It provides session management, JWT handling, and multiple authentication strategies out of the box, while remaining flexible enough to support custom credential-based authentication.

**How it works:** NextAuth.js intercepts authentication requests at a designated API route, validates credentials against configured providers, and manages session state. Sessions can be stored as JWTs (stateless) or in a database (stateful). The library provides React hooks and server-side utilities for accessing session data throughout the application.

**Features in ClutchPay:**

- Email/Password Authentication: Custom credentials provider for user login with bcrypt password verification.
- Session Management: JWT-based sessions with configurable expiration.
- Protected API Routes: Middleware utilities for requiring authentication on specific endpoints.
- User Session Data: Exposing user ID, email, and name through session callbacks.

**Configuration:**

| Package | Type |
|---------|------|
| `next-auth` | Runtime dependency |
| `bcryptjs` | Runtime dependency (password hashing) |

| Environment Variable | Description | Example |
|---------------------|-------------|---------|
| `NEXTAUTH_URL` | Base URL of the application | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | Secret key for JWT signing | Random 32+ character string |
| `NEXTAUTH_DEBUG` | Enable verbose logging | `true` or `false` |

**Integration:** NextAuth is configured in `src/libs/auth.ts`, which exports the authentication options used by the API route handler. The credentials provider queries the database via Prisma to verify user credentials. Session callbacks enrich the JWT and session objects with the user ID for use in protected routes. Protected API endpoints use the `getServerSession` function to verify authentication status.

---

## 3. Cloudinary

**What it is:** Cloudinary is a cloud-based media management platform that provides storage, transformation, optimization, and delivery of images and other assets. It offers a comprehensive API for uploading, managing, and serving media files with automatic format optimization and CDN delivery.

**How it works:** Files are uploaded to Cloudinary through its SDK, which returns a secure URL pointing to the stored asset. Cloudinary can transform images on-the-fly through URL parameters, enabling resizing, cropping, format conversion, and other modifications without storing multiple versions.

**Features in ClutchPay:**

- User Profile Images: Storage and retrieval of user avatar images.
- Invoice PDF Storage: Persistent storage of generated invoice PDF documents.
- Payment Receipt Storage: Storage of payment confirmation receipt PDFs.
- Automatic Optimization: Delivery of assets with format and quality optimization.

**Configuration:**

| Package | Type |
|---------|------|
| `cloudinary` | Runtime dependency |

| Environment Variable | Description | Example |
|---------------------|-------------|---------|
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloudinary account identifier | `your_cloud_name` |
| `NEXT_PUBLIC_CLOUDINARY_API_KEY` | Public API key | Numeric key from dashboard |
| `CLOUDINARY_API_SECRET` | Private API secret | Secret from dashboard |

**Integration:** Cloudinary is configured in `src/libs/cloudinary.ts`, which initializes the SDK with credentials and exports utility functions for uploading files. The module provides specialized functions for uploading user images (with circular cropping transformations) and PDF documents. Upload operations return secure URLs that are stored in the database alongside the relevant records.

---

## 4. Stripe

**What it is:** Stripe is a payment processing platform that enables businesses to accept online payments. It provides APIs for creating payment sessions, processing transactions, handling refunds, and managing recurring billing. Stripe handles PCI compliance, fraud detection, and payment method management.

**How it works:** The typical Stripe integration follows the Checkout Session flow. First, the server creates a Checkout Session with payment details. Then, the customer is redirected to Stripe's hosted payment page. After payment, Stripe redirects back to the application. Finally, webhooks notify the application of payment events asynchronously. This approach minimizes PCI compliance burden by keeping sensitive card data on Stripe's servers.

**Features in ClutchPay:**

- Invoice Payments: Debtors pay invoices through Stripe Checkout Sessions.
- Automatic Receipt Generation: Creation of payment receipts upon successful payment.
- Invoice Status Updates: Automatic transition of invoice status from PENDING to PAID.
- Webhook Processing: Handling of asynchronous payment confirmation events.
- Notification Triggers: Sending payment confirmation notifications to both parties.

**Configuration:**

| Package | Type |
|---------|------|
| `stripe` | Runtime dependency |

| Environment Variable | Description | Example |
|---------------------|-------------|---------|
| `STRIPE_SECRET_KEY` | Private API key for server operations | `sk_test_...` or `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Secret for verifying webhook signatures | `whsec_...` |
| `STRIPE_CURRENCY` | Default currency for payments | `eur`, `usd`, `gbp` |
| `NEXT_PUBLIC_APP_URL` | Application URL for redirect callbacks | `http://localhost:3000` |

**Integration:** Stripe functionality is implemented across several modules. The file `src/libs/stripe.ts` contains the core Stripe client initialization and utility functions. The route `src/app/api/payments/stripe-session/route.ts` creates Checkout Sessions for invoice payments. The route `src/app/api/payments/stripe-webhook/route.ts` processes webhook events for payment confirmation. The webhook endpoint verifies event signatures using the webhook secret, then updates invoice status, creates payment records, generates receipts, and triggers notifications upon successful payment.

---

## 5. PayPal

**What it is:** PayPal is a digital payment platform that enables money transfers and serves as an electronic alternative to traditional payment methods. The PayPal Payouts API allows businesses to send payments to multiple recipients simultaneously, making it suitable for disbursing funds to users.

**How it works:** PayPal Payouts operates differently from standard payment acceptance. First, the application authenticates with PayPal using OAuth credentials. Then, a payout batch is created with recipient details and amounts. PayPal processes the batch and transfers funds to recipients. Finally, webhook notifications confirm payout status. Payouts require the sender (the platform) to have sufficient funds in their PayPal account.

**Features in ClutchPay:**

- Issuer Payouts: Transferring funds to invoice issuers after payment collection.
- Batch Processing: Support for creating payout batches with multiple recipients.
- Payout Status Tracking: Monitoring the status of disbursed funds.
- Email-Based Transfers: Sending payouts to recipients via their PayPal email addresses.

**Configuration:**

| Package | Type |
|---------|------|
| `@paypal/payouts-sdk` | Runtime dependency |
| `@paypal/paypal-server-sdk` | Runtime dependency |

| Environment Variable | Description | Example |
|---------------------|-------------|---------|
| `PAYPAL_CLIENT_ID` | OAuth client ID from PayPal Developer Dashboard | Application client ID |
| `PAYPAL_CLIENT_SECRET` | OAuth client secret | Application secret |
| `PAYPAL_MODE` | Environment mode | `sandbox` or `live` |

**Integration:** PayPal integration is implemented in `src/libs/paypal.ts`, which configures the PayPal SDK with OAuth credentials and provides functions for creating payouts. The payout functionality connects to the post-payment flow, enabling automatic disbursement of collected funds to invoice issuers. The module handles authentication, payout creation, and error handling for failed transfers.

---

## 6. node-cron

**What it is:** node-cron is a lightweight task scheduler for Node.js based on GNU crontab syntax. It enables scheduling of recurring tasks within the application process, eliminating the need for external cron services for simple scheduling requirements.

**How it works:** node-cron registers task callbacks with cron expressions that define execution schedules. The library maintains an internal timer that checks every minute whether any registered tasks should execute based on the current time matching the cron expression. Tasks run within the Node.js process and share its memory and resources.

Cron Expression Format: The expression consists of five fields representing minute (0-59), hour (0-23), day of month (1-31), month (1-12), and day of week (0-7, where 0 and 7 are Sunday). An asterisk matches any value.

**Features in ClutchPay:**

- Payment Due Notifications: Daily checks for invoices approaching their due date, sending reminders to debtors.
- Overdue Payment Alerts: Daily identification of past-due invoices and notification dispatch.
- Notification Cleanup: Weekly removal of old read notifications to maintain database hygiene.

**Configuration:**

| Package | Type |
|---------|------|
| `node-cron` | Runtime dependency |
| `@types/node-cron` | Development dependency |

| Environment Variable | Description | Example |
|---------------------|-------------|---------|
| `CRON_SECRET` | Secret for protecting manual trigger endpoint | Random string for production |

**Integration:** The scheduler system consists of three components. The file `src/libs/scheduler.ts` defines and registers cron tasks with their execution schedules. The file `instrumentation.ts` is a Next.js lifecycle hook that starts the scheduler when the server initializes. The route `src/app/api/cron/check-payments/route.ts` provides an HTTP endpoint for manually triggering scheduled tasks.

Tasks are configured to run at specific times: payment due checks execute daily at 9:00 AM, overdue payment checks execute daily at 9:00 AM, and notification cleanup executes weekly on Sundays at 2:00 AM.

The scheduler automatically prevents duplicate notifications by checking for existing notifications of the same type before creating new ones.

---

## 7. Vitest

**What it is:** Vitest is a next-generation testing framework built on Vite, designed specifically for modern JavaScript and TypeScript projects. It provides a Jest-compatible API with significantly faster execution times due to native ES modules support and intelligent test isolation.

**How it works:** Vitest leverages Vite's transformation pipeline to process test files without requiring separate compilation steps. It supports parallel test execution, watch mode with instant re-runs, and provides built-in coverage reporting. The framework integrates seamlessly with TypeScript without additional configuration.

**Features in ClutchPay:**

- Unit Testing: Testing individual functions and utilities in isolation.
- Integration Testing: Testing API routes with database interactions.
- Mock Support: Mocking external services like email, Stripe, and PayPal.
- Coverage Reporting: Generating code coverage metrics and reports.
- Containerized Database: Automatic provisioning of test database containers.

**Configuration:**

| Package | Type |
|---------|------|
| `vitest` | Development dependency |
| `@vitest/coverage-v8` | Development dependency |
| `@vitest/ui` | Development dependency |

Configuration File: `vitest.config.mts`

| Test Command | Description |
|--------------|-------------|
| `pnpm test` | Run tests with containerized database |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:coverage` | Run tests with coverage report |
| `pnpm test:ui` | Run tests with interactive UI |

**Integration:** Tests are organized in the `tests/` directory with subdirectories mirroring the source structure. The directory `tests/api/` contains API route integration tests. The directory `tests/libs/` contains library and utility unit tests. The directory `tests/helpers/` contains shared test utilities and fixtures.

The test runner script (`scripts/run-tests.ts`) automatically starts a PostgreSQL container, applies migrations, runs tests, and cleans up the container. A setup file (`tests/setup.ts`) configures global mocks for external services and resets database state between tests.

---

## 8. Resend and React Email

**What it is:** Resend is a modern email API designed for developers, providing reliable email delivery with a simple REST API. React Email is a companion library that enables building email templates using React components, offering a familiar development experience with preview capabilities.

**How it works:** React Email templates are React components that render to HTML optimized for email clients. Resend's API accepts these rendered templates and handles delivery, tracking, and compliance. The combination provides a type-safe, component-based approach to transactional email development.

**Features in ClutchPay:**

- Invoice Notifications: Sending emails when new invoices are issued.
- Payment Due Reminders: Alerting debtors of approaching payment deadlines.
- Overdue Payment Alerts: Notifying debtors of past-due invoices.
- Payment Confirmations: Confirming successful payments to both parties.
- Cancellation Notices: Informing parties when invoices are canceled.

**Configuration:**

| Package | Type |
|---------|------|
| `resend` | Runtime dependency |
| `react-email` | Runtime dependency |
| `@react-email/components` | Runtime dependency |

| Environment Variable | Description | Example |
|---------------------|-------------|---------|
| `RESEND_API_KEY` | API key from Resend dashboard | `re_...` |
| `FRONTEND_URL` | Base URL for links in emails | `https://your-domain.com` |

**Integration:** Email functionality is structured across several locations. The directory `src/libs/email/` contains React Email template components for each notification type. The file `src/libs/notifications.ts` exports email sending functions that render templates and dispatch via Resend.

Template previews can be generated using the preview script, which renders each template to static HTML files in `email-previews/`. The notification system checks user preferences before sending emails, respecting the `emailNotifications` flag in user records.

---

## Environment Variables Summary

The following table summarizes all environment variables required for the complete technology stack:

| Category | Variable | Required | Description |
|----------|----------|----------|-------------|
| Database | `DATABASE_URL` | Yes | PostgreSQL connection string |
| Database | `TEST_DATABASE_URL` | Testing | Test database connection |
| Auth | `NEXTAUTH_URL` | Yes | Application base URL |
| Auth | `NEXTAUTH_SECRET` | Yes | JWT signing secret |
| Auth | `NEXTAUTH_DEBUG` | No | Enable debug logging |
| Cloudinary | `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Yes | Cloud name identifier |
| Cloudinary | `NEXT_PUBLIC_CLOUDINARY_API_KEY` | Yes | Public API key |
| Cloudinary | `CLOUDINARY_API_SECRET` | Yes | Private API secret |
| Stripe | `STRIPE_SECRET_KEY` | Yes | Private API key |
| Stripe | `STRIPE_WEBHOOK_SECRET` | Yes | Webhook signature secret |
| Stripe | `STRIPE_CURRENCY` | No | Default currency |
| PayPal | `PAYPAL_CLIENT_ID` | Yes | OAuth client ID |
| PayPal | `PAYPAL_CLIENT_SECRET` | Yes | OAuth client secret |
| PayPal | `PAYPAL_MODE` | Yes | sandbox or live |
| Email | `RESEND_API_KEY` | Yes | Resend API key |
| Email | `FRONTEND_URL` | Yes | URL for email links |
| Cron | `CRON_SECRET` | Production | Endpoint protection secret |
| General | `NEXT_PUBLIC_APP_URL` | Yes | Public application URL |

---

## Package Dependencies Overview

**Runtime Dependencies:**

| Package | Purpose |
|---------|---------|
| `@paypal/payouts-sdk` | PayPal payout operations |
| `@paypal/paypal-server-sdk` | PayPal server integration |
| `@prisma/client` | Database ORM client |
| `@react-email/components` | Email template components |
| `bcryptjs` | Password hashing |
| `cloudinary` | Media storage and delivery |
| `next` | React framework |
| `next-auth` | Authentication |
| `node-cron` | Task scheduling |
| `react-email` | Email template rendering |
| `resend` | Email delivery API |
| `stripe` | Payment processing |

**Development Dependencies:**

| Package | Purpose |
|---------|---------|
| `@types/node-cron` | TypeScript types for node-cron |
| `@vitest/coverage-v8` | Code coverage reporting |
| `@vitest/ui` | Interactive test UI |
| `prisma` | Database schema and migrations CLI |
| `vitest` | Testing framework |

---

## Architecture Summary

The ClutchPay backend follows a modular architecture where each technology integration is encapsulated in dedicated modules within `src/libs/`. This separation enables independent testing of each integration, clear dependency boundaries, simplified mocking for unit tests, and centralized configuration management.

API routes in `src/app/api/` consume these library modules to implement business logic, maintaining thin controller layers that orchestrate library calls rather than implementing integration details directly.
