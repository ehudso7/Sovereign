/**
 * @sovereign/testing
 *
 * Test helpers, factory functions, and mock utilities for the Sovereign
 * monorepo. Import from this package in test files only – never in
 * production code.
 */

import {
  toOrgId,
  toUserId,
  toProjectId,
  toAgentId,
  toRunId,
  toConnectorId,
  toPolicyId,
  toISODateString,
  ok,
  err,
  AppError,
} from "@sovereign/core";
import type {
  OrgId,
  UserId,
  ProjectId,
  AgentId,
  RunId,
  ConnectorId,
  PolicyId,
  TenantContext,
  Result,
  AuditFields,
  ISODateString,
} from "@sovereign/core";

export {
  toOrgId,
  toUserId,
  toProjectId,
  toAgentId,
  toRunId,
  toConnectorId,
  toPolicyId,
  toISODateString,
  ok,
  err,
  AppError,
};

// ---------------------------------------------------------------------------
// ID generators
// ---------------------------------------------------------------------------

let _counter = 0;

function nextId(): string {
  return `test-${++_counter}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Reset the ID counter – call in beforeEach if deterministic IDs matter. */
export function resetIdCounter(): void {
  _counter = 0;
}

export const makeOrgId = (): OrgId => toOrgId(`org_${nextId()}`);
export const makeUserId = (): UserId => toUserId(`usr_${nextId()}`);
export const makeProjectId = (): ProjectId => toProjectId(`prj_${nextId()}`);
export const makeAgentId = (): AgentId => toAgentId(`agt_${nextId()}`);
export const makeRunId = (): RunId => toRunId(`run_${nextId()}`);
export const makeConnectorId = (): ConnectorId => toConnectorId(`con_${nextId()}`);
export const makePolicyId = (): PolicyId => toPolicyId(`pol_${nextId()}`);

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

/**
 * Create a fully-populated TenantContext for use in unit and integration tests.
 */
export function makeTenantContext(
  overrides: Partial<TenantContext> = {}
): TenantContext {
  return {
    orgId: makeOrgId(),
    userId: makeUserId(),
    requestedAt: new Date().toISOString(),
    traceId: `trace_${nextId()}`,
    scopes: ["*"],
    ...overrides,
  };
}

/**
 * Build a standard AuditFields block with stable test timestamps.
 */
export function makeAuditFields(
  overrides: Partial<AuditFields> = {}
): AuditFields {
  const now = toISODateString(new Date("2025-01-01T00:00:00.000Z"));
  const userId = makeUserId();
  return {
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
    updatedBy: userId,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Result helpers
// ---------------------------------------------------------------------------

/** Assert that a Result is Ok and return its value – throws with a clear message if not. */
export function assertOk<T>(result: Result<T>, message?: string): T {
  if (!result.ok) {
    throw new Error(
      message ??
        `Expected Ok but got Err: ${
          result.error instanceof Error
            ? result.error.message
            : JSON.stringify(result.error)
        }`
    );
  }
  return result.value;
}

/** Assert that a Result is Err and return its error – throws if the result is Ok. */
export function assertErr<E>(result: Result<unknown, E>, message?: string): E {
  if (result.ok) {
    throw new Error(
      message ?? `Expected Err but got Ok: ${JSON.stringify(result.value)}`
    );
  }
  return result.error;
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

export const TEST_DATE = toISODateString(new Date("2025-06-15T12:00:00.000Z"));
export const TEST_DATE_PAST = toISODateString(new Date("2024-01-01T00:00:00.000Z"));
export const TEST_DATE_FUTURE = toISODateString(new Date("2030-12-31T23:59:59.000Z"));

export function isoDate(input: string): ISODateString {
  return toISODateString(new Date(input));
}

// ---------------------------------------------------------------------------
// Mock service factory
// ---------------------------------------------------------------------------

/**
 * Create a mock implementation of any service interface.
 * All unimplemented methods throw with a clear error – override as needed.
 *
 * @example
 * const mockAgent = createMockService<AgentService>({
 *   get: vi.fn().mockResolvedValue(ok(myAgent)),
 * });
 */
export function createMockService<T extends object>(
  partial: Partial<T> = {}
): T {
  return new Proxy(partial as T, {
    get(target, prop) {
      if (prop in target) return (target as Record<string | symbol, unknown>)[prop];
      return () => {
        throw new Error(
          `Mock method '${String(prop)}' not implemented. Provide it via createMockService({ ${String(prop)}: ... })`
        );
      };
    },
  });
}

// ---------------------------------------------------------------------------
// Async utilities
// ---------------------------------------------------------------------------

/** Wait for all microtasks to settle (useful when testing async state machines). */
export function flushPromises(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/** Sleep for a given number of milliseconds (use sparingly in tests). */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// AppError factories for common test scenarios
// ---------------------------------------------------------------------------

export const testErrors = {
  notFound: (resource = "Resource", id?: string) =>
    AppError.notFound(resource, id),
  unauthorized: () => AppError.unauthorized(),
  forbidden: () => AppError.forbidden(),
  badRequest: (msg = "Invalid input", details?: unknown) =>
    AppError.badRequest(msg, details),
  conflict: (msg = "Already exists") => AppError.conflict(msg),
  internal: () => AppError.internal(),
} as const;
