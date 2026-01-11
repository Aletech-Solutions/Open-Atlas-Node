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
    echo "Creating .env file..."
    
    # Create base .env file
    cat > .env << 'EOF'
# Database Configuration
DB_NAME=atlasnode
DB_USER=atlasnode
DB_PASSWORD=PLACEHOLDER_PASSWORD

# Backend Configuration
NODE_ENV=production
JWT_SECRET=PLACEHOLDER_JWT_SECRET
JWT_EXPIRES_IN=7d
CORS_ORIGIN=*

# Ports
BACKEND_PORT=5000
FRONTEND_PORT=3000

# Agent Communication (IMPORTANT!)
BACKEND_HOST=PLACEHOLDER_BACKEND_HOST
EOF
    
    # Generate random JWT secret
    JWT_SECRET=$(openssl rand -hex 32)
    sed -i.bak "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
    
    # Generate random database password
    DB_PASSWORD=$(openssl rand -hex 16)
    sed -i.bak "s/DB_PASSWORD=.*/DB_PASSWORD=$DB_PASSWORD/" .env
    
    rm .env.bak 2>/dev/null || true
    
    echo "✓ Generated secure JWT secret and database password"
    echo ""
    
    # Get server IP for BACKEND_HOST
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo " IMPORTANT: Configure Agent Communication"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Agents installed on remote machines need to know how to"
    echo "connect back to this control server."
    echo ""
    
    # Try to detect IP address
    echo "Detecting your server's IP address..."
    DETECTED_IPS=$(hostname -I 2>/dev/null | awk '{print $1}' || ip addr show | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | cut -d/ -f1 | head -n1)
    
    if [ ! -z "$DETECTED_IPS" ]; then
        echo "Detected IP: $DETECTED_IPS"
        echo ""
        echo "Options:"
        echo "  1) Use detected IP: $DETECTED_IPS"
        echo "  2) Enter a different IP or hostname"
        echo "  3) Skip (configure manually later)"
        echo ""
        read -p "Choose an option (1-3): " IP_CHOICE
        
        case $IP_CHOICE in
            1)
                BACKEND_HOST=$DETECTED_IPS
                echo "Using: $BACKEND_HOST"
                ;;
            2)
                read -p "Enter IP address or hostname: " BACKEND_HOST
                ;;
            3)
                echo "Skipping... You'll need to set BACKEND_HOST in .env manually!"
                BACKEND_HOST="CHANGE_THIS_TO_YOUR_SERVER_IP"
                ;;
            *)
                BACKEND_HOST=$DETECTED_IPS
                echo "Using default: $BACKEND_HOST"
                ;;
        esac
    else
        echo "Could not auto-detect IP address."
        read -p "Enter your server's IP address or hostname: " BACKEND_HOST
        
        if [ -z "$BACKEND_HOST" ]; then
            echo "⚠️  Warning: No IP set! You MUST configure BACKEND_HOST in .env"
            BACKEND_HOST="CHANGE_THIS_TO_YOUR_SERVER_IP"
        fi
    fi
    
    # Update .env with BACKEND_HOST
    sed -i.bak "s/BACKEND_HOST=.*/BACKEND_HOST=$BACKEND_HOST/" .env
    rm .env.bak 2>/dev/null || true
    
    echo ""
    echo "✓ Created .env file"
    echo ""
    
    if [ "$BACKEND_HOST" = "CHANGE_THIS_TO_YOUR_SERVER_IP" ]; then
        echo "⚠️  WARNING: You MUST edit .env and set BACKEND_HOST before adding machines!"
        echo ""
        echo "Edit .env now:"
        echo "  nano .env"
        echo ""
        echo "Then set BACKEND_HOST to your server's IP address"
        echo ""
        read -p "Press Enter to continue or Ctrl+C to exit and edit .env..."
    else
        echo "Configuration summary:"
        echo "  BACKEND_HOST=$BACKEND_HOST"
        echo "  Agents will connect to: http://$BACKEND_HOST:5000"
        echo ""
        read -p "Press Enter to continue..."
    fi
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
echo "✓ Dashboard: http://localhost:3000"
echo "✓ API: http://localhost:5000"
echo ""

# Show BACKEND_HOST configuration
if [ -f .env ]; then
    BACKEND_HOST_VALUE=$(grep "^BACKEND_HOST=" .env | cut -d'=' -f2)
    if [ ! -z "$BACKEND_HOST_VALUE" ] && [ "$BACKEND_HOST_VALUE" != "CHANGE_THIS_TO_YOUR_SERVER_IP" ]; then
        echo "✓ Agent communication: http://$BACKEND_HOST_VALUE:5000"
        echo ""
    else
        echo "⚠️  WARNING: BACKEND_HOST not configured!"
        echo "   Edit .env and set BACKEND_HOST before adding machines"
        echo "   See CONFIGURATION.md for details"
        echo ""
    fi
fi

echo "Next steps:"
echo "  1. Open http://localhost:3000 in your browser"
echo "  2. Register your first user (becomes admin)"
echo "  3. Add machines from the dashboard"
echo ""
echo "Useful commands:"
echo "  View logs:      docker-compose logs -f"
echo "  Stop services:  docker-compose stop"
echo "  Restart:        docker-compose restart"
echo "  Remove all:     docker-compose down -v"
echo ""
echo "Documentation:"
echo "  Configuration: CONFIGURATION.md"
echo "  API docs: API.md"
echo "  Contributing: CONTRIBUTING.md"
echo ""

