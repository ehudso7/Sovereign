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

### Phase 3 Remediation — Real DB Proof ✅
- [x] Fixed SET LOCAL → set_config() for RLS session variable (critical bug)
- [x] Added UnscopedDb.transactionWithOrg() for RLS-protected table writes
- [x] Updated PgMembershipRepo, PgInvitationRepo, PgSessionRepo to handle FORCE RLS
- [x] Updated PgProjectRepo, PgAuditRepo to wrap all operations in transactions for RLS context
- [x] Updated PgOrgRepo.listForUser to work with FORCE RLS on memberships table
- [x] Real PostgreSQL integration test harness (setupTestDb/teardownTestDb/truncateAllTables)
- [x] Migration proof: fresh DB migration, idempotent reruns, schema validation (8 tests)
- [x] Repository CRUD integration tests against real PostgreSQL (28 tests)
- [x] RLS tenant isolation tests: cross-tenant data isolation proven (17 tests)
- [x] Transaction behavior tests: commit, rollback, nested savepoints
- [x] CI integration test job runs migrations then real DB tests
- [x] Local developer verification scripts (dev-setup.sh, run-integration-tests.sh)
- [x] Lint: 19/19, Typecheck: 19/19, Build: 19/19, Unit Tests: 14/14 (65 tests), Integration Tests: 3/3 (53 tests)

## Backlog

### Phase 4 — Agent Studio ✅

#### Data Layer
- [x] Agent & AgentVersion entity types in @sovereign/core (entities.ts, types.ts)
- [x] AgentStudioService interface in @sovereign/core (services.ts)
- [x] Database migration 003_phase4_agents.sql (agents + agent_versions tables with RLS)
- [x] AgentRepo and AgentVersionRepo interfaces (packages/db/src/repositories/types.ts)
- [x] PgAgentRepo implementation (packages/db/src/repositories/pg-agent.repo.ts)
- [x] PgAgentVersionRepo implementation with JSONB serialization (packages/db/src/repositories/pg-agent-version.repo.ts)
- [x] DB package exports updated

#### Service Layer
- [x] PgAgentStudioService implementation (apps/api/src/services/agent-studio.service.ts)
- [x] Service registry wiring with org-scoped factory (agentStudioForOrg)

#### API Routes
- [x] Agent CRUD endpoints (GET/POST/PATCH/DELETE /api/v1/agents)
- [x] Agent version endpoints (GET/POST/PATCH /api/v1/agents/:id/versions, GET .../versions/:versionId)
- [x] Publish/unpublish endpoints (POST .../publish, POST .../unpublish)
- [x] Input validation with Zod schemas (all endpoints)
- [x] Route registration in API app
- [x] In-memory test repos (TestAgentRepo, TestAgentVersionRepo)

#### Web UI
- [x] Agent listing page with status filter (apps/web/src/app/agents/page.tsx)
- [x] Create agent form with project selector (apps/web/src/app/agents/new/page.tsx)
- [x] Agent detail page with metadata edit, archive, unpublish (apps/web/src/app/agents/[agentId]/page.tsx)
- [x] Create draft version form (apps/web/src/app/agents/[agentId]/versions/new/page.tsx)
- [x] Version detail/editor with publish control (apps/web/src/app/agents/[agentId]/versions/[versionId]/page.tsx)
- [x] Empty/loading/error/forbidden states on all pages
- [x] Permission-aware UI (create/edit/publish/archive hidden for non-privileged roles)
- [x] "Agents" nav link in AppShell

#### Permission Model
- [x] 5 agent permissions defined: agent:read, agent:create, agent:update, agent:publish, agent:archive
- [x] Role mapping: org_owner/org_admin have all, others have read-only
- [x] Permissions enforced in API route preHandlers
- [x] Permission tests (11 tests proving all 5 roles)

#### Audit Persistence
- [x] 7 audit actions: agent.created, agent.updated, agent.archived, agent.unpublished, agent_version.created, agent_version.updated, agent_version.published
- [x] Emitted by PgAgentStudioService on all state changes
- [x] PostgreSQL integration tests prove durable persistence

#### PostgreSQL Integration Tests
- [x] Agent CRUD: create, getById, getBySlug, list with filters, update, delete (5 tests)
- [x] Version CRUD: create with JSONB, list sorted, latest version, update (4 tests)
- [x] Publish/unpublish: publish, single-published enforcement, unpublishAll (3 tests)
- [x] Cross-tenant isolation: org B cannot see org A agents or versions (2 tests)
- [x] Audit persistence: single event persistence, all 7 lifecycle actions (2 tests)

#### Unit Tests
- [x] Agent studio service: CRUD, cross-tenant, status filters, archived rejection, version lifecycle, publish validation, immutability, unpublish (19 tests)
- [x] Permission model: all 5 roles x all 5 permissions (11 tests)

#### Docs
- [x] docs/API_SPEC.md updated with full agent endpoint docs and behavior rules
- [x] docs/SECURITY.md updated with agent permission matrix
- [x] TASKS.md updated

#### Final Check Results
- [x] Lint: 19/19 (0 errors, 4 pre-existing warnings)
- [x] Typecheck: 19/19
- [x] Build: 16/16
- [x] Unit Tests: 14/14 (81 tests — 14 core + 67 api)
- [x] Integration Tests: requires PostgreSQL (16 tests in agent-studio.test.ts)

### Phase 5 — Orchestrator and Run Engine ✅

#### Data Model
- [x] Run, RunStep, RunStatus, TriggerType, ExecutionProvider entity types in @sovereign/core
- [x] Run state machine (isValidTransition, isTerminal, TERMINAL_STATES)
- [x] RunService interface in @sovereign/core
- [x] Database migration 004_phase5_runs.sql (runs + run_steps tables with RLS)
- [x] RunRepo and RunStepRepo interfaces
- [x] PgRunRepo and PgRunStepRepo implementations

#### Execution Engine
- [x] Execution provider abstraction (ExecutionProvider interface)
- [x] Local/dev provider (deterministic, no external calls)
- [x] OpenAI provider (production wiring via Responses API — POST /v1/responses)
- [x] Temporal workflow definition (runAgentWorkflow)
- [x] Temporal activities (startRun, markRunning, executeAgent, recordRunSteps, completeRun, failRun)
- [x] Worker-orchestrator Temporal worker setup
- [x] Temporal client wrapper for API server

#### API Routes
- [x] POST /api/v1/agents/:agentId/runs (create run)
- [x] GET /api/v1/agents/:agentId/runs (list runs for a specific agent)
- [x] GET /api/v1/runs (list all org runs with agentId/status/projectId filters)
- [x] GET /api/v1/runs/:runId (get run detail)
- [x] GET /api/v1/runs/:runId/steps (get run steps)
- [x] POST /api/v1/runs/:runId/pause
- [x] POST /api/v1/runs/:runId/resume
- [x] POST /api/v1/runs/:runId/cancel

#### Permission Model
- [x] run:read (all roles)
- [x] run:create (org_owner, org_admin, org_member)
- [x] run:control (org_owner, org_admin)

#### Web UI
- [x] Run button on agent detail page (published agents only)
- [x] Runs list page (/runs) with status filter
- [x] Run detail page (/runs/:runId) with steps, output, controls
- [x] Pause/resume/cancel controls
- [x] "Runs" nav link in AppShell

#### Audit Events
- [x] run.created, run.started, run.paused, run.resumed, run.cancelled, run.completed, run.failed

#### Tests
- [x] State machine unit tests
- [x] Run service unit tests (including listRunsForAgent)
- [x] Permission enforcement tests
- [x] PostgreSQL integration tests (run CRUD, steps, state transitions, tenant isolation, audit)
- [x] Temporal workflow signal tests (start/complete, pause/resume, cancel, cancel-from-paused, terminal-state-safety, status-query)

#### Docs
- [x] docs/API_SPEC.md updated with run endpoint docs and behavior rules
- [x] docs/SECURITY.md updated with run permission matrix
- [x] docs/ROADMAP.md Phase 5 status: Complete
- [x] TASKS.md updated

### Phase 5 Remediation ✅

#### A. OpenAI Provider Correction
- [x] Replaced Chat Completions API (POST /v1/chat/completions) with Responses API (POST /v1/responses)
- [x] Updated packages/agents/src/providers/openai-provider.ts — full rewrite for Responses API response shape
- [x] Updated apps/worker-orchestrator/src/activities/run-activities.ts — executeWithOpenAI() uses Responses API
- [x] Preserved structured output capture, usage capture, provider metadata, and error mapping
- [x] Local/dev provider unchanged

#### B. API Contract Correction
- [x] Added GET /api/v1/agents/:agentId/runs (per-agent runs listing)
- [x] Preserved GET /api/v1/runs (org-wide listing with optional filters)
- [x] Added listRunsForAgent to RunService interface and PgRunService implementation
- [x] Added listRunsForAgent unit tests (2 tests)
- [x] Documented both endpoints in docs/API_SPEC.md

#### C. Workflow Verification
- [x] Installed @temporalio/testing@1.11.6
- [x] Created apps/worker-orchestrator/src/__tests__/run-workflow.test.ts (6 tests)
- [x] Tests verify: start/complete, pause/resume, cancel, cancel-from-paused, terminal-state-safety, status-query

#### D. Docs Updates
- [x] TASKS.md — remediation section added, Phase 5 tasks corrected
- [x] docs/API_SPEC.md — per-agent runs endpoint documented, Responses API noted
- [x] docs/ARCHITECTURE.md — AI Runtime detail added to worker-orchestrator section
- [x] docs/TEST_STRATEGY.md — Workflow Tests section added

### Phase 6–14
_See ROADMAP.md for full phase details._
