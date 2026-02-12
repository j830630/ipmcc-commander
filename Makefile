# IPMCC Commander - Makefile
# Convenience commands for development

.PHONY: setup backend frontend dev clean test help

# Default target
help:
	@echo "IPMCC Commander - Development Commands"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  setup     - Initial setup (install all dependencies)"
	@echo "  backend   - Run backend server (port 8000)"
	@echo "  frontend  - Run frontend server (port 3000)"
	@echo "  dev       - Instructions for running both servers"
	@echo "  test      - Run all tests"
	@echo "  clean     - Remove generated files"
	@echo "  db-reset  - Reset database (delete and recreate)"
	@echo ""

# Initial setup
setup:
	@echo "Setting up IPMCC Commander..."
	@echo ""
	@echo "1. Setting up backend..."
	cd backend && python -m venv venv
	cd backend && . venv/bin/activate && pip install -r requirements.txt
	@echo ""
	@echo "2. Setting up frontend..."
	cd frontend && npm install
	@echo ""
	@echo "✅ Setup complete!"
	@echo ""
	@echo "To start development:"
	@echo "  Terminal 1: make backend"
	@echo "  Terminal 2: make frontend"

# Run backend server
backend:
	@echo "Starting backend server on http://localhost:8000..."
	@echo "API docs: http://localhost:8000/docs"
	@echo ""
	cd backend && . venv/bin/activate && uvicorn app.main:app --reload --port 8000

# Run frontend server
frontend:
	@echo "Starting frontend server on http://localhost:3000..."
	@echo ""
	cd frontend && npm run dev

# Instructions for running both
dev:
	@echo "To run the full development environment:"
	@echo ""
	@echo "Open two terminal windows and run:"
	@echo ""
	@echo "  Terminal 1: make backend"
	@echo "  Terminal 2: make frontend"
	@echo ""
	@echo "Then open http://localhost:3000 in your browser."

# Run tests
test:
	@echo "Running backend tests..."
	cd backend && . venv/bin/activate && pytest
	@echo ""
	@echo "Running frontend tests..."
	cd frontend && npm test

# Clean generated files
clean:
	@echo "Cleaning generated files..."
	rm -rf backend/__pycache__
	rm -rf backend/app/__pycache__
	rm -rf backend/app/**/__pycache__
	rm -rf frontend/.next
	rm -rf frontend/node_modules/.cache
	@echo "✅ Cleaned!"

# Reset database
db-reset:
	@echo "Resetting database..."
	rm -f backend/data/ipmcc.db
	@echo "Database deleted. It will be recreated on next backend start."

# Build frontend for production
build:
	@echo "Building frontend for production..."
	cd frontend && npm run build

# Lint
lint:
	@echo "Linting backend..."
	cd backend && . venv/bin/activate && ruff check app/
	@echo ""
	@echo "Linting frontend..."
	cd frontend && npm run lint

# Format code
format:
	@echo "Formatting backend code..."
	cd backend && . venv/bin/activate && black app/
	@echo ""
	@echo "Formatting complete!"
