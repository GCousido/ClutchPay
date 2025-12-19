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

| File | Description |
|------|-------------|
| `setup_dev_env.ps1` | Automated environment setup with service control |
| `seed.ts` | Database seeding script for test data |
| `Vagrantfile` | Single-host VM for installer testing |
| `VagrantNetwork/` | Multi-host VM configuration |

#### `setup_dev_env.ps1`

##### **Automated Development Environment Setup Script (v2.0)**

A comprehensive PowerShell script that automates the entire development environment setup process from scratch. Now with service control modes.

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
   - Configures all required services:
     - Database (PostgreSQL)
     - Cloudinary (file storage)
     - Stripe (payment processing)
     - PayPal (payouts)
     - Resend (email notifications)
     - Logging (configurable log levels)

5. **Service Control Modes (NEW)**
   - `-start`: Start all Docker services
   - `-stop`: Stop all Docker services
   - Services not started by default (non-intrusive setup)

6. **Database Initialization (Optional)**
   - Prisma migrations (requires running database)
   - Generates Prisma Client
   - Optional database seeding
   - Automatic cleanup of temporary files

7. **Preserves Existing Configuration**
   - Does NOT overwrite existing `.env` files
   - Only creates new config if files don't exist

**Usage:**

```powershell
# Full environment setup (no services started)
.\utils_dev\setup_dev_env.ps1

# Start all Docker services (database + frontend)
.\utils_dev\setup_dev_env.ps1 -start

# Stop all Docker services
.\utils_dev\setup_dev_env.ps1 -stop
```

**Workflow:**

```text
1. Run .\setup_dev_env.ps1           # Configure environment
2. Edit back\.env                     # Add real API credentials
3. Run .\setup_dev_env.ps1 -start    # Start Docker services
4. Run database migrations            # cd back; npx prisma migrate reset --force
5. Start backend                      # cd back; pnpm run dev
```

**Environment Variables Created:**

| Category | Variables |
|----------|-----------|
| Database | `DATABASE_URL`, `POSTGRES_*` |
| Auth | `NEXTAUTH_SECRET`, `JWT_SECRET` |
| Cloudinary | `CLOUDINARY_*` |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| PayPal | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` |
| Email | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| Logging | `LOG_LEVEL` (DEBUG, INFO, WARN, ERROR) |

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

### 🖥️ Vagrant Virtual Machines

ClutchPay provides Vagrant configurations for testing the production installer in isolated Debian 11 environments.

#### Prerequisites

- [Vagrant](https://www.vagrantup.com/downloads) installed
- [VirtualBox](https://www.virtualbox.org/wiki/Downloads) installed

---

#### `Vagrantfile` (Single Host)

##### **Single VM for Installer Testing**

A Vagrantfile that creates a single Debian 11 virtual machine for testing the ClutchPay installer script.

**Features:**

- Debian 11 (Bullseye) 64-bit
- Bridge network (gets IP from your local network DHCP)
- 4GB RAM, 2 CPUs
- Automatic installer script copy
- Network helper scripts included

**VM Specifications:**

| Property | Value |
|----------|-------|
| Base Box | `debian/bullseye64` |
| Hostname | `clutchpay-test` |
| Memory | 4096 MB |
| CPUs | 2 |
| Network | Bridge (public_network) |

**Usage:**

```bash
# Navigate to utils_dev
cd utils_dev

# Create and start the VM
vagrant up

# Connect to the VM
vagrant ssh

# Check network status (inside VM)
bash /check-network.sh

# Run the installer (inside VM)
bash /installer.sh

# Destroy the VM when done
vagrant destroy -f
```

**Network Configuration:**

The VM uses bridge networking to get an IP from your local network's DHCP server. This allows:
- Direct access from any device on your network
- Testing the application as if it were a real server
- External access without port forwarding

**Included Helper Scripts (inside VM):**

- `/check-network.sh` - Displays network information and tests connectivity
- `/installer.sh` - The ClutchPay production installer

---

#### `VagrantNetwork/Vagrantfile` (Multi-Host)

##### **Two-VM Network for Distributed Testing**

A Vagrantfile that creates two separate virtual machines to test ClutchPay in a distributed environment with backend and frontend on different hosts.

**Features:**

- Two Debian 11 VMs with separate roles
- Automatic IP discovery and sharing between VMs
- Backend VM (4GB RAM, 2 CPUs)
- Frontend VM (2GB RAM, 1 CPU)
- Bridge networking for both

**VM Specifications:**

| VM | Hostname | Memory | CPUs | Role |
|----|----------|--------|------|------|
| backend | `clutchpay-backend` | 4096 MB | 2 | API + Database |
| frontend | `clutchpay-frontend` | 2048 MB | 1 | Static frontend |

**Usage:**

```bash
# Navigate to VagrantNetwork
cd utils_dev/VagrantNetwork

# Create and start both VMs
vagrant up

# Connect to backend VM
vagrant ssh backend

# Connect to frontend VM
vagrant ssh frontend

# Run installer on each VM (inside respective VMs)
bash /installer.sh

# Destroy both VMs when done
vagrant destroy -f
```

**IP Discovery:**

The Vagrantfile automatically:
1. Obtains bridge IPs for both VMs
2. Saves backend IP to `/vagrant/.backend_ip`
3. Saves frontend IP to `/vagrant/.frontend_ip`
4. These files are shared via the synced `/vagrant` folder

**Architecture:**

```text
┌─────────────────┐         ┌─────────────────┐
│  Backend VM     │         │  Frontend VM    │
│  (4GB, 2CPU)    │◄───────►│  (2GB, 1CPU)    │
│  - PostgreSQL   │  HTTP   │  - Nginx        │
│  - Next.js API  │         │  - Static files │
└─────────────────┘         └─────────────────┘
        │                           │
        └───────────┬───────────────┘
                    │
            Bridge Network
          (Local Network DHCP)
```

**When to Use Each:**

| Configuration | Use Case |
|---------------|----------|
| Single Host (`Vagrantfile`) | Quick installer testing, all-in-one deployment |
| Multi-Host (`VagrantNetwork/`) | Production-like setup, network testing, load testing |

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
