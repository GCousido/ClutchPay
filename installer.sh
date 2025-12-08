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

# Repository Configuration
REPO_URL="https://github.com/GCousido/ClutchPay.git"
REPO_TAG="main"

# Database credentials (from .env defaults)
DB_NAME="clutchpay_db"
DB_USER="clutchpay_user"
DB_PASSWORD="clutchpay_pass"

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

# Cloudinary Configuration
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=clutchpay
NEXT_PUBLIC_CLOUDINARY_API_KEY=316689144486275
CLOUDINARY_API_SECRET=7OboPECLxjrFxAsY0C4uFk9ny3A
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
}

################################################################################
# Helper function - Setup frontend specific installation
################################################################################
setup_frontend_installation() {
    local frontend_dir="$1"
    local frontend_port="$2"
    local backend_ip="$3"
    local backend_port="$4"

    log_header "Setting up Frontend"

    # Copy frontend files to Apache document root
    APACHE_DOC_ROOT="/var/www/clutchpay"
    log_step "Copying frontend files to ${APACHE_DOC_ROOT}..."
    $SUDO_CMD mkdir -p "$APACHE_DOC_ROOT"
    $SUDO_CMD cp -r "$frontend_dir"/* "$APACHE_DOC_ROOT/"
    $SUDO_CMD chown -R www-data:www-data "$APACHE_DOC_ROOT"
    log_success "Frontend files copied"

    # Configure Apache Virtual Host using helper function
    configure_apache_vhost "$APACHE_DOC_ROOT" "$frontend_port" "$backend_ip" "$backend_port"
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
                    while [ -z "$SERVER_IP" ] || ! validate_ip "$SERVER_IP"; do
                        echo -e "${YELLOW}Please enter the correct server IP address:${NC}"
                        read -r SERVER_IP
                        if [ -z "$SERVER_IP" ]; then
                            log_error "Server IP cannot be empty"
                        elif ! validate_ip "$SERVER_IP"; then
                            log_error "Invalid IP address format: $SERVER_IP"
                            SERVER_IP=""
                        fi
                    done
                    CONFIRMED=true
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
    
    if [ -d "$INSTALL_DIR" ]; then
        log_warning "Directory $INSTALL_DIR already exists!"
        echo -n "  Do you want to overwrite it? (y/N): "
        read -r OVERWRITE_DIR
        if [[ ! "$OVERWRITE_DIR" =~ ^[Yy]$ ]]; then
            log_error "Installation cancelled."
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
            echo -n "  Enter a different port or press Enter to continue: "
            read -r NEW_PORT
            if [ -n "$NEW_PORT" ] && validate_port "$NEW_PORT"; then
                BACKEND_PORT="$NEW_PORT"
            fi
        fi
    fi
    log_success "Backend port: $BACKEND_PORT"

    # Frontend location (for CORS configuration)
    echo ""
    echo -e "${YELLOW}Enter the FRONTEND server IP (default: ${SERVER_IP}):${NC}"
    read -r USER_FRONTEND_IP
    FRONTEND_IP="${USER_FRONTEND_IP:-$SERVER_IP}"
    
    # Validate frontend IP
    while ! validate_ip "$FRONTEND_IP"; do
        log_error "Invalid IP address format: $FRONTEND_IP"
        echo -e "${YELLOW}Please enter a valid FRONTEND server IP:${NC}"
        read -r FRONTEND_IP
    done
    
    echo -e "${YELLOW}Enter the FRONTEND port (default: 80):${NC}"
    read -r USER_FRONTEND_PORT
    FRONTEND_PORT="${USER_FRONTEND_PORT:-80}"
    
    if ! validate_port "$FRONTEND_PORT"; then
        log_error "Invalid port number: $FRONTEND_PORT"
        exit 1
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

    log_step "Cloning ClutchPay repository (tag: $REPO_TAG)..."
    rm -rf "$INSTALL_DIR" 2>/dev/null || true
    mkdir -p "$INSTALL_DIR"
    git clone --depth 1 --branch "$REPO_TAG" "$REPO_URL" "$INSTALL_DIR" 2>&1 | tail -3
    REPO_CLONED=true
    log_success "Repository cloned to $INSTALL_DIR"

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
            echo -n "  Enter a different port or press Enter to continue: "
            read -r NEW_PORT
            if [ -n "$NEW_PORT" ] && validate_port "$NEW_PORT"; then
                FRONTEND_PORT="$NEW_PORT"
            fi
        fi
    fi
    log_success "Frontend port: $FRONTEND_PORT"

    # Backend location
    echo ""
    if [ "$INTERACTIVE_MODE" = true ]; then
        # In interactive mode, keep asking until valid IP is provided
        while [ -z "$BACKEND_IP" ] || ! validate_ip "$BACKEND_IP"; do
            echo -e "${YELLOW}Enter the BACKEND server IP:${NC}"
            read -r BACKEND_IP
            if [ -z "$BACKEND_IP" ]; then
                log_error "Backend IP cannot be empty"
            elif ! validate_ip "$BACKEND_IP"; then
                log_error "Invalid IP address format: $BACKEND_IP"
                BACKEND_IP=""
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
        echo -e "${YELLOW}Enter the BACKEND server IP:${NC}"
        read -r BACKEND_IP
        if [ -z "$BACKEND_IP" ]; then
            log_error "Backend IP is required"
            exit 1
        fi
        
        echo -e "${YELLOW}Enter the BACKEND port (default: 3000):${NC}"
        read -r BACKEND_PORT
        BACKEND_PORT="${BACKEND_PORT:-3000}"
    fi
    log_success "Backend location: ${BACKEND_IP}:${BACKEND_PORT}"

    ################################################################################
    # Install Apache
    ################################################################################
    install_apache

    ################################################################################
    # Clone Repository (frontend only)
    ################################################################################
    log_header "Cloning Frontend Files"

    TEMP_CLONE="/tmp/clutchpay-clone-$$"
    log_step "Cloning repository (tag: $REPO_TAG)..."
    git clone --depth 1 --branch "$REPO_TAG" "$REPO_URL" "$TEMP_CLONE" 2>&1 | tail -3
    log_success "Repository cloned"

    ################################################################################
    # Configure Apache Virtual Host
    ################################################################################
    log_header "Configuring Apache Virtual Host"

    APACHE_DOC_ROOT="/var/www/clutchpay"
    log_step "Copying frontend files to ${APACHE_DOC_ROOT}..."
    $SUDO_CMD mkdir -p "$APACHE_DOC_ROOT"
    $SUDO_CMD cp -r "$TEMP_CLONE/frontend"/* "$APACHE_DOC_ROOT/"
    $SUDO_CMD chown -R www-data:www-data "$APACHE_DOC_ROOT"
    log_success "Frontend files copied"
    
    # Clean up temporary clone directory
    rm -rf "$TEMP_CLONE"
    
    ################################################################################
    # Configure Apache Virtual Host using helper function
    ################################################################################
    configure_apache_vhost "$APACHE_DOC_ROOT" "$FRONTEND_PORT" "$BACKEND_IP" "$BACKEND_PORT"

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
    echo -e "${CYAN}📂 Document Root:${NC} ${APACHE_DOC_ROOT}\n"
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
            log_warning "Directory $INSTALL_DIR already exists!"
            echo -n "  Do you want to overwrite it? (y/N): "
            read -r OVERWRITE_DIR
            if [[ ! "$OVERWRITE_DIR" =~ ^[Yy]$ ]]; then
                log_error "Installation cancelled. Please choose a different directory."
                exit 1
            fi
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
            log_warning "Directory $INSTALL_DIR already exists!"
            echo -n "  Do you want to overwrite it? (y/N): "
            read -r OVERWRITE_DIR
            if [[ ! "$OVERWRITE_DIR" =~ ^[Yy]$ ]]; then
                log_error "Installation cancelled. Please choose a different directory."
                exit 1
            fi
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
    setup_backend_installation "$BACKEND_DIR" "$BACKEND_PORT" "$SERVER_IP" "$FRONTEND_PORT"
    setup_frontend_installation "$FRONTEND_DIR" "$FRONTEND_PORT" "$SERVER_IP" "$BACKEND_PORT"

    ################################################################################
    # Create Systemd Service for Backend
    ################################################################################
    create_backend_service "$BACKEND_DIR"

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
    echo -e "${YELLOW}Installation directory (default: ${DEFAULT_INSTALL_DIR}):${NC}"
    read -r USER_INSTALL_DIR
    
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
    
    # Use tag from parameter or prompt for it
    if [ -n "${UPDATE_TAG:-}" ]; then
        log_info "Using tag from parameter: $UPDATE_TAG"
    else
        # Fetch tags first to show available options
        log_step "Fetching available tags..."
        cd "$INSTALL_DIR"
        git fetch --tags origin > /dev/null 2>&1 || true
        
        echo -e "\n${CYAN}Available tags:${NC}"
        git tag -l --sort=-version:refname | head -20 | sed 's/^/  - /'
        
        echo -e "\n${YELLOW}Enter the tag to update to:${NC}"
        read -r UPDATE_TAG
        
        if [ -z "$UPDATE_TAG" ]; then
            log_error "Tag cannot be empty"
            exit 1
        fi
    fi
    
    log_header "Updating ClutchPay to $UPDATE_TAG"
    
    log_step "Stopping backend service..."
    $SUDO_CMD systemctl stop clutchpay-backend.service
    
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
        log_info "Check your network connection and repository access"
        $SUDO_CMD systemctl start clutchpay-backend.service
        exit 1
    fi
    
    # Verify tag exists
    if ! git rev-parse "refs/tags/$UPDATE_TAG" > /dev/null 2>&1; then
        log_error "Tag '$UPDATE_TAG' not found in repository"
        log_info "Available tags:"
        git tag -l | sed 's/^/  - /'
        $SUDO_CMD systemctl start clutchpay-backend.service
        exit 1
    fi
    
    # Checkout the tag
    if ! git checkout "$UPDATE_TAG" 2>&1; then
        log_error "Failed to checkout tag $UPDATE_TAG"
        $SUDO_CMD systemctl start clutchpay-backend.service
        exit 1
    fi
    
    log_success "Code updated to $UPDATE_TAG"
    
    log_header "Updating Backend"
    
    # Check for missing environment variables and add them
    log_step "Checking for missing environment variables..."
    ADDED_VARS=false
    
    # Generate secure secrets for new installations
    if ! command -v openssl &> /dev/null; then
        $SUDO_CMD apt-get install -y openssl > /dev/null 2>&1
    fi
    
    # Check and add missing variables
    if [ -f "$BACKEND_DIR/.env" ]; then
        # Check each required variable
        if ! grep -q "^POSTGRES_DB=" "$BACKEND_DIR/.env"; then
            echo "POSTGRES_DB=${DB_NAME}" >> "$BACKEND_DIR/.env"
            ADDED_VARS=true
        fi
        
        if ! grep -q "^POSTGRES_USER=" "$BACKEND_DIR/.env"; then
            echo "POSTGRES_USER=${DB_USER}" >> "$BACKEND_DIR/.env"
            ADDED_VARS=true
        fi
        
        if ! grep -q "^POSTGRES_PASSWORD=" "$BACKEND_DIR/.env"; then
            echo "POSTGRES_PASSWORD=${DB_PASSWORD}" >> "$BACKEND_DIR/.env"
            ADDED_VARS=true
        fi
        
        if ! grep -q "^DATABASE_URL=" "$BACKEND_DIR/.env"; then
            echo "DATABASE_URL=\"postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}?schema=public\"" >> "$BACKEND_DIR/.env"
            ADDED_VARS=true
        fi

        if ! grep -q "^PORT=" "$BACKEND_DIR/.env"; then
            echo "PORT=${DEFAULT_BACKEND_PORT}" >> "$BACKEND_DIR/.env"
            ADDED_VARS=true
        fi
        
        if ! grep -q "^BACKEND_PORT=" "$BACKEND_DIR/.env"; then
            echo "BACKEND_PORT=${DEFAULT_BACKEND_PORT}" >> "$BACKEND_DIR/.env"
            ADDED_VARS=true
        fi
        
        if ! grep -q "^NODE_ENV=" "$BACKEND_DIR/.env"; then
            echo "NODE_ENV=production" >> "$BACKEND_DIR/.env"
            ADDED_VARS=true
        fi
        
        if ! grep -q "^NEXTAUTH_SECRET=" "$BACKEND_DIR/.env"; then
            NEXTAUTH_SECRET=$(openssl rand -base64 32)
            echo "NEXTAUTH_SECRET=${NEXTAUTH_SECRET}" >> "$BACKEND_DIR/.env"
            ADDED_VARS=true
        fi
        
        if ! grep -q "^JWT_SECRET=" "$BACKEND_DIR/.env"; then
            JWT_SECRET=$(openssl rand -base64 32)
            echo "JWT_SECRET=${JWT_SECRET}" >> "$BACKEND_DIR/.env"
            ADDED_VARS=true
        fi
        
        if ! grep -q "^NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=" "$BACKEND_DIR/.env"; then
            echo "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=clutchpay" >> "$BACKEND_DIR/.env"
            ADDED_VARS=true
        fi
        
        if ! grep -q "^NEXT_PUBLIC_CLOUDINARY_API_KEY=" "$BACKEND_DIR/.env"; then
            echo "NEXT_PUBLIC_CLOUDINARY_API_KEY=316689144486275" >> "$BACKEND_DIR/.env"
            ADDED_VARS=true
        fi
        
        if ! grep -q "^CLOUDINARY_API_SECRET=" "$BACKEND_DIR/.env"; then
            echo "CLOUDINARY_API_SECRET=7OboPECLxjrFxAsY0C4uFk9ny3A" >> "$BACKEND_DIR/.env"
            ADDED_VARS=true
        fi
        
        if [ "$ADDED_VARS" = true ]; then
            log_success "Added missing environment variables to .env"
        else
            log_success "All environment variables already present"
        fi
    fi
    
    log_step "Installing dependencies..."
    cd "$BACKEND_DIR"
    export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
    pnpm install --frozen-lockfile > /dev/null 2>&1
    log_success "Dependencies installed"
    
    log_step "Generating Prisma Client..."
    pnpm prisma generate > /dev/null 2>&1
    log_success "Prisma Client generated"
    
    log_step "Running database migrations..."
    pnpm prisma migrate deploy
    log_success "Database migrations completed"
    
    log_step "Rebuilding backend application..."
    # Load environment variables
    if [ -f "$BACKEND_DIR/.env" ]; then
        set -a
        source "$BACKEND_DIR/.env"
        set +a
    fi
    
    pnpm build > /dev/null 2>&1
    log_success "Backend rebuilt"
    
    log_header "Updating Frontend"
    
    # Get Apache document root from config or use default
    APACHE_DOC_ROOT="/var/www/clutchpay"
    
    log_step "Updating frontend files..."
    $SUDO_CMD cp -r "$FRONTEND_DIR"/* "$APACHE_DOC_ROOT/"
    $SUDO_CMD chown -R www-data:www-data "$APACHE_DOC_ROOT"
    log_success "Frontend files updated"
    
    log_step "Restarting services..."
    $SUDO_CMD systemctl start clutchpay-backend.service
    $SUDO_CMD systemctl reload apache2
    log_success "Services restarted"
    
    log_header "Update Complete! 🎉"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}${BOLD}  ClutchPay has been successfully updated!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    echo -e "${CYAN}Updated to version: ${GREEN}$UPDATE_TAG${NC}\n"
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
    
    echo -e "${YELLOW}Enter the new frontend port (default: 80):${NC}"
    read -r NEW_FRONTEND_PORT
    NEW_FRONTEND_PORT="${NEW_FRONTEND_PORT:-80}"
    
    if ! validate_port "$NEW_FRONTEND_PORT"; then
        log_error "Invalid port number"
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
    APACHE_DOC_ROOT="/var/www/clutchpay"
    echo -e "${YELLOW}Frontend directory (default: ${APACHE_DOC_ROOT}):${NC}"
    read -r USER_FRONTEND_DIR
    
    FRONTEND_DIR="${USER_FRONTEND_DIR:-$APACHE_DOC_ROOT}"
    
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
    
    echo -e "${YELLOW}Enter the new backend API port (default: 3000):${NC}"
    read -r NEW_BACKEND_PORT
    NEW_BACKEND_PORT="${NEW_BACKEND_PORT:-3000}"
    
    if ! validate_port "$NEW_BACKEND_PORT"; then
        log_error "Invalid port number"
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
            echo "  ./installer.sh --update [tag]          Update to a specific version"
            echo "  ./installer.sh --config-backend        Configure backend (new frontend location)"
            echo "  ./installer.sh --config-frontend       Configure frontend (new backend location)"
            echo "  ./installer.sh --help                  Show this help message"
            echo ""
            echo "Interactive mode (-i) options:"
            echo "  - Prompts for installation directory"
            echo "  - Prompts for port numbers"
            echo "  - Confirms auto-detected IP address"
            echo "  - Prompts for all configuration options"
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
    *)
        install_clutchpay
        ;;
esac
