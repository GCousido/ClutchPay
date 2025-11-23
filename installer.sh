#!/bin/bash

################################################################################
#                   ClutchPay Docker Installation Script
################################################################################
# Automated installation for Debian 11
# - PostgreSQL database
# - Next.js Backend API
# - Apache Frontend
################################################################################

set -Eeuo pipefail  # Exit on error, unset vars, and fail pipelines

# Get absolute path of this script
SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]}")"

# Check if running as root
IS_ROOT=false
if [ "$EUID" -eq 0 ]; then
    IS_ROOT=true
    SUDO_CMD=""
else
    SUDO_CMD="sudo"
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} ${GREEN}$1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} ${YELLOW}$1${NC}"
}

log_error() {
    echo -e "${RED}✗${NC} ${RED}$1${NC}"
}

log_header() {
    echo -e "\n${MAGENTA}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${MAGENTA}${BOLD}  $1${NC}"
    echo -e "${MAGENTA}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

log_step() {
    echo -e "${CYAN}▶${NC} $1"
}

# Global state flags for cleanup
REPO_CLONED=false
DB_STARTED=false
FRONTEND_STARTED=false
SERVICE_INSTALLED=false
SUCCESS=false

# Cleanup routine on any failure
cleanup() {
    log_warning "Installation failed. Starting cleanup..."

    # Stop and remove backend systemd service if created
    if [ "$SERVICE_INSTALLED" = true ]; then
        log_step "Removing systemd service clutchpay-backend..."
        $SUDO_CMD systemctl stop clutchpay-backend.service > /dev/null 2>&1 || true
        $SUDO_CMD systemctl disable clutchpay-backend.service > /dev/null 2>&1 || true
        $SUDO_CMD rm -f /etc/systemd/system/clutchpay-backend.service || true
        $SUDO_CMD systemctl daemon-reload > /dev/null 2>&1 || true
    fi

    # Bring down frontend container
    if [ "$FRONTEND_STARTED" = true ] && [ -d "${FRONTEND_DIR:-}/docker" ]; then
        log_step "Stopping frontend containers..."
        (cd "${FRONTEND_DIR:-}/docker" && docker compose down -v --rmi local > /dev/null 2>&1) || true
    fi

    # Bring down database container
    if [ "$DB_STARTED" = true ] && [ -d "${BACKEND_DIR:-}/docker" ]; then
        log_step "Stopping database containers..."
        (cd "${BACKEND_DIR:-}/docker" && docker compose down -v > /dev/null 2>&1) || true
    fi

    # Remove cloned repository if we created it in this run
    if [ "$REPO_CLONED" = true ] && [ -d "${INSTALL_DIR:-}" ]; then
        log_step "Removing installation directory $INSTALL_DIR..."
        $SUDO_CMD rm -rf "${INSTALL_DIR:-}" || true
    fi

    log_error "Cleanup complete. Please review logs and retry."
}

on_error() {
    local line=$1
    log_error "Error at line ${line}: '${BASH_COMMAND}'"
    cleanup
    exit 1
}

trap 'on_error $LINENO' ERR
trap 'cleanup; exit 1' INT TERM

# Configuration
INSTALL_DIR="/opt/clutchpay"
BACKEND_SUBDIR="back"
BACKEND_DIR="$INSTALL_DIR/$BACKEND_SUBDIR"
FRONTEND_DIR="$INSTALL_DIR/frontend"
BACKEND_PORT=3000
FRONTEND_PORT=80

# Database credentials (from .env defaults)
DB_NAME="clutchpay_db"
DB_USER="clutchpay_user"
DB_PASSWORD="clutchpay_pass"

################################################################################
# Banner
################################################################################
clear
echo -e "${CYAN}${BOLD}"
cat << "EOF"
   _____ _       _       _     ____
  / ____| |     | |     | |   |  _ \
 | |    | |_   _| |_ ___| |__ | |_) | __ _ _   _
 | |    | | | | | __/ __| '_ \|  _ / / _` | | | |
 | |____| | |_| | || (__| | | | |   | (_| | |_| |
  \_____|_|\__,_|\__\___|_| |_| |   \__,_|\__, |
                                            __/ |
   Docker Installation Script - Debian 11  |___/
EOF
echo -e "${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

################################################################################
# Check sudo availability
################################################################################
log_header "Checking Privileges"

if [ "$EUID" -eq 0 ]; then
    # Running as root
    SUDO_CMD=""
    log_success "Running as root"
elif command -v sudo &> /dev/null; then
    # sudo exists, check if we can use it without password
    if sudo -n true 2>/dev/null; then
        SUDO_CMD="sudo"
        log_success "sudo privileges already cached"
    else
        # Need to ask for sudo password
        log_info "This installation requires administrative privileges."
        echo -e "${YELLOW}Please enter your sudo password:${NC}"
        if ! sudo -v; then
            log_error "Failed to obtain sudo privileges"
            exit 1
        fi
        SUDO_CMD="sudo"
        log_success "sudo privileges obtained"
    fi
else
    # sudo doesn't exist
    log_error "sudo is not installed and you are not root"
    log_info "Please install sudo with: ${CYAN}su -c 'apt-get update && apt-get install -y sudo'${NC}"
    log_info "Then add your user to sudo group: ${CYAN}su -c 'usermod -aG sudo $USER'${NC}"
    log_info "After that, log out and log back in, then run this script again."
    exit 1
fi

################################################################################
# Ensure basic system tools are available
################################################################################
log_header "Verifying Essential Tools"

# Check and install basic tools that might be missing
ESSENTIAL_TOOLS_MISSING=false

# Check for dpkg (should always be present, but verify)
if ! command -v dpkg &> /dev/null; then
    log_error "dpkg not found. This script requires a Debian-based system."
    exit 1
fi

# Check for tee (used for creating systemd service)
if ! command -v tee &> /dev/null; then
    log_step "Installing coreutils (includes tee)..."
    $SUDO_CMD apt-get update -qq
    $SUDO_CMD apt-get install -y coreutils > /dev/null 2>&1
    log_success "coreutils installed"
fi

# Check for sed (used for frontend configuration)
if ! command -v sed &> /dev/null; then
    log_step "Installing sed..."
    $SUDO_CMD apt-get install -y sed > /dev/null 2>&1
    log_success "sed installed"
fi

# Check for grep (used throughout the script)
if ! command -v grep &> /dev/null; then
    log_step "Installing grep..."
    $SUDO_CMD apt-get install -y grep > /dev/null 2>&1
    log_success "grep installed"
fi

# Check for systemctl (systemd)
if ! command -v systemctl &> /dev/null; then
    log_error "systemctl not found. This script requires systemd."
    exit 1
fi

log_success "All essential system tools are available"

################################################################################
# Check System
################################################################################
log_header "Checking System Requirements"

# Check Debian
if [ ! -f /etc/debian_version ]; then
    log_error "This script requires Debian 11"
    exit 1
fi

log_success "Running on Debian $(cat /etc/debian_version)"

################################################################################
# Install Dependencies
################################################################################
log_header "Installing System Dependencies"

# Update package list
log_step "Updating package lists..."
$SUDO_CMD apt-get update -qq

# Install curl
if ! command -v curl &> /dev/null; then
    log_step "Installing curl..."
    $SUDO_CMD apt-get install -y curl > /dev/null 2>&1
    log_success "curl installed"
else
    log_success "curl already installed"
fi

# Install Git
if ! command -v git &> /dev/null; then
    log_step "Installing Git..."
    $SUDO_CMD apt-get install -y git > /dev/null 2>&1
    log_success "Git installed"
else
    log_success "Git already installed"
fi

# Install Docker
if ! command -v docker &> /dev/null; then
    log_step "Installing Docker..."
    
    $SUDO_CMD apt-get install -y ca-certificates gnupg > /dev/null 2>&1
    
    $SUDO_CMD install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/debian/gpg | $SUDO_CMD gpg --dearmor -o /etc/apt/keyrings/docker.gpg > /dev/null 2>&1
    $SUDO_CMD chmod a+r /etc/apt/keyrings/docker.gpg
    
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      $SUDO_CMD tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    $SUDO_CMD apt-get update -qq
    $SUDO_CMD apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin > /dev/null 2>&1
    
    $SUDO_CMD systemctl start docker
    $SUDO_CMD systemctl enable docker > /dev/null 2>&1
    
    # Add current user to docker group if not root
    if [ "$EUID" -ne 0 ]; then
        $SUDO_CMD usermod -aG docker $USER
        log_success "Docker installed"
        log_success "User '$USER' added to docker group"
        
        # Activate the docker group immediately without logout
        log_info "Activating docker group for current session..."
        exec sudo -u $USER bash -c "SCRIPT_PATH='$SCRIPT_PATH' bash '$SCRIPT_PATH' $*"
    fi
    
    log_success "Docker installed and started"
else
    log_success "Docker already installed"
    
    # Check if docker daemon is running
    if ! systemctl is-active --quiet docker; then
        $SUDO_CMD systemctl start docker
    fi
    
    # Check if user has docker permissions (only if not root)
    if [ "$EUID" -ne 0 ]; then
        if ! docker ps > /dev/null 2>&1; then
            log_warning "Docker permissions issue detected"
            
            # Check if user is in docker group
            if ! groups $USER | grep -q '\bdocker\b'; then
                log_step "Adding user '$USER' to docker group..."
                $SUDO_CMD usermod -aG docker $USER
                log_success "User added to docker group"
            fi
            
            # Activate the docker group immediately without logout
            log_info "Activating docker group for current session..."
            exec sudo -u $USER bash -c "SCRIPT_PATH='$SCRIPT_PATH' bash '$SCRIPT_PATH' $*"
        fi
    fi
fi

# Install Node.js 20.x
log_step "Checking Node.js version..."
NODE_INSTALLED=false
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 20 ]; then
        NODE_INSTALLED=true
        log_success "Node.js $(node --version) already installed"
    fi
fi

if [ "$NODE_INSTALLED" = "false" ]; then
    log_step "Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO_CMD bash - > /dev/null 2>&1
    $SUDO_CMD apt-get install -y nodejs > /dev/null 2>&1
    log_success "Node.js $(node --version) installed"
fi

# Install pnpm
if ! command -v pnpm &> /dev/null; then
    log_step "Installing pnpm..."
    if command -v corepack &> /dev/null; then
        $SUDO_CMD corepack enable > /dev/null 2>&1
        $SUDO_CMD corepack prepare pnpm@latest --activate > /dev/null 2>&1
    else
        $SUDO_CMD npm install -g pnpm > /dev/null 2>&1
    fi
    log_success "pnpm installed"
else
    log_success "pnpm already installed"
fi

################################################################################
# Clone Repository
################################################################################
log_header "Downloading ClutchPay"

REPO_URL="https://github.com/GCousido/ClutchPay.git"
REPO_BRANCH="production"

if [ -d "$INSTALL_DIR" ]; then
    log_warning "Installation directory exists. Backing up..."
    $SUDO_CMD mv "$INSTALL_DIR" "${INSTALL_DIR}.backup.$(date +%s)"
fi

log_step "Cloning from GitHub ($REPO_BRANCH branch)..."
$SUDO_CMD git clone --branch "$REPO_BRANCH" --depth 1 "$REPO_URL" "$INSTALL_DIR" > /dev/null 2>&1 || { log_error "Git clone failed"; exit 1; }
REPO_CLONED=true
log_success "Repository cloned to $INSTALL_DIR"

# Set proper ownership if not running as root
if [ "$IS_ROOT" = false ]; then
    log_step "Setting proper ownership..."
    $SUDO_CMD chown -R $USER:$USER "$INSTALL_DIR"
fi

# Validate expected directories
if [ ! -d "$BACKEND_DIR" ]; then
    log_error "Backend directory '$BACKEND_SUBDIR' not found inside repository. Aborting to avoid creating an empty backend."; cleanup; exit 1;
fi
if [ ! -d "$FRONTEND_DIR" ]; then
    log_error "Frontend directory 'frontend' not found inside repository. Aborting."; cleanup; exit 1;
fi
log_success "Verified backend and frontend directories exist"

################################################################################
# Configure Backend
################################################################################
log_header "Configuring Backend"

cd "$BACKEND_DIR"

# Generate secrets
log_step "Generating secure secrets..."
# Check if openssl is available
if ! command -v openssl &> /dev/null; then
    log_step "Installing openssl..."
    $SUDO_CMD apt-get install -y openssl > /dev/null 2>&1
fi

JWT_SECRET=$(openssl rand -base64 32)
NEXTAUTH_SECRET=$(openssl rand -base64 32)

# Create .env file
log_step "Creating backend .env file..."
cat > "$BACKEND_DIR/.env" << EOF
# Database Configuration
POSTGRES_DB=${DB_NAME}
POSTGRES_USER=${DB_USER}
POSTGRES_PASSWORD=${DB_PASSWORD}
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}?schema=public"

# Server Configuration
BACKEND_PORT=${BACKEND_PORT}
NODE_ENV=production
NEXT_PUBLIC_API_URL=http://localhost:${BACKEND_PORT}

# Authentication
NEXTAUTH_URL=http://localhost:${BACKEND_PORT}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
JWT_SECRET=${JWT_SECRET}

# Frontend
FRONTEND_URL=http://localhost:${FRONTEND_PORT}
FRONTEND_PORT=${FRONTEND_PORT}
EOF

log_success "Backend .env created with secure secrets"

# Create Docker .env for database
cat > "$BACKEND_DIR/docker/.env" << EOF
POSTGRES_DB=${DB_NAME}
POSTGRES_USER=${DB_USER}
POSTGRES_PASSWORD=${DB_PASSWORD}
EOF

log_success "Docker .env created"

################################################################################
# Start Database
################################################################################
log_header "Starting PostgreSQL Database"

cd "$BACKEND_DIR/docker"
log_step "Starting PostgreSQL container..."
docker compose up -d
DB_STARTED=true
sleep 3

# Wait for database
log_step "Waiting for database to be ready..."
DB_READY=false
for i in {1..30}; do
    if docker compose exec -T postgres pg_isready -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
        log_success "Database is ready!"
        DB_READY=true
        break
    fi
    sleep 1
done
if [ "$DB_READY" != true ]; then
    log_error "Database did not become ready in time"
    cleanup
    exit 1
fi

################################################################################
# Build Backend
################################################################################
log_header "Building Backend Application"

cd "$BACKEND_DIR"

log_step "Installing dependencies ..."
if ! pnpm install --frozen-lockfile 2>&1 | grep -v "Progress\|Resolving\|Downloading" | tail -10; then
    log_error "Dependency installation failed"
    cleanup
    exit 1
fi
log_success "Dependencies installed"

log_step "Generating Prisma Client..."
pnpm prisma generate > /dev/null 2>&1
log_success "Prisma Client generated"

log_step "Running database migrations..."
pnpm prisma migrate deploy > /dev/null 2>&1
log_success "Database migrations completed"

log_step "Building Next.js application (standalone mode)..."
# Ensure FRONTEND_URL is available during build for CORS config
export FRONTEND_URL="http://localhost:${FRONTEND_PORT}"
if ! pnpm build 2>&1 | tee /tmp/clutchpay-build.log | tail -20; then
    log_error "Build failed. Last 20 lines of output shown above."
    log_error "Full build log saved to: /tmp/clutchpay-build.log"
    cleanup
    exit 1
fi

if [ ! -f "$BACKEND_DIR/.next/standalone/server.js" ]; then
    log_error "Build completed but server.js not found in .next/standalone/"
    log_error "This may indicate output:'standalone' is missing in next.config.ts"
    cleanup
    exit 1
fi

log_success "Backend built successfully"

################################################################################
# Configure Frontend
################################################################################
log_header "Configuring Frontend"

cd "$FRONTEND_DIR"

# Update frontend JS to point to correct backend
log_step "Configuring frontend API endpoint..."
if [ -f "$FRONTEND_DIR/JS/auth.js" ]; then
    sed -i "s|const API_BASE_URL = .*|const API_BASE_URL = 'http://localhost:${BACKEND_PORT}';|g" "$FRONTEND_DIR/JS/auth.js"
fi

# Create Docker .env
cat > "$FRONTEND_DIR/docker/.env" << EOF
FRONTEND_PORT=${FRONTEND_PORT}
EOF

log_success "Frontend configured"

################################################################################
# Start Frontend
################################################################################
log_header "Starting Frontend (Apache)"

cd "$FRONTEND_DIR/docker"
log_step "Building and starting Apache container..."
docker compose up -d --build > /dev/null 2>&1
FRONTEND_STARTED=true
log_success "Frontend container started"

################################################################################
# Create Systemd Service for Backend
################################################################################
log_header "Creating Backend Service"

log_step "Creating systemd service..."
$SUDO_CMD tee /etc/systemd/system/clutchpay-backend.service > /dev/null << EOF
[Unit]
Description=ClutchPay Backend API
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
WorkingDirectory=$BACKEND_DIR
EnvironmentFile=$BACKEND_DIR/.env
ExecStart=/usr/bin/node $BACKEND_DIR/.next/standalone/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
SERVICE_INSTALLED=true

$SUDO_CMD systemctl daemon-reload
$SUDO_CMD systemctl enable clutchpay-backend.service > /dev/null 2>&1
$SUDO_CMD systemctl start clutchpay-backend.service

log_success "Backend service created and started"

################################################################################
# Installation Complete
################################################################################
log_header "Installation Complete! 🎉"

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}${BOLD}  ClutchPay has been successfully installed!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${CYAN}📂 Installation Directory:${NC}"
echo -e "   ${INSTALL_DIR}\n"

echo -e "${CYAN}🌐 Access URLs:${NC}"
echo -e "   Frontend: ${GREEN}http://localhost:${FRONTEND_PORT}${NC}"
echo -e "   Backend:  ${GREEN}http://localhost:${BACKEND_PORT}${NC}\n"

echo -e "${CYAN}🗄️  Database:${NC}"
echo -e "   Type:     PostgreSQL 15 (Docker)"
echo -e "   Port:     5432"
echo -e "   Database: ${DB_NAME}"
echo -e "   User:     ${DB_USER}\n"

echo -e "${CYAN}🔧 Service Management:${NC}"
echo -e "   ${YELLOW}Backend:${NC}"
echo -e "     systemctl status clutchpay-backend"
echo -e "     systemctl restart clutchpay-backend"
echo -e "     journalctl -u clutchpay-backend -f\n"

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Thank you for installing ClutchPay!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
