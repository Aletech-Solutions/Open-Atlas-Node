#!/bin/bash
set -e

echo "====================================="
echo "   AtlasNode Setup Script"
echo "====================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "Error: Docker Compose is not installed"
    echo "Please install Docker Compose first: https://docs.docker.com/compose/install/"
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
    
    # Generate random JWT secret
    JWT_SECRET=$(openssl rand -hex 32)
    sed -i.bak "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
    
    # Generate random database password
    DB_PASSWORD=$(openssl rand -hex 16)
    sed -i.bak "s/DB_PASSWORD=.*/DB_PASSWORD=$DB_PASSWORD/" .env
    
    rm .env.bak 2>/dev/null || true
    
    echo "✓ Created .env file with secure defaults"
    echo ""
    echo "IMPORTANT: Please review and update the .env file with your settings"
    echo "Press Enter to continue or Ctrl+C to exit and edit .env first..."
    read
fi

# Create necessary directories
echo "Creating directories..."
mkdir -p agent-bundles
mkdir -p logs

echo ""
echo "Building and starting containers..."
docker-compose up -d --build

echo ""
echo "Waiting for services to be ready..."
sleep 10

# Check if backend is healthy
if curl -sf http://localhost:5000/health > /dev/null; then
    echo "✓ Backend is healthy"
else
    echo "✗ Backend health check failed"
    echo "Check logs with: docker-compose logs backend"
fi

# Check if frontend is accessible
if curl -sf http://localhost:3000 > /dev/null; then
    echo "✓ Frontend is accessible"
else
    echo "✗ Frontend is not accessible"
    echo "Check logs with: docker-compose logs frontend"
fi

echo ""
echo "====================================="
echo "   AtlasNode Setup Complete!"
echo "====================================="
echo ""
echo "Access AtlasNode at: http://localhost:3000"
echo ""
echo "Useful commands:"
echo "  View logs:      docker-compose logs -f"
echo "  Stop services:  docker-compose stop"
echo "  Restart:        docker-compose restart"
echo "  Remove all:     docker-compose down -v"
echo ""
echo "First user will automatically be created as admin."
echo ""

