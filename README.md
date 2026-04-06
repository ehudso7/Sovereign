# SOVEREIGN

Production-grade multi-tenant agent operating system. One platform for agent creation, orchestration, tooling, browser automation, memory, policy enforcement, revenue management, and billing.

## Features

| Module | Description |
|--------|-------------|
| **Identity & Tenancy** | SSO-ready auth (local + WorkOS), orgs, RBAC (5 roles), row-level security |
| **Agent Studio** | Create, version, publish agents with goals, tools, budget, approval rules |
| **Run Engine** | Durable agent execution via Temporal, pause/resume/cancel, step tracking |
| **Connector Hub** | Install, configure, credential-manage connectors with trust tiers |
| **Browser Plane** | Playwright-backed browser sessions with screenshot capture and action audit |
| **Memory Engine** | Semantic/episodic/procedural memory with cross-memory linking |
| **Mission Control** | Real-time dashboard, alert rules, run monitoring, org overview |
| **Policy Engine** | OPA-style deny/allow/require_approval/quarantine with runtime enforcement |
| **Revenue Workspace** | CRM accounts, contacts, deals, tasks, notes, AI outreach drafts, sync |
| **Billing & Usage** | Plan catalog (free/team/enterprise), metering, invoices, spend alerts |
| **Onboarding** | 8-step checklist derived from real platform state |
| **Docs & Support** | In-app documentation, support diagnostics, admin overview |
| **Mobile Terminal** | PWA-ready mobile terminal with WebSocket proxy, PTY bridge, touch-optimized command palette |
| **Multi-Provider AI** | Unified AI agent routing — Anthropic Claude, OpenAI, Google Gemini, DeepSeek with per-org configuration |

## Quick Start

```bash
# Prerequisites: Node.js 20+, pnpm 9+, Docker

# Install dependencies
pnpm install

# Start infrastructure (PostgreSQL, Redis, Temporal, MinIO)
docker compose -f infra/docker/docker-compose.yml up -d

# Copy environment variables
cp .env.example .env.local

# IMPORTANT: For local development without WorkOS SSO, ensure:
#   AUTH_MODE=local
# is set in .env.local (this is the default in .env.example).
# This enables the bootstrap form to create your first admin account.

# Run database migrations
pnpm db:migrate

# Start development
pnpm dev

# Visit http://localhost:3000 → Sign In → "New installation? Bootstrap first account"
# to create your initial org and admin user.
```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in dev mode |
| `pnpm build` | Build all apps and packages |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm test` | Run unit tests |
| `pnpm test:integration` | Run integration tests (requires PostgreSQL) |
| `pnpm test:e2e` | Run E2E tests (requires PostgreSQL) |
| `pnpm format` | Format code with Prettier |
| `pnpm clean` | Remove all build artifacts |

## Architecture

```
apps/
  api/                  — Fastify API server (110+ endpoints)
  web/                  — Next.js frontend (45+ pages)
  worker-orchestrator/  — Temporal orchestration worker
  worker-browser/       — Playwright browser automation worker
  gateway-mcp/          — MCP connector gateway
  terminal-proxy/       — WebSocket terminal proxy with PTY bridge
  docs/                 — Documentation site

packages/
  core/        — Shared types, entities, branded IDs, Result pattern
  db/          — PostgreSQL client, 30+ repositories, 11 migrations
  config/      — Shared ESLint, TypeScript, env validation
  agents/      — Multi-provider AI agent runtime (Claude, OpenAI, Gemini, DeepSeek)
  billing/     — Plan definitions and metering
  connectors/  — Connector abstractions
  crm/         — CRM sync adapter interface
  policies/    — Policy engine abstractions
  observability/ — Logging and metrics
  testing/     — Shared test utilities
  ui/          — Shared React components
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full system design.

## Test Coverage

| Suite | Tests |
|-------|-------|
| Unit | 789 |
| Integration (PostgreSQL) | 240 |
| E2E | 43 |
| **Total** | **1,072** |

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design and service boundaries |
| [ROADMAP.md](docs/ROADMAP.md) | Phase execution order (Phases 0-15, all complete) |
| [API_SPEC.md](docs/API_SPEC.md) | API endpoint contract |
| [DB_SCHEMA.md](docs/DB_SCHEMA.md) | Database schema and migrations |
| [SECURITY.md](docs/SECURITY.md) | Security architecture and policies |
| [ENVIRONMENT.md](docs/ENVIRONMENT.md) | Environment variables and production enforcement |
| [TEST_STRATEGY.md](docs/TEST_STRATEGY.md) | Testing pyramid and coverage approach |
| [LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md) | Pre/post-launch verification |
| [BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md) | Backup and restore procedures |
| [ROLLBACK_PLAN.md](docs/ROLLBACK_PLAN.md) | Deploy and rollback procedures |
| [SLO.md](docs/SLO.md) | Service level objectives |
| [SUPPORT_ESCALATION.md](docs/SUPPORT_ESCALATION.md) | Incident response and escalation |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution guidelines |

## License

[MIT](LICENSE)
