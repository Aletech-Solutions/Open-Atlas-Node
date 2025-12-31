#!/bin/bash
set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="atlasnode_backup_${TIMESTAMP}.sql"

echo "Creating backup directory..."
mkdir -p "$BACKUP_DIR"

echo "Backing up database..."
docker-compose exec -T database pg_dump -U atlasnode atlasnode > "$BACKUP_DIR/$BACKUP_FILE"

echo "Compressing backup..."
gzip "$BACKUP_DIR/$BACKUP_FILE"

echo ""
echo "Backup complete: $BACKUP_DIR/${BACKUP_FILE}.gz"
echo ""
echo "To restore this backup, run:"
echo "  gunzip < $BACKUP_DIR/${BACKUP_FILE}.gz | docker-compose exec -T database psql -U atlasnode atlasnode"
echo ""

