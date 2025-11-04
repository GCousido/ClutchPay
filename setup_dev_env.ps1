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

# Verify and install pnpm if it is not installed
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "pnpm not found, global install..."
    npm install -g pnpm
} else {
    Write-Host "pnpm already installed"
}

# Installing dependencies with pnpm
Write-Host "Installing dependencies with pnpm..."
pnpm install

# Check if .env file exists
if (-not (Test-Path -Path ".env")) {
    # Ask user if they want to create an .env file with basic Prisma variables
    $createEnv = Read-Host "No .env file found. Do you want to create a .env file with basic Prisma environment variables? (y/n)"
    if ($createEnv -eq "y") {
        $envContent = @"
POSTGRES_DB=clutchpay_db
POSTGRES_USER=clutchpay_user
POSTGRES_PASSWORD=clutchpay_pass

DATABASE_URL=postgresql://clutchpay_user:clutchpay_pass@localhost:5432/clutchpay_db?schema=public

NEXT_PUBLIC_API_URL=http://localhost:3000
"@
        Set-Content -Path ".env" -Value $envContent
        Write-Host ".env file created with Prisma and Next.js variables."
    } else {
        Write-Host "Skipping .env creation."
    }
} else {
    Write-Host ".env file already exists, skipping creation."
}

# Move to docker folder and start containers
Write-Host "Moving to docker folder and starting containers ..."
Push-Location docker
docker-compose --env-file ../.env up -d
Pop-Location

# Initialize Prisma migration
Write-Host "Execute Prisma migration ..."
npx prisma migrate dev --name init

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
Write-Host "App running at http://localhost:3000"
Write-Host "Start development server..."
pnpm run dev

#######################################################################
# Execute Server in development mode with pnpm
Write-Host "Start development server..."
pnpm run dev

Write-Host "App running at http://localhost:3000"
#######################################################################