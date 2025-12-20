#!/bin/bash

################################################################################
#                   ClutchPay Installation Script
################################################################################
# Automated installation for Debian 11
# - PostgreSQL database
# - Next.js Backend API
# - Apache Frontend
#
# Usage:
#   ./installer.sh                      # Full installation (backend + frontend)
#   ./installer.sh -i                   # Interactive mode (prompts for all configurations)
#   ./installer.sh --backend-only       # Install only backend + PostgreSQL
#   ./installer.sh --backend-only -i    # Interactive backend installation
#   ./installer.sh --frontend-only      # Install only frontend (Apache)
#   ./installer.sh --frontend-only -i   # Interactive frontend installation
#   ./installer.sh --update [tag]       # Update existing installation
#   ./installer.sh --config-backend     # Configure backend to use new frontend location
#   ./installer.sh --config-frontend    # Configure frontend to use new backend location
#   ./installer.sh --config-stripe      # Configure Stripe payment credentials
#   ./installer.sh --config-paypal      # Configure PayPal payout credentials
#   ./installer.sh --config-resend      # Configure Resend email service
#   ./installer.sh --config-cloudinary  # Configure Cloudinary image storage
################################################################################

set -Eeuo pipefail  # Exit on error, unset vars, and fail pipelines

# Get absolute path of this script
SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]}")"

# Interactive mode flag
INTERACTIVE_MODE=false

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
        sudo -u postgres psql -c "DROP DATABASE IF EXISTS ${DB_NAME};" > /dev/null 2>&1 || true
        sudo -u postgres psql -c "DROP USER IF EXISTS ${DB_USER};" > /dev/null 2>&1 || true
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

# Default Configuration (will be overridden by user input)
DEFAULT_INSTALL_DIR="/opt/clutchpay"
BACKEND_SUBDIR="back"
DEFAULT_BACKEND_PORT=3000
DEFAULT_FRONTEND_PORT=80
DEFAULT_APACHE_DOC_ROOT="/var/www/clutchpay"

# Repository Configuration
REPO_URL="https://github.com/GCousido/ClutchPay.git"
REPO_TAG="main"

# Database credentials
DB_NAME="clutchpay_db"
DB_USER="clutchpay_user"
DB_PASSWORD="clutchpay_pass"

# Cloudinary Configuration (default/demo values)
DEFAULT_CLOUDINARY_CLOUD_NAME="clutchpay"
DEFAULT_CLOUDINARY_API_KEY="316689144486275"
DEFAULT_CLOUDINARY_API_SECRET="7OboPECLxjrFxAsY0C4uFk9ny3A"

# Stripe Configuration (default/demo values)
DEFAULT_STRIPE_SECRET_KEY=sk_test_51Sd8SjDL0gsWrXkk7we7vOqnlmxzpC1SqWN0A5GeuEJPHs2tr810MRxNvFhLMbNlOEgHGdba4ucXHUlJctf1TplT00nWEB2UF1
DEFAULT_STRIPE_WEBHOOK_SECRET=""
DEFAULT_STRIPE_CURRENCY="eur"

# PayPal Configuration (default/demo values)
DEFAULT_PAYPAL_CLIENT_ID=AWIctULK6TMTDwpyqYVRV1AAbCP5VwG6wDoeT1BN2clRgXhm6LcCR314Fcnt2wztLdhup7c-7RRmZZqG
DEFAULT_PAYPAL_CLIENT_SECRET=EHpi4iZKbNgPqHpQNZy6p9nawfFh6g0W1fLQpTHUdWrEOx33duo7UNW1sUuxXGIsSP9kkRntdS1KP6sL
DEFAULT_PAYPAL_MODE=sandbox

# Email Configuration (default/demo values)
DEFAULT_RESEND_API_KEY="re_T1GH3zFd_LeuawZWVLRZfZTT8ECVXJSjh"
DEFAULT_RESEND_FROM_EMAIL="ClutchPay <no-reply@notifications.clutchpay.dev>"

################################################################################
# Helper Functions (used by all installation modes)
################################################################################

# Function to check if port is in use
check_port() {
    local port=$1
    if ss -tuln 2>/dev/null | grep -q ":${port} " || netstat -tuln 2>/dev/null | grep -q ":${port} "; then
        return 0  # Port is in use
    fi
    return 1  # Port is free
}

# Function to validate port number
validate_port() {
    local port=$1
    if [[ "$port" =~ ^[0-9]+$ ]] && [ "$port" -ge 1 ] && [ "$port" -le 65535 ]; then
        return 0
    fi
    return 1
}

# Function to validate IP address
validate_ip() {
    local ip=$1
    if [[ "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        return 0
    fi
    return 1
}

# Function to validate directory path
validate_directory() {
    local dir=$1
    if [[ "$dir" =~ ^/ ]]; then
        return 0
    fi
    return 1
}

################################################################################
# Helper function - Clone Repository with Proper Permissions
################################################################################
clone_repository_with_permissions() {
    local source_url="$1"
    local target_dir="$2"
    local git_tag="$3"
    
    log_step "Cloning ClutchPay repository (tag: $git_tag)..."
    
    # Remove and recreate directory with proper permissions
    if [ "$IS_ROOT" = false ]; then
        $SUDO_CMD rm -rf "$target_dir" 2>/dev/null || true
        $SUDO_CMD mkdir -p "$target_dir"
        $SUDO_CMD git clone --depth 1 --branch "$git_tag" "$source_url" "$target_dir" 2>&1 | tail -3
        $SUDO_CMD chown -R $USER:$USER "$target_dir"
    else
        rm -rf "$target_dir" 2>/dev/null || true
        mkdir -p "$target_dir"
        git clone --depth 1 --branch "$git_tag" "$source_url" "$target_dir" 2>&1 | tail -3
    fi
    
    # Remove development utilities directory (not needed for production)
    if [ -d "$target_dir/utils_dev" ]; then
        log_step "Removing development utilities (utils_dev)..."
        $SUDO_CMD rm -rf "$target_dir/utils_dev"
        log_success "Development utilities removed"
    fi
    
    REPO_CLONED=true
    log_success "Repository cloned to $target_dir"
}


################################################################################
# Helper function - Install PostgreSQL
################################################################################
install_postgresql() {
    log_header "Installing PostgreSQL"

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
    if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" 2>/dev/null | grep -q 1; then
        log_info "Database user ${DB_USER} already exists"
    else
        sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';" > /dev/null 2>&1
        log_success "Database user created"
    fi

    # Check if database already exists
    if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" 2>/dev/null | grep -q 1; then
        log_info "Database ${DB_NAME} already exists"
    else
        sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" > /dev/null 2>&1
        log_success "Database created"
    fi

    # Grant privileges
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" > /dev/null 2>&1
    log_success "Database configured: ${DB_NAME}"
}

################################################################################
# Helper function - Create Backend Systemd Service
################################################################################
create_backend_service() {
    local backend_dir="$1"
    
    log_header "Creating Backend Service"

    log_step "Creating systemd service..."
    $SUDO_CMD tee /etc/systemd/system/clutchpay-backend.service > /dev/null << EOF
[Unit]
Description=ClutchPay Backend API
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
WorkingDirectory=$backend_dir
EnvironmentFile=$backend_dir/.env
ExecStart=/usr/bin/node $backend_dir/.next/standalone/server.js
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
}

################################################################################
# Helper function - Configure Apache Virtual Host
################################################################################
configure_apache_vhost() {
    local apache_doc_root="$1"
    local frontend_port="$2"
    local server_ip="$3"
    local backend_port="$4"
    
    log_header "Configuring Apache Virtual Host"

    APACHE_CONFIGURED=true

    # Update config.js with backend IP and port
    log_step "Configuring frontend backend connection..."
    if [ -f "$apache_doc_root/JS/config.js" ]; then
        $SUDO_CMD sed -i "s|const BACKEND_IP = '.*';|const BACKEND_IP = '${server_ip}';|" "$apache_doc_root/JS/config.js"
        $SUDO_CMD sed -i "s|const BACKEND_PORT = [0-9]*;|const BACKEND_PORT = ${backend_port};|" "$apache_doc_root/JS/config.js"
        log_success "Frontend configured to use backend at ${server_ip}:${backend_port}"
    else
        log_warning "JS/config.js not found. Skipping frontend configuration."
    fi

    # Create Apache virtual host configuration
    log_step "Creating Apache virtual host configuration..."

    # If using non-standard port, add Listen directive
    if [ "$frontend_port" -ne 80 ]; then
        # Check if port is already configured in ports.conf
        if ! grep -q "Listen $frontend_port" /etc/apache2/ports.conf 2>/dev/null; then
            log_step "Adding Listen $frontend_port to Apache ports.conf..."
            echo "Listen $frontend_port" | $SUDO_CMD tee -a /etc/apache2/ports.conf > /dev/null
        fi
    fi

    $SUDO_CMD tee /etc/apache2/sites-available/clutchpay.conf > /dev/null << EOF
<VirtualHost *:${frontend_port}>
    ServerName ${server_ip}
    ServerAdmin webmaster@localhost
    DocumentRoot ${apache_doc_root}

    <Directory ${apache_doc_root}>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog \${APACHE_LOG_DIR}/clutchpay-error.log
    CustomLog \${APACHE_LOG_DIR}/clutchpay-access.log combined
</VirtualHost>
EOF

    # Enable clutchpay site (don't disable default site to preserve existing configs)
    log_step "Enabling ClutchPay site..."
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
}

################################################################################
# Helper function - Install Apache
################################################################################
install_apache() {
    log_header "Installing Apache"

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
}

################################################################################
# Helper function - Install Node.js
################################################################################
install_nodejs() {
    log_header "Installing Node.js"

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
}

################################################################################
# Install Stripe CLI Function
################################################################################
install_stripe_cli() {
    log_step "Checking for Stripe CLI..."
    
    if command -v stripe &> /dev/null; then
        log_success "Stripe CLI already installed: $(stripe --version)"
        return 0
    fi
    
    log_step "Installing Stripe CLI..."
    
    # Download and install Stripe CLI for Debian/Ubuntu
    # Method 1: Using the official Stripe package repository
    if ! curl -s https://packages.stripe.dev/api/security/keypair/stripe-cli-gpg/public | gpg --dearmor 2>/dev/null | $SUDO_CMD tee /usr/share/keyrings/stripe.gpg > /dev/null; then
        log_warning "Could not add Stripe GPG key via packages.stripe.dev, trying alternative method..."
    fi
    
    # Add Stripe CLI repository
    echo "deb [signed-by=/usr/share/keyrings/stripe.gpg] https://packages.stripe.dev/stripe-cli-debian-local stable main" | $SUDO_CMD tee /etc/apt/sources.list.d/stripe.list > /dev/null
    
    # Update and install
    $SUDO_CMD apt-get update > /dev/null 2>&1
    
    if $SUDO_CMD apt-get install -y stripe > /dev/null 2>&1; then
        log_success "Stripe CLI installed successfully: $(stripe --version)"
        return 0
    fi
    
    # Fallback: Direct binary download
    log_warning "APT installation failed, downloading binary directly..."
    
    local STRIPE_CLI_URL="https://github.com/stripe/stripe-cli/releases/latest/download/stripe_linux_amd64.tar.gz"
    
    cd /tmp
    if curl -sL "$STRIPE_CLI_URL" -o stripe_cli.tar.gz; then
        tar -xzf stripe_cli.tar.gz
        $SUDO_CMD mv stripe /usr/local/bin/stripe
        $SUDO_CMD chmod +x /usr/local/bin/stripe
        rm -f stripe_cli.tar.gz
        log_success "Stripe CLI installed successfully: $(stripe --version)"
        return 0
    else
        log_error "Failed to download Stripe CLI"
        return 1
    fi
}

################################################################################
# Helper function - Setup backend specific installation
################################################################################
setup_backend_installation() {
    local backend_dir="$1"
    local backend_port="$2" 
    local frontend_ip="$3"
    local frontend_port="$4"

    log_header "Setting up Backend"

    cd "$backend_dir"

    # Generate secrets
    log_step "Generating secure secrets..."
    if ! command -v openssl &> /dev/null; then
        $SUDO_CMD apt-get install -y openssl > /dev/null 2>&1
    fi

    JWT_SECRET=$(openssl rand -base64 32)
    NEXTAUTH_SECRET=$(openssl rand -base64 32)

    # Create .env file
    log_step "Creating backend .env file..."
    cat > "$backend_dir/.env" << EOF
# Database Configuration
POSTGRES_DB=${DB_NAME}
POSTGRES_USER=${DB_USER}
POSTGRES_PASSWORD=${DB_PASSWORD}
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}?schema=public"

# Server Configuration
PORT=${backend_port}
BACKEND_PORT=${backend_port}
NODE_ENV=production
NEXT_PUBLIC_API_URL=http://${SERVER_IP}:${backend_port}

# Authentication
NEXTAUTH_URL=http://${SERVER_IP}:${backend_port}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
JWT_SECRET=${JWT_SECRET}

# Frontend
FRONTEND_URL=http://${frontend_ip}:${frontend_port}
FRONTEND_PORT=${frontend_port}
SERVER_IP=${frontend_ip}

# Cloudinary Configuration (configure with --config-cloudinary)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=${DEFAULT_CLOUDINARY_CLOUD_NAME}
NEXT_PUBLIC_CLOUDINARY_API_KEY=${DEFAULT_CLOUDINARY_API_KEY}
CLOUDINARY_API_SECRET=${DEFAULT_CLOUDINARY_API_SECRET}

# Stripe Configuration (configure with --config-stripe)
STRIPE_SECRET_KEY=${DEFAULT_STRIPE_SECRET_KEY}
STRIPE_WEBHOOK_SECRET=${DEFAULT_STRIPE_WEBHOOK_SECRET}
STRIPE_CURRENCY=${DEFAULT_STRIPE_CURRENCY}

# PayPal Configuration (configure with --config-paypal)
PAYPAL_CLIENT_ID=${DEFAULT_PAYPAL_CLIENT_ID}
PAYPAL_CLIENT_SECRET=${DEFAULT_PAYPAL_CLIENT_SECRET}
PAYPAL_MODE=${DEFAULT_PAYPAL_MODE}

# Email Configuration - Resend (configure with --config-resend)
RESEND_API_KEY=${DEFAULT_RESEND_API_KEY}
RESEND_FROM_EMAIL="${DEFAULT_RESEND_FROM_EMAIL}"

# Cron Job Security
CRON_SECRET=$(openssl rand -base64 32)
EOF
    log_success "Backend .env created"

    # Build backend
    log_step "Installing dependencies..."
    export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
    if ! pnpm install --frozen-lockfile 2>&1; then
        log_error "Dependency installation failed"
        cleanup; exit 1
    fi
    log_success "Dependencies installed"

    log_step "Generating Prisma Client..."
    if ! pnpm prisma generate 2>&1; then
        log_error "Prisma generation failed"
        cleanup; exit 1
    fi
    log_success "Prisma Client generated"

    log_step "Running database migrations..."
    if ! pnpm prisma migrate deploy 2>&1; then
        log_error "Database migrations failed"
        cleanup; exit 1
    fi
    log_success "Database migrations completed"

    log_step "Building Next.js application..."
    export FRONTEND_URL="http://${frontend_ip}:${frontend_port}"
    if ! pnpm build 2>&1 | tee /tmp/clutchpay-build.log | tail -20; then
        log_error "Build failed"
        cleanup; exit 1
    fi

    if [ ! -f "$backend_dir/.next/standalone/server.js" ]; then
        log_error "Build completed but server.js not found"
        cleanup; exit 1
    fi
    log_success "Backend built successfully"

    # Install Stripe CLI for webhook handling (required for demo/development)
    log_step "Installing Stripe CLI for webhook handling..."
    install_stripe_cli || log_warning "Stripe CLI installation failed. You can install it manually later."
}

################################################################################
# Helper function - Setup frontend specific installation
################################################################################
setup_frontend_installation() {
    local frontend_dir="$1"
    local frontend_port="$2"
    local backend_ip="$3"
    local backend_port="$4"
    local apache_doc_root="${DEFAULT_APACHE_DOC_ROOT}"

    log_header "Setting up Frontend"

    # Ask for Apache document root in interactive mode
    if [ "$INTERACTIVE_MODE" = true ]; then
        echo -e "${YELLOW}Enter Apache document root (default: ${DEFAULT_APACHE_DOC_ROOT}):${NC}"
        read -r USER_APACHE_DOC_ROOT
        apache_doc_root="${USER_APACHE_DOC_ROOT:-${DEFAULT_APACHE_DOC_ROOT}}"
    fi
    
    log_step "Using Apache document root: $apache_doc_root"

    # Check if Apache document root already exists
    if [ -d "$apache_doc_root" ] && [ -n "$(ls -A "$apache_doc_root" 2>/dev/null)" ]; then
        log_warning "Directory $apache_doc_root already exists with files!"
        
        if [ "$INTERACTIVE_MODE" = true ]; then
            echo -e "${YELLOW}What would you like to do?${NC}"
            echo "  1) Overwrite existing files"
            echo "  2) Backup existing files and install new ones"
            echo "  3) Cancel installation"
            echo -n "  Enter your choice (1-3): "
            read -r CHOICE
            
            case "$CHOICE" in
                1)
                    log_step "Overwriting existing files..."
                    ;;
                2)
                    BACKUP_DIR="${apache_doc_root}.backup.$(date +%s)"
                    log_step "Backing up existing files to $BACKUP_DIR..."
                    $SUDO_CMD mv "$apache_doc_root" "$BACKUP_DIR"
                    log_success "Backup created at $BACKUP_DIR"
                    ;;
                3)
                    log_error "Installation cancelled by user"
                    cleanup
                    exit 1
                    ;;
                *)
                    log_error "Invalid choice: $CHOICE"
                    cleanup
                    exit 1
                    ;;
            esac
        else
            log_error "Directory $apache_doc_root already has files!"
            log_info "In non-interactive mode, the directory must be empty or not exist."
            log_info "Options:"
            log_info "  1. Run with -i flag for interactive mode to choose an action"
            log_info "  2. Manually backup/move the directory: sudo mv $apache_doc_root ${apache_doc_root}.backup"
            cleanup
            exit 1
        fi
    fi

    # Copy frontend files to Apache document root
    log_step "Copying frontend files to ${apache_doc_root}..."
    $SUDO_CMD mkdir -p "$apache_doc_root"
    $SUDO_CMD cp -r "$frontend_dir"/* "$apache_doc_root/"
    $SUDO_CMD chown -R www-data:www-data "$apache_doc_root"
    log_success "Frontend files copied"

    # Configure Apache Virtual Host using helper function
    configure_apache_vhost "$apache_doc_root" "$frontend_port" "$backend_ip" "$backend_port"
}


################################################################################
# Common Setup Function - Shared by all installation modes
################################################################################
common_setup() {
    local mode="${1:-full}"  # full, backend, frontend
    
    ################################################################################
    # Check sudo availability
    ################################################################################
    log_header "Checking Privileges"

    if [ "$EUID" -eq 0 ]; then
        SUDO_CMD=""
        log_success "Running as root"
    elif command -v sudo &> /dev/null; then
        if sudo -n true 2>/dev/null; then
            SUDO_CMD="sudo"
            log_success "sudo privileges already cached"
        else
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

    if ! command -v dpkg &> /dev/null; then
        log_error "dpkg not found. This script requires a Debian-based system."
        exit 1
    fi

    if ! command -v tee &> /dev/null; then
        log_step "Installing coreutils (includes tee)..."
        $SUDO_CMD apt-get update -qq
        $SUDO_CMD apt-get install -y coreutils > /dev/null 2>&1
        log_success "coreutils installed"
    fi

    if ! command -v sed &> /dev/null; then
        log_step "Installing sed..."
        $SUDO_CMD apt-get install -y sed > /dev/null 2>&1
        log_success "sed installed"
    fi

    if ! command -v grep &> /dev/null; then
        log_step "Installing grep..."
        $SUDO_CMD apt-get install -y grep > /dev/null 2>&1
        log_success "grep installed"
    fi

    if ! command -v systemctl &> /dev/null; then
        log_error "systemctl not found. This script requires systemd."
        exit 1
    fi

    log_success "All essential system tools are available"

    ################################################################################
    # Check System
    ################################################################################
    log_header "Checking System Requirements"

    if [ ! -f /etc/debian_version ]; then
        log_error "This script requires Debian 11"
        exit 1
    fi

    log_success "Running on Debian $(cat /etc/debian_version)"

    ################################################################################
    # Install Dependencies
    ################################################################################
    log_header "Installing System Dependencies"

    $SUDO_CMD apt-get update -qq

    if ! command -v curl &> /dev/null; then
        log_step "Installing curl..."
        $SUDO_CMD apt-get install -y curl > /dev/null 2>&1
        log_success "curl installed"
    else
        log_success "curl already installed"
    fi

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

    SERVER_IP=$(hostname -I | awk '{print $1}')

    if [ -z "$SERVER_IP" ]; then
        log_warning "Could not auto-detect IP address"
        # Keep asking until valid IP is provided
        while [ -z "$SERVER_IP" ] || ! validate_ip "$SERVER_IP"; do
            echo -e "${YELLOW}Please enter the server IP address:${NC}"
            read -r SERVER_IP
            if [ -z "$SERVER_IP" ]; then
                log_error "Server IP cannot be empty"
            elif ! validate_ip "$SERVER_IP"; then
                log_error "Invalid IP address format: $SERVER_IP"
                SERVER_IP=""
            fi
        done
    else
        log_info "Auto-detected IP: $SERVER_IP"
        
        # In interactive mode, always confirm IP address
        if [ "$INTERACTIVE_MODE" = true ]; then
            CONFIRMED=false
            while [ "$CONFIRMED" = false ]; do
                echo -e "${YELLOW}Is this IP address correct? (Y/n):${NC}"
                read -r IP_CONFIRM
                if [[ "$IP_CONFIRM" =~ ^[Yy]$ ]] || [ -z "$IP_CONFIRM" ]; then
                    CONFIRMED=true
                elif [[ "$IP_CONFIRM" =~ ^[Nn]$ ]]; then
                    # Keep asking for new IP until valid
                    while true; do
                        echo -e "${YELLOW}Please enter the correct server IP address:${NC}"
                        read -r NEW_IP
                        if [ -z "$NEW_IP" ]; then
                            log_error "Server IP cannot be empty"
                        elif validate_ip "$NEW_IP"; then
                            SERVER_IP="$NEW_IP"
                            break
                        else
                            log_error "Invalid IP address format: $NEW_IP"
                        fi
                    done
                    # After getting new IP, ask for confirmation again
                    CONFIRMED=false
                else
                    log_error "Please answer Y (yes) or N (no)"
                fi
            done
        fi
    fi

    log_success "Server IP detected: $SERVER_IP"
}

################################################################################
# Install Backend Only Function
################################################################################
install_backend_only() {
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
     Backend Installation - Debian 11      |___/
EOF
    echo -e "${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

    # Run common setup first (privileges, tools, IP detection)
    common_setup "backend"

    ################################################################################
    # Backend Configuration
    ################################################################################
    log_header "Backend Configuration"

    # Installation directory
    if [ "$INTERACTIVE_MODE" = true ]; then
        echo -e "${YELLOW}Enter installation directory (default: ${DEFAULT_INSTALL_DIR}):${NC}"
        read -r USER_INSTALL_DIR
        INSTALL_DIR="${USER_INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"
    else
        INSTALL_DIR="$DEFAULT_INSTALL_DIR"
    fi
    
    if [ -d "$INSTALL_DIR" ] && [ -n "$(ls -A "$INSTALL_DIR" 2>/dev/null)" ]; then
        log_warning "Directory $INSTALL_DIR already exists with files!"
        
        if [ "$INTERACTIVE_MODE" = true ]; then
            echo -e "${YELLOW}What would you like to do?${NC}"
            echo "  1) Overwrite existing files"
            echo "  2) Backup existing files and install new ones"
            echo "  3) Cancel installation"
            echo -n "  Enter your choice (1-3): "
            read -r CHOICE
            
            case "$CHOICE" in
                1)
                    log_step "Overwriting existing files..."
                    ;;
                2)
                    BACKUP_DIR="${INSTALL_DIR}.backup.$(date +%s)"
                    log_step "Backing up existing files to $BACKUP_DIR..."
                    $SUDO_CMD mv "$INSTALL_DIR" "$BACKUP_DIR"
                    log_success "Backup created at $BACKUP_DIR"
                    ;;
                3)
                    log_error "Installation cancelled by user"
                    cleanup
                    exit 1
                    ;;
                *)
                    log_error "Invalid choice: $CHOICE"
                    cleanup
                    exit 1
                    ;;
            esac
        else
            log_error "Directory $INSTALL_DIR already has files!"
            log_info "In non-interactive mode, the directory must be empty or not exist."
            log_info "Options:"
            log_info "  1. Run with -i flag for interactive mode to choose an action"
            log_info "  2. Manually backup/move the directory: sudo mv $INSTALL_DIR ${INSTALL_DIR}.backup"
            cleanup
            exit 1
        fi
    fi
    BACKEND_DIR="$INSTALL_DIR/$BACKEND_SUBDIR"
    log_success "Installation directory: $INSTALL_DIR"

    # Backend port
    if [ "$INTERACTIVE_MODE" = true ]; then
        # In interactive mode, keep asking until valid port is provided
        while true; do
            echo -e "${YELLOW}Enter backend port (default: ${DEFAULT_BACKEND_PORT}):${NC}"
            read -r USER_BACKEND_PORT
            BACKEND_PORT="${USER_BACKEND_PORT:-$DEFAULT_BACKEND_PORT}"
            
            if validate_port "$BACKEND_PORT"; then
                if check_port "$BACKEND_PORT"; then
                    log_warning "Port $BACKEND_PORT is already in use!"
                    echo -e "${YELLOW}Please choose a different port.${NC}"
                else
                    break  # Valid and available port
                fi
            else
                log_error "Invalid port number: $BACKEND_PORT"
            fi
        done
    else
        BACKEND_PORT="$DEFAULT_BACKEND_PORT"
        if check_port "$DEFAULT_BACKEND_PORT"; then
            log_warning "Port $DEFAULT_BACKEND_PORT is in use!"
            log_error "In non-interactive mode, the default port must be available."
            log_info "Options:"
            log_info "  1. Run with -i flag for interactive mode to choose a different port"
            log_info "  2. Stop the service using port $DEFAULT_BACKEND_PORT"
            cleanup
            exit 1
        fi
    fi
    log_success "Backend port: $BACKEND_PORT"

    # Frontend location (for CORS configuration)
    echo ""
    FRONTEND_IP="$SERVER_IP"
    
    if [ "$INTERACTIVE_MODE" = true ]; then
        while true; do
            echo -e "${YELLOW}Enter the FRONTEND server IP (default: ${FRONTEND_IP}):${NC}"
            read -r USER_FRONTEND_IP
            FRONTEND_IP="${USER_FRONTEND_IP:-$SERVER_IP}"
            
            # Validate frontend IP
            if validate_ip "$FRONTEND_IP"; then
                break
            else
                log_error "Invalid IP address format: $FRONTEND_IP"
            fi
        done
    else
        log_info "Using server IP as frontend IP: $FRONTEND_IP"
    fi
    
    FRONTEND_PORT="80"
    if [ "$INTERACTIVE_MODE" = true ]; then
        while true; do
            echo -e "${YELLOW}Enter the FRONTEND port (default: 80):${NC}"
            read -r USER_FRONTEND_PORT
            FRONTEND_PORT="${USER_FRONTEND_PORT:-80}"
            
            if validate_port "$FRONTEND_PORT"; then
                break
            else
                log_error "Invalid port number: $FRONTEND_PORT"
            fi
        done
    else
        log_info "Using default frontend port: $FRONTEND_PORT"
    fi
    log_success "Frontend location: ${FRONTEND_IP}:${FRONTEND_PORT}"

    ################################################################################
    # Install PostgreSQL
    ################################################################################
    install_postgresql
    install_nodejs

    ################################################################################
    # Clone Repository
    ################################################################################
    log_header "Cloning Repository"

    clone_repository_with_permissions "$REPO_URL" "$INSTALL_DIR" "$REPO_TAG"

    if [ ! -d "$BACKEND_DIR" ]; then
        log_error "Backend directory not found at $BACKEND_DIR"
        cleanup
        exit 1
    fi

    ################################################################################
    # Configure Backend
    ################################################################################
    setup_backend_installation "$BACKEND_DIR" "$BACKEND_PORT" "$FRONTEND_IP" "$FRONTEND_PORT"
    
    ################################################################################
    # Create Systemd Service using helper function
    ################################################################################
    create_backend_service "$BACKEND_DIR"

    ################################################################################
    # Configure Stripe Webhook
    ################################################################################
    # Use the unified config_stripe function in non-interactive mode
    config_stripe "false" "$BACKEND_DIR" "$BACKEND_PORT" || log_info "Stripe webhook can be configured later with: ./installer.sh --config-stripe"

    ################################################################################
    # Configure Firewall
    ################################################################################
    if command -v ufw &> /dev/null; then
        log_header "Configuring Firewall"
        log_step "Opening port ${BACKEND_PORT}..."
        $SUDO_CMD ufw allow ${BACKEND_PORT}/tcp > /dev/null 2>&1 || true
        log_success "Firewall rules added"
    fi

    ################################################################################
    # Backend Installation Complete
    ################################################################################
    SUCCESS=true
    log_header "Backend Installation Complete! 🎉"

    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}${BOLD}  ClutchPay Backend has been successfully installed!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

    echo -e "${CYAN}🌐 Backend URL:${NC} ${GREEN}http://${SERVER_IP}:${BACKEND_PORT}${NC}\n"
    echo -e "${CYAN}📂 Installation Directory:${NC} ${BACKEND_DIR}\n"
    echo -e "${CYAN}🗄️  Database:${NC} PostgreSQL - ${DB_NAME}\n"
    echo -e "${CYAN}🔧 Service:${NC} systemctl status clutchpay-backend\n"
    
    echo -e "${YELLOW}📌 Next Steps - Configure services:${NC}"
    echo -e "  ${CYAN}./installer.sh --config-stripe${NC}      Configure Stripe payments"
    echo -e "  ${CYAN}./installer.sh --config-paypal${NC}      Configure PayPal payouts"
    echo -e "  ${CYAN}./installer.sh --config-resend${NC}      Configure email notifications"
    echo -e "  ${CYAN}./installer.sh --config-cloudinary${NC}  Configure cloud storage\n"
}

################################################################################
# Install Frontend Only Function
################################################################################
install_frontend_only() {
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
    Frontend Installation - Debian 11      |___/
EOF
    echo -e "${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

    # Run common setup first (privileges, tools, IP detection)
    common_setup "frontend"

    ################################################################################
    # Frontend Configuration
    ################################################################################
    log_header "Frontend Configuration"

    # Frontend port
    if [ "$INTERACTIVE_MODE" = true ]; then
        # In interactive mode, keep asking until valid port is provided
        while true; do
            echo -e "${YELLOW}Enter frontend port (default: ${DEFAULT_FRONTEND_PORT}):${NC}"
            read -r USER_FRONTEND_PORT
            FRONTEND_PORT="${USER_FRONTEND_PORT:-$DEFAULT_FRONTEND_PORT}"
            
            if validate_port "$FRONTEND_PORT"; then
                if check_port "$FRONTEND_PORT"; then
                    log_warning "Port $FRONTEND_PORT is already in use!"
                    echo -e "${YELLOW}Please choose a different port.${NC}"
                else
                    break  # Valid and available port
                fi
            else
                log_error "Invalid port number: $FRONTEND_PORT"
            fi
        done
    else
        FRONTEND_PORT="$DEFAULT_FRONTEND_PORT"
        if check_port "$DEFAULT_FRONTEND_PORT"; then
            log_warning "Port $DEFAULT_FRONTEND_PORT is in use!"
            log_error "In non-interactive mode, the default port must be available."
            log_info "Options:"
            log_info "  1. Run with -i flag for interactive mode to choose a different port"
            log_info "  2. Stop the service using port $DEFAULT_FRONTEND_PORT"
            cleanup
            exit 1
        fi
    fi
    log_success "Frontend port: $FRONTEND_PORT"

    # Backend location
    echo ""
    BACKEND_IP="$SERVER_IP"
    
    if [ "$INTERACTIVE_MODE" = true ]; then
        # In interactive mode, keep asking until valid IP is provided
        while true; do
            echo -e "${YELLOW}Enter the BACKEND server IP (default: ${BACKEND_IP}):${NC}"
            read -r USER_BACKEND_IP
            BACKEND_IP="${USER_BACKEND_IP:-$SERVER_IP}"
            
            if validate_ip "$BACKEND_IP"; then
                break
            else
                log_error "Invalid IP address format: $BACKEND_IP"
            fi
        done
        
        while true; do
            echo -e "${YELLOW}Enter the BACKEND port (default: 3000):${NC}"
            read -r USER_BACKEND_PORT
            BACKEND_PORT="${USER_BACKEND_PORT:-3000}"
            if validate_port "$BACKEND_PORT"; then
                break
            else
                log_error "Invalid port number: $BACKEND_PORT"
            fi
        done
    else
        log_info "Using server IP as backend IP: $BACKEND_IP"
        BACKEND_PORT="3000"
        log_info "Using default backend port: $BACKEND_PORT"
    fi
    log_success "Backend location: ${BACKEND_IP}:${BACKEND_PORT}"

    ################################################################################
    # Install Apache
    ################################################################################
    install_apache

    ################################################################################
    # Clone Repository
    ################################################################################
    log_header "Cloning Repository"

    TEMP_CLONE="/tmp/clutchpay-clone-$$"
    clone_repository_with_permissions "$REPO_URL" "$TEMP_CLONE" "$REPO_TAG"

    # Verify frontend directory exists
    if [ ! -d "$TEMP_CLONE/frontend" ]; then
        log_error "Frontend directory not found in repository"
        cleanup
        exit 1
    fi

    ################################################################################
    # Setup Frontend using helper function
    ################################################################################
    setup_frontend_installation "$TEMP_CLONE/frontend" "$FRONTEND_PORT" "$BACKEND_IP" "$BACKEND_PORT"
    
    # Clean up temporary clone directory
    rm -rf "$TEMP_CLONE"

    ################################################################################
    # Configure Firewall
    ################################################################################
    if command -v ufw &> /dev/null; then
        log_header "Configuring Firewall"
        log_step "Opening port ${FRONTEND_PORT}..."
        $SUDO_CMD ufw allow ${FRONTEND_PORT}/tcp > /dev/null 2>&1 || true
        log_success "Firewall rules added"
    fi

    ################################################################################
    # Frontend Installation Complete
    ################################################################################
    SUCCESS=true
    log_header "Frontend Installation Complete! 🎉"

    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}${BOLD}  ClutchPay Frontend has been successfully installed!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

    echo -e "${CYAN}🌐 Frontend URL:${NC} ${GREEN}http://${SERVER_IP}:${FRONTEND_PORT}${NC}\n"
    echo -e "${CYAN}🔗 Backend:${NC} ${BACKEND_IP}:${BACKEND_PORT}\n"
    echo -e "${CYAN}🔧 Service:${NC} systemctl status apache2\n"
}

################################################################################
# Main Installation Function
################################################################################
install_clutchpay() {

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
    # Configuration (interactive or default)
    ################################################################################
    if [ "$INTERACTIVE_MODE" = true ]; then
        log_header "Configuration Options"

        echo ""
        echo -e "${CYAN}${BOLD}Please configure the installation settings:${NC}"
        echo ""

        # === Installation Directory ===
        echo -e "${YELLOW}Enter installation directory (default: ${DEFAULT_INSTALL_DIR}):${NC}"
        read -r USER_INSTALL_DIR
        INSTALL_DIR="${USER_INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"

        # Check if directory already exists
        if [ -d "$INSTALL_DIR" ]; then
            log_warning "Directory $INSTALL_DIR already exists with files!"
            echo -e "${YELLOW}What would you like to do?${NC}"
            echo "  1) Overwrite existing files"
            echo "  2) Backup existing files and install new ones"
            echo "  3) Cancel installation"
            echo -n "  Enter your choice (1-3): "
            read -r CHOICE
            
            case "$CHOICE" in
                1)
                    log_step "Overwriting existing files..."
                    ;;
                2)
                    BACKUP_DIR="${INSTALL_DIR}.backup.$(date +%s)"
                    log_step "Backing up existing files to $BACKUP_DIR..."
                    $SUDO_CMD mv "$INSTALL_DIR" "$BACKUP_DIR"
                    log_success "Backup created at $BACKUP_DIR"
                    ;;
                3)
                    log_error "Installation cancelled by user"
                    exit 1
                    ;;
                *)
                    log_error "Invalid choice: $CHOICE"
                    exit 1
                    ;;
            esac
        fi

        BACKEND_DIR="$INSTALL_DIR/$BACKEND_SUBDIR"
        FRONTEND_DIR="$INSTALL_DIR/frontend"
        log_success "Installation directory: $INSTALL_DIR"

        echo ""

        # === Backend Port ===
        while true; do
            echo -e "${YELLOW}Enter backend port (default: $DEFAULT_BACKEND_PORT):${NC}"
            read -r USER_BACKEND_PORT
            BACKEND_PORT="${USER_BACKEND_PORT:-$DEFAULT_BACKEND_PORT}"
            
            if validate_port "$BACKEND_PORT"; then
                if check_port "$BACKEND_PORT"; then
                    log_warning "Port $BACKEND_PORT is currently in use!"
                else
                    break
                fi
            else
                log_error "Invalid port number: $BACKEND_PORT"
            fi
        done
        log_success "Backend port: $BACKEND_PORT"

        echo ""

        # === Frontend Port (Apache) ===
        while true; do
            echo -e "${YELLOW}Enter frontend port (default: $DEFAULT_FRONTEND_PORT):${NC}"
            read -r USER_FRONTEND_PORT
            FRONTEND_PORT="${USER_FRONTEND_PORT:-$DEFAULT_FRONTEND_PORT}"
            
            if validate_port "$FRONTEND_PORT"; then
                if check_port "$FRONTEND_PORT"; then
                    log_warning "Port $FRONTEND_PORT is currently in use!"
                else
                    break
                fi
            else
                log_error "Invalid port number: $FRONTEND_PORT"
            fi
        done
        log_success "Frontend port: $FRONTEND_PORT"

        echo ""
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}${BOLD}Configuration Summary:${NC}"
        echo -e "  Installation directory: ${CYAN}$INSTALL_DIR${NC}"
        echo -e "  Backend port:          ${CYAN}$BACKEND_PORT${NC}"
        echo -e "  Frontend port:         ${CYAN}$FRONTEND_PORT${NC}"
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
    else
        # Non-interactive mode: use defaults
        INSTALL_DIR="$DEFAULT_INSTALL_DIR"
        BACKEND_PORT="$DEFAULT_BACKEND_PORT"
        FRONTEND_PORT="$DEFAULT_FRONTEND_PORT"
        BACKEND_DIR="$INSTALL_DIR/$BACKEND_SUBDIR"
        FRONTEND_DIR="$INSTALL_DIR/frontend"

        # Check if directory already exists
        if [ -d "$INSTALL_DIR" ]; then
            log_error "Directory $INSTALL_DIR already has files!"
            log_info "In non-interactive mode, the directory must be empty or not exist."
            log_info "Options:"
            log_info "  1. Run with -i flag for interactive mode to choose an action"
            log_info "  2. Manually backup/move the directory: sudo mv $INSTALL_DIR ${INSTALL_DIR}.backup"
            exit 1
        fi
        
        # Validate backend port is available
        if check_port "$DEFAULT_BACKEND_PORT"; then
            log_error "Backend port $DEFAULT_BACKEND_PORT is already in use!"
            log_info "Options:"
            log_info "  1. Run with -i flag for interactive mode to choose a different port"
            log_info "  2. Stop the service using port $DEFAULT_BACKEND_PORT"
            exit 1
        fi
        
        # Validate frontend port is available
        if check_port "$DEFAULT_FRONTEND_PORT"; then
            log_error "Frontend port $DEFAULT_FRONTEND_PORT is already in use!"
            log_info "Options:"
            log_info "  1. Run with -i flag for interactive mode to choose a different port"
            log_info "  2. Stop the service using port $DEFAULT_FRONTEND_PORT"
            exit 1
        fi
        
        log_info "Using default configuration:"
        log_info "  Installation directory: $INSTALL_DIR"
        log_info "  Backend port:          $BACKEND_PORT"
        log_info "  Frontend port:         $FRONTEND_PORT"
        echo ""
    fi

    # Use common setup function instead of duplicating code
    common_setup "full"

    ################################################################################
    # Install all components using helper functions
    ################################################################################
    install_postgresql
    install_apache  
    install_nodejs

    ################################################################################
    # Clone Repository
    ################################################################################
    log_header "Downloading ClutchPay"

    if [ -d "$INSTALL_DIR" ]; then
        log_warning "Installation directory exists. Backing up..."
        $SUDO_CMD mv "$INSTALL_DIR" "${INSTALL_DIR}.backup.$(date +%s)"
    fi

    clone_repository_with_permissions "$REPO_URL" "$INSTALL_DIR" "$REPO_TAG"

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
    setup_backend_installation "$BACKEND_DIR" "$BACKEND_PORT" "$SERVER_IP" "$FRONTEND_PORT"
    setup_frontend_installation "$FRONTEND_DIR" "$FRONTEND_PORT" "$SERVER_IP" "$BACKEND_PORT"

    ################################################################################
    # Create Systemd Service for Backend
    ################################################################################
    create_backend_service "$BACKEND_DIR"

    ################################################################################
    # Configure Stripe Webhook
    ################################################################################
    # Use the unified config_stripe function in non-interactive mode
    config_stripe "false" "$BACKEND_DIR" "$BACKEND_PORT" || log_info "Stripe webhook can be configured later with: ./installer.sh --config-stripe"

    ################################################################################
    # Configure Firewall (if ufw is installed)
    ################################################################################
    if command -v ufw &> /dev/null; then
        log_header "Configuring Firewall"
        
        log_step "Opening ports $FRONTEND_PORT and ${BACKEND_PORT}..."
        $SUDO_CMD ufw allow $FRONTEND_PORT/tcp > /dev/null 2>&1 || true
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
    echo -e "   Type:     PostgreSQL"
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
}

################################################################################
# Update Function
################################################################################
update_clutchpay() {
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
            Update Script - Debian 11       |___/
EOF
echo -e "${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    
    log_header "Configuration"
    
    # Ask for installation directory
    if [ "$INTERACTIVE_MODE" = true ]; then
        echo -e "${YELLOW}Installation directory (default: ${DEFAULT_INSTALL_DIR}):${NC}"
        read -r USER_INSTALL_DIR
    fi
    
    INSTALL_DIR="${USER_INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"
    
    # Check if installation exists
    if [ ! -d "$INSTALL_DIR" ]; then
        log_error "Installation not found at $INSTALL_DIR"
        log_info "Please run installation first: ./installer.sh"
        exit 1
    fi
    
    BACKEND_DIR="$INSTALL_DIR/$BACKEND_SUBDIR"
    FRONTEND_DIR="$INSTALL_DIR/frontend"
    
    # Validate directories exist
    if [ ! -d "$BACKEND_DIR" ]; then
        log_error "Backend directory not found at $BACKEND_DIR"
        exit 1
    fi
    
    if [ ! -d "$FRONTEND_DIR" ]; then
        log_error "Frontend directory not found at $FRONTEND_DIR"
        exit 1
    fi
    
    log_success "Installation found at: $INSTALL_DIR"
    
    # Determine what to update
    # In interactive mode: ask user, in non-interactive: update both
    UPDATE_BACKEND=true
    UPDATE_FRONTEND=true
    
    if [ "$INTERACTIVE_MODE" = true ]; then
        echo -e "\n${YELLOW}What would you like to update?${NC}"
        echo "  1) Backend only"
        echo "  2) Frontend only"
        echo "  3) Both (backend and frontend)"
        echo -n "  Enter your choice (1-3): "
        read -r UPDATE_CHOICE
        
        case "$UPDATE_CHOICE" in
            1) UPDATE_BACKEND=true; UPDATE_FRONTEND=false ;;
            2) UPDATE_BACKEND=false; UPDATE_FRONTEND=true ;;
            3) UPDATE_BACKEND=true; UPDATE_FRONTEND=true ;;
            *) log_error "Invalid choice"; exit 1 ;;
        esac
    fi
    
    # Use tag from parameter or prompt for it
    if [ -n "${UPDATE_TAG:-}" ]; then
        log_info "Using tag from parameter: $UPDATE_TAG"
    else
        # Fetch tags first to show available options
        log_step "Fetching available tags..."
        cd "$INSTALL_DIR"
        if ! git fetch --tags origin > /dev/null 2>&1; then
            log_error "Failed to fetch tags from repository"
            exit 1
        fi
        
        if [ "$INTERACTIVE_MODE" = true ]; then
            echo -e "\n${CYAN}Available tags:${NC}"
            git tag -l --sort=-version:refname | head -20 | sed 's/^/  - /'
            
            echo -e "\n${YELLOW}Enter the tag to update to:${NC}"
            read -r UPDATE_TAG
        else
            # Non-interactive: use latest tag
            UPDATE_TAG=$(git tag -l --sort=-version:refname | head -1)
            if [ -z "$UPDATE_TAG" ]; then
                log_error "No tags found in repository"
                exit 1
            fi
        fi
        
        if [ -z "$UPDATE_TAG" ]; then
            log_error "Tag cannot be empty"
            exit 1
        fi
    fi
    
    # Final confirmation in interactive mode
    if [ "$INTERACTIVE_MODE" = true ]; then
        echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${YELLOW}Update summary:${NC}"
        echo -e "  Version:  ${CYAN}$UPDATE_TAG${NC}"
        [ "$UPDATE_BACKEND" = true ] && echo -e "  Backend:  ${GREEN}Yes${NC}" || echo -e "  Backend:  ${RED}No${NC}"
        [ "$UPDATE_FRONTEND" = true ] && echo -e "  Frontend: ${GREEN}Yes${NC}" || echo -e "  Frontend: ${RED}No${NC}"
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${YELLOW}Proceed with update? (Y/n):${NC}"
        read -r CONFIRM
        
        if [[ "$CONFIRM" =~ ^[Nn]$ ]]; then
            log_error "Update cancelled"
            exit 1
        fi
    else
        log_info "Updating to: $UPDATE_TAG"
        [ "$UPDATE_BACKEND" = true ] && log_info "Backend: Yes" || log_info "Backend: No"
        [ "$UPDATE_FRONTEND" = true ] && log_info "Frontend: Yes" || log_info "Frontend: No"
    fi
    
    log_header "Updating ClutchPay to $UPDATE_TAG"
    
    # Stop backend service if updating
    if [ "$UPDATE_BACKEND" = true ]; then
        log_step "Stopping backend service..."
        $SUDO_CMD systemctl stop clutchpay-backend.service
    fi
    
    log_step "Ensuring proper ownership..."
    # Ensure the current user owns the installation directory
    if [ "$IS_ROOT" = false ]; then
        $SUDO_CMD chown -R $USER:$USER "$INSTALL_DIR"
    fi
    
    log_step "Fetching updates from tag: $UPDATE_TAG..."
    cd "$INSTALL_DIR"
    
    # Fetch all tags from origin
    if ! git fetch --tags origin 2>&1; then
        log_error "Failed to fetch tags from repository"
        [ "$UPDATE_BACKEND" = true ] && $SUDO_CMD systemctl start clutchpay-backend.service
        exit 1
    fi
    
    # Verify tag exists
    if ! git rev-parse "refs/tags/$UPDATE_TAG" > /dev/null 2>&1; then
        log_error "Tag '$UPDATE_TAG' not found in repository"
        [ "$UPDATE_BACKEND" = true ] && $SUDO_CMD systemctl start clutchpay-backend.service
        exit 1
    fi
    
    # Checkout the tag
    if ! git checkout "$UPDATE_TAG" 2>&1; then
        log_error "Failed to checkout tag $UPDATE_TAG"
        [ "$UPDATE_BACKEND" = true ] && $SUDO_CMD systemctl start clutchpay-backend.service
        exit 1
    fi
    
    log_success "Code updated to $UPDATE_TAG"
    
    # Remove utils_dev directory (only needed for development)
    if [ -d "$INSTALL_DIR/utils_dev" ]; then
        log_step "Removing development utilities (utils_dev)..."
        rm -rf "$INSTALL_DIR/utils_dev"
        log_success "Development utilities removed"
    fi
    
    # Update backend if requested
    if [ "$UPDATE_BACKEND" = true ]; then
        log_header "Updating Backend"
        
        # Preserve existing .env - only add missing variables
        log_step "Checking for missing environment variables..."
        ADDED_VARS=false
        
        # Generate secure secrets for new installations
        if ! command -v openssl &> /dev/null; then
            $SUDO_CMD apt-get install -y openssl > /dev/null 2>&1
        fi
        
        # Only add missing variables, don't overwrite existing ones
        if [ -f "$BACKEND_DIR/.env" ]; then
            # Database configuration
            if ! grep -q "^POSTGRES_DB=" "$BACKEND_DIR/.env"; then
                echo "POSTGRES_DB=${DB_NAME}" >> "$BACKEND_DIR/.env"
                ADDED_VARS=true
                log_success "Added missing POSTGRES_DB"
            fi
            
            if ! grep -q "^POSTGRES_USER=" "$BACKEND_DIR/.env"; then
                echo "POSTGRES_USER=${DB_USER}" >> "$BACKEND_DIR/.env"
                ADDED_VARS=true
                log_success "Added missing POSTGRES_USER"
            fi
            
            if ! grep -q "^POSTGRES_PASSWORD=" "$BACKEND_DIR/.env"; then
                echo "POSTGRES_PASSWORD=${DB_PASSWORD}" >> "$BACKEND_DIR/.env"
                ADDED_VARS=true
                log_success "Added missing POSTGRES_PASSWORD"
            fi
            
            if ! grep -q "^DATABASE_URL=" "$BACKEND_DIR/.env"; then
                echo "DATABASE_URL=\"postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}?schema=public\"" >> "$BACKEND_DIR/.env"
                ADDED_VARS=true
                log_success "Added missing DATABASE_URL"
            fi
            
            # Server configuration
            if ! grep -q "^NODE_ENV=" "$BACKEND_DIR/.env"; then
                echo "NODE_ENV=production" >> "$BACKEND_DIR/.env"
                ADDED_VARS=true
                log_success "Added missing NODE_ENV"
            fi
            
            # Extract port from existing .env if available
            EXISTING_PORT=$(grep -oP "^PORT=\K[0-9]+" "$BACKEND_DIR/.env" 2>/dev/null || echo "3000")
            EXISTING_BACKEND_PORT=$(grep -oP "^BACKEND_PORT=\K[0-9]+" "$BACKEND_DIR/.env" 2>/dev/null || echo "$EXISTING_PORT")
            
            if ! grep -q "^PORT=" "$BACKEND_DIR/.env"; then
                echo "PORT=${EXISTING_PORT}" >> "$BACKEND_DIR/.env"
                ADDED_VARS=true
                log_success "Added missing PORT"
            fi
            
            if ! grep -q "^BACKEND_PORT=" "$BACKEND_DIR/.env"; then
                echo "BACKEND_PORT=${EXISTING_BACKEND_PORT}" >> "$BACKEND_DIR/.env"
                ADDED_VARS=true
                log_success "Added missing BACKEND_PORT"
            fi
            
            # Extract SERVER_IP from existing .env or detect it
            EXISTING_SERVER_IP=$(grep -oP "^SERVER_IP=\K[^']+" "$BACKEND_DIR/.env" 2>/dev/null || hostname -I | awk '{print $1}')
            
            if ! grep -q "^NEXT_PUBLIC_API_URL=" "$BACKEND_DIR/.env"; then
                echo "NEXT_PUBLIC_API_URL=http://${EXISTING_SERVER_IP}:${EXISTING_BACKEND_PORT}" >> "$BACKEND_DIR/.env"
                ADDED_VARS=true
                log_success "Added missing NEXT_PUBLIC_API_URL"
            fi
            
            # Authentication secrets
            if ! grep -q "^NEXTAUTH_URL=" "$BACKEND_DIR/.env"; then
                echo "NEXTAUTH_URL=http://${EXISTING_SERVER_IP}:${EXISTING_BACKEND_PORT}" >> "$BACKEND_DIR/.env"
                ADDED_VARS=true
                log_success "Added missing NEXTAUTH_URL"
            fi
            
            if ! grep -q "^NEXTAUTH_SECRET=" "$BACKEND_DIR/.env"; then
                NEXTAUTH_SECRET=$(openssl rand -base64 32)
                echo "NEXTAUTH_SECRET=${NEXTAUTH_SECRET}" >> "$BACKEND_DIR/.env"
                ADDED_VARS=true
                log_success "Added missing NEXTAUTH_SECRET"
            fi
            
            if ! grep -q "^JWT_SECRET=" "$BACKEND_DIR/.env"; then
                JWT_SECRET=$(openssl rand -base64 32)
                echo "JWT_SECRET=${JWT_SECRET}" >> "$BACKEND_DIR/.env"
                ADDED_VARS=true
                log_success "Added missing JWT_SECRET"
            fi
            
            # Frontend configuration
            EXISTING_FRONTEND_PORT=$(grep -oP "^FRONTEND_PORT=\K[0-9]+" "$BACKEND_DIR/.env" 2>/dev/null || echo "80")
            
            if ! grep -q "^FRONTEND_URL=" "$BACKEND_DIR/.env"; then
                echo "FRONTEND_URL=http://${EXISTING_SERVER_IP}:${EXISTING_FRONTEND_PORT}" >> "$BACKEND_DIR/.env"
                ADDED_VARS=true
                log_success "Added missing FRONTEND_URL"
            fi
            
            if ! grep -q "^FRONTEND_PORT=" "$BACKEND_DIR/.env"; then
                echo "FRONTEND_PORT=${EXISTING_FRONTEND_PORT}" >> "$BACKEND_DIR/.env"
                ADDED_VARS=true
                log_success "Added missing FRONTEND_PORT"
            fi
            
            if ! grep -q "^SERVER_IP=" "$BACKEND_DIR/.env"; then
                echo "SERVER_IP=${EXISTING_SERVER_IP}" >> "$BACKEND_DIR/.env"
                ADDED_VARS=true
                log_success "Added missing SERVER_IP"
            fi
            
            # Cloudinary configuration
            if ! grep -q "^NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=" "$BACKEND_DIR/.env"; then
                echo "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=${DEFAULT_CLOUDINARY_CLOUD_NAME}" >> "$BACKEND_DIR/.env"
                ADDED_VARS=true
                log_success "Added missing NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME"
            fi
            
            if ! grep -q "^NEXT_PUBLIC_CLOUDINARY_API_KEY=" "$BACKEND_DIR/.env"; then
                echo "NEXT_PUBLIC_CLOUDINARY_API_KEY=${DEFAULT_CLOUDINARY_API_KEY}" >> "$BACKEND_DIR/.env"
                ADDED_VARS=true
                log_success "Added missing NEXT_PUBLIC_CLOUDINARY_API_KEY"
            fi
            
            if ! grep -q "^CLOUDINARY_API_SECRET=" "$BACKEND_DIR/.env"; then
                echo "CLOUDINARY_API_SECRET=${DEFAULT_CLOUDINARY_API_SECRET}" >> "$BACKEND_DIR/.env"
                ADDED_VARS=true
                log_success "Added missing CLOUDINARY_API_SECRET"
            fi
            
            # Stripe configuration
            if ! grep -q "^STRIPE_SECRET_KEY=" "$BACKEND_DIR/.env"; then
                echo "STRIPE_SECRET_KEY=${DEFAULT_STRIPE_SECRET_KEY}" >> "$BACKEND_DIR/.env"
                ADDED_VARS=true
                log_success "Added missing STRIPE_SECRET_KEY"
            fi
            
            if ! grep -q "^STRIPE_WEBHOOK_SECRET=" "$BACKEND_DIR/.env"; then
                echo "STRIPE_WEBHOOK_SECRET=${DEFAULT_STRIPE_WEBHOOK_SECRET}" >> "$BACKEND_DIR/.env"
                ADDED_VARS=true
                log_success "Added missing STRIPE_WEBHOOK_SECRET"
            fi
            
            if ! grep -q "^STRIPE_CURRENCY=" "$BACKEND_DIR/.env"; then
                echo "STRIPE_CURRENCY=${DEFAULT_STRIPE_CURRENCY}" >> "$BACKEND_DIR/.env"
                ADDED_VARS=true
                log_success "Added missing STRIPE_CURRENCY"
            fi
            
            # PayPal configuration
            if ! grep -q "^PAYPAL_CLIENT_ID=" "$BACKEND_DIR/.env"; then
                echo "PAYPAL_CLIENT_ID=${DEFAULT_PAYPAL_CLIENT_ID}" >> "$BACKEND_DIR/.env"
                ADDED_VARS=true
                log_success "Added missing PAYPAL_CLIENT_ID"
            fi
            
            if ! grep -q "^PAYPAL_CLIENT_SECRET=" "$BACKEND_DIR/.env"; then
                echo "PAYPAL_CLIENT_SECRET=${DEFAULT_PAYPAL_CLIENT_SECRET}" >> "$BACKEND_DIR/.env"
                ADDED_VARS=true
                log_success "Added missing PAYPAL_CLIENT_SECRET"
            fi
            
            if ! grep -q "^PAYPAL_MODE=" "$BACKEND_DIR/.env"; then
                echo "PAYPAL_MODE=${DEFAULT_PAYPAL_MODE}" >> "$BACKEND_DIR/.env"
                ADDED_VARS=true
                log_success "Added missing PAYPAL_MODE"
            fi
            
            # Email configuration (Resend)
            if ! grep -q "^RESEND_API_KEY=" "$BACKEND_DIR/.env"; then
                echo "RESEND_API_KEY=${DEFAULT_RESEND_API_KEY}" >> "$BACKEND_DIR/.env"
                ADDED_VARS=true
                log_success "Added missing RESEND_API_KEY"
            fi
            
            if ! grep -q "^RESEND_FROM_EMAIL=" "$BACKEND_DIR/.env"; then
                echo "RESEND_FROM_EMAIL=${DEFAULT_RESEND_FROM_EMAIL}" >> "$BACKEND_DIR/.env"
                ADDED_VARS=true
                log_success "Added missing RESEND_FROM_EMAIL"
            fi
            
            # Cron job security
            if ! grep -q "^CRON_SECRET=" "$BACKEND_DIR/.env"; then
                CRON_SECRET=$(openssl rand -base64 32)
                echo "CRON_SECRET=${CRON_SECRET}" >> "$BACKEND_DIR/.env"
                ADDED_VARS=true
                log_success "Added missing CRON_SECRET"
            fi
            
            if [ "$ADDED_VARS" = false ]; then
                log_success "All environment variables already present"
            fi
        fi
        
        log_step "Installing dependencies..."
        cd "$BACKEND_DIR"
        export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
        if ! pnpm install --frozen-lockfile 2>&1; then
            log_error "Dependency installation failed"
            exit 1
        fi
        log_success "Dependencies installed"
        
        log_step "Generating Prisma Client..."
        if ! pnpm prisma generate 2>&1; then
            log_error "Prisma generation failed"
            exit 1
        fi
        log_success "Prisma Client generated"
        
        log_step "Running database migrations..."
        if ! pnpm prisma migrate deploy 2>&1; then
            log_error "Database migrations failed"
            exit 1
        fi
        log_success "Database migrations completed"
        
        log_step "Rebuilding backend application..."
        # Load environment variables
        if [ -f "$BACKEND_DIR/.env" ]; then
            set -a
            source "$BACKEND_DIR/.env"
            set +a
        fi
        
        if ! pnpm build 2>&1 | tee /tmp/clutchpay-build.log | tail -20; then
            log_error "Build failed"
            exit 1
        fi
        log_success "Backend rebuilt"
        
        # Restart backend service
        log_step "Restarting backend service..."
        $SUDO_CMD systemctl start clutchpay-backend.service
        log_success "Backend service restarted"
        
        # Check and configure Stripe webhook if needed
        log_step "Checking Stripe webhook configuration..."
        
        # Check if stripe-webhook service exists and is running
        if $SUDO_CMD systemctl list-unit-files stripe-webhook.service &> /dev/null && \
           $SUDO_CMD systemctl is-active --quiet stripe-webhook.service 2>/dev/null; then
            log_success "Stripe webhook service is already running"
        else
            # Service doesn't exist or is not running - configure it
            log_info "Configuring Stripe webhook..."
            
            # Get current backend port from .env
            CURRENT_BACKEND_PORT=$(grep -o "^BACKEND_PORT=[0-9]*" "$BACKEND_DIR/.env" 2>/dev/null | cut -d'=' -f2 || echo "3000")
            
            # Use the unified config_stripe function in non-interactive mode
            config_stripe "false" "$BACKEND_DIR" "$CURRENT_BACKEND_PORT" || log_info "Stripe webhook can be configured later with: ./installer.sh --config-stripe"
        fi
    fi
    
    # Update frontend if requested
    if [ "$UPDATE_FRONTEND" = true ]; then
        log_header "Updating Frontend"
        
        # Determine Apache document root
        APACHE_DOC_ROOT="${DEFAULT_APACHE_DOC_ROOT}"
        
        if [ "$INTERACTIVE_MODE" = true ]; then
            # Interactive mode: ask for frontend location
            echo -e "${YELLOW}Enter the Apache document root for frontend (default: ${DEFAULT_APACHE_DOC_ROOT}):${NC}"
            read -r USER_APACHE_DOC_ROOT
            APACHE_DOC_ROOT="${USER_APACHE_DOC_ROOT:-${DEFAULT_APACHE_DOC_ROOT}}"
        fi
        
        # Verify frontend directory exists
        if [ ! -d "$APACHE_DOC_ROOT" ]; then
            if [ "$INTERACTIVE_MODE" = true ]; then
                log_error "Frontend directory not found at $APACHE_DOC_ROOT"
                echo -e "${YELLOW}Would you like to create it? (Y/n):${NC}"
                read -r CREATE_DIR
                if [[ ! "$CREATE_DIR" =~ ^[Nn]$ ]]; then
                    $SUDO_CMD mkdir -p "$APACHE_DOC_ROOT"
                    log_success "Created frontend directory: $APACHE_DOC_ROOT"
                else
                    log_error "Cannot update frontend without a valid directory"
                    exit 1
                fi
            else
                log_error "Frontend directory not found at $APACHE_DOC_ROOT"
                log_info "Run with -i flag for interactive mode to specify a different location"
                exit 1
            fi
        fi
        
        # Preserve existing config.js values (BACKEND_IP and BACKEND_PORT)
        PRESERVED_BACKEND_IP=""
        PRESERVED_BACKEND_PORT=""
        
        if [ -f "$APACHE_DOC_ROOT/JS/config.js" ]; then
            log_step "Preserving existing frontend configuration..."
            PRESERVED_BACKEND_IP=$(grep -oP "const BACKEND_IP = '\K[^']+" "$APACHE_DOC_ROOT/JS/config.js" 2>/dev/null || echo "")
            PRESERVED_BACKEND_PORT=$(grep -oP "const BACKEND_PORT = \K[0-9]+" "$APACHE_DOC_ROOT/JS/config.js" 2>/dev/null || echo "")
            
            if [ -n "$PRESERVED_BACKEND_IP" ]; then
                log_success "Preserved BACKEND_IP: $PRESERVED_BACKEND_IP"
            fi
            if [ -n "$PRESERVED_BACKEND_PORT" ]; then
                log_success "Preserved BACKEND_PORT: $PRESERVED_BACKEND_PORT"
            fi
        fi
        
        log_step "Updating frontend files..."
        if ! $SUDO_CMD cp -r "$FRONTEND_DIR"/* "$APACHE_DOC_ROOT/" 2>&1; then
            log_error "Failed to copy frontend files"
            exit 1
        fi
        log_success "Frontend files copied"
        
        # Restore preserved config.js values
        if [ -n "$PRESERVED_BACKEND_IP" ] || [ -n "$PRESERVED_BACKEND_PORT" ]; then
            log_step "Restoring frontend configuration..."
            
            if [ -n "$PRESERVED_BACKEND_IP" ]; then
                $SUDO_CMD sed -i "s|const BACKEND_IP = '.*';|const BACKEND_IP = '${PRESERVED_BACKEND_IP}';|" "$APACHE_DOC_ROOT/JS/config.js"
            fi
            
            if [ -n "$PRESERVED_BACKEND_PORT" ]; then
                $SUDO_CMD sed -i "s|const BACKEND_PORT = [0-9]*;|const BACKEND_PORT = ${PRESERVED_BACKEND_PORT};|" "$APACHE_DOC_ROOT/JS/config.js"
            fi
            
            log_success "Frontend configuration restored"
        fi
        
        $SUDO_CMD chown -R www-data:www-data "$APACHE_DOC_ROOT"
        log_success "Frontend files updated"
        
        log_step "Reloading Apache..."
        $SUDO_CMD systemctl reload apache2
        log_success "Apache reloaded"
    fi
    
    log_header "Update Complete! 🎉"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}${BOLD}  ClutchPay has been successfully updated!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    echo -e "${CYAN}Updated to version: ${GREEN}$UPDATE_TAG${NC}\n"
    [ "$UPDATE_BACKEND" = true ] && echo -e "${GREEN}✓${NC} Backend updated"
    [ "$UPDATE_FRONTEND" = true ] && echo -e "${GREEN}✓${NC} Frontend updated"
    echo ""
}

################################################################################
# Configure Backend Function
################################################################################
config_backend() {
    log_header "Configure Backend - Frontend Location"
    
    # Ask for installation directory
    echo -e "${YELLOW}Backend installation directory (default: ${DEFAULT_INSTALL_DIR}):${NC}"
    read -r USER_INSTALL_DIR
    
    INSTALL_DIR="${USER_INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"
    
    # Check if user provided the root dir or the backend dir
    if [ -f "$INSTALL_DIR/package.json" ] && [ -f "$INSTALL_DIR/.env" ]; then
        BACKEND_DIR="$INSTALL_DIR"
    else
        BACKEND_DIR="$INSTALL_DIR/$BACKEND_SUBDIR"
    fi
    
    if [ ! -d "$BACKEND_DIR" ]; then
        log_error "Backend directory not found at $BACKEND_DIR"
        exit 1
    fi
    
    if [ ! -f "$BACKEND_DIR/.env" ]; then
        log_error "Backend .env file not found at $BACKEND_DIR/.env"
        exit 1
    fi
    
    log_success "Backend found at: $BACKEND_DIR"
    
    # Get new frontend location
    while true; do
        echo -e "\n${YELLOW}Enter the new frontend IP address:${NC}"
        read -r NEW_FRONTEND_IP
        
        if [ -z "$NEW_FRONTEND_IP" ]; then
            log_error "IP address cannot be empty"
        elif validate_ip "$NEW_FRONTEND_IP"; then
            break
        else
            log_error "Invalid IP address format"
        fi
    done
    
    while true; do
        echo -e "${YELLOW}Enter the new frontend port (default: 80):${NC}"
        read -r NEW_FRONTEND_PORT
        NEW_FRONTEND_PORT="${NEW_FRONTEND_PORT:-80}"
        
        if validate_port "$NEW_FRONTEND_PORT"; then
            break
        else
            log_error "Invalid port number: $NEW_FRONTEND_PORT"
        fi
    done
    
    # Final confirmation
    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Please confirm the new frontend location:${NC}"
    echo -e "  IP:   ${CYAN}$NEW_FRONTEND_IP${NC}"
    echo -e "  Port: ${CYAN}$NEW_FRONTEND_PORT${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Is this correct? (Y/n):${NC}"
    read -r CONFIRM
    
    if [[ "$CONFIRM" =~ ^[Nn]$ ]]; then
        log_error "Configuration cancelled"
        exit 1
    fi
    
    log_step "Updating backend configuration..."
    
    # Update only SERVER_IP (frontend server IP for CORS) and FRONTEND_PORT
    sed -i "s|^SERVER_IP=.*|SERVER_IP=${NEW_FRONTEND_IP}|" "$BACKEND_DIR/.env"
    sed -i "s|^FRONTEND_PORT=.*|FRONTEND_PORT=${NEW_FRONTEND_PORT}|" "$BACKEND_DIR/.env"
    
    log_success "Updated SERVER_IP to ${NEW_FRONTEND_IP}"
    log_success "Updated FRONTEND_PORT to ${NEW_FRONTEND_PORT}"
    
    # Rebuild backend with new configuration
    log_step "Rebuilding backend with new configuration..."
    cd "$BACKEND_DIR"
    
    # Load environment variables
    set -a
    source "$BACKEND_DIR/.env"
    set +a
    
    export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
    pnpm build > /dev/null 2>&1
    log_success "Backend rebuilt"
    
    # Restart backend service
    log_step "Restarting backend service..."
    $SUDO_CMD systemctl restart clutchpay-backend.service
    log_success "Backend service restarted"
    
    log_header "Configuration Complete! 🎉"
    echo -e "${GREEN}Backend now configured to accept requests from:${NC}"
    echo -e "  Frontend URL: ${CYAN}http://${NEW_FRONTEND_IP}:${NEW_FRONTEND_PORT}${NC}\n"
}

################################################################################
# Configure Frontend Function
################################################################################
config_frontend() {
    log_header "Configure Frontend - Backend Location"
    
    # Ask for frontend directory
    echo -e "${YELLOW}Frontend directory (default: ${DEFAULT_APACHE_DOC_ROOT}):${NC}"
    read -r USER_FRONTEND_DIR
    
    FRONTEND_DIR="${USER_FRONTEND_DIR:-${DEFAULT_APACHE_DOC_ROOT}}"
    
    if [ ! -d "$FRONTEND_DIR" ]; then
        log_error "Frontend directory not found at $FRONTEND_DIR"
        exit 1
    fi
    
    log_success "Frontend found at: $FRONTEND_DIR"
    
    # Get new backend location
    while true; do
        echo -e "\n${YELLOW}Enter the new backend API IP address:${NC}"
        read -r NEW_BACKEND_IP
        
        if [ -z "$NEW_BACKEND_IP" ]; then
            log_error "IP address cannot be empty"
        elif validate_ip "$NEW_BACKEND_IP"; then
            break
        else
            log_error "Invalid IP address format"
        fi
    done
    
    while true; do
        echo -e "${YELLOW}Enter the new backend API port (default: 3000):${NC}"
        read -r NEW_BACKEND_PORT
        NEW_BACKEND_PORT="${NEW_BACKEND_PORT:-3000}"
        
        if validate_port "$NEW_BACKEND_PORT"; then
            break
        else
            log_error "Invalid port number: $NEW_BACKEND_PORT"
        fi
    done
    
    # Final confirmation
    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Please confirm the new backend location:${NC}"
    echo -e "  IP:   ${CYAN}$NEW_BACKEND_IP${NC}"
    echo -e "  Port: ${CYAN}$NEW_BACKEND_PORT${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Is this correct? (Y/n):${NC}"
    read -r CONFIRM
    
    if [[ "$CONFIRM" =~ ^[Nn]$ ]]; then
        log_error "Configuration cancelled"
        exit 1
    fi
    
    log_step "Updating frontend configuration..."
    
    # Update config.js with new backend IP and port
    if [ -f "$FRONTEND_DIR/JS/config.js" ]; then
        sed -i "s|const BACKEND_IP = '.*';|const BACKEND_IP = '${NEW_BACKEND_IP}';|" "$FRONTEND_DIR/JS/config.js"
        sed -i "s|const BACKEND_PORT = [0-9]*;|const BACKEND_PORT = ${NEW_BACKEND_PORT};|" "$FRONTEND_DIR/JS/config.js"
        log_success "Updated JS/config.js with backend at ${NEW_BACKEND_IP}:${NEW_BACKEND_PORT}"
    else
        log_warning "JS/config.js not found. Skipping config update."
    fi
    
    log_success "Updated frontend to use backend at http://${NEW_BACKEND_IP}:${NEW_BACKEND_PORT}"
    
    log_header "Configuration Complete! 🎉"
    echo -e "${GREEN}Frontend now configured to connect to:${NC}"
    echo -e "  Backend API: ${CYAN}http://${NEW_BACKEND_IP}:${NEW_BACKEND_PORT}${NC}\n"
}

################################################################################
# Helper Function - Find Backend Directory
################################################################################
find_backend_dir() {
    # Ask for installation directory
    echo -e "${YELLOW}Backend installation directory (default: ${DEFAULT_INSTALL_DIR}):${NC}"
    read -r USER_INSTALL_DIR
    
    INSTALL_DIR="${USER_INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"
    
    # Check if user provided the root dir or the backend dir
    if [ -f "$INSTALL_DIR/package.json" ] && [ -f "$INSTALL_DIR/.env" ]; then
        BACKEND_DIR="$INSTALL_DIR"
    else
        BACKEND_DIR="$INSTALL_DIR/$BACKEND_SUBDIR"
    fi
    
    if [ ! -d "$BACKEND_DIR" ]; then
        log_error "Backend directory not found at $BACKEND_DIR"
        exit 1
    fi
    
    if [ ! -f "$BACKEND_DIR/.env" ]; then
        log_error "Backend .env file not found at $BACKEND_DIR/.env"
        exit 1
    fi
    
    log_success "Backend found at: $BACKEND_DIR"
}

################################################################################
# Helper Function - Update or Add Environment Variable
################################################################################
update_env_var() {
    local env_file="$1"
    local var_name="$2"
    local var_value="$3"
    
    # Check if variable exists in the file
    if grep -q "^${var_name}=" "$env_file"; then
        # Update existing variable
        sed -i "s|^${var_name}=.*|${var_name}=${var_value}|" "$env_file"
    else
        # Add new variable at the end
        echo "${var_name}=${var_value}" >> "$env_file"
    fi
}

################################################################################
# Setup Stripe Webhook with CLI Function
################################################################################
setup_stripe_webhook() {
    local stripe_secret_key="$1"
    local backend_port="$2"
    local backend_dir="$3"
    
    # Redirect all logs to stderr so they don't contaminate the return value
    log_step "Setting up Stripe webhook listener..." >&2
    
    # Create a temporary file to capture the webhook secret
    local webhook_output="/tmp/stripe_webhook_output_$$"
    local webhook_secret=""
    
    # Start stripe listen in background and capture output
    log_step "Starting Stripe CLI webhook listener..." >&2
    
    # Run stripe listen and capture the webhook signing secret
    # The --api-key flag allows us to authenticate without interactive login
    stripe listen \
        --api-key "$stripe_secret_key" \
        --forward-to "http://localhost:${backend_port}/api/payments/stripe/webhook" \
        --print-secret > "$webhook_output" 2>&1 &
    
    local stripe_pid=$!
    
    # Wait a moment for the webhook secret to be printed
    sleep 5
    
    # Read the webhook secret from output
    # Use grep without -P flag for compatibility with all Debian/Linux versions
    if [ -f "$webhook_output" ]; then
        webhook_secret=$(cat "$webhook_output" | grep -o 'whsec_[a-zA-Z0-9_]*' | head -1)
    fi
    
    # Kill the temporary process (we'll start the real one as a service)
    kill $stripe_pid 2>/dev/null || true
    rm -f "$webhook_output"
    
    if [ -z "$webhook_secret" ]; then
        log_error "Could not capture webhook secret. Trying alternative method..." >&2
        
        # Alternative: Use stripe listen with --print-secret only (with timeout to prevent blocking)
        webhook_secret=$(timeout 10 stripe listen --api-key "$stripe_secret_key" --print-secret 2>/dev/null | grep -o 'whsec_[a-zA-Z0-9_]*' | head -1)
        
        if [ -z "$webhook_secret" ]; then
            log_error "Failed to get webhook secret from Stripe CLI" >&2
            return 1
        fi
    fi
    
    log_success "Captured webhook secret: ${webhook_secret:0:15}..." >&2
    
    # Update .env with the webhook secret
    update_env_var "$backend_dir/.env" "STRIPE_WEBHOOK_SECRET" "$webhook_secret"
    log_success "Updated STRIPE_WEBHOOK_SECRET in .env" >&2
    
    # Return ONLY the webhook secret (no other output)
    echo "$webhook_secret"
}

################################################################################
# Create Stripe Webhook Systemd Service
################################################################################
create_stripe_webhook_service() {
    local stripe_secret_key="$1"
    local backend_port="$2"
    
    log_step "Creating Stripe webhook listener systemd service..."
    
    # Create systemd service for stripe webhook listener
    $SUDO_CMD tee /etc/systemd/system/stripe-webhook.service > /dev/null << EOF
[Unit]
Description=Stripe CLI Webhook Listener for ClutchPay
After=network.target clutchpay-backend.service
Wants=clutchpay-backend.service

[Service]
Type=simple
ExecStart=/usr/local/bin/stripe listen --api-key ${stripe_secret_key} --forward-to http://localhost:${backend_port}/api/payments/stripe/webhook
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Security settings
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true

[Install]
WantedBy=multi-user.target
EOF

    # Check if stripe is in /usr/bin instead
    if [ -f "/usr/bin/stripe" ]; then
        $SUDO_CMD sed -i 's|/usr/local/bin/stripe|/usr/bin/stripe|g' /etc/systemd/system/stripe-webhook.service
    fi

    # Reload systemd and enable service
    $SUDO_CMD systemctl daemon-reload
    $SUDO_CMD systemctl enable stripe-webhook.service
    $SUDO_CMD systemctl start stripe-webhook.service
    
    # Check if service started successfully
    sleep 2
    if $SUDO_CMD systemctl is-active --quiet stripe-webhook.service; then
        log_success "Stripe webhook listener service started successfully"
        return 0
    else
        log_warning "Stripe webhook service may not have started. Check with: systemctl status stripe-webhook"
        return 1
    fi
}

################################################################################
# Configure Stripe Function
# This function handles both interactive and non-interactive modes:
# - Interactive: Asks for secret key, webhook method (CLI or manual), currency
# - Non-interactive: Uses existing secret key from .env, auto-configures with CLI
################################################################################
config_stripe() {
    local interactive="${1:-true}"  # Default to interactive mode
    local backend_dir="${2:-}"      # Optional: backend dir for non-interactive
    local backend_port="${3:-}"     # Optional: backend port for non-interactive
    
    log_header "Configure Stripe Payment Credentials"
    
    # Find backend directory
    if [ -z "$backend_dir" ]; then
        find_backend_dir
        backend_dir="$BACKEND_DIR"
    fi
    
    # Get backend port from .env or use default
    if [ -z "$backend_port" ]; then
        backend_port=$(grep -o '^PORT=[0-9]*' "$backend_dir/.env" 2>/dev/null | cut -d'=' -f2 || echo "3000")
    fi
    
    local stripe_secret_key=""
    local stripe_webhook_secret=""
    local stripe_currency="eur"
    local webhook_option="1"  # Default to CLI
    
    if [ "$interactive" = "true" ]; then
        ####################
        # INTERACTIVE MODE
        ####################
        
        # Ask for webhook method
        echo -e "\n${YELLOW}How would you like to configure Stripe webhooks?${NC}"
        echo -e "  ${CYAN}1)${NC} Automatic setup with Stripe CLI (recommended for development/demo)"
        echo -e "  ${CYAN}2)${NC} Manual setup (enter webhook secret from Stripe Dashboard)"
        echo -e "${YELLOW}Choose option [1/2]:${NC}"
        read -r webhook_option
        webhook_option="${webhook_option:-1}"
        
        # Get Stripe Secret Key
        echo -e "\n${YELLOW}Enter your Stripe Secret Key (starts with sk_test_ or sk_live_):${NC}"
        echo -e "${BLUE}Get it from: https://dashboard.stripe.com/apikeys${NC}"
        read -r stripe_secret_key
        
        if [ -z "$stripe_secret_key" ]; then
            log_error "Stripe Secret Key cannot be empty"
            return 1
        fi
        
    else
        ####################
        # NON-INTERACTIVE MODE
        ####################
        
        # Read existing Stripe key from .env
        stripe_secret_key=$(grep "^STRIPE_SECRET_KEY=" "$backend_dir/.env" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'")
        
        if [ -z "$stripe_secret_key" ]; then
            log_warning "No Stripe Secret Key found in .env. Skipping webhook configuration."
            log_info "Configure Stripe later with: ./installer.sh --config-stripe"
            return 1
        fi
        
        log_info "Using existing Stripe Secret Key from .env"
        webhook_option="1"  # Always use CLI in non-interactive mode
    fi
    
    # Configure webhook based on selected option
    if [ "$webhook_option" = "1" ]; then
        # Automatic webhook setup with Stripe CLI
        log_step "Automatic Stripe Webhook Setup with CLI..."
        
        # Install Stripe CLI if not present
        if ! command -v stripe &> /dev/null; then
            install_stripe_cli
            
            if ! command -v stripe &> /dev/null; then
                log_error "Failed to install Stripe CLI"
                if [ "$interactive" = "true" ]; then
                    log_info "Please install Stripe CLI manually and try again"
                    return 1
                else
                    log_info "Configure Stripe later with: ./installer.sh --config-stripe"
                    return 1
                fi
            fi
        fi
        
        # Setup webhook and get secret
        stripe_webhook_secret=$(setup_stripe_webhook "$stripe_secret_key" "$backend_port" "$backend_dir")
        
        if [ -z "$stripe_webhook_secret" ]; then
            log_error "Failed to setup webhook automatically."
            if [ "$interactive" = "true" ]; then
                log_info "Please try manual setup (option 2)"
                return 1
            else
                log_info "Configure Stripe later with: ./installer.sh --config-stripe"
                return 1
            fi
        fi
        
        # Create systemd service for persistent webhook listener
        create_stripe_webhook_service "$stripe_secret_key" "$backend_port"
        
    else
        # Manual webhook secret entry (only in interactive mode)
        echo -e "\n${YELLOW}Enter your Stripe Webhook Secret (starts with whsec_):${NC}"
        echo -e "${BLUE}Get it after creating webhook endpoint in Stripe Dashboard${NC}"
        read -r stripe_webhook_secret
        
        if [ -z "$stripe_webhook_secret" ]; then
            log_error "Stripe Webhook Secret cannot be empty"
            return 1
        fi
    fi
    
    # Get Stripe Currency (only in interactive mode)
    if [ "$interactive" = "true" ]; then
        echo -e "\n${YELLOW}Enter currency code (default: eur):${NC}"
        echo -e "${BLUE}Examples: usd, eur, gbp${NC}"
        read -r stripe_currency
        stripe_currency="${stripe_currency:-eur}"
        
        # Final confirmation
        echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${YELLOW}Please confirm the Stripe configuration:${NC}"
        echo -e "  Secret Key:     ${CYAN}${stripe_secret_key:0:12}...${NC}"
        echo -e "  Webhook Secret: ${CYAN}${stripe_webhook_secret:0:12}...${NC}"
        echo -e "  Currency:       ${CYAN}${stripe_currency}${NC}"
        if [ "$webhook_option" = "1" ]; then
            echo -e "  Webhook Mode:   ${CYAN}Automatic (Stripe CLI)${NC}"
        else
            echo -e "  Webhook Mode:   ${CYAN}Manual${NC}"
        fi
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${YELLOW}Is this correct? (Y/n):${NC}"
        read -r CONFIRM
        
        if [[ "$CONFIRM" =~ ^[Nn]$ ]]; then
            log_error "Configuration cancelled"
            return 1
        fi
        
        # Update secret key and currency in interactive mode
        update_env_var "$backend_dir/.env" "STRIPE_SECRET_KEY" "$stripe_secret_key"
        update_env_var "$backend_dir/.env" "STRIPE_CURRENCY" "$stripe_currency"
    fi
    
    # Update webhook secret (both modes)
    log_step "Updating Stripe webhook configuration..."
    update_env_var "$backend_dir/.env" "STRIPE_WEBHOOK_SECRET" "$stripe_webhook_secret"
    
    log_success "Stripe configuration updated"
    
    # Restart backend service (only if it exists and is running)
    if systemctl is-active --quiet clutchpay-backend.service 2>/dev/null; then
        log_step "Restarting backend service..."
        $SUDO_CMD systemctl restart clutchpay-backend.service 2>/dev/null || log_warning "Could not restart backend service"
    fi
    
    log_success "Stripe Configuration Complete! 🎉"
    
    if [ "$interactive" = "true" ]; then
        echo -e "${GREEN}Stripe payments are now configured.${NC}"
        
        if [ "$webhook_option" = "1" ]; then
            echo -e "\n${GREEN}✓ Stripe CLI webhook listener is running as a service${NC}"
            echo -e "${YELLOW}Commands to manage the webhook listener:${NC}"
            echo -e "  ${CYAN}systemctl status stripe-webhook${NC}   - Check status"
            echo -e "  ${CYAN}systemctl restart stripe-webhook${NC}  - Restart listener"
            echo -e "  ${CYAN}journalctl -u stripe-webhook -f${NC}   - View logs"
        else
            echo -e "${YELLOW}Note: Make sure your webhook endpoint is configured in Stripe Dashboard:${NC}"
            echo -e "  Endpoint URL: ${CYAN}http://YOUR_BACKEND_IP:${backend_port}/api/payments/stripe/webhook${NC}"
        fi
        echo ""
    fi
    
    return 0
}

################################################################################
# Configure PayPal Function
################################################################################
config_paypal() {
    log_header "Configure PayPal Payout Credentials"
    
    find_backend_dir
    
    # Get PayPal Client ID
    echo -e "\n${YELLOW}Enter your PayPal Client ID:${NC}"
    echo -e "${BLUE}Get it from: https://developer.paypal.com/dashboard${NC}"
    read -r PAYPAL_CLIENT_ID
    
    if [ -z "$PAYPAL_CLIENT_ID" ]; then
        log_error "PayPal Client ID cannot be empty"
        exit 1
    fi
    
    # Get PayPal Client Secret
    echo -e "\n${YELLOW}Enter your PayPal Client Secret:${NC}"
    read -r PAYPAL_CLIENT_SECRET
    
    if [ -z "$PAYPAL_CLIENT_SECRET" ]; then
        log_error "PayPal Client Secret cannot be empty"
        exit 1
    fi
    
    # Get PayPal Mode
    echo -e "\n${YELLOW}Select PayPal mode:${NC}"
    echo "  1) sandbox (testing)"
    echo "  2) live (production)"
    echo -n "  Enter your choice (default: 1): "
    read -r MODE_CHOICE
    
    case "${MODE_CHOICE:-1}" in
        1) PAYPAL_MODE="sandbox" ;;
        2) PAYPAL_MODE="live" ;;
        *) PAYPAL_MODE="sandbox" ;;
    esac
    
    # Final confirmation
    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Please confirm the PayPal configuration:${NC}"
    echo -e "  Client ID:     ${CYAN}${PAYPAL_CLIENT_ID:0:20}...${NC}"
    echo -e "  Client Secret: ${CYAN}${PAYPAL_CLIENT_SECRET:0:12}...${NC}"
    echo -e "  Mode:          ${CYAN}${PAYPAL_MODE}${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Is this correct? (Y/n):${NC}"
    read -r CONFIRM
    
    if [[ "$CONFIRM" =~ ^[Nn]$ ]]; then
        log_error "Configuration cancelled"
        exit 1
    fi
    
    log_step "Updating PayPal configuration..."
    
    update_env_var "$BACKEND_DIR/.env" "PAYPAL_CLIENT_ID" "$PAYPAL_CLIENT_ID"
    update_env_var "$BACKEND_DIR/.env" "PAYPAL_CLIENT_SECRET" "$PAYPAL_CLIENT_SECRET"
    update_env_var "$BACKEND_DIR/.env" "PAYPAL_MODE" "$PAYPAL_MODE"
    
    log_success "PayPal configuration updated"
    
    # Restart backend service
    log_step "Restarting backend service..."
    $SUDO_CMD systemctl restart clutchpay-backend.service 2>/dev/null || log_warning "Could not restart backend service"
    
    log_header "PayPal Configuration Complete! 🎉"
    echo -e "${GREEN}PayPal payouts are now configured.${NC}\n"
}

################################################################################
# Configure Resend Function
################################################################################
config_resend() {
    log_header "Configure Resend Email Service"
    
    find_backend_dir
    
    # Get Resend API Key
    echo -e "\n${YELLOW}Enter your Resend API Key (starts with re_):${NC}"
    echo -e "${BLUE}Get it from: https://resend.com/api-keys${NC}"
    read -r RESEND_API_KEY
    
    if [ -z "$RESEND_API_KEY" ]; then
        log_error "Resend API Key cannot be empty"
        exit 1
    fi
    
    # Get From Email
    echo -e "\n${YELLOW}Enter the 'From' email address (default: ${DEFAULT_RESEND_FROM_EMAIL}):${NC}"
    echo -e "${BLUE}Note: The domain must be verified in your Resend dashboard${NC}"
    read -r RESEND_FROM_EMAIL
    RESEND_FROM_EMAIL="${RESEND_FROM_EMAIL:-${DEFAULT_RESEND_FROM_EMAIL}}"
    
    # Final confirmation
    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Please confirm the Resend configuration:${NC}"
    echo -e "  API Key:    ${CYAN}${RESEND_API_KEY:0:12}...${NC}"
    echo -e "  From Email: ${CYAN}${RESEND_FROM_EMAIL}${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Is this correct? (Y/n):${NC}"
    read -r CONFIRM
    
    if [[ "$CONFIRM" =~ ^[Nn]$ ]]; then
        log_error "Configuration cancelled"
        exit 1
    fi
    
    log_step "Updating Resend configuration..."
    
    update_env_var "$BACKEND_DIR/.env" "RESEND_API_KEY" "$RESEND_API_KEY"
    update_env_var "$BACKEND_DIR/.env" "RESEND_FROM_EMAIL" "\"$RESEND_FROM_EMAIL\""
    
    log_success "Resend configuration updated"
    
    # Restart backend service
    log_step "Restarting backend service..."
    $SUDO_CMD systemctl restart clutchpay-backend.service 2>/dev/null || log_warning "Could not restart backend service"
    
    log_header "Resend Configuration Complete! 🎉"
    echo -e "${GREEN}Email notifications are now configured.${NC}"
    echo -e "${YELLOW}Note: Make sure your domain is verified in the Resend dashboard.${NC}\n"
}

################################################################################
# Configure Cloudinary Function
################################################################################
config_cloudinary() {
    log_header "Configure Cloudinary Image Storage"
    
    find_backend_dir
    
    # Get Cloud Name
    echo -e "\n${YELLOW}Enter your Cloudinary Cloud Name:${NC}"
    echo -e "${BLUE}Get it from: https://console.cloudinary.com/settings/c-*/upload${NC}"
    read -r CLOUDINARY_CLOUD_NAME
    
    if [ -z "$CLOUDINARY_CLOUD_NAME" ]; then
        log_error "Cloudinary Cloud Name cannot be empty"
        exit 1
    fi
    
    # Get API Key
    echo -e "\n${YELLOW}Enter your Cloudinary API Key:${NC}"
    read -r CLOUDINARY_API_KEY
    
    if [ -z "$CLOUDINARY_API_KEY" ]; then
        log_error "Cloudinary API Key cannot be empty"
        exit 1
    fi
    
    # Get API Secret
    echo -e "\n${YELLOW}Enter your Cloudinary API Secret:${NC}"
    read -r CLOUDINARY_API_SECRET
    
    if [ -z "$CLOUDINARY_API_SECRET" ]; then
        log_error "Cloudinary API Secret cannot be empty"
        exit 1
    fi
    
    # Final confirmation
    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Please confirm the Cloudinary configuration:${NC}"
    echo -e "  Cloud Name: ${CYAN}${CLOUDINARY_CLOUD_NAME}${NC}"
    echo -e "  API Key:    ${CYAN}${CLOUDINARY_API_KEY}${NC}"
    echo -e "  API Secret: ${CYAN}${CLOUDINARY_API_SECRET:0:12}...${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Is this correct? (Y/n):${NC}"
    read -r CONFIRM
    
    if [[ "$CONFIRM" =~ ^[Nn]$ ]]; then
        log_error "Configuration cancelled"
        exit 1
    fi
    
    log_step "Updating Cloudinary configuration..."
    
    update_env_var "$BACKEND_DIR/.env" "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME" "$CLOUDINARY_CLOUD_NAME"
    update_env_var "$BACKEND_DIR/.env" "NEXT_PUBLIC_CLOUDINARY_API_KEY" "$CLOUDINARY_API_KEY"
    update_env_var "$BACKEND_DIR/.env" "CLOUDINARY_API_SECRET" "$CLOUDINARY_API_SECRET"
    
    log_success "Cloudinary configuration updated"
    
    # Rebuild and restart backend service
    log_step "Rebuilding backend with new configuration..."
    cd "$BACKEND_DIR"
    
    # Load environment variables
    set -a
    source "$BACKEND_DIR/.env"
    set +a
    
    export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
    pnpm build > /dev/null 2>&1 || log_warning "Could not rebuild backend (NEXT_PUBLIC_ vars need rebuild)"
    
    log_step "Restarting backend service..."
    $SUDO_CMD systemctl restart clutchpay-backend.service 2>/dev/null || log_warning "Could not restart backend service"
    
    log_header "Cloudinary Configuration Complete! 🎉"
    echo -e "${GREEN}Cloudinary image storage is now configured.${NC}\n"
}

################################################################################
# Main Script Entry Point
################################################################################

# Parse command line arguments
MODE=""
while [[ $# -gt 0 ]]; do
    case "${1}" in
        -i|--interactive)
            INTERACTIVE_MODE=true
            shift
            ;;
        --backend-only)
            MODE="backend"
            shift
            ;;
        --frontend-only)
            MODE="frontend"
            shift
            ;;
        --update)
            MODE="update"
            UPDATE_TAG="${2:-}"
            shift
            if [[ -n "${UPDATE_TAG}" && ! "${UPDATE_TAG}" =~ ^- ]]; then
                shift
            fi
            ;;
        --config-backend)
            MODE="config-backend"
            shift
            ;;
        --config-frontend)
            MODE="config-frontend"
            shift
            ;;
        --config-stripe)
            MODE="config-stripe"
            shift
            ;;
        --config-paypal)
            MODE="config-paypal"
            shift
            ;;
        --config-resend)
            MODE="config-resend"
            shift
            ;;
        --config-cloudinary)
            MODE="config-cloudinary"
            shift
            ;;
        --help|-h)
            echo -e "${CYAN}ClutchPay Installer${NC}"
            echo ""
            echo "Usage:"
            echo "  ./installer.sh                         Full installation (backend + frontend)"
            echo "  ./installer.sh -i                      Full installation (interactive mode)"
            echo "  ./installer.sh --backend-only          Install only backend (PostgreSQL, Node.js, API)"
            echo "  ./installer.sh --backend-only -i       Install backend (interactive mode)"
            echo "  ./installer.sh --frontend-only         Install only frontend (Apache, static files)"
            echo "  ./installer.sh --frontend-only -i      Install frontend (interactive mode)"
            echo "  ./installer.sh --update [tag]          Update to a specific version (non-interactive)"
            echo "  ./installer.sh -i --update [tag]       Update with interactive mode and specific tag"
            echo "  ./installer.sh --config-backend        Configure backend (new frontend location)"
            echo "  ./installer.sh --config-frontend       Configure frontend (new backend location)"
            echo "  ./installer.sh --config-stripe         Configure Stripe payment credentials"
            echo "  ./installer.sh --config-paypal         Configure PayPal payout credentials"
            echo "  ./installer.sh --config-resend         Configure Resend email service"
            echo "  ./installer.sh --config-cloudinary     Configure Cloudinary image storage"
            echo "  ./installer.sh --help                  Show this help message"
            echo ""
            echo "Interactive mode (-i) options:"
            echo "  - Prompts for installation directory"
            echo "  - Prompts for port numbers"
            echo "  - Confirms auto-detected IP address"
            echo "  - Prompts for all configuration options"
            echo ""
            echo "Service Configuration:"
            echo "  Use --config-stripe, --config-paypal, --config-resend, or --config-cloudinary"
            echo "  to configure external service credentials after installation."
            echo ""
            exit 0
            ;;
        *)
            if [ -z "$MODE" ]; then
                MODE="full"
            fi
            shift
            ;;
    esac
done

# Execute based on mode
case "${MODE:-full}" in
    backend)
        install_backend_only
        ;;
    frontend)
        install_frontend_only
        ;;
    update)
        update_clutchpay
        ;;
    config-backend)
        config_backend
        ;;
    config-frontend)
        config_frontend
        ;;
    config-stripe)
        config_stripe
        ;;
    config-paypal)
        config_paypal
        ;;
    config-resend)
        config_resend
        ;;
    config-cloudinary)
        config_cloudinary
        ;;
    *)
        install_clutchpay
        ;;
esac
