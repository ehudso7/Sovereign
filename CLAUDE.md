# CLAUDE.md — SOVEREIGN Execution Rules

## Identity

SOVEREIGN is a production-grade multi-tenant agent operating system. One platform, not 218 scattered mini-tools.

## Non-Negotiable Rules

1. Follow ROADMAP.md phase order exactly. Do not skip ahead.
2. Do not invent new product scope.
3. If you find a necessary architecture change, create an ADR file and stop for review before making the change.
4. Every change must preserve multi-tenancy, auditability, and policy enforcement.
5. Every risky or destructive path must be guarded by approval and policy checks.
6. No placeholder code, fake integrations, or TODO-only implementations unless explicitly marked behind a feature flag with a failing test or tracked task.
7. Keep code production quality.
8. Run lint, types, unit tests, and any affected integration tests before finishing.
9. Update TASKS.md as you complete items.
10. Output a concise completion report with:
    - what changed
    - files changed
    - tests run
    - blockers
    - follow-up tasks

## Execution Order

Before any implementation work:

1. Read AGENTS.md
2. Read CLAUDE.md (this file)
3. Read ROADMAP.md
4. Read ARCHITECTURE.md
5. Read DB_SCHEMA.md
6. Read API_SPEC.md
7. Read SECURITY.md
8. Read TASKS.md

## Change Control

Claude Code does NOT get to decide product direction. Claude Code only gets to:

- Execute the current sprint
- Follow the locked docs
- Update task status
- Run tests
- Report blockers
- Propose ADRs when forced

## Formal Change Control Triggers

These are NOT deviations — they are mandatory responses:

- Critical security advisory
- Upstream breaking change
- Failed acceptance test
- Legal/compliance blocker

Everything else stays frozen.

## Code Standards

- TypeScript strict mode everywhere
- ESLint + Prettier enforced
- No `any` types without justification
- All API endpoints must validate input
- All database queries must be tenant-scoped
- All secrets must go through the secret broker — never in code, logs, or prompts
- Tests required for all business logic
- Migrations must be reversible

## Tech Stack (Locked)

- **Frontend**: Next.js 16+ / TypeScript / App Router
- **AI Runtime**: OpenAI Responses API
- **Connectors**: MCP standard
- **Orchestration**: Temporal
- **Policy**: OPA
- **Auth**: WorkOS (SSO, SCIM, RBAC/FGA)
- **Browser Automation**: Playwright
- **Package Manager**: pnpm
- **Monorepo Tool**: Turborepo
- **Database**: PostgreSQL
- **Object Storage**: S3-compatible

## Commit Message Format

```
<type>(<scope>): <description>

[optional body]
```

Types: feat, fix, refactor, docs, test, ci, chore
Scopes: web, api, worker, db, core, agents, connectors, policies, billing, crm, infra, docs
