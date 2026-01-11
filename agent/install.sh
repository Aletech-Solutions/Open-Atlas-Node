#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "╔═══════════════════════════════════════╗"
echo "║  AtlasNode Agent Installer            ║"
echo "╚═══════════════════════════════════════╝"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}✗ Please run as root or with sudo${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Running as root"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js is not installed${NC}"
    echo "Please install Node.js first: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}✓${NC} Node.js $NODE_VERSION found"

# Check if config.json exists
if [ ! -f "config.json" ]; then
    echo -e "${YELLOW}⚠${NC} config.json not found"
    
    if [ -f "config.example.json" ]; then
        echo -e "${YELLOW}→${NC} Copying config.example.json to config.json"
        cp config.example.json config.json
        echo -e "${YELLOW}⚠${NC} Please edit config.json with your settings before continuing"
        echo "   - Set controlServer URL"
        echo "   - Set machineId"
        echo "   - Set agentToken"
        exit 1
    else
        echo -e "${RED}✗ config.example.json not found either${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓${NC} config.json found"

# Install directory
INSTALL_DIR="/opt/atlasnode-agent"
echo ""
echo "Installing to: $INSTALL_DIR"

# Create installation directory
if [ -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}⚠${NC} Installation directory already exists"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Installation cancelled"
        exit 1
    fi
    
    # Stop service if running
    if systemctl is-active --quiet atlasnode-agent; then
        echo "Stopping existing service..."
        systemctl stop atlasnode-agent
    fi
    
    rm -rf "$INSTALL_DIR"
fi

# Create installation directory
mkdir -p "$INSTALL_DIR"
echo -e "${GREEN}✓${NC} Created installation directory"

# Copy files
echo "Copying agent files..."
cp -r ./* "$INSTALL_DIR/"
echo -e "${GREEN}✓${NC} Files copied"

# Install dependencies
echo "Installing dependencies..."
cd "$INSTALL_DIR"
npm install --production --silent
echo -e "${GREEN}✓${NC} Dependencies installed"

# Install systemd service
echo "Installing systemd service..."
cp atlasnode-agent.service /etc/systemd/system/
systemctl daemon-reload
echo -e "${GREEN}✓${NC} Service installed"

# Enable and start service
echo "Enabling service to start on boot..."
systemctl enable atlasnode-agent
echo -e "${GREEN}✓${NC} Service enabled"

echo "Starting service..."
systemctl start atlasnode-agent
echo -e "${GREEN}✓${NC} Service started"

# Check service status
sleep 2
if systemctl is-active --quiet atlasnode-agent; then
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  Installation Successful!             ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════╝${NC}"
    echo ""
    echo "Service Status:"
    systemctl status atlasnode-agent --no-pager -l
    echo ""
    echo "Useful commands:"
    echo "  - View logs: journalctl -u atlasnode-agent -f"
    echo "  - Stop service: systemctl stop atlasnode-agent"
    echo "  - Start service: systemctl start atlasnode-agent"
    echo "  - Restart service: systemctl restart atlasnode-agent"
    echo "  - Check status: systemctl status atlasnode-agent"
    echo "  - Disable auto-start: systemctl disable atlasnode-agent"
    echo ""
    echo -e "${GREEN}✓${NC} The agent will now start automatically on system boot"
else
    echo ""
    echo -e "${RED}╔═══════════════════════════════════════╗${NC}"
    echo -e "${RED}║  Installation Failed!                 ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════╝${NC}"
    echo ""
    echo "Service failed to start. Check logs:"
    echo "  journalctl -u atlasnode-agent -n 50"
    exit 1
fi

