# ClutchPay Backend - Feature Documentation

This document provides a detailed description of all features implemented in the ClutchPay backend API. Each section covers the feature's purpose, behavior, business rules, and related endpoints.

---

## Table of Contents

1. [User Management](#1-user-management)
2. [Authentication](#2-authentication)
3. [Contact Management](#3-contact-management)
4. [Invoice Management](#4-invoice-management)
5. [Payment Processing](#5-payment-processing)
6. [Notification System](#6-notification-system)
7. [Scheduled Tasks](#7-scheduled-tasks)
8. [Document Generation](#8-document-generation)

---

## 1. User Management

The user management system handles registration, profile management, and user preferences for all platform participants.

### User Registration

New users can create accounts by providing their personal information. The registration process validates all input data, ensures email uniqueness, and securely hashes passwords before storage.

**Registration Requirements:**

- Email: Must be unique across the platform and follow valid email format.
- Password: Must meet minimum security requirements (length, complexity).
- Name and Surnames: Required for invoice generation and display purposes.
- Phone: Optional field with international format validation.
- Country: Optional field for regional preferences.

**Registration Behavior:**

- The system validates all fields against defined schemas before processing.
- Email addresses are checked for existing accounts to prevent duplicates.
- Passwords are hashed using bcrypt with appropriate salt rounds.
- Upon successful registration, the user can immediately log in.
- A default profile is created with email notifications enabled.

**Endpoint:** `POST /api/auth/register`

### User Profile Management

Registered users can view and update their profile information. Profile updates allow modification of personal details and preferences.

**Viewable Profile Fields:**

- User ID (read-only)
- Email address (read-only after registration)
- Name and surnames
- Phone number
- Country
- Profile image URL
- Email notification preferences
- Account creation timestamp

**Updatable Profile Fields:**

- Name and surnames
- Phone number
- Country
- Email notification preferences

**Profile Image Upload:**

Users can upload profile images that are automatically processed and stored. Images undergo the following transformations:

- Resized to standard dimensions for consistency.
- Cropped to circular format for avatar display.
- Optimized for web delivery.
- Stored on CDN for fast global access.

**Endpoints:**

- `GET /api/users` - List all users (with optional search)
- `GET /api/users/{id}` - Retrieve specific user profile
- `PATCH /api/users/{id}` - Update user profile
- `DELETE /api/users/{id}` - Remove user account

---

## 2. Authentication

The authentication system provides secure access control using session-based authentication with JWT tokens.

### Login Process

Users authenticate using their email and password credentials. The system verifies the provided password against the stored hash and establishes a session upon successful authentication.

**Login Flow:**

1. User submits email and password.
2. System retrieves user record by email.
3. Password is verified against stored bcrypt hash.
4. Upon success, a JWT session token is generated.
5. Session includes user ID, email, and name.
6. Token is returned for subsequent authenticated requests.

**Session Management:**

- Sessions are maintained as JWT tokens.
- Tokens include expiration timestamps for security.
- Session data is available to all protected endpoints.
- Users can have multiple active sessions across devices.

**Endpoint:** `POST /api/auth/[...nextauth]`

### Protected Routes

All API endpoints except registration and login require authentication. Protected routes verify the session token before processing requests.

**Authorization Behavior:**

- Requests without valid tokens receive 401 Unauthorized responses.
- Users can only access and modify their own resources.
- Invoice operations validate participant permissions.
- Certain actions validate ownership or involvement.

---

## 3. Contact Management

The contact system allows users to maintain a personal directory of other users they frequently transact with.

### Contact List

Users can add other registered users to their contact list for quick access when creating invoices. The contact relationship is bidirectional in storage but managed independently by each user.

**Contact Operations:**

- Add Contact: Link another user to the current user's contact list.
- Remove Contact: Unlink a user from the contact list.
- View Contacts: List all contacts for the current user.

**Business Rules:**

- Users cannot add themselves as contacts.
- Duplicate contact entries are prevented.
- Contacts must be existing registered users.
- Removing a contact does not affect existing invoices.
- Contact relationships are independent; adding User A to User B's contacts does not automatically add User B to User A's contacts.

**Endpoints:**

- `GET /api/users/{id}/contacts` - List user's contacts
- `POST /api/users/{id}/contacts` - Add a contact
- `DELETE /api/users/{id}/contacts/{contactId}` - Remove a contact

---

## 4. Invoice Management

The invoice system is the core feature of ClutchPay, enabling users to create, manage, and track payment requests between parties.

### Invoice Creation

Users can create invoices to request payment from other registered users. Each invoice represents a formal payment request with detailed information.

**Invoice Fields:**

- Invoice Number: Auto-generated unique identifier with prefix.
- Issuer: The user creating and sending the invoice.
- Debtor: The user responsible for payment.
- Subject: Brief description of the invoice purpose.
- Description: Detailed explanation of goods or services.
- Amount: Payment amount with decimal precision.
- Issue Date: Date when the invoice is created.
- Due Date: Optional deadline for payment.
- Status: Current state of the invoice.

**Invoice Statuses:**

- PENDING: Invoice issued and awaiting payment.
- PAID: Payment has been successfully processed.
- OVERDUE: Due date has passed without payment.
- CANCELED: Invoice has been voided by the issuer.

**Creation Process:**

1. Issuer provides invoice details and selects debtor.
2. System validates all fields and relationships.
3. Unique invoice number is generated.
4. PDF document is automatically generated and stored.
5. Invoice record is created in the database.
6. Debtor receives notification (in-app and email if enabled).

**Endpoints:**

- `POST /api/invoices` - Create new invoice
- `GET /api/invoices` - List invoices (with filters)
- `GET /api/invoices/{id}` - Retrieve specific invoice

### Invoice Retrieval and Filtering

Users can retrieve invoices they have issued or received. The listing supports filtering and pagination for efficient navigation.

**Available Filters:**

- Role: Filter by issued (as issuer) or received (as debtor) invoices.
- Status: Filter by invoice status.
- Date Range: Filter by issue date or due date ranges.
- Search: Text search across subject and description.

**Access Control:**

- Users can only view invoices where they are the issuer or debtor.
- Invoice details include related user information.
- Payment status and details are included when applicable.

### Invoice Modification

Limited modifications are allowed on invoices based on their current status.

**Cancellation:**

- Only the issuer can cancel an invoice.
- Only PENDING or OVERDUE invoices can be canceled.
- PAID invoices cannot be canceled.
- Cancellation triggers notification to the debtor.
- Canceled invoices remain in the system for record-keeping.

**Endpoint:** `PATCH /api/invoices/{id}`

---

## 5. Payment Processing

The payment system integrates with external payment providers to process invoice payments securely.

### Stripe Payment Integration

Debtors can pay invoices using Stripe Checkout, which supports various payment methods including credit cards, debit cards, and digital wallets.

**Payment Flow:**

1. Debtor initiates payment for a specific invoice.
2. System validates invoice status (must be PENDING or OVERDUE).
3. Stripe Checkout Session is created with invoice details.
4. Debtor is redirected to Stripe's secure payment page.
5. Debtor completes payment using their preferred method.
6. Stripe redirects back to application with session result.
7. Webhook receives payment confirmation from Stripe.
8. System updates invoice status to PAID.
9. Payment record is created with transaction details.
10. Receipt PDF is generated and stored.
11. Both parties receive payment confirmation notifications.

**Payment Session Details:**

- Session includes invoice amount and description.
- Currency is configurable per deployment.
- Success and cancel URLs redirect appropriately.
- Metadata links payment to specific invoice.

**Webhook Processing:**

The webhook endpoint receives asynchronous notifications from Stripe about payment events. It verifies event signatures to ensure authenticity and processes confirmed payments.

**Endpoints:**

- `POST /api/payments/stripe/session` - Create payment session
- `GET /api/payments/stripe/session` - Retrieve session details
- `POST /api/payments/stripe/webhook` - Process Stripe events
- `GET /api/payments/stripe/checkout` - Handle checkout redirects

### PayPal Payout Integration

The platform can disburse funds to invoice issuers using PayPal Payouts. This enables automatic or manual transfer of collected funds.

**Payout Process:**

1. System initiates payout for completed invoice payment.
2. PayPal batch is created with recipient details.
3. Funds are transferred to issuer's PayPal account.
4. Payout status is tracked and recorded.

**Payout Features:**

- Single or batch payout support.
- Email-based recipient identification.
- Automatic currency handling.
- Transaction reference tracking.

**Endpoint:** `POST /api/payments/paypal/payout`

### Payment History

Users can view payment history for invoices they have issued or paid.

**Payment Record Fields:**

- Payment ID
- Associated invoice
- Payment date and time
- Payment method used
- Transaction reference
- Receipt document URL

**Endpoints:**

- `GET /api/payments` - List payment history
- `GET /api/payments/{id}` - Retrieve payment details

---

## 6. Notification System

The notification system keeps users informed about invoice and payment activities through multiple channels.

### In-App Notifications

Users receive in-app notifications for important events related to their invoices. Notifications are stored in the database and accessible through the API.

**Notification Types:**

- **Invoice Issued**: Debtor is notified when a new invoice is created for them.
- **Payment Due**: Debtor is reminded when an invoice payment deadline approaches.
- **Payment Overdue**: Debtor is alerted when an invoice becomes past due.
- **Payment Received**: Issuer is notified when payment for their invoice is received.
- **Invoice Canceled**: Debtor is informed when an invoice is canceled.

**Notification Properties:**

- User: The recipient of the notification.
- Invoice: The related invoice triggering the notification.
- Type: Category of the notification event.
- Read Status: Whether the user has viewed the notification.
- Timestamps: Creation and last update times.

**Notification Management:**

- Users can retrieve all their notifications.
- Notifications can be marked as read individually or in bulk.
- Read status is tracked for cleanup purposes.
- Notifications include formatted display information.

**Endpoints:**

- `GET /api/notifications` - List user notifications
- `PATCH /api/notifications/{id}` - Update notification (mark as read)
- `DELETE /api/notifications/{id}` - Remove notification

### Email Notifications

Users with email notifications enabled receive emails for significant events. Emails are formatted using responsive HTML templates optimized for email clients.

**Email Templates:**

- **Invoice Issued Email**: Sent to debtor when new invoice is created.
  - Includes invoice details, amount, and due date.
  - Contains link to view invoice in application.

- **Payment Due Email**: Sent to debtor when payment deadline approaches.
  - Reminds of upcoming due date.
  - Shows invoice summary and amount.
  - Provides direct link to pay.

- **Payment Overdue Email**: Sent to debtor when invoice becomes overdue.
  - Alerts that payment is past due.
  - Emphasizes urgency of payment.
  - Links to payment page.

- **Payment Received Email**: Sent to issuer when payment is completed.
  - Confirms payment has been received.
  - Shows payment amount and date.
  - Thanks for using the platform.

- **Invoice Canceled Email**: Sent to debtor when invoice is voided.
  - Informs that invoice no longer requires payment.
  - Shows which invoice was canceled.

**Email Preferences:**

- Users can enable or disable email notifications in their profile.
- Email preference is checked before each email dispatch.
- In-app notifications are always created regardless of email preference.

**Email Design:**

- Consistent branding with ClutchPay visual identity.
- Responsive layout for mobile and desktop clients.
- Clear call-to-action buttons.
- Accessible design with proper contrast.
- Fallback text for clients that block images.

---

## 7. Scheduled Tasks

The scheduler system automates recurring tasks that maintain platform operations and user engagement.

### Payment Reminder Tasks

Automated tasks check for invoices requiring attention and send appropriate notifications.

**Payment Due Check:**

- Runs daily at 9:00 AM.
- Identifies invoices with due dates within the next 3 days.
- Only considers PENDING and OVERDUE invoices.
- Skips invoices without due dates.
- Creates PAYMENT_DUE notifications for debtors.
- Sends reminder emails to debtors with notifications enabled.
- Prevents duplicate notifications by checking existing notification types.

**Payment Overdue Check:**

- Runs daily at 9:00 AM.
- Identifies invoices with due dates in the past.
- Only considers PENDING and OVERDUE invoices.
- Creates PAYMENT_OVERDUE notifications for debtors.
- Sends alert emails to debtors with notifications enabled.
- Prevents duplicate notifications by checking existing notification types.

### Notification Cleanup Task

Maintains database hygiene by removing old notifications that are no longer needed.

**Cleanup Behavior:**

- Runs weekly on Sundays at 2:00 AM.
- Targets notifications older than 60 days.
- Only removes notifications that have been read.
- Preserves unread notifications regardless of age.
- Logs the count of removed notifications.

### Manual Task Triggering

Administrators can manually trigger scheduled tasks through a protected API endpoint.

**Manual Trigger Features:**

- Execute all tasks at once.
- Execute individual tasks by name.
- View results of task execution.
- Protected by secret key in production environments.

**Endpoint:** `GET /api/cron/check-payments`

---

## 8. Document Generation

The platform automatically generates professional PDF documents for invoices and payment receipts.

### Invoice PDF Generation

When an invoice is created, a PDF document is automatically generated containing all invoice details formatted for printing or digital delivery.

**Invoice PDF Contents:**

- ClutchPay branding and logo.
- Invoice number and issue date.
- Issuer contact information.
- Debtor contact information.
- Subject and detailed description.
- Amount with currency formatting.
- Due date if specified.
- Payment instructions.

**PDF Characteristics:**

- Professional layout suitable for business use.
- Consistent styling across all invoices.
- Optimized file size for quick loading.
- Stored on CDN for reliable access.
- URL included in invoice record.

### Payment Receipt Generation

When a payment is successfully processed, a receipt document is generated confirming the transaction.

**Receipt PDF Contents:**

- ClutchPay branding and logo.
- Receipt number and date.
- Payer information.
- Payee information.
- Original invoice reference.
- Payment amount confirmed.
- Payment method used.
- Transaction reference.

**Receipt Delivery:**

- PDF is generated immediately upon payment confirmation.
- Stored securely with permanent URL.
- Accessible through payment record.
- Can be downloaded by both parties.

---

## API Error Handling

The API implements consistent error handling across all endpoints using standardized error responses.

### Error Response Format

All errors return JSON responses with appropriate HTTP status codes.

**Error Categories:**

- **400 Bad Request**: Invalid input data or malformed requests.
- **401 Unauthorized**: Missing or invalid authentication.
- **403 Forbidden**: Authenticated but insufficient permissions.
- **404 Not Found**: Requested resource does not exist.
- **500 Internal Server Error**: Unexpected server-side errors.

### Input Validation

All API inputs are validated using schema-based validation before processing.

**Validation Features:**

- Type checking for all fields.
- Format validation (email, phone, dates).
- Range validation for numeric values.
- Required field enforcement.
- Custom validation rules per endpoint.

**Validation Response:**

When validation fails, the response includes details about which fields failed and why, enabling clients to provide helpful user feedback.

---

## Data Security

The platform implements multiple security measures to protect user data and transactions.

### Password Security

- Passwords are never stored in plain text.
- Bcrypt hashing with appropriate cost factor.
- Password verification uses timing-safe comparison.

### Session Security

- JWT tokens with expiration.
- Secure token generation.
- Session validation on every protected request.

### Payment Security

- No payment card data stored on platform.
- PCI compliance delegated to Stripe.
- Webhook signature verification.
- Idempotent payment processing.

### API Security

- Authentication required for sensitive endpoints.
- User-scoped data access.
- Rate limiting on authentication endpoints.
- Input sanitization and validation.

---

## Testing Coverage

The platform includes comprehensive automated testing covering all features.

### Test Categories

**Unit Tests:**

- Validation functions.
- Utility helpers.
- Data transformations.

**Integration Tests:**

- API endpoint behavior.
- Database operations.
- External service integrations.

**Test Environment:**

- Isolated test database.
- Mocked external services.
- Automatic container provisioning.
- Parallel test execution.

### Test Execution

Tests can be run in various modes:

- Single run for CI/CD pipelines.
- Watch mode for development.
- Coverage reporting for quality metrics.
- Visual UI for interactive debugging.
