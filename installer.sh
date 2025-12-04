#!/bin/bash

################################################################################
#                   ClutchPay Native Installation Script
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
DB_CONFIGURED=false
APACHE_CONFIGURED=false
SERVICE_INSTALLED=false
SUCCESS=false

# Cleanup routine on any failure
cleanup() {
    if [ "$SUCCESS" = true ]; then
        return
    fi
    
    log_warning "Installation failed. Starting cleanup..."

    # Stop and remove backend systemd service if created
    if [ "$SERVICE_INSTALLED" = true ]; then
        log_step "Removing systemd service clutchpay-backend..."
        $SUDO_CMD systemctl stop clutchpay-backend.service > /dev/null 2>&1 || true
        $SUDO_CMD systemctl disable clutchpay-backend.service > /dev/null 2>&1 || true
        $SUDO_CMD rm -f /etc/systemd/system/clutchpay-backend.service || true
        $SUDO_CMD systemctl daemon-reload > /dev/null 2>&1 || true
    fi

    # Remove Apache config if created
    if [ "$APACHE_CONFIGURED" = true ]; then
        log_step "Removing Apache configuration..."
        $SUDO_CMD a2dissite clutchpay.conf > /dev/null 2>&1 || true
        $SUDO_CMD rm -f /etc/apache2/sites-available/clutchpay.conf || true
        $SUDO_CMD systemctl reload apache2 > /dev/null 2>&1 || true
    fi

    # Remove database if created
    if [ "$DB_CONFIGURED" = true ]; then
        log_step "Removing database..."
        $SUDO_CMD -u postgres psql -c "DROP DATABASE IF EXISTS ${DB_NAME};" > /dev/null 2>&1 || true
        $SUDO_CMD -u postgres psql -c "DROP USER IF EXISTS ${DB_USER};" > /dev/null 2>&1 || true
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
  \_____|_|\__,_|\__\___|_| |_| |   \__,_|\__,  |
                                            __/ |
          Installation Script - Debian 11  |___/
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

################################################################################
# Detect Server IP Address
################################################################################
log_header "Detecting Server IP Address"

# Get the primary IP address (not 127.0.0.1)
SERVER_IP=$(hostname -I | awk '{print $1}')

if [ -z "$SERVER_IP" ]; then
    log_warning "Could not auto-detect IP address"
    echo -e "${YELLOW}Please enter the server IP address:${NC}"
    read -r SERVER_IP
fi

log_success "Server IP detected: $SERVER_IP"
echo -e "${YELLOW}Is this IP correct? (y/n)${NC}"
read -r confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo -e "${YELLOW}Please enter the correct server IP address:${NC}"
    read -r SERVER_IP
    log_success "Using IP: $SERVER_IP"
fi

################################################################################
# Install PostgreSQL (Native - No Docker)
################################################################################
log_header "Installing PostgreSQL (Native)"

if ! command -v psql &> /dev/null; then
    log_step "Installing PostgreSQL..."
    $SUDO_CMD apt-get install -y postgresql postgresql-contrib > /dev/null 2>&1
    log_success "PostgreSQL installed"
else
    log_success "PostgreSQL already installed"
fi

# Ensure PostgreSQL is running
log_step "Starting PostgreSQL service..."
$SUDO_CMD systemctl start postgresql
$SUDO_CMD systemctl enable postgresql > /dev/null 2>&1
log_success "PostgreSQL service started"

# Configure database
log_step "Configuring database..."
DB_CONFIGURED=true

# Check if user already exists
if $SUDO_CMD -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
    log_info "Database user ${DB_USER} already exists"
else
    $SUDO_CMD -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';" > /dev/null 2>&1
    log_success "Database user created"
fi

# Check if database already exists
if $SUDO_CMD -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
    log_info "Database ${DB_NAME} already exists"
else
    $SUDO_CMD -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" > /dev/null 2>&1
    log_success "Database created"
fi

# Grant privileges
$SUDO_CMD -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" > /dev/null 2>&1
log_success "Database configured: ${DB_NAME}"

################################################################################
# Install Apache (Native - No Docker)
################################################################################
log_header "Installing Apache (Native)"

if ! command -v apache2 &> /dev/null; then
    log_step "Installing Apache..."
    $SUDO_CMD apt-get install -y apache2 > /dev/null 2>&1
    log_success "Apache installed"
else
    log_success "Apache already installed"
fi

# Enable required modules
log_step "Enabling Apache modules..."
$SUDO_CMD a2enmod proxy proxy_http rewrite headers > /dev/null 2>&1
log_success "Apache modules enabled"

# Start Apache
log_step "Starting Apache service..."
$SUDO_CMD systemctl start apache2
$SUDO_CMD systemctl enable apache2 > /dev/null 2>&1
log_success "Apache service started"

################################################################################
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
REPO_TAG="primera-entrega"

if [ -d "$INSTALL_DIR" ]; then
    log_warning "Installation directory exists. Backing up..."
    $SUDO_CMD mv "$INSTALL_DIR" "${INSTALL_DIR}.backup.$(date +%s)"
fi

log_step "Cloning from GitHub (tag: $REPO_TAG)..."
$SUDO_CMD git clone --branch "$REPO_TAG" --depth 1 "$REPO_URL" "$INSTALL_DIR" > /dev/null 2>&1 || { log_error "Git clone failed"; exit 1; }
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
NEXT_PUBLIC_API_URL=http://${SERVER_IP}:${BACKEND_PORT}

# Authentication - Using SERVER_IP for external access
NEXTAUTH_URL=http://${SERVER_IP}:${BACKEND_PORT}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
JWT_SECRET=${JWT_SECRET}

# Frontend
FRONTEND_URL=http://${SERVER_IP}:${FRONTEND_PORT}
FRONTEND_PORT=${FRONTEND_PORT}
SERVER_IP=${SERVER_IP}
EOF

log_success "Backend .env created"

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
# Set environment variables for build
export FRONTEND_URL="http://${SERVER_IP}:${FRONTEND_PORT}"
export SERVER_IP="${SERVER_IP}"

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


################################################################################
# Configure Apache Virtual Host
################################################################################
log_header "Configuring Apache Virtual Host"

APACHE_CONFIGURED=true

# Copy frontend files to Apache document root
APACHE_DOC_ROOT="/var/www/clutchpay"
log_step "Copying frontend files to ${APACHE_DOC_ROOT}..."
$SUDO_CMD mkdir -p "$APACHE_DOC_ROOT"
$SUDO_CMD cp -r "$FRONTEND_DIR"/* "$APACHE_DOC_ROOT/"
$SUDO_CMD chown -R www-data:www-data "$APACHE_DOC_ROOT"
log_success "Frontend files copied"

# Create Apache virtual host configuration
log_step "Creating Apache virtual host configuration..."
$SUDO_CMD tee /etc/apache2/sites-available/clutchpay.conf > /dev/null << EOF
<VirtualHost *:${FRONTEND_PORT}>
    ServerName ${SERVER_IP}
    ServerAdmin webmaster@localhost
    DocumentRoot ${APACHE_DOC_ROOT}

    <Directory ${APACHE_DOC_ROOT}>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog \${APACHE_LOG_DIR}/clutchpay-error.log
    CustomLog \${APACHE_LOG_DIR}/clutchpay-access.log combined
</VirtualHost>
EOF

# Disable default site and enable clutchpay
log_step "Enabling ClutchPay site..."
$SUDO_CMD a2dissite 000-default.conf > /dev/null 2>&1 || true
$SUDO_CMD a2ensite clutchpay.conf > /dev/null 2>&1

# Test Apache configuration
log_step "Testing Apache configuration..."
if ! $SUDO_CMD apache2ctl configtest 2>&1 | grep -q "Syntax OK"; then
    log_error "Apache configuration test failed"
    cleanup
    exit 1
fi

# Reload Apache
$SUDO_CMD systemctl reload apache2
log_success "Apache configured and reloaded"

################################################################################
# Create Systemd Service for Backend
################################################################################
log_header "Creating Backend Service"

log_step "Creating systemd service..."
$SUDO_CMD tee /etc/systemd/system/clutchpay-backend.service > /dev/null << EOF
[Unit]
Description=ClutchPay Backend API
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
WorkingDirectory=$BACKEND_DIR
EnvironmentFile=$BACKEND_DIR/.env
ExecStart=/usr/bin/node $BACKEND_DIR/.next/standalone/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment=NODE_ENV=production
Environment=HOSTNAME=0.0.0.0

[Install]
WantedBy=multi-user.target
EOF
SERVICE_INSTALLED=true

$SUDO_CMD systemctl daemon-reload
$SUDO_CMD systemctl enable clutchpay-backend.service > /dev/null 2>&1
$SUDO_CMD systemctl start clutchpay-backend.service

# Wait for backend to start
log_step "Waiting for backend to start..."
sleep 5

if $SUDO_CMD systemctl is-active --quiet clutchpay-backend.service; then
    log_success "Backend service created and started"
else
    log_warning "Backend service may have issues. Check with: journalctl -u clutchpay-backend -f"
fi

################################################################################
# Configure Firewall (if ufw is installed)
################################################################################
if command -v ufw &> /dev/null; then
    log_header "Configuring Firewall"
    
    log_step "Opening ports 80 and ${BACKEND_PORT}..."
    $SUDO_CMD ufw allow 80/tcp > /dev/null 2>&1 || true
    $SUDO_CMD ufw allow ${BACKEND_PORT}/tcp > /dev/null 2>&1 || true
    log_success "Firewall rules added"
fi

################################################################################
# Installation Complete
################################################################################
SUCCESS=true
log_header "Installation Complete! 🎉"

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}${BOLD}  ClutchPay has been successfully installed!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${CYAN}📂 Installation Directory:${NC}"
echo -e "   ${INSTALL_DIR}\n"

echo -e "${CYAN}🌐 Access URLs:${NC}"
echo -e "   Frontend: ${GREEN}http://${SERVER_IP}:${FRONTEND_PORT}${NC}"
echo -e "   Backend:  ${GREEN}http://${SERVER_IP}:${BACKEND_PORT}${NC}\n"

echo -e "${CYAN}🗄️  Database:${NC}"
echo -e "   Type:     PostgreSQL (Native)"
echo -e "   Port:     5432"
echo -e "   Database: ${DB_NAME}"
echo -e "   User:     ${DB_USER}\n"

echo -e "${CYAN}🔧 Service Management:${NC}"
echo -e "   ${YELLOW}Backend:${NC}"
echo -e "     systemctl status clutchpay-backend"
echo -e "     systemctl restart clutchpay-backend"
echo -e "     journalctl -u clutchpay-backend -f"
echo -e ""
echo -e "   ${YELLOW}Apache (Frontend):${NC}"
echo -e "     systemctl status apache2"
echo -e "     systemctl restart apache2"
echo -e ""
echo -e "   ${YELLOW}PostgreSQL:${NC}"
echo -e "     systemctl status postgresql"
echo -e "     systemctl restart postgresql\n"

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Thank you for installing ClutchPay!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
