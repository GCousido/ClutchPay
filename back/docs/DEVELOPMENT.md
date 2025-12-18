# Development Workflow and Configuration

This document describes the development environment setup, available scripts, and configuration details for the ClutchPay backend application.

---

## Table of Contents

1. [Technology Stack](#technology-stack)
2. [Project Structure](#project-structure)
3. [Package Manager](#package-manager)
4. [Available Scripts](#available-scripts)
5. [Development Server](#development-server)
6. [Testing Workflow](#testing-workflow)
7. [Configuration Files](#configuration-files)
8. [Docker Integration](#docker-integration)
9. [Environment Variables](#environment-variables)

---

## Technology Stack

The backend is built on the following core technologies:

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 20+ | JavaScript runtime |
| Next.js | 16.0.1 | React framework with API routes |
| React | 19.2.0 | UI library (for email templates) |
| TypeScript | 5.x | Type-safe JavaScript |
| PostgreSQL | 15 | Relational database |
| Prisma | 6.18.0 | Database ORM |
| Vitest | 4.0.11 | Testing framework |

---

## Project Structure

The backend follows a modular structure separating concerns across directories:

```text
back/
├── prisma/                 # Database schema and migrations
│   ├── schema.prisma       # Data model definitions
│   └── migrations/         # Version-controlled schema changes
├── src/
│   ├── app/               # Next.js App Router
│   │   ├── api/           # API route handlers
│   │   │   ├── auth/      # Authentication endpoints
│   │   │   ├── cron/      # Scheduled task triggers
│   │   │   ├── invoices/  # Invoice operations
│   │   │   ├── notifications/ # Notification management
│   │   │   ├── payments/  # Payment processing
│   │   │   └── users/     # User management
│   │   ├── layout.tsx     # Root layout
│   │   └── page.tsx       # Home page (unused)
│   └── libs/              # Shared libraries
│       ├── api-helpers.ts # Response utilities
│       ├── auth.ts        # NextAuth configuration
│       ├── cloudinary.ts  # Media storage
│       ├── db.ts          # Prisma client singleton
│       ├── notifications.ts # Notification logic
│       ├── paypal.ts      # PayPal integration
│       ├── pdf-generator.ts # PDF creation
│       ├── scheduler.ts   # Cron job definitions
│       ├── stripe.ts      # Stripe integration
│       ├── email/         # Email templates
│       └── validations/   # Input validation schemas
├── tests/                 # Test suites
│   ├── setup.ts          # Global test configuration
│   ├── api/              # API route tests
│   ├── helpers/          # Test utilities
│   └── libs/             # Library unit tests
├── scripts/              # Development utilities
├── docker/               # Container configurations
├── docs/                 # Documentation
├── types/                # TypeScript declarations
└── instrumentation.ts    # Server startup hooks
```

---

## Package Manager

The project uses **pnpm** as the package manager for efficient dependency management.

**Why pnpm:**

- Faster installation through content-addressable storage.
- Disk space efficiency via hardlinks.
- Strict dependency resolution.
- Workspace support for monorepos.

**Package Overrides:**

The project enforces specific versions of Prisma packages through pnpm overrides to ensure compatibility:

```json
"pnpm": {
  "overrides": {
    "@prisma/client": "6.18.0",
    "prisma": "6.18.0"
  }
}
```

**Common Commands:**

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm add <package>` | Add a runtime dependency |
| `pnpm add -D <package>` | Add a development dependency |
| `pnpm update` | Update dependencies |

---

## Available Scripts

All scripts are defined in `package.json` and executed via pnpm:

### Development Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `pnpm dev` | Start development server on port 3000 with hot reload |
| `build` | `pnpm build` | Create production build |
| `start` | `pnpm start` | Run production server |
| `lint` | `pnpm lint` | Run ESLint code analysis |

### Testing Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `test` | `pnpm test` | Run full test suite with containerized database |
| `test:watch` | `pnpm test:watch` | Run tests in watch mode for development |
| `test:ui` | `pnpm test:ui` | Open interactive test UI in browser |
| `test:coverage` | `pnpm test:coverage` | Run tests with code coverage analysis |

### Coverage Report Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `coverage:md` | `pnpm coverage:md` | Generate Markdown coverage report |
| `coverage:pdf` | `pnpm coverage:pdf` | Convert coverage report to PDF |
| `coverage:all` | `pnpm coverage:all` | Run tests, generate MD, and create PDF |

---

## Development Server

The development server runs Next.js in development mode with hot module replacement.

### Starting the Server

```bash
pnpm dev
```

**Behavior:**

- Starts on port 3000 by default.
- Enables hot reload for instant code updates.
- Shows detailed error messages.
- Runs the scheduler for background tasks.
- Connects to the development database.

### Server Lifecycle

When the server starts, the following initialization occurs:

1. Next.js loads the application configuration.
2. The `instrumentation.ts` file is executed.
3. The scheduler is started (if running on Node.js runtime).
4. API routes become available at `/api/*`.
5. The server listens for incoming requests.

### Instrumentation Hook

The `instrumentation.ts` file is a Next.js lifecycle hook that runs once when the server starts. It initializes background processes:

- Detected automatically by Next.js 15+.
- Runs only on the Node.js runtime (not Edge).
- Imports and starts the cron scheduler.
- Does not run during build phase.

---

## Testing Workflow

The testing system uses Vitest with a dedicated PostgreSQL container for isolation.

### Test Execution Flow

When running `pnpm test`, the following occurs:

1. **Docker Check**: Verifies Docker is installed and running.
2. **Container Start**: Creates or starts a PostgreSQL test container on port 5433.
3. **Database Ready**: Waits for PostgreSQL to accept connections.
4. **Migrations**: Applies all Prisma migrations to test database.
5. **Test Execution**: Runs Vitest with the test database connection.
6. **Container Stop**: Stops the test container after tests complete.

### Test Configuration

Tests are configured through `vitest.config.mts`:

**Key Settings:**

- Environment: Node.js (not browser).
- Globals: Enabled for describe, test, expect without imports.
- Setup File: `tests/setup.ts` runs before each test file.
- File Parallelism: Disabled to prevent database conflicts.
- Coverage Provider: V8 for fast native coverage.

**Path Alias:**

Tests can import from source using the `@/` alias:

```typescript
import { db } from '@/libs/db';
```

### Test Setup

The `tests/setup.ts` file configures the test environment:

- Sets `NODE_ENV` to 'test'.
- Mocks NextAuth session handling.
- Provides session mock utilities for authentication tests.
- Cleans the database before and after test files.

### Test Database

The test runner uses an isolated PostgreSQL container:

| Property | Value |
|----------|-------|
| Container Name | `clutchpay-test-db` |
| Port | 5433 (different from dev) |
| Database | `clutchpay_test` |
| User | `test_user` |
| Password | `test_pass` |

### Coverage Reporting

Coverage reports are generated in multiple formats:

| Format | Location | Purpose |
|--------|----------|---------|
| Text | Console output | Quick summary |
| HTML | `coverage/index.html` | Interactive browser view |
| JSON | `coverage/coverage-summary.json` | Machine-readable data |
| LCOV | `coverage/lcov.info` | CI/CD integration |
| Markdown | `coverage/coverage-report.md` | Documentation |
| PDF | Generated via script | Printable report |

---

## Configuration Files

### TypeScript Configuration (tsconfig.json)

The TypeScript configuration optimizes for Next.js compatibility:

**Compiler Options:**

| Option | Value | Purpose |
|--------|-------|---------|
| `target` | ES2017 | JavaScript output version |
| `module` | ESNext | Modern module system |
| `moduleResolution` | bundler | Next.js bundler resolution |
| `strict` | true | Enable all strict checks |
| `noEmit` | true | No output (Next.js handles) |
| `jsx` | react-jsx | Modern JSX transform |
| `incremental` | true | Faster rebuilds |

**Path Aliases:**

The `@/*` alias maps to the `./src/*` directory for clean imports.

**Included Files:**

- Source files in `src/`
- Type declarations in `types/`
- Test files in `tests/`
- Next.js generated types

### Next.js Configuration (next.config.ts)

The Next.js configuration handles API-specific settings:

**Key Settings:**

| Setting | Purpose |
|---------|---------|
| `output: 'standalone'` | Production builds include dependencies |
| `headers()` | CORS configuration for frontend access |

**CORS Configuration:**

The server dynamically configures CORS headers based on environment:

- Allows requests from configured frontend origins.
- Supports credentials for authenticated requests.
- Permits all standard HTTP methods.
- Allows necessary headers including Authorization.

### ESLint Configuration (eslint.config.mjs)

ESLint enforces code quality standards:

**Applied Rules:**

- Next.js Core Web Vitals rules for performance.
- Next.js TypeScript rules for type safety.
- Default ignores for build outputs.

**Ignored Directories:**

- `.next/` - Build output
- `out/` - Static export
- `build/` - Distribution
- `next-env.d.ts` - Generated declarations

### Vitest Configuration (vitest.config.mts)

Test framework configuration for optimal developer experience:

**Test Settings:**

| Setting | Value | Purpose |
|---------|-------|---------|
| `globals` | true | No need to import test functions |
| `environment` | node | Server-side testing |
| `fileParallelism` | false | Sequential test files |
| `setupFiles` | tests/setup.ts | Pre-test initialization |

**Coverage Settings:**

| Setting | Purpose |
|---------|---------|
| `provider: 'v8'` | Fast native coverage |
| `all: true` | Include untested files |
| `reporter` | Multiple output formats |

**Excluded from Coverage:**

- `node_modules/`
- `tests/` directory
- Configuration files
- Migration files
- Next.js UI files

---

## Docker Integration

Docker containers provide consistent environments for development and testing.

### Development Database

The development database runs via Docker Compose:

**File:** `docker/docker-compose.yml`

**Configuration:**

| Property | Value |
|----------|-------|
| Image | postgres:15 |
| Port | 5432 |
| Restart | always |
| Volume | Persistent data storage |
| Healthcheck | Automatic readiness detection |

**Starting Development Database:**

```bash
cd docker
docker-compose up -d
```

**Environment Variables:**

The compose file reads from the `.env` file:

- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`

### Test Database Container

The test runner manages its own container automatically:

- Created on first test run.
- Reused for subsequent runs.
- Stopped after test completion.
- Uses separate port to avoid conflicts.

---

## Environment Variables

All configuration is managed through environment variables in the `.env` file.

### Database Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `POSTGRES_DB` | Database name | `clutchpay_db` |
| `POSTGRES_USER` | Database user | `clutchpay_user` |
| `POSTGRES_PASSWORD` | Database password | `clutchpay_pass` |
| `DATABASE_URL` | Full connection string | `postgresql://...` |
| `TEST_DATABASE_URL` | Test database connection | `postgresql://...` |

### Server Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `BACKEND_PORT` | API server port | `3000` |
| `FRONTEND_PORT` | Frontend port (for CORS) | `80` |
| `SERVER_IP` | Server IP (for CORS) | `localhost` |

### Authentication

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXTAUTH_URL` | Application base URL | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | JWT signing secret | Random 32+ chars |
| `NEXTAUTH_DEBUG` | Enable debug logging | `true` or `false` |

### External Services

Refer to `docs/TECHNOLOGIES.md` for detailed configuration of:

- Cloudinary (media storage)
- Stripe (payments)
- PayPal (payouts)
- Resend (emails)

### Loading Environment Variables

Environment variables are loaded automatically by Next.js from the `.env` file. For tests, the test runner script sets additional variables:

- `NODE_ENV=test`
- `DATABASE_URL` points to test container
- `TEST_DATABASE_URL` for test database access

---

## Workflow Summary

### Starting Development

1. Ensure Docker is running.
2. Start the development database: `cd docker && docker-compose up -d`
3. Apply migrations: `npx prisma migrate dev`
4. Start the server: `pnpm dev`
5. Access API at `http://localhost:3000/api`

### Running Tests

1. Ensure Docker is running.
2. Execute tests: `pnpm test`
3. View coverage: `pnpm test:coverage`

### Building for Production

1. Create production build: `pnpm build`
2. Start production server: `pnpm start`

### Database Operations

| Command | Purpose |
|---------|---------|
| `npx prisma migrate dev` | Apply migrations in development |
| `npx prisma migrate deploy` | Apply migrations in production |
| `npx prisma studio` | Open database GUI |
| `npx prisma generate` | Regenerate Prisma client |
| `npx prisma db push` | Push schema without migration |
