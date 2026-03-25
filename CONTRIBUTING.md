# Contributing to SOVEREIGN

## Development Setup

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 16+
- Redis 7+
- Docker (for infrastructure services)

### Getting Started

```bash
# Clone the repository
git clone <repo-url>
cd Sovereign

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Start infrastructure (PostgreSQL, Redis, Temporal, MinIO)
docker compose -f infra/docker/docker-compose.yml up -d

# Run database migrations
pnpm db:migrate

# Start development
pnpm dev
```

## Code Standards

- **Language**: TypeScript in strict mode everywhere
- **Linter**: ESLint with typescript-eslint (flat config)
- **Formatter**: Prettier (100 char width, semicolons, single quotes)
- **Types**: No `any` types without justification and eslint-disable comment
- **Testing**: Required for all business logic
- **Multi-tenancy**: All database queries must be tenant-scoped via `org_id`
- **Secrets**: All secrets go through the secret broker — never in code, logs, or prompts

## Commit Messages

```
<type>(<scope>): <description>

[optional body]
```

**Types**: `feat`, `fix`, `refactor`, `docs`, `test`, `ci`, `chore`

**Scopes**: `web`, `api`, `worker`, `db`, `core`, `agents`, `connectors`, `policies`, `billing`, `crm`, `infra`, `docs`

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes following the code standards above
3. Run the full verification suite before submitting:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm build
   pnpm test
   pnpm test:integration   # requires PostgreSQL
   pnpm test:e2e           # requires PostgreSQL
   ```
4. All checks must pass — lint, typecheck, build, unit, integration, and E2E
5. Submit a PR with a clear description of what changed and why
6. Wait for review and CI to pass

## Architecture

- See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for system design
- See [docs/SECURITY.md](docs/SECURITY.md) for security policies
- See [docs/DB_SCHEMA.md](docs/DB_SCHEMA.md) for database schema
- See [docs/API_SPEC.md](docs/API_SPEC.md) for API contract

## Change Control

Architectural changes require an ADR (Architecture Decision Record) in `docs/ADR/` before implementation. See [CLAUDE.md](CLAUDE.md) for the full execution rules.

## Monorepo Structure

```
apps/
  api/              — Fastify API server
  web/              — Next.js frontend
  worker-orchestrator/ — Temporal orchestration worker
  worker-browser/   — Playwright browser automation worker
  gateway-mcp/      — MCP gateway
  docs/             — Documentation site

packages/
  core/             — Shared types, entities, branded IDs
  db/               — PostgreSQL client, repos, migrations
  config/           — Shared ESLint, TypeScript, env validation
  agents/           — Agent runtime abstractions
  billing/          — Billing plan definitions
  connectors/       — Connector abstractions
  crm/              — CRM sync adapter interface
  policies/         — Policy engine abstractions
  observability/    — Logging and metrics
  testing/          — Shared test utilities
  ui/               — Shared UI components
```
