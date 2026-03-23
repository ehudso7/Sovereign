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

### Chaos Tests
- **Scope**: Worker restart during runs, DB failover, network partition
- **Approach**: Kill workers mid-run, verify recovery
- **Location**: `infra/scripts/chaos-tests/`

## Test Infrastructure

### Test Database
- Fresh PostgreSQL per test suite (integration)
- Migrations run automatically before tests
- Seed data via test factories
- Cleanup after each test

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
