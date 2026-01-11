#!/bin/bash

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "╔═══════════════════════════════════════╗"
echo "║  AtlasNode Agent Status               ║"
echo "╚═══════════════════════════════════════╝"
echo ""

# Check if service exists
if ! systemctl list-unit-files | grep -q "atlasnode-agent.service"; then
    echo -e "${RED}✗ Service not installed${NC}"
    echo ""
    echo "To install the agent, run:"
    echo "  sudo ./install.sh"
    exit 1
fi

# Check if service is active
if systemctl is-active --quiet atlasnode-agent; then
    echo -e "${GREEN}✓ Service is running${NC}"
else
    echo -e "${RED}✗ Service is not running${NC}"
fi

# Check if service is enabled
if systemctl is-enabled --quiet atlasnode-agent; then
    echo -e "${GREEN}✓ Auto-start is enabled${NC}"
else
    echo -e "${YELLOW}⚠ Auto-start is disabled${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get service status
systemctl status atlasnode-agent --no-pager -l

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${BLUE}Recent Logs:${NC}"
echo ""
journalctl -u atlasnode-agent -n 20 --no-pager

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Useful commands:"
echo "  View live logs: journalctl -u atlasnode-agent -f"
echo "  Restart service: sudo systemctl restart atlasnode-agent"
echo "  Stop service: sudo systemctl stop atlasnode-agent"
echo "  Start service: sudo systemctl start atlasnode-agent"
echo ""

