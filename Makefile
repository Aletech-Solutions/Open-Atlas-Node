.PHONY: help setup start stop restart logs clean backup update dev

help:
	@echo "AtlasNode - Available Commands"
	@echo ""
	@echo "  make setup     - Initial setup and start"
	@echo "  make start     - Start all services"
	@echo "  make stop      - Stop all services"
	@echo "  make restart   - Restart all services"
	@echo "  make logs      - View logs (follow mode)"
	@echo "  make backup    - Backup database"
	@echo "  make update    - Update to latest version"
	@echo "  make clean     - Remove all containers and volumes"
	@echo "  make dev       - Start in development mode"
	@echo ""

setup:
	@bash scripts/setup.sh

start:
	@docker-compose up -d

stop:
	@docker-compose stop

restart:
	@docker-compose restart

logs:
	@docker-compose logs -f

clean:
	@echo "WARNING: This will remove all containers, volumes, and data!"
	@echo "Press Ctrl+C to cancel, or Enter to continue..."
	@read
	@docker-compose down -v
	@rm -rf backups/*
	@echo "Cleanup complete"

backup:
	@bash scripts/backup.sh

update:
	@bash scripts/update.sh

dev:
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

