#!/bin/bash

################################################################################
#                     ClutchPay Installation Script - Debian 11
################################################################################
# This script automates the complete installation of ClutchPay on Debian 11:
# - Backend (Next.js API) with PostgreSQL in Docker
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
    read -p "Do you want to install Git? (y/n): " INSTALL_GIT
    if [[ $INSTALL_GIT =~ ^[Yy]$ ]]; then
        install_git || exit 1
    else
        log_error "Git is required to proceed. Exiting."
        exit 1
    fi
else
    log_success "Git is installed ($(git --version))"
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    log_warning "Docker is not installed"
    read -p "Do you want to install Docker? (y/n): " INSTALL_DOCKER
    if [[ $INSTALL_DOCKER =~ ^[Yy]$ ]]; then
        install_docker || exit 1
    else
        log_error "Docker is required to proceed. Exiting."
        exit 1
    fi
else
    log_success "Docker is installed ($(docker --version))"
    
# Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        log_warning "Docker daemon is not running"
        log_info "Starting Docker daemon..."
        sudo systemctl start docker
        sudo systemctl enable docker
    fi
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    log_info "Installing Docker Compose..."
    
    # Install Docker Compose standalone
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
    sudo curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    log_success "Docker Compose installed successfully"
else
    if command -v docker-compose &> /dev/null; then
        log_success "Docker Compose is installed ($(docker-compose --version))"
    else
        log_success "Docker Compose (v2) is installed ($(docker compose version))"
    fi
fi

log_success "All prerequisites are met!"

################################################################################
# Get user configuration
################################################################################
log_header "Configuration Setup"

# Backend directory
echo -e "${CYAN}Backend Configuration:${NC}"
read -p "Enter the installation directory for backend (default: $HOME/$BACKEND_FOLDER_NAME): " BACKEND_DIR
BACKEND_DIR=${BACKEND_DIR:-"$HOME/$BACKEND_FOLDER_NAME"}
BACKEND_DIR=$(eval echo "$BACKEND_DIR")  # Expand ~ and variables

# Backend port
read -p "Enter the backend server port (default: 3000): " BACKEND_PORT
BACKEND_PORT=${BACKEND_PORT:-3000}

# Database configuration
echo -e "\n${CYAN}Database Configuration (PostgreSQL):${NC}"
DB_TYPE="postgresql"
DB_IMAGE="postgres:16-alpine"
DB_PORT_DEFAULT=5432

echo "Select PostgreSQL installation method:"
echo "  1) Docker container (recommended)"
echo "  2) Native PostgreSQL installation"
read -p "Enter your choice (1-2, default: 1): " DB_INSTALL_METHOD
DB_INSTALL_METHOD=${DB_INSTALL_METHOD:-1}

read -p "Enter database port (default: $DB_PORT_DEFAULT): " DB_PORT
DB_PORT=${DB_PORT:-$DB_PORT_DEFAULT}

read -p "Enter database name (default: clutchpay): " DB_NAME
DB_NAME=${DB_NAME:-clutchpay}

read -p "Enter database user (default: clutchpay_user): " DB_USER
DB_USER=${DB_USER:-clutchpay_user}

read -sp "Enter database password (will be hidden): " DB_PASSWORD
echo
while [ -z "$DB_PASSWORD" ]; do
    echo -e "${YELLOW}Password cannot be empty${NC}"
    read -sp "Enter database password: " DB_PASSWORD
    echo
done

# JWT Secret
echo -e "\n${CYAN}Security Configuration:${NC}"
read -sp "Enter JWT secret (leave empty to auto-generate): " JWT_SECRET
echo
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
    log_info "Auto-generated JWT secret"
fi

# NextAuth Secret
read -sp "Enter NextAuth secret (leave empty to auto-generate): " NEXTAUTH_SECRET
echo
if [ -z "$NEXTAUTH_SECRET" ]; then
    NEXTAUTH_SECRET=$(openssl rand -base64 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
    log_info "Auto-generated NextAuth secret"
fi

# Frontend directory
echo -e "\n${CYAN}Frontend Configuration:${NC}"
read -p "Enter the installation directory for frontend (default: $HOME/$FRONTEND_FOLDER_NAME): " FRONTEND_DIR
FRONTEND_DIR=${FRONTEND_DIR:-"$HOME/$FRONTEND_FOLDER_NAME"}
FRONTEND_DIR=$(eval echo "$FRONTEND_DIR")  # Expand ~ and variables

# Frontend port
read -p "Enter the frontend server port (default: 80): " FRONTEND_PORT
FRONTEND_PORT=${FRONTEND_PORT:-80}

# Frontend deployment method
echo "Select frontend deployment method:"
echo "  1) Native Apache installation"
echo "  2) Docker container"
read -p "Enter your choice (1-2, default: 1): " FRONTEND_DEPLOY_METHOD
FRONTEND_DEPLOY_METHOD=${FRONTEND_DEPLOY_METHOD:-1}

# Backend URL for frontend
read -p "Enter backend URL for frontend (default: http://localhost:$BACKEND_PORT): " BACKEND_URL
BACKEND_URL=${BACKEND_URL:-"http://localhost:$BACKEND_PORT"}

# Confirmation
echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Please review your configuration:${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Backend Directory:  ${GREEN}$BACKEND_DIR${NC}"
echo -e "Backend Port:       ${GREEN}$BACKEND_PORT${NC}"
echo -e "Database Type:      ${GREEN}$DB_TYPE${NC}"
if [ "$DB_INSTALL_METHOD" = "1" ]; then
    echo -e "Database Install:   ${GREEN}Docker Container${NC}"
else
    echo -e "Database Install:   ${GREEN}Native PostgreSQL${NC}"
fi
echo -e "Database Port:      ${GREEN}$DB_PORT${NC}"
echo -e "Database Name:      ${GREEN}$DB_NAME${NC}"
echo -e "Database User:      ${GREEN}$DB_USER${NC}"
echo -e "Frontend Directory: ${GREEN}$FRONTEND_DIR${NC}"
echo -e "Frontend Port:      ${GREEN}$FRONTEND_PORT${NC}"
if [ "$FRONTEND_DEPLOY_METHOD" = "1" ]; then
    echo -e "Frontend Deploy:    ${GREEN}Native Apache${NC}"
else
    echo -e "Frontend Deploy:    ${GREEN}Docker Container${NC}"
fi
echo -e "Backend URL:        ${GREEN}$BACKEND_URL${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

read -p "Proceed with installation? (y/n): " CONFIRM
if [[ ! $CONFIRM =~ ^[Yy]$ ]]; then
    log_warning "Installation cancelled by user."
    exit 0
fi

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
mkdir -p "$BACKEND_DIR"

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
PORT=${BACKEND_PORT}
NODE_ENV=production
NEXT_PUBLIC_API_URL=http://localhost:${BACKEND_PORT}

# Authentication
JWT_SECRET="${JWT_SECRET}"
NEXTAUTH_SECRET="${NEXTAUTH_SECRET}"
NEXTAUTH_URL=http://localhost:${BACKEND_PORT}

# Session Configuration (30 days)
SESSION_MAX_AGE=2592000
SESSION_UPDATE_AGE=86400

# Stripe Configuration (Optional - Add your keys)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# PayPal Configuration (Optional - Add your keys)
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_MODE=sandbox

# Email Configuration (Optional - Add your SMTP settings)
EMAIL_HOST=
EMAIL_PORT=587
EMAIL_USER=
EMAIL_PASSWORD=
EMAIL_FROM=

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:${FRONTEND_PORT}

# Database container name (for Docker)
DB_CONTAINER_NAME=clutchpay_db
EOF

log_success "Backend .env file created"

# Install and configure PostgreSQL based on user choice
if [ "$DB_INSTALL_METHOD" = "1" ]; then
    ################################################################################
    # Docker PostgreSQL Installation
    ################################################################################
    log_info "Setting up PostgreSQL with Docker..."
    
    # Create .env file for Docker Compose
    log_info "Creating Docker .env file..."
    cat > "$BACKEND_DIR/docker/.env" << EOF
POSTGRES_USER=${DB_USER}
POSTGRES_PASSWORD=${DB_PASSWORD}
POSTGRES_DB=${DB_NAME}
EOF

    log_success "Docker .env file created"

    # Start database container using existing docker-compose.yml
    log_info "Starting database container..."
    cd "$BACKEND_DIR/docker"
    docker-compose up -d 2>&1 | sed 's/^/  /'
    log_success "Database container started"

    # Wait for database to be ready
    log_info "Waiting for PostgreSQL database to be ready..."
    sleep 5
    CONTAINER_NAME=$(docker-compose ps -q postgres)
    for i in {1..30}; do
        if docker exec $CONTAINER_NAME pg_isready -U "$DB_USER" &>/dev/null; then
            log_success "Database is ready!"
            break
        fi
        echo -n "."
        sleep 2
    done
    echo

else
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
    
    # Change port if not default
    if [ "$DB_PORT" != "5432" ]; then
        sudo sed -i "s/port = 5432/port = ${DB_PORT}/" "$PG_CONF"
    fi
    
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
    log_success "Node.js is already installed ($(node --version))"
fi

# Install pnpm
log_info "Checking pnpm installation..."
if ! command -v pnpm &> /dev/null; then
    log_info "Installing pnpm..."
    npm install -g pnpm 2>&1 | sed 's/^/  /'
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

# Build backend
log_info "Building backend application..."
pnpm build 2>&1 | sed 's/^/  /'
log_success "Backend built successfully"

################################################################################
# Install Frontend
################################################################################
log_header "Installing Frontend"

# Create frontend directory
log_info "Creating frontend directory: $FRONTEND_DIR"
mkdir -p "$FRONTEND_DIR"

# Copy frontend files
log_info "Copying frontend files..."
if [ -d "$TEMP_DIR/frontend" ]; then
    cp -r "$TEMP_DIR/frontend/"* "$FRONTEND_DIR/"
    log_success "Frontend files copied"
else
    log_warning "Frontend directory not found in repository - creating placeholder"
    mkdir -p "$FRONTEND_DIR/public"
    echo "<html><body><h1>ClutchPay Frontend</h1><p>Configure your frontend here</p></body></html>" > "$FRONTEND_DIR/public/index.html"
fi

# Create frontend .env file
log_info "Creating frontend .env file..."
cat > "$FRONTEND_DIR/.env" << EOF
# Backend API Configuration
VITE_API_URL=${BACKEND_URL}
REACT_APP_API_URL=${BACKEND_URL}
NEXT_PUBLIC_API_URL=${BACKEND_URL}

# Frontend Configuration
PORT=${FRONTEND_PORT}
NODE_ENV=production

# Optional: Add your frontend-specific variables here
# VITE_STRIPE_PUBLISHABLE_KEY=
# VITE_GOOGLE_ANALYTICS_ID=
EOF

log_success "Frontend .env file created"

# Install and configure frontend based on user choice
if [ "$FRONTEND_DEPLOY_METHOD" = "1" ]; then
    ################################################################################
    # Native Apache Installation
    ################################################################################
    log_info "Setting up frontend with Native Apache..."
    
    # Install Apache
    log_info "Checking Apache installation..."
    if ! command -v apache2 &> /dev/null; then
        log_info "Installing Apache web server..."
        sudo apt-get update 2>&1 | sed 's/^/  /'
        sudo apt-get install -y apache2 2>&1 | sed 's/^/  /'
        log_success "Apache installed"
    else
        log_success "Apache is already installed"
    fi

    APACHE_CMD="apache2"
    APACHE_CONF_DIR="/etc/apache2/sites-available"

    # Create Apache virtual host configuration
    log_info "Creating Apache virtual host configuration..."
    APACHE_CONF_FILE="$APACHE_CONF_DIR/clutchpay.conf"

    sudo tee "$APACHE_CONF_FILE" > /dev/null << EOF
<VirtualHost *:${FRONTEND_PORT}>
    ServerName localhost
    DocumentRoot ${FRONTEND_DIR}/public
    
    <Directory ${FRONTEND_DIR}/public>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
        
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

    # Enable required Apache modules
    log_info "Enabling required Apache modules..."
    sudo a2enmod rewrite proxy proxy_http 2>&1 | sed 's/^/  /'
    sudo a2ensite clutchpay.conf 2>&1 | sed 's/^/  /'

    # Update Apache port if not 80
    if [ "$FRONTEND_PORT" != "80" ]; then
        sudo sed -i "s/Listen 80/Listen $FRONTEND_PORT/g" /etc/apache2/ports.conf 2>/dev/null || true
    fi

    sudo systemctl restart apache2 2>&1 | sed 's/^/  /'
    log_success "Apache configured and restarted"

else
    ################################################################################
    # Docker Apache Installation
    ################################################################################
    log_info "Setting up frontend with Docker..."
    
    # Create Dockerfile for Apache
    log_info "Creating Dockerfile for frontend..."
    cat > "$FRONTEND_DIR/Dockerfile" << 'EOF'
FROM httpd:2.4-alpine

# Install necessary modules
RUN apk add --no-cache apache2-proxy

# Copy frontend files
COPY public/ /usr/local/apache2/htdocs/

# Copy custom Apache configuration
COPY apache.conf /usr/local/apache2/conf/httpd.conf

EXPOSE 80

CMD ["httpd-foreground"]
EOF

    # Create Apache configuration for Docker
    log_info "Creating Apache configuration for Docker..."
    cat > "$FRONTEND_DIR/apache.conf" << EOF
ServerRoot "/usr/local/apache2"
Listen 80

LoadModule mpm_event_module modules/mod_mpm_event.so
LoadModule authn_file_module modules/mod_authn_file.so
LoadModule authn_core_module modules/mod_authn_core.so
LoadModule authz_host_module modules/mod_authz_host.so
LoadModule authz_groupfile_module modules/mod_authz_groupfile.so
LoadModule authz_user_module modules/mod_authz_user.so
LoadModule authz_core_module modules/mod_authz_core.so
LoadModule access_compat_module modules/mod_access_compat.so
LoadModule auth_basic_module modules/mod_auth_basic.so
LoadModule reqtimeout_module modules/mod_reqtimeout.so
LoadModule filter_module modules/mod_filter.so
LoadModule mime_module modules/mod_mime.so
LoadModule log_config_module modules/mod_log_config.so
LoadModule env_module modules/mod_env.so
LoadModule headers_module modules/mod_headers.so
LoadModule setenvif_module modules/mod_setenvif.so
LoadModule version_module modules/mod_version.so
LoadModule unixd_module modules/mod_unixd.so
LoadModule status_module modules/mod_status.so
LoadModule autoindex_module modules/mod_autoindex.so
LoadModule dir_module modules/mod_dir.so
LoadModule alias_module modules/mod_alias.so
LoadModule rewrite_module modules/mod_rewrite.so
LoadModule proxy_module modules/mod_proxy.so
LoadModule proxy_http_module modules/mod_proxy_http.so

<IfModule unixd_module>
    User daemon
    Group daemon
</IfModule>

ServerAdmin admin@localhost
ServerName localhost

<Directory />
    AllowOverride none
    Require all denied
</Directory>

DocumentRoot "/usr/local/apache2/htdocs"
<Directory "/usr/local/apache2/htdocs">
    Options Indexes FollowSymLinks
    AllowOverride All
    Require all granted
    
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

<IfModule dir_module>
    DirectoryIndex index.html
</IfModule>

<Files ".ht*">
    Require all denied
</Files>

ErrorLog /proc/self/fd/2
LogLevel warn

<IfModule log_config_module>
    LogFormat "%h %l %u %t \"%r\" %>s %b \"%{Referer}i\" \"%{User-Agent}i\"" combined
    LogFormat "%h %l %u %t \"%r\" %>s %b" common
    CustomLog /proc/self/fd/1 common
</IfModule>

<IfModule mime_module>
    TypesConfig conf/mime.types
    AddType application/x-compress .Z
    AddType application/x-gzip .gz .tgz
    AddType text/html .shtml
    AddOutputFilter INCLUDES .shtml
</IfModule>
EOF

    # Create docker-compose.yml for frontend
    log_info "Creating docker-compose.yml for frontend..."
    cat > "$FRONTEND_DIR/docker-compose.yml" << EOF
version: '3.8'

services:
  apache:
    build: .
    container_name: clutchpay_frontend
    restart: unless-stopped
    ports:
      - "${FRONTEND_PORT}:80"
    volumes:
      - ./public:/usr/local/apache2/htdocs
    networks:
      - clutchpay_network

networks:
  clutchpay_network:
    driver: bridge
EOF

    log_success "Docker configuration files created"

    # Build and start frontend container
    log_info "Building and starting frontend container..."
    cd "$FRONTEND_DIR"
    docker-compose up -d --build 2>&1 | sed 's/^/  /'
    log_success "Frontend container started"
    
    cd "$BACKEND_DIR"
fi

################################################################################
# Create systemd service for backend (optional)
################################################################################
log_header "Creating System Services"

read -p "Do you want to create a systemd service for the backend? (y/n): " CREATE_SERVICE
if [[ $CREATE_SERVICE =~ ^[Yy]$ ]]; then
    log_info "Creating systemd service..."
    
    sudo tee /etc/systemd/system/clutchpay-backend.service > /dev/null << EOF
[Unit]
Description=ClutchPay Backend API
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$BACKEND_DIR
Environment="NODE_ENV=production"
ExecStart=$(which pnpm) start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
    
    sudo systemctl daemon-reload
    sudo systemctl enable clutchpay-backend.service
    sudo systemctl start clutchpay-backend.service
    
    log_success "Systemd service created and started"
else
    log_info "Skipping systemd service creation"
fi

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
log_header "Installation Complete! 🎉"

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

echo -e "${CYAN}⚙️  Useful Commands:${NC}"
echo -e "   ${YELLOW}# Start/Stop Backend${NC}"
echo -e "   cd $BACKEND_DIR"
echo -e "   pnpm start                  # Start backend server"
echo -e "   pnpm dev                    # Start in development mode"
echo -e "   pnpm test                   # Run tests"
echo -e ""
echo -e "   ${YELLOW}# Database Management${NC}"
if [ "$DB_INSTALL_METHOD" = "1" ]; then
    echo -e "   cd $BACKEND_DIR/docker"
    echo -e "   docker-compose up -d      # Start database"
    echo -e "   docker-compose down       # Stop database"
    echo -e "   docker-compose logs -f    # View logs"
else
    echo -e "   sudo systemctl start postgresql    # Start PostgreSQL"
    echo -e "   sudo systemctl stop postgresql     # Stop PostgreSQL"
    echo -e "   sudo systemctl status postgresql   # Check status"
    echo -e "   psql -h localhost -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME}  # Connect to database"
fi
echo -e ""
echo -e "   ${YELLOW}# Prisma Commands${NC}"
echo -e "   pnpm prisma studio          # Open Prisma Studio (database GUI)"
echo -e "   pnpm prisma migrate dev     # Create new migration"
echo -e "   pnpm prisma generate        # Regenerate Prisma Client"
echo -e ""
echo -e "   ${YELLOW}# Apache Commands${NC}"
if [ "$FRONTEND_DEPLOY_METHOD" = "1" ]; then
    echo -e "   sudo systemctl restart apache2     # Restart Apache"
    echo -e "   sudo systemctl stop apache2        # Stop Apache"
    echo -e "   sudo systemctl status apache2      # Check Apache status"
    echo -e "   sudo tail -f /var/log/apache2/clutchpay_error.log  # View errors"
else
    echo -e "   cd $FRONTEND_DIR"
    echo -e "   docker-compose up -d      # Start frontend"
    echo -e "   docker-compose down       # Stop frontend"
    echo -e "   docker-compose logs -f    # View logs"
    echo -e "   docker-compose restart    # Restart frontend"
fi
echo -e ""

if [[ $CREATE_SERVICE =~ ^[Yy]$ ]]; then
    echo -e "   ${YELLOW}# Systemd Service${NC}"
    echo -e "   sudo systemctl start clutchpay-backend    # Start service"
    echo -e "   sudo systemctl stop clutchpay-backend     # Stop service"
    echo -e "   sudo systemctl status clutchpay-backend   # Check status"
    echo -e "   sudo journalctl -u clutchpay-backend -f   # View logs"
    echo -e ""
fi

echo -e "${YELLOW}📝 Next Steps:${NC}"
echo -e "   1. Review and update ${GREEN}$BACKEND_DIR/.env${NC} with your API keys:"
echo -e "      - Stripe keys (for payments)"
echo -e "      - PayPal credentials (for payouts)"
echo -e "      - Email SMTP settings (for notifications)"
echo -e ""
echo -e "   2. Review and update ${GREEN}$FRONTEND_DIR/.env${NC} if needed"
echo -e ""
echo -e "   3. Test the installation:"
echo -e "      - Backend:  ${CYAN}curl http://localhost:$BACKEND_PORT/api/health${NC}"
echo -e "      - Frontend: ${CYAN}curl http://localhost:$FRONTEND_PORT${NC}"
echo -e ""
echo -e "   4. Create your first admin user or run database seeds"
echo -e ""

echo -e "${YELLOW}⚠️  Important Security Notes:${NC}"
echo -e "   - Change database passwords in production environments"
echo -e "   - Use environment-specific secrets for JWT and NextAuth"
echo -e "   - Configure firewall rules for production deployments"
echo -e "   - Enable HTTPS with SSL certificates (Let's Encrypt)"
echo -e "   - Review CORS settings in ${GREEN}$BACKEND_DIR/.env${NC}"
echo -e ""

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Thank you for installing ClutchPay!${NC}"
echo -e "${GREEN}  For support, visit: https://github.com/GCousido/ClutchPay${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
