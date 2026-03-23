#!/usr/bin/env bash
set -euo pipefail

# Run integration tests against a real PostgreSQL instance.
# Requires PostgreSQL running on localhost:5432.
#
# Usage:
#   ./infra/scripts/run-integration-tests.sh
#
# With Docker Compose:
#   docker compose -f infra/docker/docker-compose.yml up -d postgres
#   ./infra/scripts/run-integration-tests.sh
#
# Without Docker (local PostgreSQL):
#   Ensure PostgreSQL is running and the sovereign user exists:
#     createuser -P sovereign  (password: sovereign_dev)
#     createdb -O sovereign sovereign
#   Then run this script.

DATABASE_URL="${DATABASE_URL:-postgresql://sovereign:sovereign_dev@localhost:5432/sovereign}"

echo "Running integration tests against: ${DATABASE_URL%%@*}@****"

# Run migrations first
echo "Running migrations..."
DATABASE_URL="$DATABASE_URL" pnpm db:migrate

# Run integration tests
echo "Running integration tests..."
DATABASE_URL="$DATABASE_URL" pnpm --filter @sovereign/db test:integration

echo ""
echo "Integration tests complete."
