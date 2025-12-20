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
- **File Storage**: Automatic PDF and image upload to Cloudinary
- **Multi-language Support**: Internationalization (i18n) for English and Spanish
- **Responsive Design**: Mobile-friendly interface
- **API-First Architecture**: RESTful API with comprehensive validation
- **Database Management**: PostgreSQL with Prisma ORM
- **Automated Testing**: Comprehensive test suite with integration tests
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
- **File Storage**: [Cloudinary](https://cloudinary.com/) (Images & PDFs)
- **Testing**: [Vitest](https://vitest.dev/)

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
