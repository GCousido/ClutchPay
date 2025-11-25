# ClutchPay Backend

The backend application for ClutchPay, built with Next.js App Router, Prisma ORM, and PostgreSQL. This service provides a RESTful API for invoice management, user authentication, and payment tracking.

---

## 📋 Overview

This is a full-stack Next.js application using the App Router architecture with API routes. It handles:

- **User Authentication**: Secure credential-based authentication with NextAuth.js
- **User Management**: CRUD operations for user profiles and contacts
- **Database Operations**: PostgreSQL database with Prisma ORM
- **Validation**: Type-safe request/response validation with Zod
- **Testing**: Comprehensive test suite with Vitest

---

## 🏗️ Architecture

### Directory Structure

```text
back/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/          # API routes
│   │   │   ├── auth/     # Authentication endpoints
│   │   │   └── users/    # User management endpoints
│   │   ├── layout.tsx    # Root layout
│   │   └── page.tsx      # Home page
│   │
│   └── libs/             # Shared libraries
│       ├── auth.ts       # NextAuth configuration
│       ├── db.ts         # Prisma client singleton
│       ├── api-helpers.ts # API utility functions
│       └── validations/  # Zod schemas
│           ├── index.ts
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

# Application
NODE_ENV=development
```

### Prisma Schema

Located at `prisma/schema.prisma`, defines:

- **User Model**: User entity
- **Invoice Model**: Invoice entity
- **Payment Model**: Payment entity
- **Notification Model**: Notification entity
- **Relationships**: Relationships between entities.
- **Indexes**: Optimized for common queries

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

### Users

#### **Get All Users**

```http
GET /api/users
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
  "firstName": "Jane",
  "lastName": "Smith",
  "phone": "+34698765432"
}
```

#### **Delete User**

```http
DELETE /api/users/{id}
Authorization: Bearer {token}
```

#### **Get User Contacts**

```http
GET /api/users/{id}/contacts
Authorization: Bearer {token}
```

#### **Add Contact**

```http
POST /api/users/{id}/contacts
Authorization: Bearer {token}
Content-Type: application/json

{
  "contactId": "contact-user-id"
}
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
