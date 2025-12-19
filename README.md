# ClutchPay

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.9.0-brightgreen)](https://nodejs.org/)
[![pnpm Version](https://img.shields.io/badge/pnpm-%3E%3D8.0.0-orange)](https://pnpm.io/)
[![Backend Tests](https://github.com/GCousido/ClutchPay/actions/workflows/backend-tests.yml/badge.svg)](https://github.com/GCousido/ClutchPay/actions/workflows/backend-tests.yml)
[![Backend Coverage](https://codecov.io/gh/GCousido/ClutchPay/graph/badge.svg?token=YO9JU00M3K)](https://codecov.io/gh/GCousido/ClutchPay)

A invoice management application built with Next.js and Prisma ORM. ClutchPay allows users to create, send, and manage invoices, make and track payments, and generate payment receipts automatically.

> **Note:** This project is developed as part of a master's degree course in Computer Engineering at the Universidad de Vigo.

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Development](#development)

---

## ✨ Features

- **User Authentication**: Secure authentication system with NextAuth.js
- **Invoice Management**: Create, update, and track invoices with PDF storage
- **Payment Processing**: Stripe integration for secure card/bank payments
- **Automatic Payouts**: PayPal Payouts to transfer funds to invoice issuers
- **Notifications System**:
  - Internal notifications with read/unread tracking
  - Email notifications via Resend with React Email templates
- **File Storage**: Automatic PDF and image upload to Cloudinary
- **Multi-language Support**: Internationalization (i18n) for English and Spanish
- **Structured Logging**: Configurable log levels (DEBUG, INFO, WARN, ERROR)
- **Responsive Design**: Mobile-friendly interface
- **API-First Architecture**: RESTful API with comprehensive validation
- **Database Management**: PostgreSQL with Prisma ORM
- **Automated Testing**: Comprehensive test suite with 600+ tests
- **CI/CD Pipeline**: Automated testing on every push

---

## 🛠 Tech Stack

### Backend

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Runtime**: Node.js 20+
- **Database**: PostgreSQL
- **ORM**: [Prisma](https://www.prisma.io/)
- **Authentication**: [NextAuth.js](https://next-auth.js.org/)
- **Validation**: [Zod](https://zod.dev/)
- **Payments**: [Stripe](https://stripe.com/) (Checkout Sessions, Webhooks)
- **Payouts**: [PayPal Payouts SDK](https://developer.paypal.com/docs/payouts/)
- **Email**: [Resend](https://resend.com/) + [React Email](https://react.email/)
- **File Storage**: [Cloudinary](https://cloudinary.com/) (Images & PDFs)
- **Logging**: Custom structured logger with configurable levels
- **Testing**: [Vitest](https://vitest.dev/) (600+ tests, 93%+ coverage)

### Frontend

- **UI Framework**: HTML5, CSS3, JavaScript (ES6+)
- **Styling**: Custom CSS
- **Build Tool**: Docker for containerization
- **Internationalization**: Custom i18n implementation

### DevOps

- **Package Manager**: pnpm
- **Containerization**: Docker & Docker Compose
- **CI/CD**: GitHub Actions
- **Version Control**: Git

---

## 📁 Project Structure

```text
ClutchPay/
├── back/                 # Backend application (Next.js + Prisma)
│   ├── src/             # Source code
│   ├── prisma/          # Database schema and migrations
│   ├── tests/           # Test suite
│   └── docker/          # PostgreSQL Docker configuration
│
├── frontend/            # Frontend application (HTML/CSS/JS)
│   ├── JS/             # JavaScript modules
│   ├── CSS/            # Stylesheets
│   └── docker/         # Frontend Docker configuration
│
├── utils_dev/          # Development utilities and scripts
│   └── setup_dev_env.ps1  # Automated environment setup
│
├── .github/            # GitHub Actions workflows
│   └── workflows/      # CI/CD pipelines
│
└── README.md           # This file
```

For detailed information about each directory, see their respective README files:

- [Backend Documentation](./back/README.md)
- [Frontend Documentation](./frontend/README.md)
- [Development Utilities](./utils_dev/README.md)

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: >= 20.9.0 ([Download](https://nodejs.org/))
- **pnpm**: >= 8.0.0 (Install: `npm install -g pnpm`)
- **Docker**: Latest version ([Download](https://www.docker.com/))
- **Docker Compose**: Included with Docker Desktop
- **Git**: For version control

### Installation

#### Automated Setup (Windows)

Use the provided PowerShell script for automatic environment setup:

```powershell
# Run from project root
.\utils_dev\setup_dev_env.ps1
```

This script will:

- ✅ Validate system requirements
- ✅ Install dependencies
- ✅ Configure environment variables
- ✅ Start Docker containers
- ✅ Run database migrations
- ✅ Seed the database
- ✅ Launch development server

#### Manual Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/GCousido/ClutchPay.git
   cd ClutchPay
   ```

2. **Set up the backend:**
   ```bash
   cd back
   pnpm install
   cp .env.example .env  # Configure your environment variables
   pnpm prisma migrate dev
   pnpm prisma db seed
   ```

3. **Configure services:**
   - Set up [Stripe](https://dashboard.stripe.com/apikeys) for payments
   - Set up [PayPal](https://developer.paypal.com/dashboard) for payouts
   - Set up [Resend](https://resend.com/api-keys) for email notifications
   - Set up [Cloudinary](https://console.cloudinary.com/) for file storage

### Production Deployment (Linux/Debian)

ClutchPay includes an automated installer script for production deployment on Debian 11+ systems.

#### Quick Start

**Full installation (Backend + Frontend):**
```bash
wget https://raw.githubusercontent.com/GCousido/ClutchPay/main/installer.sh
chmod +x installer.sh
sudo ./installer.sh
```

**Interactive mode (recommended for first-time setup):**
```bash
sudo ./installer.sh -i
```

#### Installation Modes

| Mode | Description | Command |
|------|-------------|---------|
| **Full** | Backend + Frontend + PostgreSQL + Apache | `./installer.sh` |
| **Backend Only** | API server + Database | `./installer.sh --backend-only` |
| **Frontend Only** | Static files + Apache | `./installer.sh --frontend-only` |
| **Update** | Update existing installation | `./installer.sh --update [tag]` |

#### Post-Installation Configuration

After installation, configure external services using the provided configuration commands:

**Configure Stripe (Payment Processing):**
```bash
sudo ./installer.sh --config-stripe
```
Required credentials:
- Stripe Secret Key (from [Dashboard](https://dashboard.stripe.com/apikeys))
- Currency code (e.g., `eur`, `usd`, `gbp`)

The installer offers two webhook configuration options:
1. **Automatic (Recommended)**: Uses Stripe CLI to forward webhooks locally. The installer will:
   - Install Stripe CLI automatically
   - Prompt you to authenticate with `stripe login`
   - Create a systemd service (`clutchpay-stripe-webhook`) for persistent webhook forwarding
2. **Manual**: Enter your webhook secret from [Stripe Webhooks Dashboard](https://dashboard.stripe.com/webhooks) (useful for production with public domains)

**Configure PayPal (Issuer Payouts):**
```bash
sudo ./installer.sh --config-paypal
```
Required credentials:
- Client ID (from [Developer Dashboard](https://developer.paypal.com/dashboard))
- Client Secret
- Mode (`sandbox` for testing, `live` for production)

**Configure Resend (Email Notifications):**
```bash
sudo ./installer.sh --config-resend
```
Required credentials:
- API Key (from [Resend API Keys](https://resend.com/api-keys))
- From Email (must be verified in Resend dashboard)

**Configure Cloudinary (File Storage):**
```bash
sudo ./installer.sh --config-cloudinary
```
Required credentials:
- Cloud Name (from [Console](https://console.cloudinary.com/))
- API Key
- API Secret

**Reconfigure Network Settings:**
```bash
# Update backend frontend location
sudo ./installer.sh --config-backend

# Update frontend backend location
sudo ./installer.sh --config-frontend
```

#### System Requirements

- **OS**: Debian 11+ (Bullseye or newer)
- **Memory**: 2GB RAM minimum (4GB recommended for production)
  - PostgreSQL: ~512MB
  - Node.js Backend: ~512MB
  - Apache Frontend: ~256MB
  - System overhead: ~512MB
- **Disk**: 5GB free space minimum
  - Application files: ~500MB
  - PostgreSQL data: ~1GB (grows with usage)
  - Logs and cache: ~500MB
  - System packages: ~1GB
- **Network**: Configurable ports during installation
  - Frontend (Apache): Port 80 by default (configurable)
  - Backend API: Port 3000 by default (configurable)
  - PostgreSQL: Port 5432 (localhost only)

#### What Gets Installed

- ✅ PostgreSQL 13+ database server
- ✅ Node.js 20.x runtime
- ✅ pnpm package manager
- ✅ Apache 2.4 web server
- ✅ Stripe CLI (for webhook forwarding)
- ✅ ClutchPay Backend as systemd service (`clutchpay-backend`)
- ✅ Stripe Webhook forwarder as systemd service (`clutchpay-stripe-webhook`) - if configured
- ✅ ClutchPay Frontend static files

#### Default Locations

| Component | Path | Notes |
|-----------|------|-------|
| Installation | `/opt/clutchpay` | Main installation directory |
| Backend | `/opt/clutchpay/back` | API source code |
| Frontend | `/var/www/clutchpay` | Apache document root |
| Environment | `/opt/clutchpay/back/.env` | Configuration file |
| Logs | `journalctl -u clutchpay-backend` | Backend service logs |

#### Service Management

```bash
# Check backend status
sudo systemctl status clutchpay-backend

# Restart backend after configuration changes
sudo systemctl restart clutchpay-backend

# View real-time logs
sudo journalctl -u clutchpay-backend -f

# Check Apache status
sudo systemctl status apache2

# Check Stripe webhook forwarder (if configured)
sudo systemctl status clutchpay-stripe-webhook

# View Stripe webhook logs
sudo journalctl -u clutchpay-stripe-webhook -f
```

#### Firewall Configuration

If using UFW firewall:
```bash
sudo ufw allow 80/tcp    # Frontend (HTTP)
sudo ufw allow 3000/tcp  # Backend API
sudo ufw allow 443/tcp   # HTTPS (if using SSL)
```

#### SSL/HTTPS Setup

For production environments, we recommend using Let's Encrypt with Certbot:

```bash
sudo apt-get install certbot python3-certbot-apache
sudo certbot --apache -d yourdomain.com
```

#### Troubleshooting

**Backend not starting:**
```bash
# Check logs
sudo journalctl -u clutchpay-backend -n 50

# Verify database connection
sudo -u postgres psql -d clutchpay_db -c "\dt"

# Check environment file
cat /opt/clutchpay/back/.env
```

**Frontend not accessible:**
```bash
# Check Apache status
sudo systemctl status apache2

# Verify Apache configuration
sudo apache2ctl configtest

# Check Apache error logs
sudo tail -f /var/log/apache2/clutchpay-error.log
```

**Database issues:**
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Run migrations manually
cd /opt/clutchpay/back
pnpm prisma migrate deploy
```

### Development

**Start the backend development server:**

```bash
cd back
pnpm run dev
```

Server will be available at: `http://localhost:3000`

**Start the frontend:**

```bash
cd frontend/docker
docker-compose up -d
```

Frontend will be available at: `http://localhost:80`
