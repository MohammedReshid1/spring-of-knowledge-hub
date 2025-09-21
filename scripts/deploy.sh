#!/bin/bash
# Production Deployment Script for Spring of Knowledge Hub
# Handles Docker deployment, environment setup, and health checks

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="spring-of-knowledge-hub"
DOCKER_COMPOSE_FILE="docker-compose.prod.yml"
BACKUP_DIR="/opt/backups/${PROJECT_NAME}"
LOG_DIR="/opt/logs/${PROJECT_NAME}"

echo -e "${BLUE}🏫 Spring of Knowledge Hub - Production Deployment${NC}"
echo "============================================================"

# Function to print status messages
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️ $1${NC}"
}

# Check if running as root or with sudo
check_permissions() {
    print_info "Checking deployment permissions..."
    if [[ $EUID -eq 0 ]]; then
        print_warning "Running as root. Consider using a deployment user."
    elif ! sudo -n true 2>/dev/null; then
        print_error "This script requires sudo privileges for Docker operations."
        exit 1
    fi
    print_status "Permission check completed"
}

# Check system requirements
check_system_requirements() {
    print_info "Checking system requirements..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check available disk space (minimum 5GB)
    available_space=$(df . | tail -1 | awk '{print $4}')
    min_space=5242880  # 5GB in KB
    
    if [ "$available_space" -lt "$min_space" ]; then
        print_error "Insufficient disk space. At least 5GB required."
        exit 1
    fi
    
    # Check memory (minimum 4GB)
    total_memory=$(free -m | awk '/^Mem:/{print $2}')
    min_memory=4096  # 4GB in MB
    
    if [ "$total_memory" -lt "$min_memory" ]; then
        print_warning "System has less than 4GB RAM. Performance may be affected."
    fi
    
    print_status "System requirements check completed"
}

# Setup environment variables
setup_environment() {
    print_info "Setting up environment variables..."
    
    # Check if .env.production exists
    if [ ! -f ".env.production" ]; then
        print_error ".env.production file not found. Creating template..."
        cat > .env.production << EOL
# Database Configuration
MONGODB_URL=mongodb://mongo:27017/school_management
MONGODB_DATABASE=school_management

# Security Configuration  
JWT_SECRET_KEY=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)

# API Configuration
API_HOST=0.0.0.0
API_PORT=8000
FRONTEND_URL=http://localhost:3000

# Email Configuration (Update with your SMTP settings)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=noreply@yourschool.com

# Redis Configuration
REDIS_URL=redis://redis:6379/0

# File Storage
UPLOAD_PATH=/app/uploads
MAX_FILE_SIZE=50MB

# Monitoring
LOG_LEVEL=INFO
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# Production Settings
ENVIRONMENT=production
DEBUG=false
CORS_ORIGINS=https://yourschool.com
EOL
        print_warning "Template .env.production created. Please update with your actual values."
        print_info "Press Enter to continue after updating .env.production..."
        read
    fi
    
    # Validate required environment variables
    source .env.production
    
    required_vars=("MONGODB_URL" "JWT_SECRET_KEY" "ENCRYPTION_KEY")
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            print_error "Required environment variable $var is not set."
            exit 1
        fi
    done
    
    print_status "Environment setup completed"
}

# Create Docker Compose configuration
create_docker_compose() {
    print_info "Creating Docker Compose configuration..."
    
    cat > $DOCKER_COMPOSE_FILE << EOL
version: '3.8'

services:
  # Frontend Service
  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - backend
    restart: unless-stopped
    networks:
      - school-network

  # Backend Service
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    ports:
      - "8000:8000"
    env_file:
      - .env.production
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    depends_on:
      - mongo
      - redis
    restart: unless-stopped
    networks:
      - school-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # MongoDB Database
  mongo:
    image: mongo:6.0
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: \${MONGODB_ROOT_PASSWORD:-secure_password_123}
      MONGO_INITDB_DATABASE: school_management
    volumes:
      - mongo-data:/data/db
      - ./backup:/backup
    restart: unless-stopped
    networks:
      - school-network
    command: mongod --auth

  # Redis Cache
  redis:
    image: redis:7.0-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped
    networks:
      - school-network
    command: redis-server --appendonly yes

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - static-files:/var/www/static
    depends_on:
      - backend
      - frontend
    restart: unless-stopped
    networks:
      - school-network

  # Monitoring with Prometheus
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    restart: unless-stopped
    networks:
      - school-network

  # Grafana Dashboard
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin123
    volumes:
      - grafana-data:/var/lib/grafana
    restart: unless-stopped
    networks:
      - school-network

volumes:
  mongo-data:
  redis-data:
  prometheus-data:
  grafana-data:
  static-files:

networks:
  school-network:
    driver: bridge
EOL

    print_status "Docker Compose configuration created"
}

# Create Dockerfiles
create_dockerfiles() {
    print_info "Creating Dockerfiles..."
    
    # Backend Dockerfile
    cat > Dockerfile.backend << EOL
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    gcc \\
    curl \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY backend/ .

# Create necessary directories
RUN mkdir -p uploads logs

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:8000/health || exit 1

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
EOL

    # Frontend Dockerfile
    cat > Dockerfile.frontend << EOL
# Build stage
FROM node:18-alpine as build

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src/ ./src/
COPY public/ ./public/
COPY index.html ./

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
EOL

    print_status "Dockerfiles created"
}

# Setup directories
setup_directories() {
    print_info "Setting up directories..."
    
    directories=(
        "$BACKUP_DIR"
        "$LOG_DIR"
        "./uploads"
        "./logs" 
        "./ssl"
        "./nginx"
        "./monitoring"
    )
    
    for dir in "${directories[@]}"; do
        sudo mkdir -p "$dir"
        print_status "Created directory: $dir"
    done
    
    # Set proper permissions
    sudo chown -R $USER:$USER ./uploads ./logs
    sudo chmod -R 755 ./uploads ./logs
    
    print_status "Directory setup completed"
}

# Create database backup
create_backup() {
    print_info "Creating database backup..."
    
    timestamp=$(date +%Y%m%d_%H%M%S)
    backup_file="${BACKUP_DIR}/backup_${timestamp}.gz"
    
    # Check if MongoDB is running
    if docker ps | grep -q mongo; then
        docker exec school-management-mongo mongodump --out /backup/dump_${timestamp}
        sudo tar -czf "$backup_file" -C "$BACKUP_DIR" dump_${timestamp}
        sudo rm -rf "${BACKUP_DIR}/dump_${timestamp}"
        print_status "Database backup created: $backup_file"
    else
        print_warning "MongoDB not running, skipping backup"
    fi
}

# Deploy application
deploy_application() {
    print_info "Deploying application..."
    
    # Pull latest images
    print_info "Pulling Docker images..."
    docker-compose -f $DOCKER_COMPOSE_FILE pull
    
    # Build custom images
    print_info "Building custom images..."
    docker-compose -f $DOCKER_COMPOSE_FILE build
    
    # Start services
    print_info "Starting services..."
    docker-compose -f $DOCKER_COMPOSE_FILE up -d
    
    print_status "Application deployment started"
}

# Health checks
perform_health_checks() {
    print_info "Performing health checks..."
    
    # Wait for services to start
    print_info "Waiting for services to start..."
    sleep 30
    
    services=("backend" "mongo" "redis")
    for service in "${services[@]}"; do
        print_info "Checking $service service..."
        
        if docker-compose -f $DOCKER_COMPOSE_FILE ps | grep -q "$service.*Up"; then
            print_status "$service is running"
        else
            print_error "$service failed to start"
            docker-compose -f $DOCKER_COMPOSE_FILE logs "$service"
            return 1
        fi
    done
    
    # Test API endpoint
    print_info "Testing API endpoint..."
    for i in {1..10}; do
        if curl -f http://localhost:8000/health >/dev/null 2>&1; then
            print_status "API health check passed"
            break
        elif [ $i -eq 10 ]; then
            print_error "API health check failed after 10 attempts"
            return 1
        else
            print_info "API not ready, waiting... (attempt $i/10)"
            sleep 10
        fi
    done
    
    # Test frontend
    print_info "Testing frontend..."
    if curl -f http://localhost:80 >/dev/null 2>&1; then
        print_status "Frontend is accessible"
    else
        print_warning "Frontend may not be ready yet"
    fi
    
    print_status "Health checks completed"
}

# Setup monitoring
setup_monitoring() {
    print_info "Setting up monitoring..."
    
    # Create Prometheus configuration
    cat > monitoring/prometheus.yml << EOL
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'backend-api'
    static_configs:
      - targets: ['backend:8000']
    metrics_path: '/metrics'
    scrape_interval: 10s

  - job_name: 'mongodb'
    static_configs:
      - targets: ['mongo:27017']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['localhost:9100']
EOL
    
    print_status "Monitoring setup completed"
}

# Main deployment function
main() {
    print_info "Starting deployment process..."
    
    check_permissions
    check_system_requirements
    setup_environment
    setup_directories
    create_docker_compose
    create_dockerfiles
    setup_monitoring
    
    # Create backup if MongoDB is running
    if docker ps | grep -q mongo; then
        create_backup
    fi
    
    deploy_application
    perform_health_checks
    
    print_status "Deployment completed successfully!"
    
    echo ""
    echo -e "${GREEN}🎉 Spring of Knowledge Hub is now running!${NC}"
    echo "============================================================"
    echo -e "Frontend: ${BLUE}http://localhost${NC}"
    echo -e "API: ${BLUE}http://localhost:8000${NC}"
    echo -e "API Docs: ${BLUE}http://localhost:8000/docs${NC}"
    echo -e "Monitoring: ${BLUE}http://localhost:9090${NC}"
    echo -e "Dashboard: ${BLUE}http://localhost:3001${NC}"
    echo ""
    echo -e "${YELLOW}Important:${NC}"
    echo "1. Update your DNS to point to this server"
    echo "2. Configure SSL certificates in ./ssl/"
    echo "3. Update CORS_ORIGINS in .env.production"
    echo "4. Setup regular backups with cron"
    echo "5. Configure monitoring alerts"
    echo ""
    echo -e "Logs: ${BLUE}docker-compose -f $DOCKER_COMPOSE_FILE logs -f${NC}"
    echo -e "Stop: ${BLUE}docker-compose -f $DOCKER_COMPOSE_FILE down${NC}"
}

# Run main function
main "$@"