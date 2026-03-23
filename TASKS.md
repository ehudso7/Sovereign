# SOVEREIGN — Tasks

## Current Sprint: Phase 3

### Remediation — ESLint Baseline ✅
- [x] Add eslint and typescript-eslint as project dependencies (root + packages/config)
- [x] Rewrite packages/config/eslint.config.mjs for modern typescript-eslint v8+
- [x] Create root eslint.config.mjs that delegates to shared config
- [x] Remove broken per-package eslint configs (use root config via ESLint directory walk)
- [x] Fix lint errors: prefer-const in auth.service.ts
- [x] Fix lint warnings: replace console.log with logger/console.warn in api, workers, gateway
- [x] Verify: pnpm turbo lint passes 19/19 packages with 0 errors 0 warnings
- [x] Verify: pnpm turbo typecheck passes 19/19 packages
- [x] Verify: pnpm turbo test passes 14/14 tasks (65 tests)

### Phase 0 — Control Documents ✅
- [x] Create PRD.md
- [x] Create ROADMAP.md
- [x] Create ARCHITECTURE.md
- [x] Create CLAUDE.md
- [x] Create AGENTS.md
- [x] Create TASKS.md (this file)
- [x] Create DB_SCHEMA.md
- [x] Create API_SPEC.md
- [x] Create SECURITY.md
- [x] Create TEST_STRATEGY.md
- [x] Create RUNBOOKS/
- [x] Create ADR/0001-system-architecture.md

### Phase 1 — Monorepo Foundation ✅
- [x] Initialize pnpm workspace
- [x] Configure Turborepo
- [x] Set up shared TypeScript config
- [x] Set up shared ESLint config
- [x] Scaffold all apps and packages
- [x] CI/CD workflows
- [x] Environment validation

### Phase 2 — Identity, Orgs, Tenancy ✅
- [x] Auth abstraction layer with local/WorkOS provider modes
- [x] Organization CRUD, memberships, roles, invitations
- [x] Session management (create, validate, expire, revoke)
- [x] Project/workspace boundaries
- [x] Audit event stubs for auth-sensitive actions
- [x] Auth middleware and API routes
- [x] Minimal web UI
- [x] Cross-tenant isolation tests

### Phase 3 — Data Layer and Storage ✅
- [x] Real PostgreSQL client with connection pooling (packages/db)
- [x] TenantDb and UnscopedDb interfaces for tenant-scoped and cross-org queries
- [x] Repository interfaces for all Phase 2 entities (UserRepo, OrgRepo, MembershipRepo, InvitationRepo, SessionRepo, ProjectRepo, AuditRepo)
- [x] PostgreSQL repository implementations (PgUserRepo, PgOrgRepo, PgMembershipRepo, PgInvitationRepo, PgSessionRepo, PgProjectRepo, PgAuditRepo)
- [x] Migration runner with schema_migrations tracking table
- [x] RLS migration (002_row_level_security.sql) for org-scoped tables
- [x] Service implementations swapped from in-memory to repository-backed (PgAuthService, PgUserService, PgOrgService, PgMembershipService, PgInvitationService, PgProjectService, PgAuditEmitter)
- [x] Service registry updated to wire repositories to services with tenant scoping
- [x] In-memory store removed from active path
- [x] Test infrastructure: in-memory repository implementations for unit tests (test-repos.ts)
- [x] All existing unit tests updated to use repository-backed services
- [x] Cross-tenant isolation tests verified with new architecture
- [x] Lint: 19/19, Typecheck: 19/19, Tests: 14/14 (65 tests)

## Backlog

### Phase 4 — Agent Studio
_Not started. Tasks will be expanded when Phase 4 begins._

### Phase 5–14
_See ROADMAP.md for full phase details._
