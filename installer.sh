#!/bin/bash

################################################################################
#                     ClutchPay Installation Script - Debian 11
################################################################################
# This script automates the complete installation of ClutchPay on Debian 11:
# - Backend (Next.js API) with PostgreSQL
# - Frontend (Static site) with Apache web server
# - Automatic dependency installation and configuration
################################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_header() {
    echo -e "\n${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${MAGENTA}  $1${NC}"
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

# Configuration variables
REPO_URL="https://github.com/GCousido/ClutchPay.git"
REPO_BRANCH="production"
TEMP_DIR="/tmp/clutchpay_install_$$"
BACKEND_FOLDER_NAME="clutchpay_backend"
FRONTEND_FOLDER_NAME="clutchpay_frontend"

################################################################################
# Display welcome banner
################################################################################
clear
echo -e "${CYAN}"
cat << "EOF"
   _____ _       _       _     ____              
  / ____| |     | |     | |   |  _ \             
 | |    | |_   _| |_ ___| |__ | |_) | __ _ _   _ 
 | |    | | | | | __/ __| '_ \|  _ / / _` | | | |
 | |____| | |_| | || (__| | | | |   | (_| | |_| |
  \_____|_|\__,_|\__\___|_| |_| |   \__,_|\__, |
                                            __/ |
   Installation Script v1.0 - Debian 11    |___/ 
EOF
echo -e "${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

################################################################################
# Check prerequisites
################################################################################
log_header "Checking Prerequisites"

# Verify we're on Debian
if [ ! -f /etc/debian_version ]; then
    log_error "This script is designed for Debian 11 only"
    exit 1
fi

log_info "Detected Debian $(cat /etc/debian_version)"

# Install Git
install_git() {
    log_info "Installing Git..."
    sudo apt-get update 2>&1 | sed 's/^/  /'
    sudo apt-get install -y git 2>&1 | sed 's/^/  /'
    log_success "Git installed successfully"
}

# Install curl
install_curl() {
    log_info "Installing curl..."
    sudo apt-get update 2>&1 | sed 's/^/  /'
    sudo apt-get install -y curl 2>&1 | sed 's/^/  /'
    log_success "curl installed successfully"
}

# Install Docker
install_docker() {
    log_info "Installing Docker..."
    
    # Install prerequisites
    sudo apt-get update 2>&1 | sed 's/^/  /'
    sudo apt-get install -y ca-certificates curl gnupg 2>&1 | sed 's/^/  /'
    
    # Add Docker's official GPG key
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    
    # Set up the repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker Engine
    sudo apt-get update 2>&1 | sed 's/^/  /'
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin 2>&1 | sed 's/^/  /'
    
    # Start and enable Docker service
    sudo systemctl start docker
    sudo systemctl enable docker
    
    # Add current user to docker group
    sudo usermod -aG docker $USER
    
    log_success "Docker installed successfully"
    log_warning "You need to log out and back in for Docker group permissions to take effect"
    log_info "Alternatively, run: newgrp docker"
}

# Check and install dependencies
log_info "Checking required dependencies..."

# Check Git
if ! command -v git &> /dev/null; then
    log_warning "Git is not installed"
    install_git || exit 1
else
    log_success "Git is installed ($(git --version))"
fi

# Check curl
if ! command -v curl &> /dev/null; then
    log_warning "curl is not installed"
    install_curl || exit 1
else
    log_success "curl is installed ($(curl --version | head -n 1))"
fi

# PostgreSQL will be installed natively, no Docker required
log_info "PostgreSQL will be installed natively"

log_success "All prerequisites are met!"

################################################################################
# Configuration Setup
################################################################################
log_header "Configuration Setup"

# Fixed configuration values
BACKEND_DIR="/opt/clutchpay/backend"
BACKEND_PORT=3000
FRONTEND_DIR="/var/www/clutchpay"
FRONTEND_PORT=80
BACKEND_URL="http://localhost:$BACKEND_PORT"

# Database configuration
DB_TYPE="postgresql"
DB_PORT=5432
DB_NAME="clutchpay"
DB_USER="clutchpay_user"
DB_PASSWORD="clutchpay_password"

# Security secrets (auto-generated)
JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
NEXTAUTH_SECRET=$(openssl rand -base64 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)

# Display configuration
log_info "Installation configuration:"
echo -e "  Backend Directory:  ${GREEN}$BACKEND_DIR${NC}"
echo -e "  Backend Port:       ${GREEN}$BACKEND_PORT${NC}"
echo -e "  Database Type:      ${GREEN}PostgreSQL (Native)${NC}"
echo -e "  Database Port:      ${GREEN}$DB_PORT${NC}"
echo -e "  Database Name:      ${GREEN}$DB_NAME${NC}"
echo -e "  Frontend Directory: ${GREEN}$FRONTEND_DIR${NC}"
echo -e "  Frontend Port:      ${GREEN}$FRONTEND_PORT${NC}"
echo -e ""
log_info "Auto-generated secure passwords and secrets"
log_info "Proceeding with installation..."

################################################################################
# Clone repository
################################################################################
log_header "Downloading ClutchPay from GitHub"

log_info "Cloning repository from $REPO_URL (branch: $REPO_BRANCH)..."
mkdir -p "$TEMP_DIR"
git clone --branch "$REPO_BRANCH" --depth 1 "$REPO_URL" "$TEMP_DIR" 2>&1 | sed 's/^/  /'
log_success "Repository cloned successfully"

################################################################################
# Install Backend
################################################################################
log_header "Installing Backend"

# Create backend directory
log_info "Creating backend directory: $BACKEND_DIR"
sudo mkdir -p "$BACKEND_DIR"
sudo chown $USER:$USER "$BACKEND_DIR"

# Copy backend files
log_info "Copying backend files..."
if [ -d "$TEMP_DIR/back" ]; then
    cp -r "$TEMP_DIR/back/"* "$BACKEND_DIR/"
    log_success "Backend files copied"
else
    log_error "Backend directory not found in repository"
    exit 1
fi

# Generate database URL
if [ "$DB_TYPE" = "postgresql" ]; then
    DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${DB_PORT}/${DB_NAME}?schema=public"
else
    DATABASE_URL="mysql://${DB_USER}:${DB_PASSWORD}@localhost:${DB_PORT}/${DB_NAME}"
fi

# Create .env file for backend
log_info "Creating backend .env file..."
cat > "$BACKEND_DIR/.env" << EOF
# Database Configuration
DATABASE_URL="${DATABASE_URL}"

# Server Configuration
NODE_ENV=production
NEXT_PUBLIC_API_URL=http://localhost:${BACKEND_PORT}

# Authentication
JWT_SECRET="${JWT_SECRET}"
NEXTAUTH_SECRET="${NEXTAUTH_SECRET}"
NEXTAUTH_URL=http://localhost:${BACKEND_PORT}

FRONTEND_URL=http://localhost:${FRONTEND_PORT}
EOF

log_success "Backend .env file created"

################################################################################
# Native PostgreSQL Installation
################################################################################
log_info "Installing PostgreSQL natively..."

# Install PostgreSQL
if ! command -v psql &> /dev/null; then
    log_info "Installing PostgreSQL server..."
    sudo apt-get update 2>&1 | sed 's/^/  /'
    sudo apt-get install -y postgresql postgresql-contrib 2>&1 | sed 's/^/  /'
    log_success "PostgreSQL installed"
else
    log_success "PostgreSQL is already installed"
fi

# Start and enable PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql
log_success "PostgreSQL service started"

# Create database user and database
log_info "Creating database user and database..."

# Create user
sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';" 2>/dev/null || \
    sudo -u postgres psql -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';"

# Create database
sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" 2>/dev/null || \
    log_warning "Database ${DB_NAME} already exists"

# Grant privileges
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"

log_success "Database and user created"

# Configure PostgreSQL to accept connections
log_info "Configuring PostgreSQL authentication..."

PG_VERSION=$(psql --version | grep -oP '\d+' | head -1)
PG_HBA="/etc/postgresql/${PG_VERSION}/main/pg_hba.conf"
PG_CONF="/etc/postgresql/${PG_VERSION}/main/postgresql.conf"

# Add authentication rule for the database user
if ! sudo grep -q "host.*${DB_NAME}.*${DB_USER}" "$PG_HBA" 2>/dev/null; then
    echo "host    ${DB_NAME}    ${DB_USER}    127.0.0.1/32    md5" | sudo tee -a "$PG_HBA" > /dev/null
    echo "host    ${DB_NAME}    ${DB_USER}    ::1/128         md5" | sudo tee -a "$PG_HBA" > /dev/null
fi

# Ensure PostgreSQL listens on localhost
sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = 'localhost'/" "$PG_CONF" 2>/dev/null || true

# Restart PostgreSQL to apply changes
sudo systemctl restart postgresql
log_success "PostgreSQL configured and restarted"

# Test connection
log_info "Testing database connection..."
if PGPASSWORD="${DB_PASSWORD}" psql -h localhost -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -c "SELECT 1;" &>/dev/null; then
    log_success "Database connection successful!"
else
    log_warning "Could not verify database connection. Please check credentials."
fi

# Return to backend directory
cd "$BACKEND_DIR"

# Check for Node.js and pnpm
log_info "Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    log_info "Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - 2>&1 | sed 's/^/  /'
    sudo apt-get install -y nodejs 2>&1 | sed 's/^/  /'
    log_success "Node.js installed"
else
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 20 ]; then
        log_warning "Node.js version is too old ($NODE_VERSION). Installing Node.js 20 LTS..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - 2>&1 | sed 's/^/  /'
        sudo apt-get install -y nodejs 2>&1 | sed 's/^/  /'
        log_success "Node.js upgraded to version 20"
    else
        log_success "Node.js is already installed ($(node --version))"
    fi
fi

# Install pnpm
log_info "Checking pnpm installation..."
if ! command -v pnpm &> /dev/null; then
    log_info "Installing pnpm..."
    # Use corepack (included with Node.js 16.9+) or npm
    if command -v corepack &> /dev/null; then
        sudo corepack enable 2>&1 | sed 's/^/  /'
        sudo corepack prepare pnpm@latest --activate 2>&1 | sed 's/^/  /'
    else
        sudo npm install -g pnpm 2>&1 | sed 's/^/  /'
    fi
    log_success "pnpm installed"
else
    log_success "pnpm is already installed ($(pnpm --version))"
fi

# Install backend dependencies
log_info "Installing backend dependencies..."
cd "$BACKEND_DIR"
pnpm install 2>&1 | sed 's/^/  /'
log_success "Backend dependencies installed"

# Run Prisma migrations
log_info "Running database migrations..."
pnpm prisma generate 2>&1 | sed 's/^/  /'
pnpm prisma migrate deploy 2>&1 | sed 's/^/  /'
log_success "Database migrations completed"

# Build backend (Next.js standalone)
log_info "Building backend application in standalone mode..."
set +e  # Temporarily disable exit on error to capture output
BUILD_OUTPUT=$(NEXT_OUTPUT_MODE=standalone pnpm build 2>&1)
BUILD_EXIT_CODE=$?
echo "$BUILD_OUTPUT" | sed 's/^/  /'
set -e  # Re-enable exit on error

if [ $BUILD_EXIT_CODE -ne 0 ]; then
    log_error "Backend build FAILED with exit code $BUILD_EXIT_CODE"
    log_error "There are TypeScript compilation errors in your code."
    log_error "Please fix the errors in types/validator.ts and run the installer again."
    exit 1
fi

# Verify standalone build was created
if [ ! -f "$BACKEND_DIR/.next/standalone/server.js" ]; then
    log_error "Standalone build failed - server.js not found"
    log_error "Expected file: $BACKEND_DIR/.next/standalone/server.js"
    exit 1
fi

log_success "Backend built successfully in standalone mode"

################################################################################
# Install Frontend
################################################################################
log_header "Installing Frontend"

# Create frontend directory
log_info "Creating frontend directory: $FRONTEND_DIR"
sudo mkdir -p "$FRONTEND_DIR"
sudo chown www-data:www-data "$FRONTEND_DIR"
sudo chmod 755 "$FRONTEND_DIR"

# Copy frontend files
log_info "Copying frontend files..."
if [ -d "$TEMP_DIR/frontend" ]; then
    sudo cp -r "$TEMP_DIR/frontend/"* "$FRONTEND_DIR/"
    sudo chown -R www-data:www-data "$FRONTEND_DIR"
    sudo find "$FRONTEND_DIR" -type d -exec chmod 755 {} \;
    sudo find "$FRONTEND_DIR" -type f -exec chmod 644 {} \;
    log_success "Frontend files copied"
else
    log_error "Frontend directory not found in repository"
fi

# Create frontend .env file
log_info "Creating frontend .env file..."
cat > "$FRONTEND_DIR/.env" << EOF
# Backend API Configuration
API_URL=${BACKEND_URL}

# Frontend Configuration
PORT=${FRONTEND_PORT}
NODE_ENV=production
EOF

log_success "Frontend .env file created"

# Install Apache
log_info "Checking Apache installation..."

# Check if apache2 command exists AND if systemd service exists
APACHE_INSTALLED=false
if command -v apache2 &> /dev/null && systemctl list-unit-files | grep -q "apache2.service"; then
    APACHE_INSTALLED=true
    log_success "Apache is already installed"
fi

if [ "$APACHE_INSTALLED" = "false" ]; then
    log_info "Installing Apache web server..."
    sudo apt-get update 2>&1 | sed 's/^/  /'
    sudo apt-get install -y apache2 2>&1 | sed 's/^/  /'
    log_success "Apache installed"
fi

# Always ensure Apache is started and enabled
log_info "Ensuring Apache service is running..."
if ! sudo systemctl is-active --quiet apache2; then
    sudo systemctl start apache2 2>&1 | sed 's/^/  /'
fi
if ! sudo systemctl is-enabled --quiet apache2; then
    sudo systemctl enable apache2 2>&1 | sed 's/^/  /'
fi
log_success "Apache service is running"

APACHE_CONF_DIR="/etc/apache2/sites-available"
APACHE_SITES_ENABLED="/etc/apache2/sites-enabled"

# Verify Apache directories exist - if not, Apache installation failed
if [ ! -d "$APACHE_CONF_DIR" ]; then
    log_error "Apache configuration directory not found: $APACHE_CONF_DIR"
    log_error "Apache installation may have failed. Please install Apache manually:"
    log_error "  sudo apt-get update"
    log_error "  sudo apt-get install -y apache2"
    exit 1
fi

# Create Apache virtual host configuration
log_info "Creating Apache virtual host configuration..."
APACHE_CONF_FILE="$APACHE_CONF_DIR/clutchpay.conf"

sudo tee "$APACHE_CONF_FILE" > /dev/null << EOF
<VirtualHost *:${FRONTEND_PORT}>
    ServerName localhost
    DocumentRoot ${FRONTEND_DIR}
    
    <Directory ${FRONTEND_DIR}>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
        DirectoryIndex index.html login.html
        
        # Enable mod_rewrite for SPA routing
        RewriteEngine On
        RewriteBase /
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>
    
    # Proxy API requests to backend
    ProxyPreserveHost On
    ProxyPass /api ${BACKEND_URL}/api
    ProxyPassReverse /api ${BACKEND_URL}/api
    
    ErrorLog \${APACHE_LOG_DIR}/clutchpay_error.log
    CustomLog \${APACHE_LOG_DIR}/clutchpay_access.log combined
</VirtualHost>
EOF

log_success "Apache virtual host created"

# Disable default site
if [ -f "$APACHE_SITES_ENABLED/000-default.conf" ]; then
    log_info "Disabling default Apache site..."
    sudo a2dissite 000-default.conf 2>&1 | sed 's/^/  /' || true
fi

# Enable required Apache modules
log_info "Enabling required Apache modules..."
sudo a2enmod rewrite 2>&1 | sed 's/^/  /' || log_warning "Could not enable rewrite module"
sudo a2enmod proxy 2>&1 | sed 's/^/  /' || log_warning "Could not enable proxy module"
sudo a2enmod proxy_http 2>&1 | sed 's/^/  /' || log_warning "Could not enable proxy_http module"

# Enable ClutchPay site
log_info "Enabling ClutchPay site..."
sudo a2ensite clutchpay.conf 2>&1 | sed 's/^/  /' || log_warning "Could not enable site"

# Update Apache port if not 80
if [ "$FRONTEND_PORT" != "80" ]; then
    if [ -f "/etc/apache2/ports.conf" ]; then
        sudo sed -i "s/Listen 80/Listen $FRONTEND_PORT/g" /etc/apache2/ports.conf 2>/dev/null || true
    fi
fi

# Restart Apache
log_info "Restarting Apache..."
set +e
RESTART_OUTPUT=$(sudo systemctl restart apache2 2>&1)
RESTART_EXIT_CODE=$?
set -e

if [ $RESTART_EXIT_CODE -ne 0 ]; then
    log_error "Failed to restart Apache (exit code: $RESTART_EXIT_CODE)"
    echo "$RESTART_OUTPUT" | sed 's/^/  /'
    log_error "Checking Apache status..."
    sudo systemctl status apache2 --no-pager | sed 's/^/  /'
    log_error "Checking Apache configuration..."
    sudo apache2ctl configtest 2>&1 | sed 's/^/  /'
    exit 1
fi

# Verify Apache is actually running
if ! sudo systemctl is-active --quiet apache2; then
    log_error "Apache service is not running after restart"
    sudo systemctl status apache2 --no-pager | sed 's/^/  /'
    exit 1
fi

log_success "Apache configured and restarted successfully"

# Verify Apache is actually running
if ! sudo systemctl is-active --quiet apache2; then
    log_error "Apache service is not running after restart"
    sudo systemctl status apache2 --no-pager | sed 's/^/  /'
    exit 1
fi

log_success "Apache configured and restarted successfully"

################################################################################
# Create systemd service for backend
################################################################################
log_header "Creating System Services"

log_info "Creating systemd service for backend..."

sudo tee /etc/systemd/system/clutchpay-backend.service > /dev/null << EOF
[Unit]
Description=ClutchPay Backend API (Next.js Standalone)
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$BACKEND_DIR
Environment="NODE_ENV=production"
Environment="PORT=3000"
ExecStart=/usr/bin/node $BACKEND_DIR/.next/standalone/server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable clutchpay-backend.service
sudo systemctl start clutchpay-backend.service

log_success "Systemd service created and started"

################################################################################
# Cleanup
################################################################################
log_header "Cleaning Up"

log_info "Removing temporary files..."
rm -rf "$TEMP_DIR"
log_success "Temporary files removed"

################################################################################
# Installation complete
################################################################################
log_header "Installation Complete"

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ClutchPay has been successfully installed!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${CYAN}📂 Installation Directories:${NC}"
echo -e "   Backend:  ${GREEN}$BACKEND_DIR${NC}"
echo -e "   Frontend: ${GREEN}$FRONTEND_DIR${NC}\n"

echo -e "${CYAN}🌐 Access URLs:${NC}"
echo -e "   Backend API:  ${GREEN}http://localhost:$BACKEND_PORT${NC}"
echo -e "   Frontend:     ${GREEN}http://localhost:$FRONTEND_PORT${NC}\n"

echo -e "${CYAN}🗄️  Database:${NC}"
echo -e "   Type:     ${GREEN}$DB_TYPE${NC}"
echo -e "   Host:     ${GREEN}localhost:$DB_PORT${NC}"
echo -e "   Database: ${GREEN}$DB_NAME${NC}"
echo -e "   User:     ${GREEN}$DB_USER${NC}\n"

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Thank you for installing ClutchPay!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
