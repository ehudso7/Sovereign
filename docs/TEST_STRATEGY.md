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

# Run migrations and integration tests
./infra/scripts/run-integration-tests.sh

# Or manually:
DATABASE_URL=postgresql://sovereign:sovereign_dev@localhost:5432/sovereign pnpm db:migrate
DATABASE_URL=postgresql://sovereign:sovereign_dev@localhost:5432/sovereign pnpm --filter @sovereign/db test:integration
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

## Coverage Rules

- New business logic code must include tests
- Bug fixes must include a regression test
- No PR merges with failing tests
- Coverage reports generated but not blocking (target: 80% for packages/*)

## Test Environment Variables

```
DATABASE_URL=postgresql://test:test@localhost:5433/sovereign_test
REDIS_URL=redis://localhost:6380
TEMPORAL_ADDRESS=localhost:7234
WORKOS_API_KEY=test_key
WORKOS_CLIENT_ID=test_client
```
