# ClutchPay Backend

[![Backend Tests](https://github.com/GCousido/ClutchPay/actions/workflows/backend-tests.yml/badge.svg)](https://github.com/GCousido/ClutchPay/actions/workflows/backend-tests.yml)
[![codecov](https://codecov.io/gh/GCousido/ClutchPay/graph/badge.svg?token=YO9JU00M3K)](https://codecov.io/gh/GCousido/ClutchPay)

The backend application for ClutchPay, built with Next.js App Router, Prisma ORM, and PostgreSQL. This service provides a RESTful API for invoice management, user authentication, and payment tracking.

---

## 📋 Overview

This is a full-stack Next.js application using the App Router architecture with API routes. It handles:

- **User Authentication**: Secure credential-based authentication with NextAuth.js
- **User Management**: CRUD operations for user profiles and contacts
- **Invoice Management**: Create, update, and delete invoices with PDF attachments
- **Payment Processing**: Stripe integration for payments with PayPal payouts
- **Notifications**: Internal notification system + email notifications via Resend
- **File Storage**: Cloudinary integration for images and PDFs
- **Database Operations**: PostgreSQL database with Prisma ORM
- **Validation**: Type-safe request/response validation with Zod
- **Logging**: Structured logging with configurable log levels
- **Testing**: Comprehensive test suite with Vitest (unit + integration tests)

---

## 🏗️ Architecture

### Directory Structure

```text
back/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/          # API routes
│   │   │   ├── auth/     # Authentication endpoints
│   │   │   ├── invoices/ # Invoice management endpoints
│   │   │   └── users/    # User management endpoints
│   │   ├── layout.tsx    # Root layout
│   │   └── page.tsx      # Home page
│   │
│   └── libs/             # Shared libraries
│       ├── auth.ts       # NextAuth configuration
│       ├── cloudinary.ts # Cloudinary file upload/delete
│       ├── db.ts         # Prisma client singleton
│       ├── api-helpers.ts # API utility functions
│       └── validations/  # Zod schemas
│           ├── index.ts
│           ├── invoice.ts
│           └── user.ts
│
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── migrations/       # Database migrations
│
├── tests/                # Test suites
│
├── docker/               # Docker configuration
│   └── docker-compose.yml # PostgreSQL service
│
├── scripts/              # Utility scripts
│   ├── generate-coverage-report.js
│   └── coverage-md-to-pdf.mjs
│
├── types/                # TypeScript type definitions
│   ├── nextauth.d.ts     # NextAuth types
│   ├── routes.d.ts       # Route types
│   └── validator.ts      # Validator types
│
├── .env                  # Environment variables (git-ignored)
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── vitest.config.mts     # Vitest test configuration
└── next.config.ts        # Next.js configuration
```

---

## 🔧 Configuration Files

### Environment Variables (.env)

Required variables:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/clutchpay?schema=public

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secure-random-secret-min-32-chars

# JWT
JWT_SECRET=your-jwt-secret-key-min-32-chars

# Cloudinary (File Storage)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
NEXT_PUBLIC_CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Stripe (Payments)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_CURRENCY=eur

# PayPal (Payouts)
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret
PAYPAL_MODE=sandbox  # 'sandbox' or 'live'

# Email (Resend)
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL=ClutchPay <noreply@clutchpay.com>

# Logging
LOG_LEVEL=INFO  # DEBUG, INFO, WARN, ERROR

# Application
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
FRONTEND_URL=http://localhost:80
```

### Prisma Schema

Located at `prisma/schema.prisma`, defines:

- **User Model**: User authentication and profile data
- **Invoice Model**: Invoice data
- **Payment Model**: Payment tracking linked to invoices
- **Notification Model**: User notifications
- **Relationships**:
  - User → Invoice (issuer/debtor)
  - Invoice → Payment (one-to-one)
  - User ↔ User (contacts, many-to-many)
- **Indexes**: Optimized for queries on email, invoice numbers, status, dates

### Next.js Configuration

- **App Router**: Uses Next.js 15 App Router architecture
- **API Routes**: RESTful endpoints under `/api`
- **TypeScript**: Full type safety

---

## 🚀 Getting Started

### Prerequisites

- Node.js >= 20.9.0
- pnpm >= 8.0.0
- Docker (for PostgreSQL)
- PostgreSQL

### Installation

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Configure environment**

   ```bash
   # Edit .env with your configuration
   ```

3. **Start PostgreSQL**

   ```bash
   cd docker
   docker-compose up -d
   ```

4. **Run migrations**

   ```bash
   pnpm exec prisma migrate dev
   pnpm exec prisma generate
   ```

5. **Seed database (optional)**

   ```bash
   npx tsx ../utils_dev/seed.ts
   ```

### Development

**Start development server:**

```bash
pnpm run dev
```

Server runs at `http://localhost:3000`

**Available scripts:**

- `pnpm run dev` - Start development server with Turbopack
- `pnpm run build` - Build for production
- `pnpm run start` - Start production server
- `pnpm test` - Run all tests
- `pnpm coverage` - Run tests with coverage report
- `pnpm coverage:all` - Generate PDF with the coverage report

---

## 📡 API Endpoints

### Authentication

#### **Register User**

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+34612345678"
}
```

#### **Login**

```http
POST /api/auth/callback/credentials
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

### Invoices

#### **Get All Invoices**

```http
GET /api/invoices?role=issuer&page=1&limit=10
Authorization: Bearer {token}
```

Query Parameters:

- `role`: `issuer` or `debtor` (required)
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 1000)
- `status`: Filter by status (`PENDING`, `PAID`, `CANCELLED`)
- `subject`: Filter by subject (partial match)
- `minAmount`, `maxAmount`: Filter by amount range
- `issueDateFrom`, `issueDateTo`: Filter by issue date
- `dueDateFrom`, `dueDateTo`: Filter by due date
- `sortBy`: Sort field (default: `createdAt`)
- `sortOrder`: `asc` or `desc` (default: `desc`)

#### **Create Invoice**

```http
POST /api/invoices
Authorization: Bearer {token}
Content-Type: application/json

{
  "invoiceNumber": "INV-2024-001",
  "issuerUserId": 1,
  "debtorUserId": 2,
  "subject": "Web Development Services",
  "description": "Full stack development for e-commerce platform",
  "amount": 2500.00,
  "status": "PENDING",
  "issueDate": "2024-01-15",
  "dueDate": "2024-02-15",
  "invoicePdf": "data:application/pdf;base64,JVBERi0xLjQK..."
}
```

**Note**: `invoicePdf` must be a base64-encoded PDF with the `data:application/pdf;base64,` prefix. The PDF is automatically uploaded to Cloudinary.

#### **Get Invoice by ID**

```http
GET /api/invoices/{id}
Authorization: Bearer {token}
```

Returns invoice details including payment information if available.

#### **Update Invoice**

```http
PUT /api/invoices/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "subject": "Updated Service Description",
  "amount": 3000.00,
  "invoicePdf": "data:application/pdf;base64,JVBERi0xLjQK..."
}
```

**Restrictions**:

- Only the issuer can update an invoice
- Invoices with payments cannot be modified
- If `invoicePdf` is provided, old PDF is deleted from Cloudinary

#### **Delete Invoice**

```http
DELETE /api/invoices/{id}
Authorization: Bearer {token}
```

**Restrictions**:

- Only the issuer can delete an invoice
- Invoices with payments cannot be deleted
- PDF is automatically deleted from Cloudinary

### Users

#### **Get All Users**

```http
GET /api/users?page=1&limit=10
Authorization: Bearer {token}
```

#### **Get User by ID**

```http
GET /api/users/{id}
Authorization: Bearer {token}
```

#### **Update User**

```http
PUT /api/users/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Jane",
  "surnames": "Smith Doe",
  "phone": "+34698765432",
  "imageBase64": "data:image/png;base64,iVBORw0KG..."
}
```

**Note**: `imageBase64` is optional. If provided, old image is deleted from Cloudinary and new one is uploaded.

#### **Get User Contacts**

```http
GET /api/users/{id}/contacts?page=1&limit=10
Authorization: Bearer {token}
```

#### **Add Contact**

```http
POST /api/users/{id}/contacts
Authorization: Bearer {token}
Content-Type: application/json

{
  "contactId": 2
}
```

#### **Remove Contact**

```http
DELETE /api/users/{id}/contacts
Authorization: Bearer {token}
Content-Type: application/json

{
  "contactId": 2
}
```

---

## 💳 Payment Processing

ClutchPay implements a complete payment flow using **Stripe** for payment collection and **PayPal Payouts** for fund distribution.

### Payment Flow

```text
1. Debtor → Stripe Checkout → Pays invoice via card/bank
2. Stripe Webhook → Confirms payment success
3. Backend → PayPal Payout → Transfers funds to issuer's PayPal
4. Payment recorded → Invoice marked as PAID
```

### Stripe Integration

- **Checkout Sessions**: Create secure payment pages for invoices
- **Webhooks**: Handle payment events (success, failure, expiration)
- **Session Status**: Track payment status through the lifecycle

#### **Create Payment Session**

```http
POST /api/payments/stripe/checkout
Authorization: Bearer {token}
Content-Type: application/json

{
  "invoiceId": 1
}
```

**Response:**

```json
{
  "sessionId": "cs_test_xxx",
  "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_xxx"
}
```

#### **Get Payment by Invoice**

```http
GET /api/payments?invoiceId=1
Authorization: Bearer {token}
```

### PayPal Payouts

After successful Stripe payment, funds are automatically transferred to the invoice issuer via PayPal:

- **Automatic Payout**: Triggered by Stripe webhook on payment success
- **Batch Processing**: Supports single and batch payouts
- **Status Tracking**: Monitor payout status (PENDING, SUCCESS, FAILED)

### Configuration

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_CURRENCY=eur

# PayPal
PAYPAL_CLIENT_ID=your-client-id
PAYPAL_CLIENT_SECRET=your-client-secret
PAYPAL_MODE=sandbox  # 'sandbox' or 'live'
```

---

## 🔔 Notifications

ClutchPay provides a dual notification system with internal notifications and external email notifications.

### Notification Types

| Type | Description | Email? |
|------|-------------|--------|
| `INVOICE_ISSUED` | New invoice issued to debtor | ✅ |
| `PAYMENT_DUE` | Payment reminder (3 days before due) | ✅ |
| `PAYMENT_OVERDUE` | Invoice past due date | ✅ |
| `PAYMENT_RECEIVED` | Payment confirmed | ✅ |
| `INVOICE_CANCELED` | Invoice canceled by issuer | ✅ |

### Internal Notifications API

#### **Get User Notifications**

```http
GET /api/notifications?page=1&limit=10
Authorization: Bearer {token}
```

**Query Parameters:**

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 100)
- `read`: Filter by read status (`true` or `false`)

#### **Mark Notification as Read**

```http
PUT /api/notifications/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "read": true
}
```

#### **Mark All as Read**

```http
PUT /api/notifications
Authorization: Bearer {token}
Content-Type: application/json

{
  "readAll": true
}
```

### Email Notifications

Powered by **Resend** with **React Email** templates:

- **React Email Templates**: Type-safe, styled email components
- **Automatic Sending**: Triggered on notification creation
- **Simulation Mode**: Works without API key in development

### Email Templates

Located in `src/libs/email/templates/`:

- `invoice-issued.tsx` - New invoice notification
- `payment-due.tsx` - Payment reminder
- `payment-overdue.tsx` - Overdue warning
- `payment-received.tsx` - Payment confirmation
- `invoice-canceled.tsx` - Cancellation notice

### Configuration

```env
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL=ClutchPay <noreply@clutchpay.com>
```

---

## 📝 Logging

ClutchPay includes a structured logging system for debugging and monitoring.

### Log Levels

| Level | Description | Use Case |
|-------|-------------|----------|
| `DEBUG` | Detailed debugging info | Development, troubleshooting |
| `INFO` | General operations | Normal operation tracking |
| `WARN` | Warning conditions | Non-critical issues |
| `ERROR` | Error conditions | Failures requiring attention |

### Usage

```typescript
import { logger } from '@/libs/logger';

logger.debug('Payment', 'Creating checkout session', { invoiceId: 1 });
logger.info('Server', 'Application started on port 3000');
logger.warn('PayPal', 'Credentials not configured, using simulation');
logger.error('Stripe', 'Webhook verification failed', error);
```

### Output Format

```text
[2024-01-15T10:30:45.123Z] [INFO] [Server] Application started on port 3000
[2024-01-15T10:30:46.456Z] [DEBUG] [Payment] Creating checkout session | {"invoiceId":1}
```

### Configuration

Set log level via environment variable:

```env
LOG_LEVEL=DEBUG  # DEBUG, INFO, WARN, ERROR (default: INFO)
```

---

## ☁️ Cloudinary Integration

ClutchPay uses Cloudinary for storing and managing files:

### Features

- **Profile Images**: Automatic upload, transformation (500x500), and deletion
- **Invoice PDFs**: Upload as raw resources, automatic deletion on invoice cancellation
- **URL Extraction**: Automatic public_id extraction from Cloudinary URLs

### Folder Structure

```text
ClutchPay/
├── profile_images/    # User profile pictures
├── invoices/          # Invoice PDF documents
└── tests/             # Integration test files
    ├── images/        # Test images
    └── invoices/      # Test PDFs
```

### Configuration

Set these environment variables:

```env
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
NEXT_PUBLIC_CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

---

## 🗄️ Database

### Prisma Commands

**Generate Prisma Client:**

```bash
pnpm exec prisma generate
```

**Create Migration:**

```bash
pnpm exec prisma migrate dev --name migration_name
```

**Apply Migrations:**

```bash
pnpm exec prisma migrate deploy
```

**Reset Database:**

```bash
pnpm exec prisma migrate reset
```

**Open Prisma Studio:**

```bash
pnpm exec prisma studio
```

---

## 🔒 Security

### Authentication Configuration

- **Password Hashing**: bcrypt with salt rounds
- **JWT Tokens**: Secure token generation with expiration
- **Session Management**: NextAuth.js session handling
- **CSRF Protection**: Built-in Next.js CSRF protection

### Validation

- **Input Validation**: Zod schemas for all inputs
- **Type Safety**: TypeScript for compile-time checks
- **SQL Injection**: Prisma ORM prevents SQL injection
- **XSS Protection**: Next.js built-in XSS protection

---

## 📚 Additional Documentation

- **Development Utilities**: See [../utils_dev/README.md](../utils_dev/README.md)
- **Main Documentation**: See [../README.md](../README.md)
- **Frontend Documentation**: See [../frontend/README.md](../frontend/README.md)
