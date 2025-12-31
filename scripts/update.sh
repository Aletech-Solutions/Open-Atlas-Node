#!/bin/bash
set -e

echo "====================================="
echo "   AtlasNode Update Script"
echo "====================================="
echo ""

# Backup database first
echo "Creating database backup..."
./scripts/backup.sh

echo ""
echo "Pulling latest changes..."
git pull

echo ""
echo "Rebuilding containers..."
docker-compose up -d --build

echo ""
echo "Update complete!"
echo "Check status with: docker-compose ps"
echo ""

