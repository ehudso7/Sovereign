# AGENTS.md — Universal Repo Instructions for SOVEREIGN

## Project Overview

SOVEREIGN is a multi-tenant agent operating system. It allows organizations to create, configure, run, and govern AI agents that can use tools, browse the web, remember context, and operate under policy-enforced guardrails.

## Repo Structure

```
sovereign/
  apps/
    web/              # Next.js frontend
    api/              # API server
    worker-orchestrator/  # Temporal worker for agent orchestration
    worker-browser/   # Browser automation worker
    gateway-mcp/      # MCP gateway server
    docs/             # Documentation site
  packages/
    ui/               # Shared UI components (design system)
    config/           # Shared configs (ESLint, TypeScript, Tailwind)
    db/               # Database client, schema, migrations
    core/             # Shared types, utils, constants
    agents/           # Agent definitions, execution logic
    connectors/       # MCP connectors and tool integrations
    policies/         # OPA policy engine integration
    observability/    # Logging, tracing, metrics
    billing/          # Metering, usage, payments
    crm/              # CRM/revenue workspace logic
    testing/          # Shared test utilities and fixtures
  infra/
    docker/           # Docker configs
    terraform/        # IaC definitions
    scripts/          # Dev and ops scripts
  docs/
    ADR/              # Architecture Decision Records
    RUNBOOKS/         # Operational runbooks
    PRD.md
    ROADMAP.md
    ARCHITECTURE.md
    DB_SCHEMA.md
    API_SPEC.md
    SECURITY.md
    TEST_STRATEGY.md
  .github/
    workflows/        # CI/CD pipelines
```

## Development Commands

```bash
pnpm install          # Install all dependencies
pnpm dev              # Start all apps in dev mode
pnpm build            # Build all apps and packages
pnpm lint             # Lint all packages
pnpm typecheck        # TypeScript type checking
pnpm test             # Run all unit tests
pnpm test:integration # Run integration tests
pnpm db:migrate       # Run database migrations
pnpm db:seed          # Seed development database
```

## Key Principles

1. **Multi-tenancy first**: Every data access must be org-scoped. No exceptions.
2. **Audit everything**: Every state-changing action emits an audit event.
3. **Policy before action**: Destructive or sensitive operations require policy evaluation.
4. **No black boxes**: Every agent run must be fully traceable.
5. **Memory with provenance**: Every memory write must be attributable.
6. **Durable execution**: Agent runs survive worker restarts via Temporal.
7. **Connector trust tiers**: Verified, internal, and untrusted — each with different permissions.

## Testing Requirements

- Unit tests for all business logic
- Integration tests for API endpoints
- E2E tests for critical user flows
- Tenant isolation tests for all data access
- Policy enforcement tests for all gated actions

## Security Rules

- No secrets in code, logs, or AI prompts
- All API endpoints require authentication
- All mutations require authorization checks
- Input validation on all external boundaries
- Rate limiting on all public endpoints
- CORS restricted to known origins
