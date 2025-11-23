#######################################################################
####### PowerShell Script for Setting Up Development Environment ######
#######################################################################

#### Use the following command to run this script if execution policies prevent it:
# Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
# .\setup.ps1

# Check if Node.js is installed
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js is not installed. Please install Node.js before continuing." -ForegroundColor Red
    exit 1
}

# Get Node.js version
$nodeVersion = node --version
# Remove the 'v' prefix
$nodeVersionNumber = $nodeVersion.TrimStart("v")

# Define minimum version required
$minVersion = "20.9.0"

# Compare versions
if ([version]$nodeVersionNumber -lt [version]$minVersion) {
    Write-Host "Node.js version is $nodeVersionNumber. Please upgrade to version $minVersion or higher." -ForegroundColor Red
    exit 1
} else {
    Write-Host "Node.js version $nodeVersionNumber is sufficient."
}

# Check if Docker is installed
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker is not installed. Please install Docker before continuing." -ForegroundColor Red
    exit 1
}

# Verify Docker daemon is running
try {
    docker info > $null 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Docker daemon is not running. Please start Docker before continuing." -ForegroundColor Red
        exit 1
    } else {
        Write-Host "Docker daemon is running."
    }
} catch {
    Write-Host "Failed to communicate with Docker daemon. Please ensure Docker is running." -ForegroundColor Red
    exit 1
}

# Check if Docker Compose is installed
if (-not (Get-Command docker-compose -ErrorAction SilentlyContinue)) {
    Write-Host "Docker Compose is not installed. Please install Docker Compose before continuing." -ForegroundColor Red
    exit 1
}

# Ask user for port configuration FIRST
Write-Host "`n=== Port Configuration ===" -ForegroundColor Cyan
$backendPort = Read-Host "Enter the port for backend API (default: 3000)"
if ([string]::IsNullOrWhiteSpace($backendPort)) {
    $backendPort = "3000"
}

$frontendPort = Read-Host "Enter the port for frontend (default: 5050)"
if ([string]::IsNullOrWhiteSpace($frontendPort)) {
    $frontendPort = "5050"
}

Write-Host "Backend will run on: http://localhost:$backendPort" -ForegroundColor Green
Write-Host "Frontend will run on: http://localhost:$frontendPort" -ForegroundColor Green

# Verify and install pnpm if it is not installed
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "pnpm not found, global install..."
    npm install -g pnpm
} else {
    Write-Host "pnpm already installed"
}

# Installing dependencies with pnpm in backend folder
Write-Host "Installing backend dependencies with pnpm..."
Push-Location back
pnpm install
Pop-Location

# Check if .env file exists
if (-not (Test-Path -Path "back\.env")) {
    # Ask user if they want to create an .env file with basic Prisma variables
    $createEnv = Read-Host "`nNo .env file found. Do you want to create a .env file with basic Prisma environment variables? (y/n)"
    if ($createEnv -eq "y") {
        $envContent = @"
POSTGRES_DB=clutchpay_db
POSTGRES_USER=clutchpay_user
POSTGRES_PASSWORD=clutchpay_pass

DATABASE_URL=postgresql://clutchpay_user:clutchpay_pass@localhost:5432/clutchpay_db?schema=public

NEXT_PUBLIC_API_URL=http://localhost:$backendPort
NEXTAUTH_URL=http://localhost:$backendPort
NEXTAUTH_SECRET=your-secret-key-change-this-in-production

BACKEND_PORT=$backendPort
FRONTEND_PORT=$frontendPort
FRONTEND_URL=http://localhost:$frontendPort
"@
        Set-Content -Path "back\.env" -Value $envContent
        Write-Host ".env file created with Prisma and Next.js variables."
    } else {
        Write-Host "Skipping .env creation."
    }
} else {
    Write-Host ".env file already exists, updating port configuration..." -ForegroundColor Yellow
    
    # Update or add port variables in existing .env
    $envContent = Get-Content -Path "back\.env" -Raw
    
    # Update NEXT_PUBLIC_API_URL
    if ($envContent -match "NEXT_PUBLIC_API_URL=.*") {
        $envContent = $envContent -replace "NEXT_PUBLIC_API_URL=.*", "NEXT_PUBLIC_API_URL=http://localhost:$backendPort"
    } else {
        $envContent += "`nNEXT_PUBLIC_API_URL=http://localhost:$backendPort"
    }
    
    # Update NEXTAUTH_URL
    if ($envContent -match "NEXTAUTH_URL=.*") {
        $envContent = $envContent -replace "NEXTAUTH_URL=.*", "NEXTAUTH_URL=http://localhost:$backendPort"
    } else {
        $envContent += "`nNEXTAUTH_URL=http://localhost:$backendPort"
    }
    
    # Update BACKEND_PORT
    if ($envContent -match "BACKEND_PORT=.*") {
        $envContent = $envContent -replace "BACKEND_PORT=.*", "BACKEND_PORT=$backendPort"
    } else {
        $envContent += "`nBACKEND_PORT=$backendPort"
    }
    
    # Update FRONTEND_PORT
    if ($envContent -match "FRONTEND_PORT=.*") {
        $envContent = $envContent -replace "FRONTEND_PORT=.*", "FRONTEND_PORT=$frontendPort"
    } else {
        $envContent += "`nFRONTEND_PORT=$frontendPort"
    }
    
    # Update FRONTEND_URL
    if ($envContent -match "FRONTEND_URL=.*") {
        $envContent = $envContent -replace "FRONTEND_URL=.*", "FRONTEND_URL=http://localhost:$frontendPort"
    } else {
        $envContent += "`nFRONTEND_URL=http://localhost:$frontendPort"
    }
    
    Set-Content -Path "back\.env" -Value $envContent
    Write-Host "Port configuration updated in .env file."
}

# Update frontend API URL configuration
Write-Host "`nUpdating frontend API configuration..." -ForegroundColor Cyan
$authJsPath = "frontend\JS\auth.js"
if (Test-Path -Path $authJsPath) {
    $authContent = Get-Content -Path $authJsPath -Raw
    $authContent = $authContent -replace "this\.API_BASE_URL = 'http://localhost:\d+'", "this.API_BASE_URL = 'http://localhost:$backendPort'"
    Set-Content -Path $authJsPath -Value $authContent
    Write-Host "Frontend API URL updated to http://localhost:$backendPort"
}

# Move to backend docker folder and start backend containers
Write-Host "`nStarting backend Docker containers..." -ForegroundColor Cyan
Push-Location back\docker
docker-compose --env-file ..\.env up -d
Pop-Location

# Start frontend Docker containers
Write-Host "Starting frontend Docker containers..." -ForegroundColor Cyan
Push-Location frontend\docker

# Create .env file for frontend docker-compose
@"
FRONTEND_PORT=$frontendPort
"@ | Set-Content -Path ".env"

Write-Host "Configured frontend to run on port: $frontendPort" -ForegroundColor Green

# Build and start frontend container
docker-compose up -d --build

if ($LASTEXITCODE -eq 0) {
    Write-Host "Frontend Docker container started successfully!" -ForegroundColor Green
    Write-Host "Frontend available at: http://localhost:$frontendPort" -ForegroundColor Green
} else {
    Write-Host "Failed to start frontend Docker container. Error code: $LASTEXITCODE" -ForegroundColor Red
}

Pop-Location

# Initialize Prisma migration
Write-Host "Execute Prisma migration ..."
Push-Location back
npx prisma migrate reset --force

# Generate Prisma client
Write-Host "Generating Prisma client..."
npx prisma generate

# Optionally add seed data to database
$seedChoice = Read-Host "Do you want to add seed data to the database? (y/n)"
if ($seedChoice -eq "y") {
    Write-Host "Adding seed data to database..."
    npx tsx prisma/seed.ts
} else {
    Write-Host "Skipping seed data step."
}
Pop-Location

Write-Host "`n=== Starting Development Servers ===" -ForegroundColor Cyan
Write-Host "Backend API: http://localhost:$backendPort" -ForegroundColor Green
Write-Host "Frontend: http://localhost:$frontendPort" -ForegroundColor Green

# Kill any process using the backend port
Write-Host "`nChecking if port $backendPort is in use..." -ForegroundColor Cyan
$processOnPort = Get-NetTCPConnection -LocalPort $backendPort -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($processOnPort) {
    Write-Host "Port $backendPort is in use. Killing process(es)..." -ForegroundColor Yellow
    foreach ($pid in $processOnPort) {
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        Write-Host "Killed process with PID: $pid" -ForegroundColor Yellow
    }
    Start-Sleep -Seconds 2
}

Write-Host "`nStarting Next.js development server..." -ForegroundColor Cyan

# Update package.json dev script with custom port
Push-Location back
$packageJsonPath = "package.json"
if (Test-Path -Path $packageJsonPath) {
    $packageJson = Get-Content -Path $packageJsonPath -Raw | ConvertFrom-Json
    $packageJson.scripts.dev = "next dev -p $backendPort"
    $packageJson | ConvertTo-Json -Depth 10 | Set-Content -Path $packageJsonPath
}

pnpm run dev
Pop-Location