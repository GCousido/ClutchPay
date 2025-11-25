#Requires -Version 5.1
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

################################################################################
###                                                                          ###
###     ClutchPay - Development Environment Setup Script                     ###
###     Version: 1.0.0                                                       ###
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
    - Initializes Docker containers for database and frontend
    - Sets up Prisma migrations and generates client
    - Optionally seeds the database with initial data
    - Starts the Next.js development server

.NOTES
    File Name      : setup_dev_env.ps1
    Author         : ClutchPay Development Team
    Version        : 1.0.0
    Prerequisite   : PowerShell 5.1+, Node.js 20.9.0+, Docker, Docker Compose
    
.EXAMPLE
    .\setup_dev_env.ps1
    
    If execution policies prevent script execution, run:
    Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
    .\setup_dev_env.ps1
#>

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
# PHASE 2: PORT CONFIGURATION
# ============================================================================

Write-Header "PHASE 2: Port Configuration"

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

# ============================================================================
# PHASE 3: DEPENDENCY INSTALLATION
# ============================================================================

Write-Header "PHASE 3: Installing Project Dependencies"

Write-Step "Installing backend dependencies..."
Write-Info "This may take a few minutes on first run"

# Store original location
$originalLocation = Get-Location

# Navigate to project root if we're in utils_dev
$currentDir = Get-Location
if ($currentDir.Path -like "*utils_dev*") {
    Write-Info "Detected execution from utils_dev folder, navigating to project root..."
    Set-Location ..
    $projectRoot = Get-Location
} else {
    $projectRoot = $currentDir
}

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
Set-Location $projectRoot

# ============================================================================
# PHASE 4: ENVIRONMENT CONFIGURATION
# ============================================================================

Write-Header "PHASE 4: Environment Configuration"

Write-Step "Checking for .env file..."

if (-not (Test-Path -Path "back\.env")) {
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

# ============================================================================
# Application URLs
# ============================================================================
NEXT_PUBLIC_API_URL=http://localhost:$backendPort
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
        Set-Content -Path "back\.env" -Value $envContent
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
    Write-Success ".env file found"
    Write-Step "Updating port configuration in existing .env..."
    
    $envContent = Get-Content -Path "back\.env" -Raw
    
    # Update or add port-related variables
    $updates = @{
        "NEXT_PUBLIC_API_URL" = "http://localhost:$backendPort"
        "NEXTAUTH_URL" = "http://localhost:$backendPort"
        "BACKEND_PORT" = $backendPort
        "FRONTEND_PORT" = $frontendPort
        "FRONTEND_URL" = "http://localhost:$frontendPort"
    }
    
    foreach ($key in $updates.Keys) {
        if ($envContent -match "$key=.*") {
            $envContent = $envContent -replace "$key=.*", "$key=$($updates[$key])"
        } else {
            $envContent += "`n$key=$($updates[$key])"
        }
    }
    
    Set-Content -Path "back\.env" -Value $envContent
    Write-Success "Port configuration updated in .env file"
}

# Configure frontend environment variables
Write-Step "Configuring frontend environment variables..."
$frontendEnvPath = "frontend\.env"
$frontendEnvContent = @"
# ============================================================================
# Frontend Configuration
# ============================================================================
API_BASE_URL=http://localhost:$backendPort
FRONTEND_PORT=$frontendPort
"@

if (Test-Path -Path $frontendEnvPath) {
    Write-Info "Updating existing frontend .env file"
    $existingContent = Get-Content -Path $frontendEnvPath -Raw
    
    # Update or add API URL variables
    $apiUrlUpdates = @{
        "API_BASE_URL" = "http://localhost:$backendPort"
        "FRONTEND_PORT" = $frontendPort
    }
    
    foreach ($key in $apiUrlUpdates.Keys) {
        if ($existingContent -match "$key=.*") {
            $existingContent = $existingContent -replace "$key=.*", "$key=$($apiUrlUpdates[$key])"
        } else {
            $existingContent += "`n$key=$($apiUrlUpdates[$key])"
        }
    }
    
    Set-Content -Path $frontendEnvPath -Value $existingContent
    Write-Success "Frontend .env file updated"
} else {
    Write-Info "Creating new frontend .env file"
    Set-Content -Path $frontendEnvPath -Value $frontendEnvContent
    Write-Success "Frontend .env file created with API URL: http://localhost:$backendPort"
}

# ============================================================================
# PHASE 5: DOCKER CONTAINER SETUP
# ============================================================================

Write-Header "PHASE 5: Docker Container Initialization"

Write-Host ""
Write-Host "  The following Docker containers will be initialized:" -ForegroundColor White
Write-Host "    - PostgreSQL Database (port 5432)" -ForegroundColor Gray
Write-Host "    - Frontend Application (port $frontendPort)" -ForegroundColor Gray
Write-Host ""

$dockerConfirm = Read-Host "  Proceed with Docker container initialization? (y/n)"

if ($dockerConfirm -ne "y") {
    Write-Warning "Docker container initialization skipped by user"
    Write-Info "You can start containers manually later with: docker-compose up -d"
} else {
    # Backend containers (database)
    Write-Step "Starting backend database container..."
    Write-Info "Initializing PostgreSQL database via Docker Compose"

    Push-Location back\docker
    try {
        docker-compose --env-file ..\.env up -d
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Backend database container started successfully"
            Write-Info "PostgreSQL is running on localhost:5432"
        } else {
            Write-ErrorMsg "Failed to start backend database container"
            Pop-Location
            exit 1
        }
    } catch {
        Write-ErrorMsg "Error starting database container: $_"
        Pop-Location
        exit 1
    }
    Pop-Location

    # Frontend container
    Write-Step "Starting frontend container..."
    Write-Info "Building and deploying frontend Docker container"

    Push-Location frontend\docker

    # Create frontend .env file
    @"
FRONTEND_PORT=$frontendPort
"@ | Set-Content -Path ".env"

    try {
        docker-compose up -d --build
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Frontend container started successfully"
            Write-Info "Frontend accessible at: http://localhost:$frontendPort"
        } else {
            Write-ErrorMsg "Failed to start frontend container"
            Pop-Location
            exit 1
        }
    } catch {
        Write-ErrorMsg "Error starting frontend container: $_"
        Pop-Location
        exit 1
    }

    Pop-Location
}

# ============================================================================
# PHASE 6: DATABASE MIGRATION AND SETUP
# ============================================================================

Write-Header "PHASE 6: Database Migration and Setup"

Push-Location back

Write-Step "Resetting Prisma migrations..."
Write-Info "This will drop the database and recreate it with the latest schema"
try {
    npx prisma migrate reset --force
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Database migrations applied successfully"
    } else {
        Write-ErrorMsg "Failed to apply database migrations"
        Pop-Location
        exit 1
    }
} catch {
    Write-ErrorMsg "Error during migration: $_"
    Pop-Location
    exit 1
}

Write-Step "Generating Prisma Client..."
try {
    npx prisma generate
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Prisma Client generated successfully"
    } else {
        Write-ErrorMsg "Failed to generate Prisma Client"
        Pop-Location
        exit 1
    }
} catch {
    Write-ErrorMsg "Error generating Prisma Client: $_"
    Pop-Location
    exit 1
}

# Database seeding
Write-Host ""
$seedChoice = Read-Host "  Would you like to seed the database with initial data? (y/n)"
if ($seedChoice -eq "y") {
    Write-Step "Seeding database with initial data..."
    
    # Check if seed file exists in utils_dev folder
    $utilsSeedPath = "..\utils_dev\seed.ts"
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
} else {
    Write-Info "Skipping database seeding"
}

Pop-Location

# ============================================================================
# PHASE 7: DEVELOPMENT SERVER STARTUP
# ============================================================================

Write-Header "PHASE 7: Starting Development Server"

Write-Step "Checking for processes on port $backendPort..."
$processOnPort = Get-NetTCPConnection -LocalPort $backendPort -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique

if ($processOnPort) {
    Write-Warning "Port $backendPort is currently in use"
    Write-Step "Terminating conflicting processes..."
    foreach ($processId in $processOnPort) {
        try {
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
            Write-Success "Terminated process with PID: $processId"
        } catch {
            Write-Warning "Could not terminate process $processId"
        }
    }
    Start-Sleep -Seconds 2
    Write-Success "Port $backendPort is now available"
} else {
    Write-Success "Port $backendPort is available"
}

Write-Step "Configuring Next.js development server..."
Push-Location back

$packageJsonPath = "package.json"
if (Test-Path -Path $packageJsonPath) {
    $packageJson = Get-Content -Path $packageJsonPath -Raw | ConvertFrom-Json
    $packageJson.scripts.dev = "next dev -p $backendPort"
    $packageJson | ConvertTo-Json -Depth 10 | Set-Content -Path $packageJsonPath
    Write-Success "Next.js configured to run on port $backendPort"
} else {
    Write-Warning "package.json not found, using default configuration"
}

# Display final summary
Write-Host ""
Write-Host "+====================================================================+" -ForegroundColor Green
Write-Host "|                                                                    |" -ForegroundColor Green
Write-Host "|              SETUP COMPLETED SUCCESSFULLY!                     |" -ForegroundColor White
Write-Host "|                                                                    |" -ForegroundColor Green
Write-Host "+====================================================================+" -ForegroundColor Green
Write-Host ""
Write-Host "  +--------------------------------------------------------------+" -ForegroundColor Cyan
Write-Host "  | Service Status                                           |" -ForegroundColor Cyan
Write-Host "  +--------------------------------------------------------------+" -ForegroundColor Cyan
Write-Host "  | [+] PostgreSQL Database       Running on port 5432       |" -ForegroundColor White
Write-Host "  | [+] Frontend Container        " -NoNewline -ForegroundColor White
Write-Host "http://localhost:$frontendPort".PadRight(26) -NoNewline -ForegroundColor Green
Write-Host "|" -ForegroundColor Cyan
Write-Host "  | [>] Backend API               " -NoNewline -ForegroundColor White
Write-Host "http://localhost:$backendPort".PadRight(26) -NoNewline -ForegroundColor Yellow
Write-Host "|" -ForegroundColor Cyan
Write-Host "  +--------------------------------------------------------------+" -ForegroundColor Cyan
Write-Host ""
Write-Host "  [i] Starting Next.js development server..." -ForegroundColor Blue
Write-Host "  [i] Press Ctrl+C to stop the server" -ForegroundColor Blue
Write-Host ""
Write-Host "---------------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""

pnpm run dev

Pop-Location
