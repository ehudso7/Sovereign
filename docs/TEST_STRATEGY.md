# SOVEREIGN — Test Strategy

## Testing Pyramid

```
        ┌──────────┐
        │   E2E    │  Few, critical flows
        ├──────────┤
        │ Integr.  │  API endpoints, DB queries, service interactions
        ├──────────┤
        │   Unit   │  Business logic, utilities, validation
        └──────────┘
```

## Test Types

### Unit Tests
- **Scope**: Individual functions, classes, components
- **Runner**: Vitest
- **Location**: `__tests__/` directories or `*.test.ts` co-located files
- **Coverage Target**: 80% for business logic packages
- **Speed**: < 10 seconds for full suite per package

### Integration Tests
- **Scope**: API endpoints, database operations, service interactions
- **Runner**: Vitest with test containers
- **Location**: `__tests__/integration/` directories
- **Database**: Test PostgreSQL instance, migrated fresh per suite
- **Speed**: < 60 seconds for full suite

### End-to-End Tests
- **Scope**: Critical user flows across the full stack
- **Runner**: Playwright
- **Location**: `apps/web/e2e/`
- **Coverage**: Core flows only (auth, agent CRUD, run execution, billing)
- **Speed**: < 5 minutes for full suite

### Tenant Isolation Tests
- **Scope**: Verify no cross-tenant data access
- **Approach**: Create two orgs, attempt cross-access on every endpoint
- **Location**: `packages/testing/tenant-isolation/`
- **Requirement**: Must pass for every API endpoint and DB query

### Policy Enforcement Tests
- **Scope**: Verify policy gates cannot be bypassed
- **Approach**: Attempt restricted actions with various roles/policies
- **Location**: `packages/testing/policy-enforcement/`
- **Requirement**: Must pass for every gated action

### Load Tests
- **Scope**: API throughput, concurrent runs, worker scaling
- **Runner**: k6 or Artillery
- **Location**: `infra/scripts/load-tests/`
- **Targets**: SLO thresholds defined in PRD

### Workflow Tests
- **Scope**: Temporal workflow signal behavior, state transitions, completion lifecycle
- **Runner**: Vitest + `@temporalio/testing` (`TestWorkflowEnvironment.createTimeSkipping()`)
- **Location**: `apps/worker-orchestrator/src/__tests__/`
- **Approach**: Real Temporal test server with mocked activities. Verifies:
  - Run starts and completes normally
  - Pause signal pauses, resume signal resumes
  - Cancel signal cancels from running and paused states
  - Invalid/late signals do not corrupt terminal states
  - Status query returns correct state
- **Speed**: < 60 seconds for full suite (downloads test server on first run)

### Connector Hub Integration Tests
- **Scope**: Connector/skill install persistence, credential encryption, tool-enabled runs, tenant isolation
- **Runner**: Vitest with real PostgreSQL
- **Location**: `packages/db/src/__tests__/integration/connector-hub.test.ts`
- **Coverage**: Catalog CRUD, install/revoke, credential storage, skill installs, tenant isolation, audit events, end-to-end tool-enabled run proof

### Browser Session Integration Tests
- **Scope**: Browser session CRUD, state transitions, takeover/release, tenant isolation, audit events
- **Runner**: Vitest with real PostgreSQL
- **Location**: `packages/db/src/__tests__/integration/browser-sessions.test.ts`
- **Coverage**: Create/retrieve, list with filters, status updates, takeover fields, tenant isolation (read/update/delete), audit event persistence

### Browser Worker Tests
- **Scope**: Browser action execution, session management, Playwright provider
- **Runner**: Vitest with mock contexts
- **Location**: `apps/worker-browser/src/__tests/`
- **Coverage**: All 9 action types, parameter validation, error handling, session registration/removal/cleanup

### Browser Session Service Tests
- **Scope**: Service-level business logic with mock repos
- **Runner**: Vitest
- **Location**: `apps/api/src/__tests__/services/browser-session.service.test.ts`
- **Coverage**: Create, get, takeover, release, close, policy gating (allow/block)

### Browser Session Permission Tests
- **Scope**: Permission matrix verification for browser:read, browser:control, browser:takeover
- **Runner**: Vitest
- **Location**: `apps/api/src/__tests__/services/browser-session-permissions.test.ts`

### Browser Session Route Tests
- **Scope**: Service-level contract tests for all browser session endpoints
- **Runner**: Vitest with in-memory test repos
- **Location**: `apps/api/src/__tests__/routes/browser-session-routes.test.ts`
- **Coverage**: Create, get, list, takeover/release, close, audit events, policy gating, tenant isolation

### Memory Engine Integration Tests
- **Scope**: Memory CRUD, search, dedup, status transitions, tenant isolation, links, audit
- **Runner**: Vitest with real PostgreSQL
- **Location**: `packages/db/src/__tests__/integration/memory-engine.test.ts`

### Memory Service Tests
- **Scope**: Service-level logic with in-memory repos
- **Runner**: Vitest
- **Location**: `apps/api/src/__tests__/services/memory.service.test.ts`
- **Coverage**: Create, get, list, search, update, redact, expire, delete, promote, retrieveForRun, writeEpisodicFromRun, dedup

### Memory Permission Tests
- **Scope**: Permission matrix for memory:read, memory:write, memory:review, memory:redact, memory:delete
- **Runner**: Vitest
- **Location**: `apps/api/src/__tests__/services/memory-permissions.test.ts`

### Memory Route Tests
- **Scope**: Service-level contract tests for all 10 memory endpoints
- **Runner**: Vitest with in-memory test repos
- **Location**: `apps/api/src/__tests__/routes/memory-routes.test.ts`
- **Coverage**: Create (validation, dedup, audit), list (filters, org scoping), search (text match, empty/whitespace rejection, kind filter, non-active exclusion), get (by ID, not-found, wrong-org), update (active-only, wrong-org, audit), redact (content replacement, not-found, wrong-org, audit), expire (status transition, not-found, wrong-org, audit), delete (soft-delete, not-found, wrong-org, audit), promote (episodic→procedural, link creation, original expiry, validation, wrong-org, audit), links (with/without links, not-found, wrong-org), retrieveForRun (readEnabled gating, status exclusions, kind filter, maxRetrievalCount, audit), writeEpisodicFromRun (episodic creation, source link, audit), org scoping cross-cutting

### Memory Runtime Integration Tests (DB-Backed)
- **Scope**: Proves runtime retrieval and episodic write behavior against real PostgreSQL
- **Runner**: Vitest with real PostgreSQL
- **Location**: `packages/db/src/__tests__/integration/memory-engine.test.ts` (runtime behavior section)
- **Coverage**: Active-only retrieval, redacted/expired/deleted exclusion, kind filtering, episodic write with attribution, source_run link persistence, write→retrieve round-trip, cross-tenant runtime isolation

### Mission Control Route Tests
- **Scope**: Service-level contract tests for all 8 mission control endpoints
- **Runner**: Vitest with in-memory test repos
- **Location**: `apps/api/src/__tests__/routes/mission-control-routes.test.ts`
- **Coverage**: Overview metrics (status counts, failure rate, token aggregation, alert count, recent failures), run listing with filters, run detail with steps/tool/memory linkage, timeline ordering, linked browser sessions, alert listing/filtering/acknowledgment, alert generation (run_failed, deduplication), org scoping, permission enforcement

### Mission Control Integration Tests (DB-Backed)
- **Scope**: PostgreSQL-backed proof for Mission Control queries, alert lifecycle, overview metrics, and tenant isolation
- **Runner**: Vitest with real PostgreSQL (test harness: setupTestDb/teardownTestDb/truncateAllTables)
- **Location**: `packages/db/src/__tests__/integration/mission-control.test.ts`
- **Coverage**: Alert rule CRUD (create, list/filter, update, delete), alert event CRUD (create, list with filters, acknowledge, resolve, countByStatus), alert deduplication via resourceId, overview metrics computed from persisted runs (status counts, token aggregation, cost, queue wait, duration, failure rate, open alerts, recent failures), run list filters (status, agentId, projectId), run detail/timeline (ordered steps, tool usage aggregation), browser session linkage (runId-based, runsWithBrowser count), tool usage via audit events (distinct runs), memory usage via audit events (distinct runs, no double-count), tenant isolation across all mission control queries (alert rules, alert events, acknowledge, runs, browser sessions, audit events)

### Policy Engine Route Tests
- **Scope**: Service-level contract tests for policy, approval, quarantine, audit endpoints
- **Runner**: Vitest with in-memory test repos
- **Location**: `apps/api/src/__tests__/routes/policy-routes.test.ts`
- **Coverage**: Policy CRUD, evaluation (allow/deny/require_approval/quarantine outcomes), approval workflow, quarantine lifecycle, permission enforcement, tenant isolation, audit evidence

### Policy Engine Integration Tests (DB-Backed)
- **Scope**: PostgreSQL-backed proof for policy, approval, quarantine persistence and tenant isolation
- **Runner**: Vitest with real PostgreSQL (test harness)
- **Location**: `packages/db/src/__tests__/integration/policy-engine.test.ts`
- **Coverage**: Policy CRUD, policy decision persistence, approval lifecycle, quarantine lifecycle, tenant isolation, audit evidence

### Runtime Enforcement Tests (Phase 10 Remediation)
- **Scope**: Proves policy evaluation is enforced at all runtime boundaries (not just API endpoints)
- **Runner**: Vitest with in-memory test repos
- **Location**: `apps/api/src/__tests__/routes/runtime-enforcement.test.ts` (34 tests)
- **Coverage**:
  - Run execution: allow/deny/quarantine/require_approval at run boundary
  - Connector tool use: allow/deny/quarantine/wildcard at tool execution boundary
  - Browser risky actions: policy-integrated enforcement for upload/download with audit
  - Memory governance: read/write blocked by deny policies
  - Approval lifecycle: pending blocks, approved proceeds, denied stays blocked, expired blocks
  - Quarantine enforcement: blocked subjects, no bypass via alternate paths, release restores access
  - Cross-boundary: org-wide lockdown, tenant scoping, disabled policies, priority ordering
  - Secret resolution audit: verified no secret values in audit payload

### Workflow Policy Enforcement Tests
- **Scope**: Temporal workflow-level proof that policy blocks run execution
- **Runner**: Vitest with mocked Temporal primitives
- **Location**: `apps/worker-orchestrator/src/__tests__/run-workflow.test.ts` (4 new tests)
- **Coverage**: Deny blocks run, quarantine blocks run, require_approval blocks run, allow proceeds normally

### Chaos Tests
- **Scope**: Worker restart during runs, DB failover, network partition
- **Approach**: Kill workers mid-run, verify recovery
- **Location**: `infra/scripts/chaos-tests/`

## Test Infrastructure

### Test Database
- Fresh PostgreSQL per test suite (integration)
- Migrations run automatically before tests
- Each integration test file gets an isolated database (created/dropped per suite)
- Tables truncated between individual tests for isolation
- Seed data via test factories
- Cleanup after each test

### Running Integration Tests Locally
```bash
# Start PostgreSQL (via Docker Compose or local install)
docker compose -f infra/docker/docker-compose.yml up -d postgres

# Run integration tests
TEST_DATABASE_URL=postgresql://sovereign:sovereign_dev@localhost:5432/sovereign pnpm test:integration

# Or manually:
TEST_DATABASE_URL=postgresql://sovereign:sovereign_dev@localhost:5432/sovereign DATABASE_URL=postgresql://sovereign:sovereign_dev@localhost:5432/sovereign pnpm db:migrate
TEST_DATABASE_URL=postgresql://sovereign:sovereign_dev@localhost:5432/sovereign DATABASE_URL=postgresql://sovereign:sovereign_dev@localhost:5432/sovereign pnpm --filter @sovereign/db test:integration
```

### Test Factories
- Located in `packages/testing/factories/`
- Factory for every core entity (org, user, agent, run, etc.)
- Factories produce valid, minimal test data
- Factories support overrides for specific test scenarios

### Mocks and Stubs
- External services mocked at boundary (WorkOS, payment provider, OpenAI)
- Mock implementations in `packages/testing/mocks/`
- No mocking of internal business logic

## CI Pipeline

```
PR → Lint → Typecheck → Unit Tests → Integration Tests → Build → Preview Deploy
Main → All above + E2E Tests → Staging Deploy
Release → All above + Load Tests → Production Deploy
```

### PR Checks (Required)
1. ESLint passes
2. TypeScript compiles without errors
3. Unit tests pass
4. Integration tests pass
5. Build succeeds
6. No new security vulnerabilities

### Main Branch (Additional)
7. E2E tests pass
8. Preview deployment succeeds

### Release (Additional)
9. Load test thresholds met
10. Security scan passes
11. Staging deployment verified

## Test Naming Convention

```typescript
describe('AgentService', () => {
  describe('createAgent', () => {
    it('creates an agent with valid input', () => { ... });
    it('rejects agent with missing name', () => { ... });
    it('scopes agent to the authenticated org', () => { ... });
    it('emits audit event on creation', () => { ... });
  });
});
```

## E2E Tests (Phase 14)

Full API-level end-to-end tests using Fastify `.inject()` against real PostgreSQL.

**Location**: `apps/api/src/__tests__/e2e/`, `apps/api/src/__tests__/load/`, `apps/api/src/__tests__/resilience/`

**Run**: `pnpm test:e2e`

**Suites**:
- `critical-flows.e2e.test.ts` — 14 describe blocks covering all critical user flows
- `api-load.test.ts` — Load/stress verification for concurrent operations
- `worker-resilience.test.ts` — State durability across app restarts, concurrent writes

**Covered flows**:
- Auth / session bootstrap and logout
- Onboarding progress and dismiss
- Agent creation → versioning → publish
- Run creation and listing
- Connector catalog → install → revoke
- Memory CRUD and search
- Mission Control overview and alerts
- Policy deny / approval / quarantine
- Revenue workspace CRUD
- Billing access
- Docs / support / admin surfaces
- Tenant isolation (cross-org data leakage)
- Error handling (no internal leakage)
- Health check
- Concurrent request handling (50+ concurrent)
- State durability (app restart)
- Deduplication under concurrent writes

## Terminal Proxy Tests (Phase 15)

### Session Manager Tests
- Session creation, attach, reconnect, close, closeAll
- Idle timeout behavior with timer mock
- Output history append and trimming to 500 lines
- Resize dimensions update
- Session state serialization (getState)
- WebSocket message routing to PTY bridge
- Reconnect replays output history

### PTY Bridge Tests
- Command execution (echo, pwd, ls)
- Blocked command rejection (rm -rf /, shutdown, etc.)
- Timeout protection (30-second default)
- Working directory tracking via cd
- Environment variable isolation
- Error handling for failed commands

### Multi-Provider Agent Tests
- Provider constructor validation (empty API key rejection)
- Network error handling (fetch throws)
- HTTP error handling (401, 500 responses)
- Response parsing for each provider format:
  - Anthropic Messages API (content blocks)
  - Google Gemini API (candidates/parts)
  - DeepSeek Chat API (choices/message)
  - OpenAI Responses API (output/content)
- LocalExecutionProvider deterministic output
- Token usage tracking across providers

### Terminal Route Tests (Service-Level Contract)
- POST create session: correct defaults, active status
- GET list sessions: user-scoped, status filter
- GET session by ID: detail, not-found
- POST close: transitions to closed, audit event
- POST resize: metadata update
- Tenant isolation: cross-org access blocked

### Agent Chat Route Tests (Service-Level Contract)
- GET agent-providers: returns all configured providers
- POST agent-chat: message routing, response shape
- GET chat history: empty for new, populated after chat
- Provider fallback: uses LocalExecutionProvider when no API keys set

## Coverage Rules

- New business logic code must include tests
- Bug fixes must include a regression test
- No PR merges with failing tests
- Coverage reports generated but not blocking (target: 80% for packages/*)

## Test Environment Variables

```
TEST_DATABASE_URL=postgresql://sovereign:sovereign_dev@localhost:5432/sovereign
DATABASE_URL=postgresql://sovereign:sovereign_dev@localhost:5432/sovereign
REDIS_URL=redis://localhost:6380
TEMPORAL_ADDRESS=localhost:7234
WORKOS_API_KEY=test_key
WORKOS_CLIENT_ID=test_client
SOVEREIGN_SECRET_KEY=test-secret-key-for-testing-32chars!!
```
