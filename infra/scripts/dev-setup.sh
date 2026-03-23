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

# Wait for services
echo "Waiting for services to be ready..."
sleep 5

echo "Development environment ready!"
echo "Run 'pnpm dev' to start all applications."
