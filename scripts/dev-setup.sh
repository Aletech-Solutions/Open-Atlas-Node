#!/bin/bash
set -e

echo "====================================="
echo "   AtlasNode Development Setup"
echo "====================================="
echo ""

# Install backend dependencies
echo "Installing backend dependencies..."
cd backend
npm install
cd ..

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd frontend
npm install
cd ..

# Install agent dependencies
echo "Installing agent dependencies..."
cd agent
npm install
cd ..

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cp .env.example .env
    
    # Generate secure secrets
    JWT_SECRET=$(openssl rand -hex 32)
    DB_PASSWORD=$(openssl rand -hex 16)
    
    # Update .env with generated secrets
    sed -i.bak "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
    sed -i.bak "s/DB_PASSWORD=.*/DB_PASSWORD=$DB_PASSWORD/" .env
    
    rm .env.bak 2>/dev/null || true
    
    echo "✓ .env file created with secure defaults"
fi

echo ""
echo "====================================="
echo "   Development Setup Complete!"
echo "====================================="
echo ""
echo "To start development:"
echo ""
echo "  Option 1 - Docker Compose (Recommended):"
echo "    make dev"
echo ""
echo "  Option 2 - Manual (3 terminals):"
echo "    Terminal 1: cd backend && npm run dev"
echo "    Terminal 2: cd frontend && npm run dev"
echo "    Terminal 3: docker-compose up database"
echo ""
echo "Frontend will be at: http://localhost:3000"
echo "Backend will be at: http://localhost:5000"
echo ""

