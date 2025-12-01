# Payments API Documentation

This document provides comprehensive documentation for the Payments API endpoints in ClutchPay.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Security Model](#security-model)
- [API Endpoints](#api-endpoints)
  - [List Payments](#list-payments)
  - [Get Payment Details](#get-payment-details)
  - [Create Payment](#create-payment)
- [Payment Methods](#payment-methods)
- [Receipt PDFs](#receipt-pdfs)
- [Error Handling](#error-handling)
- [Examples](#examples)

---

## Overview

The Payments API enables users to:
- View their payment history (as payer or receiver)
- Get detailed information about specific payments including receipt PDFs
- Create new payments to pay outstanding invoices

All payments are linked to invoices through a one-to-one relationship. When a payment is created, the associated invoice is automatically marked as `PAID`.

## Authentication

All endpoints require authentication via NextAuth.js sessions. Include the session cookie in all requests.

```http
Cookie: next-auth.session-token=<your-session-token>
```

## Security Model

### Authorization Rules

| Role | Description | Permissions |
|------|-------------|-------------|
| **Payer** | The debtor who owes the invoice | Can view and create payments for invoices where they are the debtor |
| **Receiver** | The issuer who will receive the payment | Can view payments for invoices they issued |

### Access Control

- **GET /api/payments**: Returns only payments where the authenticated user is either:
  - The debtor (payer) of the associated invoice
  - The issuer (receiver) of the associated invoice
  
- **GET /api/payments/:id**: Accessible only if the user is the payer or receiver

- **POST /api/payments**: Only the debtor (person who owes the invoice) can create a payment

---

## API Endpoints

### List Payments

Retrieves a paginated list of payments for the authenticated user.

```http
GET /api/payments
```

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `role` | string | `payer` | Filter by role: `payer` (payments made by user) or `receiver` (payments received) |
| `paymentMethod` | string | - | Filter by payment method: `PAYPAL`, `VISA`, `MASTERCARD`, `OTHER` |
| `minAmount` | number | - | Minimum invoice amount filter |
| `maxAmount` | number | - | Maximum invoice amount filter |
| `paymentDateFrom` | ISO 8601 date | - | Filter payments from this date |
| `paymentDateTo` | ISO 8601 date | - | Filter payments up to this date |
| `sortBy` | string | `paymentDate` | Sort field: `paymentDate`, `createdAt` |
| `sortOrder` | string | `desc` | Sort order: `asc`, `desc` |
| `page` | number | `1` | Page number for pagination |
| `limit` | number | `10` | Number of items per page (max 1000) |

#### Response

```json
{
  "meta": {
    "total": 50,
    "totalPages": 5,
    "page": 1,
    "limit": 10,
    "nextPage": 2,
    "prevPage": null
  },
  "data": [
    {
      "id": 1,
      "invoiceId": 5,
      "paymentDate": "2024-01-15T10:30:00.000Z",
      "paymentMethod": "PAYPAL",
      "paymentReference": "STRIPE-TXN-123456",
      "receiptPdfUrl": "https://res.cloudinary.com/.../receipt.pdf",
      "subject": "Payment for web development services",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z",
      "invoice": {
        "id": 5,
        "invoiceNumber": "INV-2024-001",
        "issuerUserId": 1,
        "debtorUserId": 2,
        "subject": "Web Development Services",
        "amount": "1500.00",
        "status": "PAID",
        "issueDate": "2024-01-01T00:00:00.000Z",
        "dueDate": "2024-02-01T00:00:00.000Z"
      }
    }
  ]
}
```

#### Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Validation error (invalid filters) |
| 401 | Unauthorized (not authenticated) |

---

### Get Payment Details

Retrieves detailed information about a specific payment.

```http
GET /api/payments/:id
```

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Payment ID |

#### Response

```json
{
  "id": 1,
  "invoiceId": 5,
  "paymentDate": "2024-01-15T10:30:00.000Z",
  "paymentMethod": "PAYPAL",
  "paymentReference": "STRIPE-TXN-123456",
  "receiptPdfUrl": "https://res.cloudinary.com/.../receipt.pdf",
  "subject": "Payment for web development services",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z",
  "invoice": {
    "id": 5,
    "invoiceNumber": "INV-2024-001",
    "issuerUserId": 1,
    "debtorUserId": 2,
    "subject": "Web Development Services",
    "description": "Full stack web development for company website",
    "amount": "1500.00",
    "status": "PAID",
    "issueDate": "2024-01-01T00:00:00.000Z",
    "dueDate": "2024-02-01T00:00:00.000Z",
    "invoicePdfUrl": "https://res.cloudinary.com/.../invoice.pdf",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "issuerUser": {
      "id": 1,
      "name": "John",
      "surnames": "Doe",
      "email": "john@example.com",
      "imageUrl": null
    },
    "debtorUser": {
      "id": 2,
      "name": "Jane",
      "surnames": "Smith",
      "email": "jane@example.com",
      "imageUrl": null
    }
  }
}
```

#### Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Invalid payment ID |
| 401 | Unauthorized (not authenticated) |
| 403 | Forbidden (not payer or receiver) |
| 404 | Payment not found |

---

### Create Payment

Creates a new payment for an invoice. Only the debtor (person who owes) can create a payment.

```http
POST /api/payments
```

#### Request Body

```json
{
  "invoiceId": 5,
  "paymentMethod": "PAYPAL",
  "receiptPdf": "data:application/pdf;base64,JVBERi0xLjQK...",
  "subject": "Payment for web development services",
  "paymentReference": "STRIPE-TXN-123456"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `invoiceId` | integer | Yes | ID of the invoice to pay |
| `paymentMethod` | string | Yes | Payment method: `PAYPAL`, `VISA`, `MASTERCARD`, `OTHER` |
| `receiptPdf` | string | Yes | Base64 encoded PDF with `data:application/pdf;base64,` prefix |
| `subject` | string | No | Optional payment subject/description (max 500 chars) |
| `paymentReference` | string | No | External transaction reference (e.g., Stripe/PayPal ID, max 255 chars) |

#### Response

```json
{
  "id": 1,
  "invoiceId": 5,
  "paymentDate": "2024-01-15T10:30:00.000Z",
  "paymentMethod": "PAYPAL",
  "paymentReference": "STRIPE-TXN-123456",
  "receiptPdfUrl": "https://res.cloudinary.com/.../receipt.pdf",
  "subject": "Payment for web development services",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z",
  "invoice": {
    "id": 5,
    "invoiceNumber": "INV-2024-001",
    "issuerUserId": 1,
    "debtorUserId": 2,
    "subject": "Web Development Services",
    "amount": "1500.00",
    "status": "PAID",
    "issueDate": "2024-01-01T00:00:00.000Z",
    "dueDate": "2024-02-01T00:00:00.000Z"
  }
}
```

#### Status Codes

| Code | Description |
|------|-------------|
| 201 | Payment created successfully |
| 400 | Validation error, invoice already paid, or invoice not payable |
| 401 | Unauthorized (not authenticated) |
| 403 | Forbidden (user is not the debtor) |
| 404 | Invoice not found |

#### Business Rules

1. Only the **debtor** (person who owes the invoice) can create a payment
2. Invoice must be in `PENDING` or `OVERDUE` status
3. Each invoice can only have **one payment** (one-to-one relationship)
4. Upon successful payment creation:
   - Receipt PDF is uploaded to Cloudinary
   - Payment record is created in database
   - Invoice status is updated to `PAID`

---

## Payment Methods

The system supports the following payment methods:

| Method | Description |
|--------|-------------|
| `PAYPAL` | PayPal payment |
| `VISA` | Visa credit/debit card |
| `MASTERCARD` | Mastercard credit/debit card |
| `OTHER` | Other payment methods |

### Integration with Payment Providers

The `paymentReference` field can store external transaction IDs from payment providers:

- **Stripe**: Store the `payment_intent` ID (e.g., `pi_1234567890`)
- **PayPal**: Store the transaction ID (e.g., `8MC585209K746831H`)

Example with Stripe integration:

```javascript
// After successful Stripe payment
const stripePaymentIntent = await stripe.paymentIntents.create({
  amount: invoiceAmount * 100, // Convert to cents
  currency: 'usd',
  payment_method: paymentMethodId,
  confirm: true,
});

// Create payment in ClutchPay
const response = await fetch('/api/payments', {
  method: 'POST',
  body: JSON.stringify({
    invoiceId: invoiceId,
    paymentMethod: 'VISA', // or 'MASTERCARD'
    receiptPdf: receiptPdfBase64,
    paymentReference: stripePaymentIntent.id, // Store Stripe reference
    subject: 'Payment via Stripe',
  }),
});
```

---

## Receipt PDFs

### Upload Requirements

Receipt PDFs must be:
- Base64 encoded
- Include the data URI prefix: `data:application/pdf;base64,`
- Valid PDF format

### Storage

Receipt PDFs are stored in Cloudinary in the `ClutchPay/invoices` folder. The returned `receiptPdfUrl` is a permanent, publicly accessible URL.

### Example Base64 PDF

```javascript
const pdfBuffer = await generateReceiptPdf(paymentDetails);
const base64Pdf = pdfBuffer.toString('base64');
const receiptPdf = `data:application/pdf;base64,${base64Pdf}`;
```

---

## Error Handling

### Error Response Format

```json
{
  "message": "Error description",
  "errors": [
    {
      "path": ["fieldName"],
      "message": "Validation error message"
    }
  ]
}
```

### Common Errors

| Error | Status | Message |
|-------|--------|---------|
| Not authenticated | 401 | `Unauthorized` |
| Not the debtor | 403 | `You can only pay invoices where you are the debtor` |
| Not authorized to view | 403 | `You do not have permission to view this payment` |
| Invoice not found | 404 | `Invoice not found` |
| Payment not found | 404 | `Payment not found` |
| Already paid | 400 | `This invoice has already been paid` |
| Invalid status | 400 | `Cannot pay an invoice with status: CANCELED...` |
| Invalid payment ID | 400 | `Invalid payment ID` |

---

## Examples

### List Payments as Payer

```bash
curl -X GET "http://localhost:3000/api/payments?role=payer&page=1&limit=20" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"
```

### List Payments as Receiver with Filters

```bash
curl -X GET "http://localhost:3000/api/payments?role=receiver&paymentMethod=PAYPAL&minAmount=100&maxAmount=5000&paymentDateFrom=2024-01-01T00:00:00Z" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"
```

### Get Payment Details

```bash
curl -X GET "http://localhost:3000/api/payments/1" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"
```

### Create a Payment

```bash
curl -X POST "http://localhost:3000/api/payments" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  -d '{
    "invoiceId": 5,
    "paymentMethod": "PAYPAL",
    "receiptPdf": "data:application/pdf;base64,JVBERi0xLjQK...",
    "subject": "Payment for consulting services",
    "paymentReference": "PAYPAL-TXN-ABC123"
  }'
```

### JavaScript/TypeScript Example

```typescript
// Create payment after external payment provider confirmation
async function createPayment(invoiceId: number, stripePaymentIntent: string) {
  // Generate receipt PDF
  const receiptPdf = await generateReceiptPdf(invoiceId);
  
  const response = await fetch('/api/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      invoiceId,
      paymentMethod: 'VISA',
      receiptPdf,
      paymentReference: stripePaymentIntent,
      subject: 'Payment completed',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return response.json();
}

// Fetch payment history
async function getPaymentHistory(role: 'payer' | 'receiver' = 'payer') {
  const response = await fetch(`/api/payments?role=${role}&sortBy=paymentDate&sortOrder=desc`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch payments');
  }

  const { meta, data } = await response.json();
  return { meta, payments: data };
}
```

---

## Database Schema

```prisma
model Payment {
  id                Int       @id @default(autoincrement())
  invoiceId         Int       @unique
  paymentDate       DateTime
  paymentMethod     PaymentMethod
  paymentReference  String?
  receiptPdfUrl     String
  subject           String?   @db.Text
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  invoice           Invoice   @relation(fields: [invoiceId], references: [id])
}

enum PaymentMethod {
  PAYPAL
  VISA
  MASTERCARD
  OTHER
}
```

---

## Related Documentation

- [Invoices API](./README.md#invoices-api) - Create and manage invoices
- [Cloudinary Integration](./README.md#cloudinary-pdf-integration) - PDF storage configuration
- [Authentication](./README.md#authentication) - NextAuth.js setup
