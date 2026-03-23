# SOVEREIGN

Multi-tenant agent operating system.

## Quick Start

```bash
# Prerequisites: Node.js 20+, pnpm 9+, Docker

# Install dependencies
pnpm install

# Start infrastructure (PostgreSQL, Redis, Temporal, MinIO)
docker compose -f infra/docker/docker-compose.yml up -d

# Copy environment variables
cp .env.example .env.local

# Start development
pnpm dev
```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in dev mode |
| `pnpm build` | Build all apps and packages |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm test` | Run unit tests |
| `pnpm test:integration` | Run integration tests |

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full system design.

## Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md) for the locked phase execution order.
