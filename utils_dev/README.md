# Development Utils 🛠️

Utility tools and scripts for PDP-Pasarela development.

---

## 📁 Files in this Folder

### 🔧 `setup_dev_env.ps1`

**Development Environment Setup Script**

Automated PowerShell script that configures the complete development environment. Performs the following operations:

#### Features

- ✅ **System Requirements Validation**
  - Verifies Node.js (minimum v20.9.0)
  - Verifies Docker and Docker Compose
  - Verifies and installs pnpm if necessary

- 🔌 **Port Configuration**
  - Backend API (default: 3000)
  - Frontend (default: 80)

- 📦 **Dependency Installation**
  - Installs backend dependencies with pnpm
  - Creates/updates `.env` file with automatic configuration

- 🐳 **Docker Container Initialization**
  - PostgreSQL (database)
  - Frontend container

- 🗄️ **Database Configuration**
  - Executes Prisma migrations
  - Generates Prisma client
  - Optionally executes database seeding

- 🚀 **Development Server Startup**
  - Frees port if in use
  - Starts Next.js on configured port

#### How to Run

```powershell
# If execution policies prevent running:
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\setup_dev_env.ps1
```

---

### 🌱 `seed.ts`

**Database Seeding Script**

TypeScript script that generates realistic test data for development.

#### Generated Data

- 👥 **40 Users** with varied information
  - Unique emails
  - Passwords hashed with bcrypt
  - European phone numbers (50% of the time)
  - ISO country codes (30% of the time)
  - Avatars (20% of the time)

- 📄 **160+ Invoices** (0-8 per user)
  - Formatted invoice numbers (INV-YYYY-XXXXXX)
  - Amounts between $100-$5000
  - Statuses: PENDING, PAID, OVERDUE

- 💳 **120+ Payments** (75-85% of invoices paid)
  - Methods: PayPal, Visa, Mastercard, Other
  - Unique references
  - Realistic dates

- 🤝 **Contact Relationships** (based on invoices)
  - Automatic linking between users who have interacted
  - 2-8 contacts per user

- 🔔 **350+ Notifications**
  - INVOICE_ISSUED - when invoice is created
  - PAYMENT_RECEIVED - when invoice is paid
  - PAYMENT_DUE - 7 days before due date
  - PAYMENT_OVERDUE - when invoice is overdue

#### Features

- Cleans existing data before execution
- Generates varied and realistic data
- Logical relationships between data
- Detailed summary upon completion

---

### 📖 `README.md`

**This file** - Development tools documentation

---

## 🚀 Typical Usage Flow

1. **Initial setup:**
   ```powershell
   .\setup_dev_env.ps1
   ```

2. **The script automatically:**
   - ✅ Validates system requirements
   - ✅ Configures ports (interactive)
   - ✅ Installs dependencies
   - ✅ Creates `.env` file
   - ✅ Starts Docker containers
   - ✅ Executes database migrations
   - ✅ Optionally executes seeding
   - ✅ Starts development server

3. **Access at:**
   - Backend API: `http://localhost:3000` (or configured port)
   - Frontend: `http://localhost:80` (or configured port)
   - PostgreSQL: `localhost:5432`

---

## 📋 Prerequisites

- **PowerShell 5.1+**
- **Node.js 20.9.0+** - [Download](https://nodejs.org/)
- **Docker Desktop** - [Download](https://www.docker.com/products/docker-desktop/)
- **Docker Compose** - (included in Docker Desktop)

---

## 🔧 Generated Configuration Files

### `back/.env`

Backend configuration:

```env
POSTGRES_DB=clutchpay_db
POSTGRES_USER=clutchpay_user
POSTGRES_PASSWORD=clutchpay_pass
DATABASE_URL=postgresql://...
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key
```

### `frontend/.env`

Frontend configuration:

```env
API_BASE_URL=http://localhost:3000
FRONTEND_PORT=80
```

---

## 📊 Test Data Statistics

When running `seed.ts`:

| Element | Quantity | Description |
|---------|----------|-------------|
| Users | 40 | With variety of optional data |
| Invoices | ~160 | Distributed among users |
| Payments | ~120 | 75-85% of invoices paid |
| Contacts | Variable | 2-8 per user |
| Notifications | ~350 | 4 different types |

---

## ⚠️ Important Notes

- The script **will delete the existing database** during migrations
- Seeding data is **fictional and for development only**
- Changing `NEXTAUTH_SECRET` in production is **mandatory**
- The script **automatically handles port conflicts**
- **Frontend environment variables** are read from `.env`

---

## 🆘 Troubleshooting

**Port in use:**
- The script automatically detects and frees ports in use

**Docker won't start:**
- Ensure Docker Desktop is running
- Verify you have sufficient permissions

**Migrations fail:**
- Remove Docker containers: `docker-compose down`
- Restart: `.\setup_dev_env.ps1`

**Seeding fails:**
- Ensure PostgreSQL is running
- Verify credentials in `.env`

---

## 📝 Last Updated

**November 24, 2025**
