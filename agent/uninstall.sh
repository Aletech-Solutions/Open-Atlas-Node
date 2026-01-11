#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "╔═══════════════════════════════════════╗"
echo "║  AtlasNode Agent Uninstaller          ║"
echo "╚═══════════════════════════════════════╝"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}✗ Please run as root or with sudo${NC}"
    exit 1
fi

# Confirm uninstallation
read -p "Are you sure you want to uninstall AtlasNode Agent? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Uninstallation cancelled"
    exit 0
fi

INSTALL_DIR="/opt/atlasnode-agent"

# Stop service if running
if systemctl is-active --quiet atlasnode-agent; then
    echo "Stopping service..."
    systemctl stop atlasnode-agent
    echo -e "${GREEN}✓${NC} Service stopped"
fi

# Disable service
if systemctl is-enabled --quiet atlasnode-agent 2>/dev/null; then
    echo "Disabling service..."
    systemctl disable atlasnode-agent
    echo -e "${GREEN}✓${NC} Service disabled"
fi

# Remove systemd service file
if [ -f "/etc/systemd/system/atlasnode-agent.service" ]; then
    echo "Removing service file..."
    rm /etc/systemd/system/atlasnode-agent.service
    systemctl daemon-reload
    echo -e "${GREEN}✓${NC} Service file removed"
fi

# Remove installation directory
if [ -d "$INSTALL_DIR" ]; then
    echo "Removing installation directory..."
    rm -rf "$INSTALL_DIR"
    echo -e "${GREEN}✓${NC} Installation directory removed"
fi

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Uninstallation Complete!             ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════╝${NC}"
echo ""
echo "AtlasNode Agent has been removed from your system."

