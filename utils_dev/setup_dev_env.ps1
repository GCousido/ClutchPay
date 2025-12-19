#Requires -Version 5.1

param(
    [Alias('start')]
    [switch]$StartServices,
    [Alias('stop')]
    [switch]$StopServices
)

################################################################################
###                                                                          ###
###     ClutchPay - Development Environment Setup Script                     ###
###     Version: 2.0.0                                                       ###
###     PowerShell Script for Automated Development Environment Setup        ###
###                                                                          ###
################################################################################
<#
.SYNOPSIS
    Automated setup script for ClutchPay development environment.

.DESCRIPTION
    This script performs the following operations:
    - Validates system requirements (Node.js, Docker, Docker Compose)
    - Configures backend and frontend ports
    - Installs project dependencies via pnpm
    - Creates and configures .env files
    - Optionally initializes Docker containers for database and frontend
    - Sets up Prisma migrations and generates client
    - Optionally seeds the database with initial data
    
    Use -start to start all Docker services
    Use -stop to stop all Docker services

.NOTES
    File Name      : setup_dev_env.ps1
    Author         : ClutchPay Development Team
    Version        : 2.0.0
    Prerequisite   : PowerShell 5.1+, Node.js 20.9.0+, Docker, Docker Compose
    
.EXAMPLE
    .\setup_dev_env.ps1
    Runs the full setup without starting services
    
.EXAMPLE
    .\setup_dev_env.ps1 -start
    Starts all Docker services (database, frontend)
    
.EXAMPLE
    .\setup_dev_env.ps1 -stop
    Stops all Docker services
    
    If execution policies prevent script execution, run:
    Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
    .\setup_dev_env.ps1
#>
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Script configuration
$ErrorActionPreference = "Stop"
$MIN_NODE_VERSION = "20.9.0"
$DEFAULT_BACKEND_PORT = "3000"
$DEFAULT_FRONTEND_PORT = "80"

# Helper function for formatted output
function Write-Header {
    param([string]$Message)
    Write-Host "`n" -NoNewline
    Write-Host "===================================================================" -ForegroundColor Cyan
    Write-Host "  $Message" -ForegroundColor White
    Write-Host "===================================================================" -ForegroundColor Cyan
}

function Write-Step {
    param([string]$Message)
    Write-Host "`n[" -NoNewline -ForegroundColor White
    Write-Host ">" -NoNewline -ForegroundColor Cyan
    Write-Host "] " -NoNewline -ForegroundColor White
    Write-Host $Message -ForegroundColor White
}

function Write-Success {
    param([string]$Message)
    Write-Host "  [" -NoNewline -ForegroundColor White
    Write-Host "+" -NoNewline -ForegroundColor Green
    Write-Host "] " -NoNewline -ForegroundColor White
    Write-Host $Message -ForegroundColor Green
}

function Write-ErrorMsg {
    param([string]$Message)
    Write-Host "  [" -NoNewline -ForegroundColor White
    Write-Host "x" -NoNewline -ForegroundColor Red
    Write-Host "] " -NoNewline -ForegroundColor White
    Write-Host $Message -ForegroundColor Red
}

function Write-Warning {
    param([string]$Message)
    Write-Host "  [" -NoNewline -ForegroundColor White
    Write-Host "!" -NoNewline -ForegroundColor Yellow
    Write-Host "] " -NoNewline -ForegroundColor White
    Write-Host $Message -ForegroundColor Yellow
}

function Write-Info {
    param([string]$Message)
    Write-Host "  [" -NoNewline -ForegroundColor White
    Write-Host "i" -NoNewline -ForegroundColor Blue
    Write-Host "] " -NoNewline -ForegroundColor White
    Write-Host $Message -ForegroundColor Gray
}

# Helper function to generate secure keys
function Generate-SecureKey {
    param([int]$ByteLength = 32)
    $bytes = New-Object byte[] $ByteLength
    $rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::new()
    $rng.GetBytes($bytes)
    $rng.Dispose()
    return [Convert]::ToBase64String($bytes)
}

# Get project root
$currentDir = Get-Location
if ($currentDir.Path -like "*utils_dev*") {
    $projectRoot = (Get-Item $currentDir).Parent.FullName
} elseif ($currentDir.Path -like "*ClutchPay*") {
    # Try to find project root by looking for back folder
    $testPath = $currentDir.Path
    while ($testPath -and -not (Test-Path (Join-Path $testPath "back"))) {
        $parent = Split-Path $testPath -Parent
        if ($parent -eq $testPath) { break }
        $testPath = $parent
    }
    if (Test-Path (Join-Path $testPath "back")) {
        $projectRoot = $testPath
    } else {
        $projectRoot = $currentDir.Path
    }
} else {
    $projectRoot = $currentDir.Path
}

# ============================================================================
# SERVICE CONTROL MODES (-start / -stop)
# ============================================================================

if ($StopServices) {
    Write-Host ""
    Write-Host "+====================================================================+" -ForegroundColor Red
    Write-Host "|              STOPPING ALL CLUTCHPAY SERVICES                      |" -ForegroundColor White
    Write-Host "+====================================================================+" -ForegroundColor Red
    Write-Host ""
    Write-Info "Project root: $projectRoot"
    
    # Verify directories exist
    $backDockerPath = Join-Path $projectRoot "back\docker"
    $frontDockerPath = Join-Path $projectRoot "frontend\docker"
    
    if (-not (Test-Path $backDockerPath)) {
        Write-ErrorMsg "Backend docker directory not found: $backDockerPath"
        exit 1
    }
    
    # Stop backend database
    Write-Step "Stopping backend database container..."
    Push-Location $backDockerPath
    try {
        docker-compose down
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Backend database container stopped"
        } else {
            Write-Warning "Backend database container may not have been running"
        }
    } catch {
        Write-Warning "Could not stop backend database: $_"
    }
    Pop-Location
    
    # Stop frontend
    if (Test-Path $frontDockerPath) {
        Write-Step "Stopping frontend container..."
        Push-Location $frontDockerPath
        try {
            docker-compose down
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Frontend container stopped"
            } else {
                Write-Warning "Frontend container may not have been running"
            }
        } catch {
            Write-Warning "Could not stop frontend: $_"
        }
        Pop-Location
    }
    
    Write-Host ""
    Write-Success "All services stopped"
    exit 0
}

if ($StartServices) {
    Write-Host ""
    Write-Host "+====================================================================+" -ForegroundColor Green
    Write-Host "|              STARTING ALL CLUTCHPAY SERVICES                      |" -ForegroundColor White
    Write-Host "+====================================================================+" -ForegroundColor Green
    Write-Host ""
    Write-Info "Project root: $projectRoot"
    
    # Verify directories exist
    $backDockerPath = Join-Path $projectRoot "back\docker"
    $frontDockerPath = Join-Path $projectRoot "frontend\docker"
    $backEnvPath = Join-Path $projectRoot "back\.env"
    
    if (-not (Test-Path $backDockerPath)) {
        Write-ErrorMsg "Backend docker directory not found: $backDockerPath"
        Write-Info "Make sure you are running from the project directory"
        exit 1
    }
    
    if (-not (Test-Path $backEnvPath)) {
        Write-ErrorMsg "Backend .env file not found: $backEnvPath"
        Write-Info "Run the setup script first without -start to create configuration"
        exit 1
    }
    
    # Start backend database
    Write-Step "Starting backend database container..."
    Push-Location $backDockerPath
    try {
        docker-compose --env-file $backEnvPath up -d
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Backend database container started"
            Write-Info "PostgreSQL is running on localhost:5432"
        } else {
            Write-ErrorMsg "Failed to start backend database container"
            Write-Info "Check Docker is running and try again"
        }
    } catch {
        Write-ErrorMsg "Error starting database container: $_"
    }
    Pop-Location
    
    # Start frontend
    if (Test-Path $frontDockerPath) {
        Write-Step "Starting frontend container..."
        Push-Location $frontDockerPath
        try {
            docker-compose up -d --build
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Frontend container started"
                Write-Info "Frontend accessible at: http://localhost:80"
            } else {
                Write-ErrorMsg "Failed to start frontend container"
            }
        } catch {
            Write-ErrorMsg "Error starting frontend container: $_"
        }
        Pop-Location
    } else {
        Write-Warning "Frontend docker directory not found, skipping"
    }
    
    Write-Host ""
    Write-Host "+--------------------------------------------------------------+" -ForegroundColor Cyan
    Write-Host "| Service Status                                               |" -ForegroundColor Cyan
    Write-Host "+--------------------------------------------------------------+" -ForegroundColor Cyan
    Write-Host "| [+] PostgreSQL Database       Running on port 5432           |" -ForegroundColor White
    Write-Host "| [+] Frontend Container        http://localhost:80            |" -ForegroundColor White
    Write-Host "+--------------------------------------------------------------+" -ForegroundColor Cyan
    Write-Host ""
    Write-Info "To start the backend development server, run:"
    Write-Host "    cd back; pnpm run dev" -ForegroundColor Yellow
    Write-Host ""
    exit 0
}

# ============================================================================
# MAIN SETUP BLOCK - Only runs if no -start or -stop flag was provided
# ============================================================================
if (-not $StartServices -and -not $StopServices) {

# Display script header
Clear-Host
Write-Host ""
Write-Host "+====================================================================+" -ForegroundColor Cyan
Write-Host "|                                                                    |" -ForegroundColor Cyan
Write-Host "|          PDP-PASARELA DEVELOPMENT ENVIRONMENT SETUP                |" -ForegroundColor White
Write-Host "|                        Version 1.0.0                               |" -ForegroundColor Gray
Write-Host "|                                                                    |" -ForegroundColor Cyan
Write-Host "+====================================================================+" -ForegroundColor Cyan
Write-Host ""

# ============================================================================
# PHASE 1: SYSTEM REQUIREMENTS VALIDATION
# ============================================================================

Write-Header "PHASE 1: System Requirements Validation"

# Check Node.js installation
Write-Step "Checking Node.js installation..."
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-ErrorMsg "Node.js is not installed"
    Write-Info "Please install Node.js v$MIN_NODE_VERSION or higher from https://nodejs.org/"
    exit 1
}

$nodeVersion = node --version
$nodeVersionNumber = $nodeVersion.TrimStart("v")

if ([version]$nodeVersionNumber -lt [version]$MIN_NODE_VERSION) {
    Write-ErrorMsg "Node.js version $nodeVersionNumber is below minimum required version"
    Write-Info "Minimum required: v$MIN_NODE_VERSION"
    Write-Info "Current version: v$nodeVersionNumber"
    Write-Info "Please upgrade Node.js from https://nodejs.org/"
    exit 1
}

Write-Success "Node.js v$nodeVersionNumber detected"

# Check Docker installation
Write-Step "Checking Docker installation..."
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-ErrorMsg "Docker is not installed"
    Write-Info "Please install Docker Desktop from https://www.docker.com/products/docker-desktop/"
    exit 1
}

$dockerVersion = docker --version
Write-Success "Docker detected: $dockerVersion"

# Verify Docker daemon
Write-Step "Verifying Docker daemon status..."
try {
    $null = & docker info
    Write-Success "Docker daemon is running"
} catch {
    Write-ErrorMsg "Docker daemon is not running"
    Write-Info "Please start Docker Desktop and try again"
    exit 1
}

# Check Docker Compose installation
Write-Step "Checking Docker Compose installation..."
if (-not (Get-Command docker-compose -ErrorAction SilentlyContinue)) {
    Write-ErrorMsg "Docker Compose is not installed"
    Write-Info "Docker Compose is usually included with Docker Desktop"
    Write-Info "Please reinstall Docker Desktop from https://www.docker.com/"
    exit 1
}

$dockerComposeVersion = docker-compose --version
Write-Success "Docker Compose detected: $dockerComposeVersion"

# Verify pnpm installation
Write-Step "Checking pnpm package manager..."
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Warning "pnpm is not installed globally"
    Write-Step "Installing pnpm globally via npm..."
    npm install -g pnpm
    if ($LASTEXITCODE -eq 0) {
        Write-Success "pnpm installed successfully"
    } else {
        Write-ErrorMsg "Failed to install pnpm"
        exit 1
    }
} else {
    $pnpmVersion = pnpm --version
    Write-Success "pnpm v$pnpmVersion detected"
}

Write-Success "All system requirements validated successfully"

# ============================================================================
# PHASE 2: PORT CONFIGURATION (only if .env doesn't exist)
# ============================================================================

Write-Header "PHASE 2: Port Configuration"

# Check if .env already exists
$backEnvExists = Test-Path -Path (Join-Path $projectRoot "back\.env")

if ($backEnvExists) {
    Write-Success "Existing .env file found - using current configuration"
    Write-Info "Delete back\.env to reconfigure ports"
    $backendPort = $DEFAULT_BACKEND_PORT
    $frontendPort = $DEFAULT_FRONTEND_PORT
} else {
    Write-Info "Configure the ports for your development environment"
    Write-Host ""

    # Backend port configuration
    Write-Host "  Backend API Port Configuration:" -ForegroundColor White
    Write-Host "    Current default: $DEFAULT_BACKEND_PORT" -ForegroundColor Gray
    $backendPort = Read-Host "    Enter backend port (press Enter for default)"
    if ([string]::IsNullOrWhiteSpace($backendPort)) {
        $backendPort = $DEFAULT_BACKEND_PORT
        Write-Info "Using default backend port: $backendPort"
    } else {
        Write-Success "Backend port set to: $backendPort"
    }

    Write-Host ""

    # Frontend port configuration
    Write-Host "  Frontend Port Configuration:" -ForegroundColor White
    Write-Host "    Current default: $DEFAULT_FRONTEND_PORT" -ForegroundColor Gray
    $frontendPort = Read-Host "    Enter frontend port (press Enter for default)"
    if ([string]::IsNullOrWhiteSpace($frontendPort)) {
        $frontendPort = $DEFAULT_FRONTEND_PORT
        Write-Info "Using default frontend port: $frontendPort"
    } else {
        Write-Success "Frontend port set to: $frontendPort"
    }

    Write-Host ""
    Write-Host "  +-------------------------------------------------------+" -ForegroundColor Cyan
    Write-Host "  | Port Configuration Summary                          |" -ForegroundColor Cyan
    Write-Host "  +-------------------------------------------------------+" -ForegroundColor Cyan
    Write-Host "  | Backend API:  " -NoNewline -ForegroundColor White
    Write-Host "http://localhost:$backendPort".PadRight(33) -NoNewline -ForegroundColor Green
    Write-Host "|" -ForegroundColor Cyan
    Write-Host "  | Frontend:     " -NoNewline -ForegroundColor White
    Write-Host "http://localhost:$frontendPort".PadRight(33) -NoNewline -ForegroundColor Green
    Write-Host "|" -ForegroundColor Cyan
    Write-Host "  +-------------------------------------------------------+" -ForegroundColor Cyan
}

# ============================================================================
# PHASE 3: DEPENDENCY INSTALLATION
# ============================================================================

Write-Header "PHASE 3: Installing Project Dependencies"

Write-Step "Installing backend dependencies..."
Write-Info "This may take a few minutes on first run"

# Store original location and navigate to project root
$originalLocation = Get-Location
Set-Location $projectRoot

Push-Location (Join-Path $projectRoot "back")
try {
    pnpm install --silent
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Backend dependencies installed successfully"
    } else {
        Write-ErrorMsg "Failed to install backend dependencies"
        Pop-Location
        Set-Location $originalLocation
        exit 1
    }
} catch {
    Write-ErrorMsg "Error during dependency installation: $_"
    Pop-Location
    Set-Location $originalLocation
    exit 1
}
Pop-Location

# ============================================================================
# PHASE 4: ENVIRONMENT CONFIGURATION
# ============================================================================

Write-Header "PHASE 4: Environment Configuration"

$backEnvPath = Join-Path $projectRoot "back\.env"

Write-Step "Checking for .env file..."

if (-not (Test-Path -Path $backEnvPath)) {
    Write-Warning ".env file not found in backend directory"
    Write-Host ""
    $createEnv = Read-Host "  Would you like to create a new .env file with default values? (y/n)"
    
    if ($createEnv -eq "y") {
        Write-Step "Creating .env file with default configuration..."
        Write-Step "Generating security keys..."
        
        $NextAuthKey = Generate-SecureKey -ByteLength 32
        $JWTKey = Generate-SecureKey -ByteLength 32
        
        Write-Info "NEXTAUTH_SECRET: Generated securely"
        Write-Info "JWT_SECRET: Generated securely"
        
        $envContent = @"
# ============================================================================
# Database Configuration
# ============================================================================
POSTGRES_DB=clutchpay_db
POSTGRES_USER=clutchpay_user
POSTGRES_PASSWORD=clutchpay_pass

DATABASE_URL=postgresql://clutchpay_user:clutchpay_pass@localhost:5432/clutchpay_db?schema=public

TEST_DATABASE_URL=postgresql://clutchpay_user:clutchpay_pass@localhost:5432/clutchpay_db?schema=public

# ============================================================================
# Application URLs
# ============================================================================
NEXT_PUBLIC_API_URL=http://localhost:$backendPort
NEXT_PUBLIC_APP_URL=http://localhost:$backendPort
NEXTAUTH_URL=http://localhost:$backendPort

# ============================================================================
# Security Keys (Auto-generated on $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
# ============================================================================
NEXTAUTH_SECRET=$NextAuthKey
JWT_SECRET=$JWTKey

# ============================================================================
# Cloudinary Configuration (configure with your own credentials)
# ============================================================================
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=<your_cloud_name>
NEXT_PUBLIC_CLOUDINARY_API_KEY=<your_api_key>
CLOUDINARY_API_SECRET=<your_api_secret>

# ============================================================================
# Stripe Configuration (Payment Processing)
# Get your keys from https://dashboard.stripe.com/apikeys
# ============================================================================
STRIPE_SECRET_KEY=<your_stripe_secret_key>
STRIPE_WEBHOOK_SECRET=<your_stripe_webhook_secret>
STRIPE_CURRENCY=eur

# ============================================================================
# PayPal Configuration (Payouts)
# Get your credentials from https://developer.paypal.com/
# ============================================================================
PAYPAL_CLIENT_ID=<your_paypal_client_id>
PAYPAL_CLIENT_SECRET=<your_paypal_client_secret>
PAYPAL_MODE=sandbox

# ============================================================================
# Email Configuration (Resend)
# Get your API key from https://resend.com/
# ============================================================================
RESEND_API_KEY=<your_resend_api_key>
RESEND_FROM_EMAIL=ClutchPay <noreply@your-domain.com>

# ============================================================================
# Logging Configuration
# ============================================================================
LOG_LEVEL=INFO

# ============================================================================
# Port Configuration
# ============================================================================
BACKEND_PORT=$backendPort
FRONTEND_PORT=$frontendPort
FRONTEND_URL=http://localhost:$frontendPort

# ============================================================================
# Development Settings
# ============================================================================
NODE_ENV=development
"@
        Set-Content -Path $backEnvPath -Value $envContent
        Write-Success ".env file created successfully with secure keys"
        Write-Info "Database: clutchpay_db"
        Write-Info "User: clutchpay_user"
        Write-Warning "IMPORTANT: Keep NEXTAUTH_SECRET and JWT_SECRET secure!"
        Write-Warning "IMPORTANT: Never commit .env file to version control"
    } else {
        Write-Warning "Skipping .env file creation"
        Write-Info "You will need to create this file manually before running the application"
    }
} else {
    Write-Success ".env file found - preserving existing configuration"
    Write-Info "If you need to reconfigure, delete back\.env and run setup again"
}

# Configure frontend environment variables (only if not exists)
Write-Step "Checking frontend environment variables..."
$frontendEnvPath = Join-Path $projectRoot "frontend\.env"

if (Test-Path -Path $frontendEnvPath) {
    Write-Success "Frontend .env file found - preserving existing configuration"
} else {
    Write-Info "Creating new frontend .env file"
    $frontendEnvContent = @"
# ============================================================================
# Frontend Configuration
# ============================================================================
API_BASE_URL=http://localhost:$backendPort
FRONTEND_PORT=$frontendPort
"@
    Set-Content -Path $frontendEnvPath -Value $frontendEnvContent
    Write-Success "Frontend .env file created with API URL: http://localhost:$backendPort"
}

# ============================================================================
# PHASE 5: DOCKER CONTAINER SETUP (Information Only)
# ============================================================================

Write-Header "PHASE 5: Docker Container Information"

Write-Host ""
Write-Host "  Docker containers are NOT started automatically." -ForegroundColor Yellow
Write-Host "  The following containers are available:" -ForegroundColor White
Write-Host "    - PostgreSQL Database (port 5432)" -ForegroundColor Gray
Write-Host "    - Frontend Application (port $frontendPort)" -ForegroundColor Gray
Write-Host ""
Write-Info "To start all services, run:"
Write-Host "    .\setup_dev_env.ps1 -start" -ForegroundColor Green
Write-Host ""
Write-Info "To stop all services, run:"
Write-Host "    .\setup_dev_env.ps1 -stop" -ForegroundColor Red
Write-Host ""

# ============================================================================
# PHASE 6: DATABASE MIGRATION AND SETUP (Optional)
# ============================================================================

Write-Header "PHASE 6: Database Migration and Setup"

Write-Host ""
Write-Host "  Database migrations require the PostgreSQL container to be running." -ForegroundColor Yellow
Write-Host ""

$runMigrations = Read-Host "  Would you like to run database migrations now? (y/n)"

if ($runMigrations -eq "y") {
    Push-Location (Join-Path $projectRoot "back")

    Write-Step "Resetting Prisma migrations..."
    Write-Info "This will drop the database and recreate it with the latest schema"
    try {
        npx prisma migrate reset --force
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Database migrations applied successfully"
        } else {
            Write-ErrorMsg "Failed to apply database migrations"
            Pop-Location
            Write-Warning "Make sure the database container is running: .\setup_dev_env.ps1 -start"
        }
    } catch {
        Write-ErrorMsg "Error during migration: $_"
        Pop-Location
        Write-Warning "Make sure the database container is running: .\setup_dev_env.ps1 -start"
    }

    Write-Step "Generating Prisma Client..."
    try {
        npx prisma generate
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Prisma Client generated successfully"
        } else {
            Write-ErrorMsg "Failed to generate Prisma Client"
        }
    } catch {
        Write-ErrorMsg "Error generating Prisma Client: $_"
    }

    Pop-Location
} else {
    Write-Info "Skipping database migrations"
    Write-Info "You can run migrations later with: cd back; npx prisma migrate reset --force"
    
    # Still generate Prisma Client as it's needed for TypeScript
    Push-Location (Join-Path $projectRoot "back")
    Write-Step "Generating Prisma Client..."
    try {
        npx prisma generate
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Prisma Client generated successfully"
        } else {
            Write-Warning "Could not generate Prisma Client"
        }
    } catch {
        Write-Warning "Error generating Prisma Client: $_"
    }
    Pop-Location
}

# Database seeding (optional)
Write-Host ""
$seedChoice = Read-Host "  Would you like to seed the database with initial data? (y/n)"
if ($seedChoice -eq "y") {
    Push-Location (Join-Path $projectRoot "back")
    Write-Step "Seeding database with initial data..."
    
    # Check if seed file exists in utils_dev folder
    $utilsSeedPath = Join-Path $projectRoot "utils_dev\seed.ts"
    $prismaSeedPath = "prisma\seed.ts"
    
    if (Test-Path -Path $utilsSeedPath) {
        Write-Info "Using seed.ts from utils_dev folder"
        
        # Copy seed.ts to prisma folder temporarily
        Copy-Item -Path $utilsSeedPath -Destination $prismaSeedPath -Force
        Write-Info "Copied seed.ts to prisma folder"
    }
    
    try {
        npx tsx prisma/seed.ts
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Database seeded successfully"
            
            # Clean up seed.ts from prisma folder after seeding
            Write-Step "Cleaning up temporary seed file..."
            if (Test-Path -Path $prismaSeedPath) {
                Remove-Item -Path $prismaSeedPath -Force
                Write-Success "Temporary seed.ts file removed from prisma folder"
            }
        } else {
            Write-Warning "Database seeding completed with warnings"
            
            # Still clean up even if there were warnings
            if (Test-Path -Path $prismaSeedPath) {
                Remove-Item -Path $prismaSeedPath -Force
                Write-Info "Temporary seed.ts file removed"
            }
        }
    } catch {
        Write-Warning "Error during seeding: $_"
        
        # Clean up even if there was an error
        if (Test-Path -Path $prismaSeedPath) {
            Remove-Item -Path $prismaSeedPath -Force
            Write-Info "Temporary seed.ts file removed"
        }
    }
    Pop-Location
} else {
    Write-Info "Skipping database seeding"
}

# ============================================================================
# PHASE 7: SETUP COMPLETE
# ============================================================================

Write-Header "PHASE 7: Setup Complete"

Push-Location (Join-Path $projectRoot "back")

$packageJsonPath = "package.json"
if (Test-Path -Path $packageJsonPath) {
    $packageJson = Get-Content -Path $packageJsonPath -Raw | ConvertFrom-Json
    $packageJson.scripts.dev = "next dev -p $backendPort"
    $packageJson | ConvertTo-Json -Depth 10 | Set-Content -Path $packageJsonPath
    Write-Success "Next.js configured to run on port $backendPort"
} else {
    Write-Warning "package.json not found, using default configuration"
}

Pop-Location

# Display final summary
Write-Host ""
Write-Host "+====================================================================+" -ForegroundColor Green
Write-Host "|                                                                    |" -ForegroundColor Green
Write-Host "|              SETUP COMPLETED SUCCESSFULLY!                         |" -ForegroundColor White
Write-Host "|                                                                    |" -ForegroundColor Green
Write-Host "+====================================================================+" -ForegroundColor Green
Write-Host ""
Write-Host "  +--------------------------------------------------------------+" -ForegroundColor Cyan
Write-Host "  | Configuration Summary                                        |" -ForegroundColor Cyan
Write-Host "  +--------------------------------------------------------------+" -ForegroundColor Cyan
Write-Host "  | Backend Port:  $backendPort                                             |" -ForegroundColor White
Write-Host "  | Frontend Port: $frontendPort                                              |" -ForegroundColor White
Write-Host "  | Database:      PostgreSQL on port 5432                       |" -ForegroundColor White
Write-Host "  +--------------------------------------------------------------+" -ForegroundColor Cyan
Write-Host ""
Write-Host "  +--------------------------------------------------------------+" -ForegroundColor Yellow
Write-Host "  | NEXT STEPS                                                   |" -ForegroundColor Yellow
Write-Host "  +--------------------------------------------------------------+" -ForegroundColor Yellow
Write-Host "  |                                                              |" -ForegroundColor White
Write-Host "  | 1. Configure your .env file with real credentials:          |" -ForegroundColor White
Write-Host "  |    - Cloudinary (file storage)                              |" -ForegroundColor Gray
Write-Host "  |    - Stripe (payment processing)                            |" -ForegroundColor Gray
Write-Host "  |    - PayPal (payouts)                                       |" -ForegroundColor Gray
Write-Host "  |    - Resend (email notifications)                           |" -ForegroundColor Gray
Write-Host "  |                                                              |" -ForegroundColor White
Write-Host "  | 2. Start Docker services:                                   |" -ForegroundColor White
Write-Host "  |    .\setup_dev_env.ps1 -start                              |" -ForegroundColor Green
Write-Host "  |                                                              |" -ForegroundColor White
Write-Host "  | 3. Run database migrations (if not done already):           |" -ForegroundColor White
Write-Host "  |    cd back; npx prisma migrate reset --force                |" -ForegroundColor Green
Write-Host "  |                                                              |" -ForegroundColor White
Write-Host "  | 4. Start the backend development server:                    |" -ForegroundColor White
Write-Host "  |    cd back; pnpm run dev                                    |" -ForegroundColor Green
Write-Host "  |                                                              |" -ForegroundColor White
Write-Host "  | 5. To stop services later:                                  |" -ForegroundColor White
Write-Host "  |    .\setup_dev_env.ps1 -stop                                |" -ForegroundColor Red
Write-Host "  |                                                              |" -ForegroundColor White
Write-Host "  +--------------------------------------------------------------+" -ForegroundColor Yellow
Write-Host ""
Write-Host "  [i] Environment configuration files created:" -ForegroundColor Blue
Write-Host "      - back\.env (backend configuration)" -ForegroundColor Gray
Write-Host "      - frontend\.env (frontend configuration)" -ForegroundColor Gray
Write-Host ""
Write-Host "  [!] Remember: Never commit .env files to version control!" -ForegroundColor Yellow
Write-Host ""
Write-Host "---------------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""

} # End of main setup block
