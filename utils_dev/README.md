# Development Utilities

Utility tools and scripts for ClutchPay development and testing. This directory contains automation scripts, test utilities, and development helpers to streamline the development workflow.

---

## 📋 Overview

We provide different development tools:

- **Automated Environment Setup**: One-command development environment configuration
- **Database Seeding**: Test data generation for development
- **Test Coverage Tools**: Coverage report generation and conversion
- **Development Documentation**: Comprehensive testing documentation

---

## 📁 Directory Contents

### 🔧 Core Scripts

#### `setup_dev_env.ps1`

##### **Automated Development Environment Setup Script**

A comprehensive PowerShell script that automates the entire development environment setup process from scratch.

**Features:**

1. **System Requirements Validation**
   - ✅ Verifies Node.js >= 20.9.0
   - ✅ Checks Docker installation and daemon status
   - ✅ Validates Docker Compose availability
   - ✅ Auto-installs pnpm if missing

2. **Interactive Port Configuration**
   - Backend API port (default: 3000)
   - Frontend port (default: 80)
   - Automatic port conflict detection

3. **Dependency Management**
   - Installs backend dependencies with pnpm
   - Handles path navigation for any execution location
   - Uses frozen lockfile for consistency

4. **Environment Configuration**
   - Creates `.env` files automatically
   - Generates cryptographically secure secrets
   - Configures database connection strings
   - Sets up NextAuth and JWT secrets

5. **Docker Container Setup**
   - PostgreSQL database container
   - Frontend container
   - User confirmation before initialization
   - Health checks and automatic startup

6. **Database Initialization**
   - Runs Prisma migrations
   - Generates Prisma Client
   - Optional database seeding
   - Automatic cleanup of temporary files

7. **Development Server Launch**
   - Port conflict resolution
   - Process termination if needed
   - Custom port configuration
   - Automatic server startup

**Usage:**

```powershell
# Run from project root
.\utils_dev\setup_dev_env.ps1

# Or from utils_dev directory
cd utils_dev
.\setup_dev_env.ps1
```

**Requirements:**

- Windows PowerShell 5.1+
- Administrator privileges (for Docker operations)
- Internet connection (for package installation)

**Execution Policy:**

```powershell
# If script execution is blocked
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\setup_dev_env.ps1
```

---

#### `seed.ts`

##### **Database Seeding Script**

TypeScript script for populating the database with test data during development.

**Features:**

- Creates sample users
- Generates test invoices
- Creates payment records
- Establishes user relationships
- Idempotent execution (safe to run multiple times)

**Usage:**

```bash
# Run from backend directory
cd back
npx tsx ../utils_dev/seed.ts
```

**Automatic Usage:**
The `setup_dev_env.ps1` script automatically runs this during setup and cleans up the temporary file afterward.

---

## Utilies in different folders

### 📊 Coverage Tools

#### `generate-coverage-report.js`

##### **Test Coverage Markdown Generator**

Node.js script that generates a comprehensive Markdown report from Vitest coverage data.

**Features:**

- Parses coverage JSON data
- Generates detailed coverage tables
- Creates summary statistics
- Outputs formatted Markdown

**Output:**

Creates `coverage-report.md` with:

- Overall coverage percentage
- Per-file coverage breakdown
- Uncovered lines identification
- Coverage trends

---

#### `coverage-md-to-pdf.mjs`

##### **Coverage Report PDF Converter**

ES Module script that converts Markdown coverage reports to PDF format.

**Features:**

- Markdown to PDF conversion
- Formatted tables and styling
- Syntax highlighting for code
- Professional report layout

**Requirements:**

- `markdown-pdf` or similar converter
- Input: `coverage-report.md`
- Output: `coverage-report.pdf`

**Usage to generate the report:**

```bash
pnpm coverage:all
```

---

## 🚀 Quick Start Guide

### First-Time Setup

#### **Step 1: Run automated setup**

```powershell
.\utils_dev\setup_dev_env.ps1
```

#### **Step 2: Verify installation**

- Backend: `http://localhost:3000`
- Frontend: `http://localhost:80`
- Database: `localhost:5432`

#### **Step 3: Run tests**

```bash
cd back
pnpm run test
```

---

## 🔧 Manual Setup (Alternative)

If you prefer manual setup or the script fails:

### 1. System Validation

```powershell
# Check Node.js
node --version  # Should be >= 20.9.0

# Check Docker
docker --version
docker-compose --version

# Install pnpm
npm install -g pnpm
```

### 2. Backend Setup

```bash
cd back
pnpm install
# Edit .env with your configuration
```

### 3. Database Setup

```bash
cd docker
docker-compose up -d
cd ..
pnpm exec prisma migrate dev
pnpm exec prisma generate
```

### 4. Seed Database

```bash
npx tsx ../utils_dev/seed.ts
```

### 5. Start Development

```bash
pnpm run dev
```

---

## 🐛 Troubleshooting

### Common Issues

**Script execution blocked:**

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

**PowerShell version too old:**

```powershell
# Check version
$PSVersionTable.PSVersion
# Upgrade to PowerShell 5.1 or later
```

**Docker not running:**

```bash
# Windows: Start Docker Desktop
# Linux: sudo systemctl start docker
```

**Port already in use:**

```powershell
# Find process using port 3000
netstat -ano | findstr :3000
# Kill process by PID
taskkill /PID <PID> /F
```

**pnpm installation fails:**

```bash
# Install globally with npm
npm install -g pnpm

# Verify installation
pnpm --version
```

**Prisma migration errors:**

```bash
# Reset database
pnpm exec prisma migrate reset

# Regenerate client
pnpm exec prisma generate
```

---

## 📚 Additional Resources

- **Main Documentation**: [../README.md](../README.md)
- **Backend Documentation**: [../back/README.md](../back/README.md)
- **Frontend Documentation**: [../frontend/README.md](../frontend/README.md)

---

## ⚠️ Important Notes

- The script **will delete the existing database** during migrations
- Seeding data is **fictional and for development only**
- The script **automatically handles port conflicts**
