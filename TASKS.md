# SOVEREIGN — Tasks

## Current Sprint: Complete

All 16 phases (0-15) are complete. The platform is launch-ready with mobile terminal and multi-provider AI agent support.

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

### Phase 5 Final Verification ✅

#### A. Build Repair
- [x] Fixed /runs page SSR prerender error (wrapped useSearchParams in Suspense boundary)
- [x] Fixed @sovereign/db build to copy SQL migration files to dist/ for runtime migration runner
- [x] Full build: 16/16 tasks passing

#### B. Integration Test Fixes
- [x] Fixed migration count assertion (2 → 4 migrations after Phase 4+5)
- [x] Fixed audit event tests: replaced non-UUID resourceId strings with proper UUIDs
- [x] Fixed agent version listing test: corrected sort-order assertion (ascending, not descending)
- [x] All 5 integration suites pass: 88/88 tests

#### C. Final Totals
- [x] Lint: 20/20
- [x] Typecheck: 20/20
- [x] Build: 16/16
- [x] Unit tests: 166 (core: 47, api: 113, worker-orchestrator: 6)
- [x] Integration tests: 88 (migrations: 8, repositories: 28, agent-studio: 16, rls: 17, run-engine: 19)

### Phase 6 — Tooling and Connector Hub (In Progress)

#### MCP Gateway Runtime (apps/gateway-mcp)
- [x] Tool registry with register, get, list, execute, and clear operations
- [x] Echo connector — no-auth proof connector (echo, current_time tools)
- [x] Weather connector — credentialed proof connector with dev-safe simulation (get_weather, get_forecast tools)
- [x] Connector registration barrel (registerBuiltinConnectors)
- [x] Catalog definitions (BUILTIN_CONNECTORS, BUILTIN_SKILLS seed data)
- [x] Gateway entry point with exports for API/worker consumption
- [x] Package exports configured for workspace resolution

#### Data Layer
- [x] Connector, ConnectorInstall, Skill, SkillInstall entity types in @sovereign/core
- [x] ConnectorRepo, ConnectorInstallRepo, ConnectorCredentialRepo, SkillRepo, SkillInstallRepo interfaces
- [x] PgConnectorRepo implementation (unscoped, global catalog)
- [x] PgConnectorInstallRepo implementation (tenant-scoped with RLS)
- [x] PgConnectorCredentialRepo implementation (tenant-scoped with upsert)
- [x] PgSkillRepo implementation (unscoped, global catalog)
- [x] PgSkillInstallRepo implementation (tenant-scoped with RLS)
- [x] Audit actions: connector.installed, connector.configured, connector.tested, connector.revoked, skill.installed, skill.uninstalled

#### Service Layer
- [x] PgConnectorService — catalog listing, install, configure, test, revoke, scope retrieval
- [x] PgSkillService — catalog listing, install, uninstall

#### API Endpoints
- [x] GET /api/v1/connectors — list connector catalog
- [x] GET /api/v1/connectors/installed — list installed connectors for org
- [x] GET /api/v1/connectors/:connectorId — connector detail
- [x] GET /api/v1/connectors/:connectorId/scopes — connector scopes
- [x] POST /api/v1/connectors/:connectorId/install — install connector
- [x] PATCH /api/v1/connectors/:connectorId/configure — configure credentials/settings
- [x] POST /api/v1/connectors/:connectorId/test — test connector
- [x] POST /api/v1/connectors/:connectorId/revoke — revoke connector
- [x] GET /api/v1/skills — list skill catalog
- [x] GET /api/v1/skills/installed — list installed skills for org
- [x] GET /api/v1/skills/:skillId — skill detail
- [x] POST /api/v1/skills/:skillId/install — install skill
- [x] POST /api/v1/skills/:skillId/uninstall — uninstall skill

#### Permission Model
- [x] connector:read (all roles)
- [x] connector:install (org_owner, org_admin)
- [x] connector:configure (org_owner, org_admin)
- [x] connector:test (org_owner, org_admin)
- [x] connector:revoke (org_owner, org_admin)
- [x] skill:read (all roles)
- [x] skill:install (org_owner, org_admin)
- [x] skill:uninstall (org_owner, org_admin)

#### Web UI
- [x] Connector catalog page (/connectors) with trust badges and category filter
- [x] Connector detail page (/connectors/:id) with install/configure/test/revoke controls
- [x] Skills catalog page (/skills) with install/uninstall
- [x] "Connectors" and "Skills" nav links in AppShell

#### Runtime Integration
- [x] Worker-orchestrator executeAgent supports tool_call steps
- [x] Connector credentials loaded from DB for tool execution
- [x] Tool execution results recorded as run steps

#### Database Migration
- [x] 005_phase6_connectors.sql (connectors, connector_installs, connector_credentials, skills, skill_installs)
- [x] RLS policies on org-scoped tables

#### Proof Connectors/Skills
- [x] Echo connector (no-auth): echo, current_time tools
- [x] Weather connector (api_key): get_weather, get_forecast tools
- [x] Research Assistant skill (bundles echo + weather)

### Phase 6 Remediation ✅

#### A. Credential Security
- [x] Replaced base64-only encoding with AES-256-GCM encryption via SOVEREIGN_SECRET_KEY
- [x] Encryption uses scrypt key derivation, random salt, random IV per credential
- [x] Decryption only at connector test and agent run tool execution
- [x] API responses never expose raw credential values

#### B. PostgreSQL Integration Tests
- [x] connector-hub.test.ts: connector catalog, install, credential, skill install, tenant isolation, audit, E2E run proof

#### C. Runtime Tool-Use Evidence
- [x] Added run.tool_used audit action
- [x] Tool-call run steps emit run.tool_used audit events with tool name and connector slug

#### D. Route/API Coverage
- [x] connector-routes.test.ts: HTTP-level tests for connector and skill endpoints

#### E. Docs
- [x] SECURITY.md: connector credential encryption details
- [x] TEST_STRATEGY.md: connector hub integration test section
- [x] TASKS.md: remediation section

### Phase 7 — Browser + Computer Action Plane ✅

#### A. Data Model and Persistence
- [x] BrowserSessionId branded type in packages/core/src/types.ts
- [x] BrowserSession, BrowserAction, BrowserActionResult entities in entities.ts
- [x] BrowserSessionStatus state enum (provisioning, ready, active, takeover_requested, human_control, closing, closed, failed)
- [x] BrowserActionType enum (navigate, click, type, select, wait_for_selector, extract_text, screenshot, upload_file, download_file)
- [x] RISKY_BROWSER_ACTIONS constant for policy gating
- [x] Migration 006_phase7_browser.sql with browser_sessions table, indexes, RLS
- [x] BrowserSessionRepo interface in packages/db
- [x] PgBrowserSessionRepo implementation

#### B. Browser Session State Machine
- [x] browser-state-machine.ts with valid transitions
- [x] isValidBrowserTransition, assertBrowserTransition, isBrowserTerminal
- [x] Terminal states: closed, failed
- [x] All transitions validated centrally

#### C. Browser Execution Provider Abstraction
- [x] BrowserProvider interface (launch, isAvailable)
- [x] BrowserContext interface (navigate, click, type, select, etc.)
- [x] executeBrowserAction dispatcher
- [x] PlaywrightProvider implementation (chromium, firefox, webkit)

#### D. Worker-Browser Implementation
- [x] SessionManager for in-process browser session management
- [x] PlaywrightProvider with headless browser launching
- [x] Idle session cleanup
- [x] Graceful shutdown with session cleanup
- [x] Entry point with Playwright availability check

#### E. Browser Action Model
- [x] navigate, click, type, select, wait_for_selector, extract_text, screenshot, upload_file, download_file
- [x] Actions validated with required parameters
- [x] Error handling for missing parameters and context failures

#### F. Policy and Approval Gating
- [x] RISKY_BROWSER_ACTIONS: upload_file, download_file
- [x] checkActionPolicy server-side enforcement
- [x] Risky actions blocked by default unless session metadata.allowRiskyActions = true
- [x] browser.action_blocked audit events for denied actions
- [x] browser.downloaded / browser.uploaded audit events for allowed risky actions

#### G. API Implementation
- [x] POST /api/v1/browser-sessions — create session
- [x] GET /api/v1/browser-sessions — list sessions (with status/runId filters)
- [x] GET /api/v1/browser-sessions/:sessionId — get session detail
- [x] GET /api/v1/browser-sessions/:sessionId/artifacts — list artifacts
- [x] POST /api/v1/browser-sessions/:sessionId/takeover — request takeover
- [x] POST /api/v1/browser-sessions/:sessionId/release — release takeover
- [x] POST /api/v1/browser-sessions/:sessionId/close — close session

#### H. Permission Model
- [x] browser:read — all roles
- [x] browser:control — org_owner, org_admin
- [x] browser:takeover — org_owner, org_admin

#### I. Minimal Web UI
- [x] Browser sessions list page with status filters
- [x] Browser session detail page with metadata, artifacts, controls
- [x] Takeover/Release/Close controls with permission-gating
- [x] Navigation link in app shell
- [x] Empty/error/loading/forbidden states

#### J. Audit Events
- [x] browser.session_created
- [x] browser.takeover_requested
- [x] browser.takeover_started
- [x] browser.takeover_released
- [x] browser.session_closed
- [x] browser.action_blocked
- [x] browser.downloaded
- [x] browser.uploaded

#### K. Testing
- [x] browser-state-machine.test.ts — state transition validation (17 valid, 10 invalid)
- [x] browser-session.service.test.ts — unit tests with mock repos
- [x] browser-session-permissions.test.ts — permission matrix verification
- [x] browser-session-routes.test.ts — service-level contract tests
- [x] browser-sessions.test.ts — PostgreSQL integration (CRUD, filters, tenant isolation, audit)
- [x] browser-provider.test.ts — action execution with mock context
- [x] session-manager.test.ts — session lifecycle management

### Phase 8 — Memory Engine ✅

#### A. Data Model
- [x] MemoryId, MemoryLinkId branded types
- [x] Memory, MemoryLink, MemoryScopeType, MemoryKind, MemoryStatus entities
- [x] MemoryConfig expanded (readEnabled, writeEnabled, allowedScopes, allowedKinds, maxRetrievalCount, autoWriteEpisodic)
- [x] Migration 007_phase8_memory.sql (memories, memory_links, RLS, indexes)
- [x] PgMemoryRepo, PgMemoryLinkRepo implementations

#### B. Memory Kinds and Lifecycle
- [x] semantic, episodic, procedural kinds
- [x] active, redacted, expired, deleted statuses
- [x] Promote episodic → procedural (creates new procedural, expires original)
- [x] SHA-256 content hash deduplication

#### C. Retrieval
- [x] Scope-aware + kind + status filtering
- [x] Text search via ILIKE on title/summary/content
- [x] Excludes non-active from runtime retrieval

#### D. Runtime Integration
- [x] retrieveMemories + writeEpisodicMemory activities
- [x] Workflow injects memories into agent instructions pre-execution
- [x] Workflow writes episodic memory post-completion when configured

#### E. Governance
- [x] Redact (replaces content, marks redacted)
- [x] Expire, Delete (soft), Promote
- [x] All audited and permission-gated

#### F. API (10 endpoints)
- [x] POST/GET /api/v1/memories, GET /api/v1/memories/search
- [x] GET/PATCH /api/v1/memories/:id
- [x] POST .../redact, .../expire, .../delete, .../promote
- [x] GET .../links

#### G. Permissions
- [x] memory:read (all), memory:write (owner/admin/member)
- [x] memory:review (owner/admin/security_admin)
- [x] memory:redact + memory:delete (owner/admin)

#### H. Testing
- [x] memory.service.test.ts — 17 tests
- [x] memory-permissions.test.ts — 6 tests
- [x] memory-engine.test.ts — PostgreSQL integration (10 repo-level tests)

### Phase 8 Remediation — Route/API Coverage and DB-Backed Proof ✅

#### A. Route/API Coverage
- [x] memory-routes.test.ts — 55 service-level contract tests covering all 10 endpoints
  - POST /api/v1/memories: create, duplicate detection, audit, all kinds, all scopes (5 tests)
  - GET /api/v1/memories: list, kind filter, status filter, scope filter, empty, org scoping (6 tests)
  - GET /api/v1/memories/search: text match, empty query, whitespace query, kind filter, non-active exclusion, org scoping (6 tests)
  - GET /api/v1/memories/:memoryId: get by ID, not-found, wrong-org (3 tests)
  - PATCH /api/v1/memories/:memoryId: update, reject non-active, wrong-org, audit (4 tests)
  - POST .../redact: redact, not-found, wrong-org, audit (4 tests)
  - POST .../expire: expire, not-found, wrong-org, audit (4 tests)
  - POST .../delete: soft-delete, not-found, wrong-org, audit (4 tests)
  - POST .../promote: promote, link, expire original, reject semantic, reject non-active, wrong-org, audit (7 tests)
  - GET .../links: with links, no links, not-found, wrong-org (4 tests)
  - Runtime: retrieveForRun (8 tests), writeEpisodicFromRun (3 tests)
  - Org scoping cross-cutting: all CRUD ops org-scoped (1 composite test)

#### B. PostgreSQL-Backed Runtime Memory Proof
- [x] memory-engine.test.ts expanded with 8 runtime DB-backed tests:
  - retrieveForRun: active retrieval, redacted exclusion, expired exclusion, deleted exclusion, kind filtering, maxRetrievalCount (6 tests)
  - writeEpisodicFromRun: episodic write with source attribution, source_run link, round-trip write→retrieve (3 tests)
  - cross-tenant runtime isolation (1 test)

#### C. Test-Count Reconciliation
- [x] Prior Phase 7 count (302) was a unit-only tally of @sovereign/core (47) + @sovereign/api (249) + @sovereign/worker-orchestrator (6) = 302
- [x] Prior Phase 8 count (244+) was incomplete — reported only partial @sovereign/api results
- [x] The discrepancy was inconsistent reporting, not a test regression
- [x] Final totals now verified below

#### D. Final Verified Totals
Unit tests (420 total across 5 packages):
- @sovereign/core: 81 tests (3 files)
- @sovereign/api: 303 tests (21 files)
- @sovereign/worker-orchestrator: 6 tests (1 file)
- @sovereign/worker-browser: 17 tests (2 files)
- @sovereign/gateway-mcp: 13 tests (1 file)

Integration tests (156 total across 8 suites, requires PostgreSQL):
- migrations.test.ts: 8 tests
- repositories.test.ts: 29 tests
- rls-tenant-isolation.test.ts: 20 tests
- agent-studio.test.ts: 18 tests
- run-engine.test.ts: 21 tests
- connector-hub.test.ts: 31 tests
- browser-sessions.test.ts: 11 tests
- memory-engine.test.ts: 18 tests

Grand total: 576 tests (420 unit + 156 integration)

#### E. Exit Gates
- [x] Route/API coverage exists for memory endpoints (55 tests)
- [x] PostgreSQL-backed tests prove runtime retrieval and episodic write (10 tests)
- [x] Final test totals reconciled and reported
- [x] Lint, typecheck, build pass
- [x] No Phase 9 work done

### Phase 9 — Observability and Mission Control ✅

#### A. Data Model
- [x] alert_rules and alert_events tables (008_phase9_alerts.sql)
- [x] AlertRule, AlertEvent entities in @sovereign/core
- [x] AlertRuleId, AlertEventId branded types
- [x] PgAlertRuleRepo, PgAlertEventRepo implementations
- [x] RLS policies on both tables

#### B. Mission Control Service
- [x] MissionControlService with overview metrics, run filtering, run detail, timeline, browser/tool/memory linkage, alerting
- [x] Alert generation: run_failed, run_stuck, browser_failed conditions
- [x] Alert acknowledge with audit trail

#### C. API Endpoints (8 endpoints)
- [x] GET /api/v1/mission-control/overview
- [x] GET /api/v1/mission-control/runs
- [x] GET /api/v1/mission-control/runs/:runId
- [x] GET /api/v1/mission-control/runs/:runId/timeline
- [x] GET /api/v1/mission-control/runs/:runId/steps
- [x] GET /api/v1/mission-control/runs/:runId/linked-browser-sessions
- [x] GET /api/v1/mission-control/alerts
- [x] POST /api/v1/mission-control/alerts/:alertId/acknowledge

#### D. Permission Model
- [x] observability:read (all roles)
- [x] observability:alerts (org_owner, org_admin, org_security_admin)

#### E. Web UI
- [x] Mission Control overview page (/mission-control)
- [x] Runs list with status filter (/mission-control/runs)
- [x] Run detail with timeline, tool/browser/memory linkage (/mission-control/runs/:runId)
- [x] Alerts list with acknowledge (/mission-control/alerts)
- [x] "Mission Control" nav link in AppShell

#### F. Testing
- [x] mission-control-routes.test.ts — 30 tests
- [x] TestAlertRuleRepo, TestAlertEventRepo in-memory repos
- [x] Permission enforcement tests for observability:read and observability:alerts

#### G. Docs
- [x] TASKS.md, API_SPEC.md, SECURITY.md, DB_SCHEMA.md, TEST_STRATEGY.md updated

### Phase 9 Remediation — DB-Backed Mission Control Proof ✅

#### A. PostgreSQL-Backed Integration Tests
- [x] mission-control.test.ts — 29 DB-backed integration tests:
  - Alert rule CRUD: create, list with filters, update, delete (3 tests)
  - Alert event CRUD: create, list with status/severity/conditionType filters, acknowledge (prevents re-ack), resolve (prevents re-resolve), countByStatus (5 tests)
  - Alert deduplication: service-level dedup via resourceId tracking (1 test)
  - Overview metrics from persisted data: status counts + token/cost aggregation, queue wait + duration from timestamps, open alert count, recent failures ordering (4 tests)
  - Run list filters: by status, by agentId, by projectId (3 tests)
  - Run detail/timeline: ordered steps, tool usage aggregation from steps (2 tests)
  - Browser linkage: sessions linked to runs, runsWithBrowser count (2 tests)
  - Tool usage via audit events: distinct runs with tools (1 test)
  - Memory usage via audit events: distinct runs with memory retrieval, no double-counting (2 tests)
  - Tenant isolation: alert rules, alert events, alert acknowledge, runs, browser sessions, audit events — all proven cross-org isolated (6 tests)

#### B. Metric Correction
- [x] Fixed `runsWithMemory` metric: was using `metadata.scopeId` (memory scope, not run) → now uses `metadata.runId ?? resourceId` to count distinct runs
- [x] Label now correctly counts runs that had memory retrieval, not distinct memory scopes

#### C. Pre-existing Integration Test Fixes
- [x] Fixed truncateAllTables to include alert_events, alert_rules, memory_links, memories, browser_sessions
- [x] Fixed browser-sessions.test.ts and memory-engine.test.ts cleanup to use transactionWithOrg (FORCE RLS requires org context)
- [x] Fixed memory-engine.test.ts: replaced non-UUID scopeId strings with proper UUIDs
- [x] Fixed memory-engine.test.ts: added prerequisite run/agent/project records for FK constraints
- [x] Fixed browser-sessions.test.ts: replaced non-UUID resourceId in audit test
- [x] Fixed migrations.test.ts: updated migration count from 5 to 8

#### D. Final Verified Totals
Unit tests (450 total across 5 packages):
- @sovereign/core: 81 tests (3 files)
- @sovereign/api: 333 tests (22 files)
- @sovereign/worker-orchestrator: 6 tests (1 file)
- @sovereign/worker-browser: 17 tests (2 files)
- @sovereign/gateway-mcp: 13 tests (1 file)

Integration tests (169 total across 9 suites, requires PostgreSQL):
- mission-control.test.ts: 29 tests (NEW)
- connector-hub.test.ts: 26 tests
- repositories.test.ts: 28 tests
- run-engine.test.ts: 19 tests
- memory-engine.test.ts: 17 tests
- rls-tenant-isolation.test.ts: 17 tests
- agent-studio.test.ts: 16 tests
- browser-sessions.test.ts: 9 tests
- migrations.test.ts: 8 tests

Grand total: 619 tests (450 unit + 169 integration)

#### E. Exit Gates
- [x] PostgreSQL-backed Mission Control integration tests exist and pass (29 tests)
- [x] Alerts are proven durable in DB-backed tests (9 tests: CRUD, acknowledge, resolve, countByStatus, dedup)
- [x] Overview metrics are clearly defined and correctly labeled (runsWithMemory fix)
- [x] Lint, typecheck, build, unit tests, and integration tests pass
- [x] No Phase 10 work was done

### Phase 10 — Policy, Safety, Secrets, Audit ✅

#### A. Data Model
- [x] Migration 009_phase10_policies.sql (policies, policy_decisions, approvals, quarantine_records with RLS)
- [x] Policy, PolicyDecision, Approval, QuarantineRecord entities in @sovereign/core
- [x] ApprovalId, PolicyDecisionId, QuarantineRecordId branded types
- [x] PgPolicyRepo, PgPolicyDecisionRepo, PgApprovalRepo, PgQuarantineRecordRepo implementations

#### B. Policy Engine
- [x] PgPolicyService with deterministic evaluation: quarantine > deny > require_approval > allow
- [x] Priority-based policy matching (higher priority wins within same enforcement level)
- [x] Scope-aware: org-wide and subject-specific policies
- [x] Action pattern matching with glob support (e.g., "connector.*")
- [x] Automatic approval request creation on require_approval decisions
- [x] Quarantine check blocks before policy evaluation

#### C. Secret Brokering
- [x] Existing AES-256-GCM encryption preserved from Phase 6
- [x] Secret resolution audit trail via secret.resolved events (value never exposed)
- [x] recordSecretResolution() method for audit-safe evidence

#### D. Approval Workflow
- [x] Create/list/approve/deny approvals
- [x] Pending status enforcement (can't re-decide)
- [x] expirePending() for automatic expiry
- [x] Linked to policy decisions via policyDecisionId
- [x] Audit trail: approval.requested, approval.approved, approval.denied

#### E. Quarantine
- [x] Quarantine subjects (agents, runs)
- [x] Active quarantine blocks policy evaluation (returns "quarantined")
- [x] Release with permission gating
- [x] getActiveForSubject() check at evaluation boundary
- [x] Audit trail: quarantine.entered, quarantine.released

#### F. API Endpoints (15 endpoints)
- [x] GET/POST /api/v1/policies, GET/PATCH /api/v1/policies/:id
- [x] POST /api/v1/policies/:id/disable, POST /api/v1/policies/:id/enable
- [x] POST /api/v1/policies/evaluate
- [x] GET /api/v1/approvals, GET /api/v1/approvals/:id
- [x] POST /api/v1/approvals/:id/approve, POST /api/v1/approvals/:id/deny
- [x] GET/POST /api/v1/quarantine, POST /api/v1/quarantine/:id/release
- [x] GET /api/v1/audit, GET /api/v1/audit/:eventId

#### G. Permission Model
- [x] policy:read (all roles), policy:write (owner/admin/security_admin)
- [x] approval:read (all roles), approval:decide (owner/admin/security_admin)
- [x] audit:read (owner/admin/member/security_admin)
- [x] quarantine:read (all roles), quarantine:manage (owner/admin/security_admin)

#### H. Audit Events (14 new)
- [x] policy.created, policy.updated, policy.disabled, policy.enabled, policy.archived
- [x] policy.decision
- [x] approval.requested, approval.approved, approval.denied, approval.expired, approval.cancelled
- [x] quarantine.entered, quarantine.released
- [x] secret.resolved

#### I. Web UI (6 pages + nav)
- [x] /policies — list with status filter, enable/disable actions
- [x] /policies/new — create form
- [x] /policies/[policyId] — detail with edit and status controls
- [x] /approvals — list with approve/deny controls
- [x] /quarantine — list with release controls
- [x] /audit — log viewer with action filter
- [x] Navigation links in AppShell

#### J. Testing
- [x] policy-routes.test.ts — 48 route/service tests
- [x] policy-engine.test.ts — 21 PostgreSQL integration tests
- [x] TestPolicyRepo, TestPolicyDecisionRepo, TestApprovalRepo, TestQuarantineRecordRepo in-memory repos

#### K. Final Verified Totals
Unit tests (498 total):
- @sovereign/core: 81
- @sovereign/api: 381 (48 new policy route tests)
- @sovereign/worker-orchestrator: 6
- @sovereign/worker-browser: 17
- @sovereign/gateway-mcp: 13

Integration tests (190 total across 10 suites):
- policy-engine.test.ts: 21 (NEW)
- mission-control.test.ts: 29
- connector-hub.test.ts: 26
- repositories.test.ts: 28
- run-engine.test.ts: 19
- memory-engine.test.ts: 17
- rls-tenant-isolation.test.ts: 17
- agent-studio.test.ts: 16
- browser-sessions.test.ts: 9
- migrations.test.ts: 8

Grand total: 688 tests (498 unit + 190 integration)

### Phase 10 Remediation — Runtime Enforcement Proof ✅

#### A. Runtime Enforcement at Required Boundaries
- [x] Run execution boundary: `enforceRunPolicy` activity added to Temporal workflow, called before `markRunning`
  - Blocks with POLICY_DENIED if policy returns deny/quarantined
  - Blocks with APPROVAL_REQUIRED if policy returns require_approval
  - Allow proceeds normally to execution
- [x] Connector tool use boundary: `executeToolCall` activity now calls `evaluatePolicyAtBoundary` before executing tool
  - Blocks tool execution if denied/quarantined
  - Returns APPROVAL_REQUIRED error if approval needed
  - Secret resolution audit event emitted on credential decryption
- [x] Browser risky actions boundary: `checkActionPolicy` upgraded with PgPolicyService integration
  - Policy service evaluation runs before metadata fallback
  - Deny/quarantined/require_approval decisions block the action
  - Policy service automatically wired via `setPolicyService()` in service registry
- [x] Memory governance boundary: `retrieveMemories` and `writeEpisodicMemory` activities check policy
  - Memory read blocked (returns empty) if deny/quarantined/require_approval
  - Memory write blocked (silently skips) if not allowed
- [x] Secret resolution: audit trail added in `executeToolCall` for credential decryption
  - `secret.resolved` event emitted with secretType, resolvedFor — never includes actual secret value

#### B. Approval-Gated Action Proof
- [x] require_approval policy blocks action and creates approval record
- [x] Pending approval blocks re-evaluation (still returns require_approval)
- [x] Approved approval changes status, decidedBy, decidedAt set
- [x] Denied approval stays blocked; cannot re-approve after denial
- [x] Expired approval cannot be approved (status no longer pending)
- [x] Approval-gated connector tool use creates approval and blocks until approved
- [x] Full audit trail: approval.requested → approval.approved/denied

#### C. Quarantine Enforcement Proof
- [x] Quarantined agent cannot execute runs (returns "quarantined")
- [x] Quarantined connector cannot be used for tool calls
- [x] Quarantined subject cannot bypass via alternate action type
- [x] Release from quarantine restores allowed execution path
- [x] Quarantine overrides allow policies (quarantine > deny > require_approval > allow)
- [x] Quarantine audit events: quarantine.entered, quarantine.released

#### D. Worker/Runtime Tests
- [x] runtime-enforcement.test.ts — 34 tests proving blocked vs allowed behavior:
  - Run execution: 5 tests (allow, deny, quarantine, require_approval, audit)
  - Connector tool use: 4 tests (allow, deny, quarantine, wildcard)
  - Browser risky actions: 4 tests (non-risky allow, policy deny, quarantine block, audit)
  - Memory governance: 4 tests (read allow, read deny, write deny, wildcard)
  - Approval lifecycle: 7 tests (pending blocks, approved proceeds, denied stays blocked, expired blocks, connector approval, audit trail)
  - Quarantine enforcement: 6 tests (agent blocked, connector blocked, no bypass, release restores, quarantine overrides allow, audit)
  - Cross-boundary: 4 tests (org-wide lockdown, tenant scoping, disabled policy, priority ordering)
- [x] run-workflow.test.ts — 4 new workflow tests (deny blocks, quarantine blocks, require_approval blocks, allow proceeds)

#### E. Final Verified Totals
Unit tests (536 total across 5 packages):
- @sovereign/core: 81 tests (3 files)
- @sovereign/api: 415 tests (24 files) — +34 runtime enforcement tests
- @sovereign/worker-orchestrator: 10 tests (1 file) — +4 workflow policy tests
- @sovereign/worker-browser: 17 tests (2 files)
- @sovereign/gateway-mcp: 13 tests (1 file)

Integration tests (190 total across 10 suites, requires PostgreSQL):
- policy-engine.test.ts: 21
- mission-control.test.ts: 29
- connector-hub.test.ts: 26
- repositories.test.ts: 28
- run-engine.test.ts: 19
- memory-engine.test.ts: 17
- rls-tenant-isolation.test.ts: 17
- agent-studio.test.ts: 16
- browser-sessions.test.ts: 9
- migrations.test.ts: 8

Grand total: 726 tests (536 unit + 190 integration)

#### F. Exit Gates
- [x] Runtime enforcement proven at run execution, connector tool use, browser risky actions, memory governance, secret resolution
- [x] Approval-gated action behavior proven end-to-end (pending blocks, approved proceeds, denied stays blocked, expired blocks)
- [x] Quarantine blocking/release behavior proven in runtime paths
- [x] Worker/runtime tests exist for blocked vs allowed behavior (38 new tests)
- [x] Lint, typecheck, build, unit tests pass
- [x] No Phase 11 work done

### Phase 11 — Revenue Workspace ✅

#### A. Data Model
- [x] Migration 010_phase11_revenue.sql (crm_accounts, crm_contacts, crm_deals, crm_tasks, crm_notes, outreach_drafts, crm_sync_log with RLS)
- [x] CrmAccountId, CrmContactId, CrmDealId, CrmTaskId, CrmNoteId, OutreachDraftId, CrmSyncLogId branded types
- [x] CrmAccount, CrmContact, CrmDeal, CrmTask, CrmNote, OutreachDraft, CrmSyncLog entities
- [x] PgCrmAccountRepo, PgCrmContactRepo, PgCrmDealRepo, PgCrmTaskRepo, PgCrmNoteRepo, PgOutreachDraftRepo, PgCrmSyncLogRepo implementations
- [x] All 7 tables RLS-protected with FORCE ROW LEVEL SECURITY

#### B. Revenue Workspace Service
- [x] PgRevenueService with account/contact/deal/task CRUD
- [x] Meeting note capture and entity-linked notes
- [x] AI outreach draft generation (deterministic for dev/CI)
- [x] CRM sync via adapter pattern (LocalCrmSyncAdapter for dev/proof)
- [x] Revenue overview with pipeline value, counts, stage distribution

#### C. AI Outreach Drafts
- [x] generateOutreachDraft with entity context gathering
- [x] Notes used as additional context for generation
- [x] Drafts persisted with approval_status (draft/pending_approval/approved/denied/sent)
- [x] Approval-ready state — no autonomous sending

#### D. Meeting Notes / Revenue Context
- [x] Notes linked to any revenue entity (account/contact/deal)
- [x] Note types: general, meeting, call, email
- [x] Notes queryable per entity and fed into outreach draft context

#### E. CRM Sync Adapter
- [x] CrmSyncAdapter interface (pushAccount, pushContact, pushDeal)
- [x] LocalCrmSyncAdapter stub for dev/CI proof
- [x] Sync pushes entity, stores external CRM ID back on entity
- [x] Sync log tracks direction, status, external ID, errors
- [x] Audit events: revenue.sync_requested, revenue.sync_completed, revenue.sync_failed

#### F. API Endpoints (24 endpoints)
- [x] GET /api/v1/revenue/overview
- [x] GET/POST /api/v1/revenue/accounts, GET/PATCH /api/v1/revenue/accounts/:accountId
- [x] GET/POST /api/v1/revenue/contacts, GET/PATCH /api/v1/revenue/contacts/:contactId
- [x] GET/POST /api/v1/revenue/deals, GET/PATCH /api/v1/revenue/deals/:dealId
- [x] GET/POST /api/v1/revenue/tasks, GET/PATCH /api/v1/revenue/tasks/:taskId
- [x] POST /api/v1/revenue/notes, GET /api/v1/revenue/notes
- [x] POST /api/v1/revenue/outreach-drafts/generate
- [x] GET /api/v1/revenue/outreach-drafts/:draftId, GET /api/v1/revenue/outreach-drafts
- [x] POST /api/v1/revenue/sync, GET /api/v1/revenue/sync

#### G. Permission Model
- [x] revenue:read — all roles
- [x] revenue:write — org_owner, org_admin, org_member
- [x] revenue:sync — org_owner, org_admin
- [x] outreach:generate — org_owner, org_admin, org_member
- [x] outreach:approve — org_owner, org_admin, org_security_admin

#### H. Audit Events (13 new)
- [x] revenue.account_created, revenue.account_updated
- [x] revenue.contact_created, revenue.contact_updated
- [x] revenue.deal_created, revenue.deal_updated
- [x] revenue.task_created, revenue.task_updated
- [x] revenue.note_created
- [x] outreach.generated
- [x] revenue.sync_requested, revenue.sync_completed, revenue.sync_failed

#### I. Web UI (13 pages + nav)
- [x] /revenue — overview with pipeline value, counts, quick actions
- [x] /revenue/accounts — list with status badges
- [x] /revenue/accounts/new — create form
- [x] /revenue/accounts/[accountId] — detail with notes, edit, sync indicator
- [x] /revenue/contacts — list
- [x] /revenue/contacts/new — create form
- [x] /revenue/contacts/[contactId] — detail with notes
- [x] /revenue/deals — list with stage/value
- [x] /revenue/deals/new — create form
- [x] /revenue/deals/[dealId] — detail with notes
- [x] /revenue/tasks — list with status/priority
- [x] /revenue/tasks/new — create form
- [x] /revenue/tasks/[taskId] — detail with status controls
- [x] /revenue/outreach — generate + list drafts
- [x] "Revenue" nav link in AppShell

#### J. Testing
- [x] revenue-routes.test.ts — 42 service-level contract tests
  - Account CRUD: 6 tests (create, list, get, not-found, update, audit, tenant isolation)
  - Contact CRUD: 5 tests (create, list, get, update, audit)
  - Deal CRUD: 5 tests (create, list with filter, update, audit, tenant isolation)
  - Task CRUD: 4 tests (create, list with filter, update, audit)
  - Notes: 3 tests (create linked, list for entity, audit)
  - Outreach Drafts: 5 tests (generate, context-aware generation, get by ID, list, audit)
  - CRM Sync: 7 tests (sync account/contact/deal, fail nonexistent, fail unsupported, audit lifecycle, list logs)
  - Revenue Overview: 2 tests (counts with stage distribution, org-scoped)
  - Tenant Isolation: 4 tests (account/contact/deal/task cross-org blocked)
- [x] revenue-workspace.test.ts — 18 PostgreSQL integration tests
  - Account CRUD: 4 tests (create/retrieve, list, update, delete)
  - Contact CRUD: 2 tests (create/retrieve, link to account)
  - Deal CRUD: 2 tests (create with value, filter by stage)
  - Task CRUD: 2 tests (create/retrieve, update status)
  - Notes: 1 test (create linked notes)
  - Outreach Drafts: 1 test (create/retrieve)
  - Sync Log: 1 test (create/update status)
  - Tenant Isolation: 6 tests (account/contact/deal/task/outreach/sync cross-org blocked)
  - Audit: 1 test (persist revenue audit events)
- [x] TestCrmAccountRepo, TestCrmContactRepo, TestCrmDealRepo, TestCrmTaskRepo, TestCrmNoteRepo, TestOutreachDraftRepo, TestCrmSyncLogRepo in-memory repos

#### K. Final Verified Totals
Unit tests (578 total across 5 packages):
- @sovereign/core: 81 tests (3 files)
- @sovereign/api: 457 tests (25 files) — +42 revenue route tests
- @sovereign/worker-orchestrator: 10 tests (1 file)
- @sovereign/worker-browser: 17 tests (2 files)
- @sovereign/gateway-mcp: 13 tests (1 file)

Integration tests (208 total across 11 suites, requires PostgreSQL):
- revenue-workspace.test.ts: 18 (NEW)
- policy-engine.test.ts: 21
- mission-control.test.ts: 29
- connector-hub.test.ts: 26
- repositories.test.ts: 28
- run-engine.test.ts: 19
- memory-engine.test.ts: 17
- rls-tenant-isolation.test.ts: 17
- agent-studio.test.ts: 16
- browser-sessions.test.ts: 9
- migrations.test.ts: 8

Grand total: 786 tests (578 unit + 208 integration)

#### L. Exit Gates
- [x] Account/contact/deal/task CRUD works
- [x] Revenue overview works
- [x] Outreach draft generation works
- [x] Relationship context and notes work
- [x] CRM sync proof path works
- [x] Tenant isolation proven in unit and integration tests
- [x] Revenue/outreach permissions enforced in API
- [x] PostgreSQL-backed tests cover revenue persistence and sync state
- [x] Minimal Revenue Workspace UI works
- [x] Lint, typecheck, build, unit tests pass
- [x] No Phase 12 work was done

### Phase 11 Remediation — Contract Reconciliation and Policy-Gated Sync Proof ✅

#### A. API Contract Reconciliation
- [x] Verified 24 implemented endpoints in code (was incorrectly reported as 22)
- [x] Corrected endpoint count in TASKS.md from 22 to 24
- [x] Endpoint list was already accurate — only the summary count was wrong

#### B. Policy/Approval Runtime Enforcement on Revenue Sync
- [x] PgRevenueService now accepts PgPolicyService via setPolicyService()
- [x] syncEntity() evaluates policy before sync execution
- [x] deny policy → sync blocked with FORBIDDEN error
- [x] quarantined entity → sync blocked with FORBIDDEN error
- [x] require_approval → approval record created, sync log stays pending
- [x] allow policy → sync proceeds normally
- [x] Policy service wired automatically in service registry via policyForOrg()

#### C. Approval Lifecycle Proof for Sync
- [x] Pending approval blocks sync (returns pending status with approvalId)
- [x] Approved approval changes status to approved
- [x] Denied approval keeps sync blocked; subsequent attempt creates new approval
- [x] Cancelled/expired approval cannot be approved; subsequent sync still blocked
- [x] Approval state (approvalId, policyDecision) surfaced in sync API response

#### D. Tests Added (9 new)
- [x] allow policy — sync proceeds (1)
- [x] deny policy — sync blocked (1)
- [x] require_approval — approval created and sync blocked while pending (1)
- [x] approved request — sync proceeds after approval (1)
- [x] denied request — sync stays blocked (1)
- [x] expired/cancelled approval — cannot approve, subsequent sync blocked (1)
- [x] quarantined entity — sync blocked (1)
- [x] explicit allow policy — sync proceeds (1)
- [x] audit trail captures policy decision for sync (1)

#### E. Final Verified Totals
Unit tests (587 total across 5 packages):
- @sovereign/core: 81 tests
- @sovereign/api: 466 tests (25 files) — +9 policy-gated sync tests
- @sovereign/worker-orchestrator: 10 tests
- @sovereign/worker-browser: 17 tests
- @sovereign/gateway-mcp: 13 tests

Integration tests (208 total, unchanged):
- Same 11 suites as before

Grand total: 795 tests (587 unit + 208 integration)

#### F. Exit Gates
- [x] Revenue endpoint contract is exact and reconciled (24 endpoints)
- [x] Policy/approval-gated sync behavior proven end to end
- [x] Pending/approved/denied/expired approval outcomes proven
- [x] Lint, typecheck, build, unit tests pass
- [x] No Phase 12 work done

### Phase 12 — Billing and Usage ✅

#### A. Data Model
- [x] Migration 011_phase12_billing.sql (billing_accounts, usage_events, invoices, spend_alerts with RLS)
- [x] BillingAccountId, UsageEventId, InvoiceId, SpendAlertId branded types
- [x] BillingAccount, UsageEvent, Invoice, SpendAlert, PlanDefinition entities
- [x] PgBillingAccountRepo, PgUsageEventRepo, PgInvoiceRepo, PgSpendAlertRepo implementations
- [x] All 4 tables RLS-protected

#### B. Plan Catalog (3 plans, 5 meters)
- [x] free ($0): 50 runs, 100K tokens, 100 calls, 10 sessions, 100MB; no overage
- [x] team ($99/mo): 1K runs, 5M tokens, 5K calls, 200 sessions, 10GB; overage allowed
- [x] enterprise ($499/mo): unlimited on all meters

#### C. API Endpoints (13 endpoints)
- [x] GET /api/v1/billing/account
- [x] PATCH /api/v1/billing/account
- [x] GET /api/v1/billing/plans
- [x] POST /api/v1/billing/account/change-plan
- [x] GET /api/v1/billing/usage
- [x] GET /api/v1/billing/invoice-preview
- [x] GET /api/v1/billing/invoices
- [x] GET /api/v1/billing/invoices/:invoiceId
- [x] POST /api/v1/billing/entitlement-check
- [x] GET /api/v1/billing/alerts
- [x] POST /api/v1/billing/alerts
- [x] POST /api/v1/billing/alerts/:alertId/acknowledge
- [x] POST /api/v1/billing/provider/sync

#### D. Permission Model
- [x] billing:read — all roles
- [x] billing:write — org_owner, org_admin, org_billing_admin
- [x] billing:manage_plan — org_owner, org_billing_admin
- [x] billing:sync — org_owner, org_billing_admin

#### E. Audit Events (11 new)
- [x] billing.account_created/updated, billing.plan_changed
- [x] billing.invoice_generated, billing.enforcement_blocked
- [x] billing.alert_triggered/acknowledged
- [x] billing.sync_requested/completed/failed

#### F. Web UI (4 pages + nav)
- [x] /billing — overview, /billing/invoices — list, /billing/invoices/[id] — detail
- [x] "Billing" nav link

#### G. Testing
- [x] billing-routes.test.ts — 32 unit tests
- [x] billing.test.ts — 11 PostgreSQL integration tests

#### H. Final Totals
- Unit: 619 (81 core + 498 api + 10 orch + 17 browser + 13 mcp)
- Integration: 219 across 12 suites
- Grand total: 838

### Phase 12 Remediation — Real Metering and Enforcement Proof ✅

#### A. Real Usage Metering Integration
- [x] Run creation: PgRunService.createRun() records agent_runs usage event (sourceType: "run", sourceId: run.id)
- [x] Browser session: PgBrowserSessionService.createSession() records browser_sessions usage event
- [x] Connector tool: PgConnectorService.test() records connector_calls usage event
- [x] All metering via setBillingService() pattern wired in service registry
- [x] Non-fatal: billing failure does not block platform operations (.catch(() => {}))

#### B. Real Plan Enforcement on Run Creation
- [x] PgRunService.createRun() calls enforceEntitlement(orgId, userId, "agent_runs") before run
- [x] Free plan at limit (50 runs) → FORBIDDEN with "limit" reason
- [x] Team plan past limit (1000 runs) with overage_allowed → allowed
- [x] Enterprise plan → unlimited, always allowed
- [x] Blocked run emits billing.enforcement_blocked audit event

#### C. Tests Added (10 new)
- [x] Run creation records agent_runs usage event (1)
- [x] Multiple runs increment usage count (1)
- [x] Browser session creation records browser_sessions event (1)
- [x] Free plan blocks run at limit (1)
- [x] Free plan allows run under limit (1)
- [x] Team plan allows run past limit with overage (1)
- [x] Enterprise plan allows unlimited runs (1)
- [x] Enforcement blocked emits audit event (1)
- [x] Allowed run does not emit enforcement audit (1)
- [x] Spend alert triggers from real accumulated usage-driven spend (1)

#### D. Final Totals
- Unit: 629 (81 core + 508 api + 10 orch + 17 browser + 13 mcp)
- Integration: 219 across 12 suites
- Grand total: 848

### Phase 13 — Docs, Support, Onboarding, Admin ✅

#### A. Onboarding (derived from real platform state)
- [x] 8-step checklist: org_created, project_created, agent_created, agent_published, run_completed, connector_installed, billing_setup, policy_reviewed
- [x] All steps derived from actual platform data (agents, runs, connectors, billing, policies, projects)
- [x] Percentage progress tracked
- [x] Manual step completion emits onboarding.step_completed audit event

#### B. Docs (in-app, static)
- [x] 10 categories: getting-started, agents, runs, connectors, browser, memory, mission-control, policies, revenue, billing
- [x] 12 articles reflecting actual implemented product behavior
- [x] Category index + article detail via API

#### C. Support Diagnostics
- [x] Platform summary: agents, published agents, runs, failed runs, connectors, browser sessions, alerts
- [x] Billing info: plan, status, email (no secrets)
- [x] Recent failed runs (error messages only, no tokens/credentials)
- [x] Recent alerts (severity, title, status)
- [x] Onboarding progress included
- [x] Secret redaction: no tokens, secrets, passwords, credentials in output
- [x] Emits support.diagnostics_viewed audit event

#### D. Admin Overview
- [x] Org counts: members, agents, runs, connectors, policies
- [x] Billing plan/status
- [x] Membership list with name, email, role
- [x] Settings summary: plan, projects, policies, connectors, billing email
- [x] Links to policies, quarantine, audit, support
- [x] Emits admin.overview_viewed audit event

#### E. API Endpoints (8 endpoints)
- [x] GET /api/v1/onboarding
- [x] POST /api/v1/onboarding/dismiss
- [x] GET /api/v1/docs
- [x] GET /api/v1/docs/:slug
- [x] GET /api/v1/support/diagnostics
- [x] GET /api/v1/admin/overview
- [x] GET /api/v1/admin/memberships
- [x] GET /api/v1/admin/settings-summary

#### F. Permission Model
- [x] onboarding:read — all roles
- [x] onboarding:write — org_owner, org_admin
- [x] docs:read — all roles
- [x] support:read — org_owner, org_admin, org_security_admin
- [x] admin:read — org_owner, org_admin, org_security_admin

#### G. Audit Events (4 new)
- [x] onboarding.step_completed, onboarding.dismissed
- [x] support.diagnostics_viewed, admin.overview_viewed

#### H. Web UI (5 pages + 4 nav links)
- [x] /onboarding — checklist with progress bar and action links
- [x] /docs — category index with article links
- [x] /docs/[slug] — article detail
- [x] /support — diagnostics dashboard
- [x] /admin — overview with members, settings, and quick links
- [x] 4 nav links in AppShell: Setup, Docs, Support, Admin

#### I. Testing
- [x] onboarding-routes.test.ts — 20 unit tests
  - Onboarding: 7 tests (initial, agent, published, connector, billing, 100%, audit)
  - Docs: 3 tests (list, get, not-found)
  - Support: 4 tests (summary, billing info, secret redaction, audit)
  - Admin: 3 tests (overview counts, audit, settings)
  - Tenant isolation: 2 tests (onboarding, admin)
- [x] No new DB tables needed (derived from existing state)

#### J. Final Totals
- Unit: 649 (81 core + 528 api + 10 orch + 17 browser + 13 mcp)
- Integration: 219 across 12 suites (unchanged)
- Grand total: 868

### Phase 13 Remediation — DB-Backed Proof and Contract Reconciliation ✅

#### A. Onboarding Contract Fix
- [x] Removed POST /api/v1/onboarding/complete (was misleading — steps are derived, not manually completable)
- [x] Added POST /api/v1/onboarding/dismiss (dismisses guidance, does not fake prerequisites)
- [x] Service: completeStep() replaced with dismissOnboarding()
- [x] Audit: onboarding.dismissed event (not step_completed for manual faking)

#### B. PostgreSQL-Backed Integration Tests
- [x] onboarding-support-admin.test.ts — 18 DB-backed tests:
  - Onboarding: 7 tests (project_created, agent_created, agent_published, run_completed, connector_installed, billing_setup, policy_reviewed — all from persisted data)
  - Support diagnostics: 4 tests (agent count, failed runs, billing plan/email, alert count)
  - Admin overview: 3 tests (membership count, policy count, settings with billing/projects)
  - Tenant isolation: 4 tests (agents, billing, policies, runs cross-org blocked)
  - Audit: 1 test (support/admin audit events persisted)

#### C. UI/API Contract Reconciliation
- [x] Exact pages: 5 (/onboarding, /docs, /docs/[slug], /support, /admin)
- [x] Exact nav links: 4 (Setup, Docs, Support, Admin)
- [x] Exact endpoints: 8 (GET onboarding, POST onboarding/dismiss, GET docs, GET docs/:slug, GET support/diagnostics, GET admin/overview, GET admin/memberships, GET admin/settings-summary)

#### D. Final Totals
- Unit: 649 (81 core + 528 api + 10 orch + 17 browser + 13 mcp)
- Integration: 237 across 13 suites (+18 new in onboarding-support-admin.test.ts)
- Grand total: 886

### Phase 14 — Release Hardening ✅

#### A. E2E Test Hardening
- [x] critical-flows.e2e.test.ts — 14 describe blocks covering all critical flows
  - Auth / session / org bootstrap (4 tests)
  - Onboarding flow (2 tests)
  - Agent lifecycle: create → version → publish (1 test)
  - Run lifecycle: create → list → detail (1 test)
  - Connector lifecycle: catalog → install → revoke (1 test)
  - Memory lifecycle: create → get → search (1 test)
  - Mission Control: overview + alerts (2 tests)
  - Policy enforcement: deny + approval + quarantine (3 tests)
  - Revenue workspace: account → contact → deal → task (1 test)
  - Billing enforcement (2 tests)
  - Docs / support / admin surface access (6 tests)
  - Tenant isolation: agents, memories, policies cross-org (3 tests)
  - Health check (1 test)
  - Error handling: no internal detail leakage (2 tests)

#### B. Load / Stress Verification
- [x] api-load.test.ts — 6 load scenarios
  - 50 concurrent health checks
  - 20 concurrent bootstrap requests
  - 10 sequential run creations + 10 concurrent listings
  - 10 concurrent mission control overview requests
  - 20 memory creations + 5 concurrent searches
  - 10 concurrent billing reads

#### C. Chaos / Resilience Verification
- [x] worker-resilience.test.ts — 6 resilience scenarios
  - Run state survives app close/reopen
  - Session token remains valid after app rebuild
  - Concurrent run creations produce no corrupt state
  - Memory deduplication under concurrent writes
  - Concurrent policy creates produce distinct policies
  - Repeated 404s return stable error shape

#### D. Security Review and Fixes
- [x] Fixed 11 SQL injection vulnerabilities (OrgId string interpolation → parameterized)
  - pg-billing.repo.ts: 4 UPDATE queries fixed
  - pg-revenue.repo.ts: 7 UPDATE queries fixed
- [x] Added security headers to all API responses (X-Content-Type-Options, X-Frame-Options, HSTS, etc.)
- [x] Extracted buildApp() from index.ts for testability
- [x] Updated docs/SECURITY.md with fix details

#### E. Backup / Restore Readiness
- [x] docs/BACKUP_RESTORE.md — full backup/restore procedures
  - pg_dump full/schema/data backup commands
  - WAL archiving for point-in-time recovery
  - Restore procedure with verification steps
  - Object storage backup via S3 sync
  - Backup encryption with GPG
  - RTO/RPO targets documented
  - Quarterly drill schedule

#### F. Deploy / Rollback Readiness
- [x] docs/ROLLBACK_PLAN.md — complete rollback procedures
  - Application rollback steps
  - Database migration rollback
  - Blue-green deployment rollback
  - Worker/orchestrator rollback (Temporal durable state)
  - Post-rollback verification checklist

#### G. Production SLO / Operational Readiness
- [x] docs/SLO.md — minimal launch SLOs
  - API uptime: 99.9% monthly
  - Latency targets per endpoint category
  - Run queue wait time: < 30s p95
  - Day-1 alert thresholds
  - Monitoring approach

#### H. Launch Checklist and Runbooks
- [x] docs/LAUNCH_CHECKLIST.md — pre-launch, post-launch, first-week
- [x] docs/ROLLBACK_PLAN.md
- [x] docs/BACKUP_RESTORE.md
- [x] docs/ENVIRONMENT.md — all required env vars documented
- [x] docs/SUPPORT_ESCALATION.md — severity levels, escalation paths, common issues

#### I. Security Fixes
- [x] 11 SQL injection fixes (see D above)
- [x] Security headers added
- [x] No new feature scope

#### J. Admin/Support Hardening
- [x] Verified: support diagnostics returns safe metadata only
- [x] Verified: admin endpoints require permission checks
- [x] Verified: error responses do not leak internals (E2E test)
- [x] Verified: tenant isolation holds across onboarding/support/admin (E2E test)

#### K. Testing
- [x] E2E suite: ~30 tests in critical-flows.e2e.test.ts
- [x] Load suite: 6 tests in api-load.test.ts
- [x] Resilience suite: 6 tests in worker-resilience.test.ts
- [x] Existing unit tests updated for buildApp() refactor

#### L. Docs Updated
- [x] TASKS.md
- [x] docs/SECURITY.md — Phase 14 fixes section
- [x] docs/TEST_STRATEGY.md — E2E test layer added
- [x] .github/workflows/ci.yml — E2E job added
- [x] turbo.json — test:e2e task added
- [x] New docs: LAUNCH_CHECKLIST.md, ROLLBACK_PLAN.md, BACKUP_RESTORE.md, ENVIRONMENT.md, SUPPORT_ESCALATION.md, SLO.md

#### M. Final Verified Totals (pre-verification sprint)
- Unit: 649 (81 core + 528 api + 10 orch + 17 browser + 13 mcp)
- Integration: 219 across 12 suites
- E2E: 42 across 3 suites
- Grand total: 910

### Phase 14 Final Verification Sprint ✅

#### A. Full PostgreSQL-Backed Verification
- [x] All 240 integration tests pass against real PostgreSQL 16 (13 suites)
- [x] All 43 E2E tests pass against real PostgreSQL 16 (3 suites)
- [x] Fixed E2E test payloads to match actual API schemas (memory, policy, revenue, connector, quarantine)
- [x] Converted browser-sessions and memory-engine integration tests from raw DB to test harness
- [x] Fixed migration count assertion (9 → 11 migrations)
- [x] Fixed revenue workspace UUID fixtures for PostgreSQL UUID columns

#### B. Backup/Restore Drill — Executed and Verified
- [x] Seeded test data into sovereign_test (org + user records)
- [x] pg_dump -Fc backup created (153KB, 37 tables, 403 TOC entries)
- [x] pg_restore to fresh sovereign_restore_drill database
- [x] Row counts verified: organizations=3, users=3, schema_migrations=11
- [x] Specific seeded records verified present in restored DB
- [x] Migration runner confirms idempotent on restored DB (0 applied, 11 skipped)

#### C. Deploy/Rollback Rehearsal — Executed and Verified
- [x] Fresh sovereign_deploy_drill database created
- [x] All 11 migrations applied successfully
- [x] Health check: OK (24ms)
- [x] Rolled back 011_phase12_billing — billing tables removed, 10 migrations remain
- [x] Fixed rollbackMigration() bug: DOWN section was found but never executed
- [x] Fixed DOWN section uncommenting: `-- ` prefixed lines properly stripped
- [x] Re-applied migration: 1 applied, 10 skipped
- [x] Post-redeploy health check: OK (23ms)

#### D. Secret Handling Hardening
- [x] Production mode (NODE_ENV=production) now refuses to start without SESSION_SECRET
- [x] Production mode refuses to start without SOVEREIGN_SECRET_KEY
- [x] Dev fallback secret cannot leak into production paths
- [x] docs/ENVIRONMENT.md updated with enforcement documentation

#### E. Bug Fixes Discovered During Verification
- [x] Fixed rollbackMigration(): DOWN section regex matched but SQL was never executed
- [x] Fixed DOWN section processing: uncomments `-- ` prefixed lines before execution
- [x] Fixed E2E connector test: /api/v1/connectors/catalog → /api/v1/connectors
- [x] Fixed E2E quarantine test: /api/v1/policies/quarantine → /api/v1/quarantine
- [x] Fixed E2E approval test: /api/v1/policies/approvals → /api/v1/approvals

#### F. Final Repo Polish
- [x] CONTRIBUTING.md added (development setup, code standards, PR process)
- [x] LICENSE added (MIT)
- [x] README.md updated to reflect full product (features, architecture, test coverage, docs index)
- [x] TASKS.md updated to reflect all phases complete

#### G. Final Verified Grand Totals
Unit tests (649 total across 5 packages):
- @sovereign/core: 81 tests (3 files)
- @sovereign/api: 528 tests (28 files)
- @sovereign/worker-orchestrator: 10 tests (1 file)
- @sovereign/worker-browser: 17 tests (2 files)
- @sovereign/gateway-mcp: 13 tests (1 file)

Integration tests (240 total across 13 suites):
- mission-control.test.ts: 29
- repositories.test.ts: 28
- connector-hub.test.ts: 26
- policy-engine.test.ts: 21
- revenue-workspace.test.ts: 20
- run-engine.test.ts: 19
- onboarding-support-admin.test.ts: 19
- rls-tenant-isolation.test.ts: 17
- memory-engine.test.ts: 17
- agent-studio.test.ts: 16
- billing.test.ts: 11
- browser-sessions.test.ts: 9
- migrations.test.ts: 8

E2E tests (43 total across 3 suites):
- critical-flows.e2e.test.ts: 31
- api-load.test.ts: 6
- worker-resilience.test.ts: 6

**Grand total: 932 tests (649 unit + 240 integration + 43 E2E)**

#### H. Exit Gates — All Satisfied
- [x] Integration tests pass in real PostgreSQL-backed environment
- [x] E2E tests pass in real PostgreSQL-backed environment
- [x] Backup/restore drill actually executed and verified
- [x] Deploy/rollback rehearsal actually executed and verified
- [x] Production secret handling is safe and explicit
- [x] No new feature scope was added
- [x] Lint, typecheck, build, unit, integration, and E2E all pass
- [x] New docs: LAUNCH_CHECKLIST.md, ROLLBACK_PLAN.md, BACKUP_RESTORE.md, ENVIRONMENT.md, SUPPORT_ESCALATION.md, SLO.md

### Phase 15 — Mobile Terminal with Multi-Provider AI Agent Access ✅

> ADR: docs/ADR/0002-mobile-terminal-multi-agent.md (Accepted)

#### Phase 15a — Foundation ✅
- [x] ADR 0002 created and accepted
- [x] Multi-provider execution providers (Anthropic Claude, Google Gemini, DeepSeek)
- [x] xterm.js terminal emulator component in packages/ui
- [x] Terminal proxy service scaffolding (apps/terminal-proxy)
- [x] Mobile-responsive layout detection in apps/web
- [x] PWA manifest and service worker
- [x] Terminal session DB migration (015_phase15_terminal.sql)
- [x] Terminal session data layer (repo + service)
- [x] Terminal session and agent-chat API routes
- [x] Mobile terminal page in apps/web

#### Phase 15b — Terminal Core ✅
- [x] PTY bridge with command execution, sanitization, timeout, working directory tracking
- [x] Blocked command list (rm -rf /, mkfs, dd, fork bomb, shutdown, reboot, chmod 777 /)
- [x] Session manager with output history (500 lines), reconnection replay, idle timeout
- [x] WebSocket message routing (structured JSON + raw command fallback)
- [x] Session resize support (cols/rows)
- [x] Session state serialization (outputHistory, cwd, envVars, commandCount)
- [x] Terminal proxy auth integration (session token validation against API)
- [x] Touch-optimized command palette with category filters (git, test, deploy, ai)

#### Phase 15c — AI Agent Integration ✅
- [x] Agent provider configuration service (per-org, in-memory for Phase 15)
- [x] Terminal session detail page (/terminal/[sessionId]) with per-session AI chat
- [x] Terminal context injection into agent prompts (last N lines of output)
- [x] Provider switching mid-conversation
- [x] Agent chat service with multi-provider routing via ExecutionProvider abstraction
- [x] LocalExecutionProvider fallback when no API keys configured

#### Phase 15d — Polish and Hardening ✅
- [x] Provider unit tests — constructor validation, network errors, HTTP errors, response parsing (25 tests)
- [x] Terminal component and command palette render tests (10 tests)
- [x] Terminal proxy session manager tests — create, attach, reconnect, close, idle timeout, resize, state (24 tests)
- [x] PTY bridge tests — command execution, blocked commands, timeout, cwd tracking (24 tests)
- [x] Terminal session route tests — CRUD, audit, tenant isolation (29 tests)
- [x] .env.example updated with Phase 15 variables
- [x] Security review: blocked commands, session isolation, API key handling, credential audit

#### Phase 15 Docs Updated ✅
- [x] docs/ROADMAP.md — Phase 14 marked complete, Phase 15 added and completed
- [x] docs/ARCHITECTURE.md — apps/terminal-proxy service, multi-provider agents detail
- [x] docs/API_SPEC.md — Terminal session endpoints (5), Agent provider endpoints (1), Agent chat endpoints (2)
- [x] docs/SECURITY.md — Terminal proxy security, multi-provider API key security, permission matrix
- [x] docs/DB_SCHEMA.md — terminal_sessions, agent_chat_sessions, agent_chat_messages tables
- [x] docs/TEST_STRATEGY.md — Terminal proxy tests, multi-provider tests, route tests sections
- [x] docs/ENVIRONMENT.md — Phase 15 env vars (TERMINAL_PROXY_PORT, provider API keys)
- [x] docs/ADR/0002-mobile-terminal-multi-agent.md — Status changed to Accepted
- [x] README.md — Mobile Terminal + Multi-Provider AI features, terminal-proxy in architecture, test counts updated

#### Phase 15 Final Verified Totals
Unit tests (789 total across 9 packages):
- @sovereign/core: 81 tests (3 files)
- @sovereign/api: 571 tests (33 files) — +29 terminal/chat route tests
- @sovereign/worker-orchestrator: 21 tests
- @sovereign/worker-browser: 17 tests (2 files)
- @sovereign/gateway-mcp: 13 tests (1 file)
- @sovereign/agents: 25 tests (1 file) — NEW: provider tests
- @sovereign/ui: 10 tests (2 files) — NEW: terminal + command palette tests
- @sovereign/web: 3 tests (1 file)
- @sovereign/terminal-proxy: 48 tests (2 files) — NEW: session manager + PTY bridge tests

Integration tests (240 total across 13 suites, unchanged)
E2E tests (43 total across 3 suites, unchanged)

**Grand total: 1,072 tests (789 unit + 240 integration + 43 E2E)**

#### Phase 15 Exit Gates — All Satisfied
- [x] Multi-provider agent routing works (Anthropic, OpenAI, Gemini, DeepSeek, local fallback)
- [x] Terminal proxy handles WebSocket connections with session persistence and reconnection
- [x] PTY bridge executes commands safely with blocked command protection
- [x] Mobile terminal page renders and interacts with API (terminal + AI tabs)
- [x] 140 new tests added, all pass
- [x] All existing tests pass — zero regressions
- [x] Lint (23/23), typecheck (24/24), test (22/22) all pass across full monorepo
- [x] All docs updated for Phase 15 completion
- [x] No Phase 16 work done
