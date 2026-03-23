#!/usr/bin/env bash
set -euo pipefail

echo "Setting up SOVEREIGN development environment..."

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed."; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "pnpm is required. Install with: npm install -g pnpm"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed."; exit 1; }

# Install dependencies
echo "Installing dependencies..."
pnpm install

# Copy env files
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo "Created .env.local from .env.example. Please update with your values."
fi

# Start infrastructure services
echo "Starting infrastructure services..."
docker compose -f infra/docker/docker-compose.yml up -d

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
for i in $(seq 1 30); do
  if pg_isready -h localhost -p 5432 -q 2>/dev/null; then
    echo "PostgreSQL is ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "Timed out waiting for PostgreSQL."
    exit 1
  fi
  sleep 1
done

# Run database migrations
echo "Running database migrations..."
pnpm db:migrate

echo ""
echo "Development environment ready!"
echo ""
echo "Commands:"
echo "  pnpm dev              # Start all applications"
echo "  pnpm db:migrate       # Run database migrations"
echo "  pnpm test             # Run unit tests"
echo "  pnpm test:integration # Run integration tests (requires PostgreSQL)"
echo "  pnpm lint             # Lint all packages"
echo "  pnpm typecheck        # Type check all packages"
echo "  pnpm build            # Build all packages"
