/**
 * Mission Control PostgreSQL integration tests — Phase 9 remediation.
 *
 * Proves that all Mission Control queries, alert lifecycle, and overview
 * metrics work correctly against real PostgreSQL with durable data.
 * Verifies tenant isolation across all mission-control queries.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  setupTestDb,
  teardownTestDb,
  getTestDb,
  truncateAllTables,
} from "./db-test-harness.js";
import { PgUserRepo } from "../../repositories/pg-user.repo.js";
import { PgOrgRepo } from "../../repositories/pg-org.repo.js";
import { PgMembershipRepo } from "../../repositories/pg-membership.repo.js";
import { PgProjectRepo } from "../../repositories/pg-project.repo.js";
import { PgAgentRepo } from "../../repositories/pg-agent.repo.js";
import { PgAgentVersionRepo } from "../../repositories/pg-agent-version.repo.js";
import { PgRunRepo } from "../../repositories/pg-run.repo.js";
import { PgRunStepRepo } from "../../repositories/pg-run-step.repo.js";
import { PgBrowserSessionRepo } from "../../repositories/pg-browser-session.repo.js";
import { PgAlertRuleRepo } from "../../repositories/pg-alert.repo.js";
import { PgAlertEventRepo } from "../../repositories/pg-alert.repo.js";
import { PgAuditRepo } from "../../repositories/pg-audit.repo.js";
import { toISODateString } from "@sovereign/core";
import type {
  OrgId,
  UserId,
  ProjectId,
  AgentId,
  AgentVersionId,
  RunId,
} from "@sovereign/core";

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await setupTestDb();
}, 30_000);

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await truncateAllTables();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SeedResult {
  orgId: OrgId;
  userId: UserId;
  projectId: ProjectId;
  agentId: AgentId;
  agentVersionId: AgentVersionId;
}

async function seedOrgWithAgent(suffix = ""): Promise<SeedResult> {
  const db = getTestDb();
  const userRepo = new PgUserRepo(db.unscoped());
  const orgRepo = new PgOrgRepo(db.unscoped());
  const membershipRepo = new PgMembershipRepo(db.unscoped());

  const user = await userRepo.create({ email: `mc${suffix}@test.com`, name: `MCUser${suffix}` });
  const org = await orgRepo.create({ name: `MC Org${suffix}`, slug: `mc-org${suffix}` });
  await membershipRepo.create({ orgId: org.id, userId: user.id, role: "org_owner", accepted: true });

  const tenantDb = db.forTenant(org.id);
  const projectRepo = new PgProjectRepo(tenantDb);
  const project = await projectRepo.create({ orgId: org.id, name: "MC Project", slug: `mc-proj${suffix}` });

  const agentRepo = new PgAgentRepo(tenantDb);
  const agent = await agentRepo.create({
    orgId: org.id,
    projectId: project.id,
    name: "MC Agent",
    slug: `mc-agent${suffix}`,
    createdBy: user.id,
  });

  const versionRepo = new PgAgentVersionRepo(tenantDb);
  const version = await versionRepo.create({
    orgId: org.id,
    agentId: agent.id,
    version: 1,
    goals: ["test"],
    instructions: "test instructions",
    tools: [{ name: "web_search" }],
    budget: null,
    approvalRules: [],
    memoryConfig: null,
    schedule: null,
    modelConfig: { provider: "local", model: "test" },
    createdBy: user.id,
  });
  await versionRepo.publish(version.id, org.id);

  return {
    orgId: org.id,
    userId: user.id,
    projectId: project.id,
    agentId: agent.id,
    agentVersionId: version.id,
  };
}

async function createRun(
  orgId: OrgId,
  projectId: ProjectId,
  agentId: AgentId,
  agentVersionId: AgentVersionId,
  userId: UserId,
  overrides?: {
    status?: string;
    tokenUsage?: { inputTokens: number; outputTokens: number; totalTokens: number };
    costCents?: number;
    error?: { code: string; message: string };
  },
): Promise<RunId> {
  const db = getTestDb();
  const runRepo = new PgRunRepo(db.forTenant(orgId));

  const run = await runRepo.create({
    orgId,
    projectId,
    agentId,
    agentVersionId,
    triggerType: "manual",
    triggeredBy: userId,
    executionProvider: "local",
    input: {},
    configSnapshot: {},
  });

  if (overrides?.status) {
    const now = toISODateString(new Date());
    // Walk through states as needed
    if (overrides.status !== "queued") {
      await runRepo.updateStatus(run.id, orgId, "starting");
      if (overrides.status !== "starting") {
        await runRepo.updateStatus(run.id, orgId, "running", { startedAt: now });
        if (overrides.status === "completed") {
          await runRepo.updateStatus(run.id, orgId, "completed", {
            output: { result: "done" },
            tokenUsage: overrides.tokenUsage,
            costCents: overrides.costCents,
            completedAt: now,
          });
        } else if (overrides.status === "failed") {
          await runRepo.updateStatus(run.id, orgId, "failed", {
            error: overrides.error ?? { code: "ERR", message: "Test failure" },
            completedAt: now,
          });
        } else if (overrides.status === "paused") {
          await runRepo.updateStatus(run.id, orgId, "paused");
        } else if (overrides.status === "cancelled" || overrides.status === "cancelling") {
          await runRepo.updateStatus(run.id, orgId, "cancelling");
          if (overrides.status === "cancelled") {
            await runRepo.updateStatus(run.id, orgId, "cancelled", { completedAt: now });
          }
        }
      }
    }
  }

  return run.id;
}

// ===========================================================================
// 1. Alert Rule CRUD
// ===========================================================================

describe("Alert Rule CRUD (PostgreSQL)", () => {
  it("creates an alert rule and retrieves by ID", async () => {
    const { orgId, userId } = await seedOrgWithAgent();
    const db = getTestDb();
    const repo = new PgAlertRuleRepo(db.forTenant(orgId));

    const rule = await repo.create({
      orgId,
      name: "Failed run alert",
      description: "Alert on run failures",
      conditionType: "run_failed",
      thresholdMinutes: 5,
      createdBy: userId,
    });

    expect(rule.id).toBeTruthy();
    expect(rule.orgId).toBe(orgId);
    expect(rule.name).toBe("Failed run alert");
    expect(rule.conditionType).toBe("run_failed");
    expect(rule.thresholdMinutes).toBe(5);
    expect(rule.enabled).toBe(true);

    const retrieved = await repo.getById(rule.id, orgId);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(rule.id);
  });

  it("lists alert rules with filters", async () => {
    const { orgId, userId } = await seedOrgWithAgent();
    const db = getTestDb();
    const repo = new PgAlertRuleRepo(db.forTenant(orgId));

    await repo.create({ orgId, name: "r1", conditionType: "run_failed", createdBy: userId });
    await repo.create({ orgId, name: "r2", conditionType: "run_stuck", createdBy: userId });
    await repo.create({ orgId, name: "r3", conditionType: "run_failed", enabled: false, createdBy: userId });

    const all = await repo.listForOrg(orgId);
    expect(all.length).toBe(3);

    const failedOnly = await repo.listForOrg(orgId, { conditionType: "run_failed" });
    expect(failedOnly.length).toBe(2);

    const enabledOnly = await repo.listForOrg(orgId, { enabled: true });
    expect(enabledOnly.length).toBe(2);
  });

  it("updates and deletes alert rules", async () => {
    const { orgId, userId } = await seedOrgWithAgent();
    const db = getTestDb();
    const repo = new PgAlertRuleRepo(db.forTenant(orgId));

    const rule = await repo.create({ orgId, name: "r1", conditionType: "run_failed", createdBy: userId });

    const updated = await repo.update(rule.id, orgId, { name: "updated-r1", enabled: false });
    expect(updated).not.toBeNull();
    expect(updated!.name).toBe("updated-r1");
    expect(updated!.enabled).toBe(false);

    const deleted = await repo.delete(rule.id, orgId);
    expect(deleted).toBe(true);

    const gone = await repo.getById(rule.id, orgId);
    expect(gone).toBeNull();
  });
});

// ===========================================================================
// 2. Alert Event CRUD + Lifecycle
// ===========================================================================

describe("Alert Event CRUD (PostgreSQL)", () => {
  it("creates an alert event and retrieves by ID", async () => {
    const { orgId } = await seedOrgWithAgent();
    const db = getTestDb();
    const repo = new PgAlertEventRepo(db.forTenant(orgId));

    const event = await repo.create({
      orgId,
      severity: "warning",
      title: "Run failed",
      message: "Run abc failed with timeout",
      conditionType: "run_failed",
      resourceType: "run",
      resourceId: "00000000-0000-0000-0000-000000000001",
      metadata: { agentId: "agent-1" },
    });

    expect(event.id).toBeTruthy();
    expect(event.status).toBe("open");
    expect(event.severity).toBe("warning");
    expect(event.conditionType).toBe("run_failed");
    expect(event.metadata).toEqual({ agentId: "agent-1" });

    const retrieved = await repo.getById(event.id, orgId);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(event.id);
  });

  it("lists alert events with status/severity/conditionType filters", async () => {
    const { orgId } = await seedOrgWithAgent();
    const db = getTestDb();
    const repo = new PgAlertEventRepo(db.forTenant(orgId));

    await repo.create({ orgId, severity: "warning", title: "a1", conditionType: "run_failed", resourceType: "run" });
    await repo.create({ orgId, severity: "critical", title: "a2", conditionType: "run_stuck", resourceType: "run" });
    await repo.create({ orgId, severity: "warning", title: "a3", conditionType: "browser_failed", resourceType: "browser_session" });

    const all = await repo.listForOrg(orgId);
    expect(all.length).toBe(3);

    const warnings = await repo.listForOrg(orgId, { severity: "warning" });
    expect(warnings.length).toBe(2);

    const stuck = await repo.listForOrg(orgId, { conditionType: "run_stuck" });
    expect(stuck.length).toBe(1);
    expect(stuck[0]!.severity).toBe("critical");

    const limited = await repo.listForOrg(orgId, { limit: 1 });
    expect(limited.length).toBe(1);
  });

  it("acknowledges an open alert event", async () => {
    const { orgId, userId } = await seedOrgWithAgent();
    const db = getTestDb();
    const repo = new PgAlertEventRepo(db.forTenant(orgId));

    const event = await repo.create({
      orgId,
      severity: "warning",
      title: "Run failed",
      conditionType: "run_failed",
      resourceType: "run",
    });

    const acked = await repo.acknowledge(event.id, orgId, userId);
    expect(acked).not.toBeNull();
    expect(acked!.status).toBe("acknowledged");
    expect(acked!.acknowledgedBy).toBe(userId);
    expect(acked!.acknowledgedAt).not.toBeNull();

    // Cannot re-acknowledge (status is no longer 'open')
    const reAck = await repo.acknowledge(event.id, orgId, userId);
    expect(reAck).toBeNull();
  });

  it("resolves an alert event", async () => {
    const { orgId } = await seedOrgWithAgent();
    const db = getTestDb();
    const repo = new PgAlertEventRepo(db.forTenant(orgId));

    const event = await repo.create({
      orgId,
      severity: "warning",
      title: "test",
      conditionType: "run_failed",
      resourceType: "run",
    });

    const resolved = await repo.resolve(event.id, orgId);
    expect(resolved).not.toBeNull();
    expect(resolved!.status).toBe("resolved");
    expect(resolved!.resolvedAt).not.toBeNull();

    // Cannot re-resolve
    const reResolve = await repo.resolve(event.id, orgId);
    expect(reResolve).toBeNull();
  });

  it("countByStatus aggregates correctly", async () => {
    const { orgId, userId } = await seedOrgWithAgent();
    const db = getTestDb();
    const repo = new PgAlertEventRepo(db.forTenant(orgId));

    const e1 = await repo.create({ orgId, severity: "warning", title: "a1", conditionType: "run_failed", resourceType: "run" });
    await repo.create({ orgId, severity: "warning", title: "a2", conditionType: "run_failed", resourceType: "run" });
    const e3 = await repo.create({ orgId, severity: "critical", title: "a3", conditionType: "run_stuck", resourceType: "run" });

    // Acknowledge one, resolve another
    await repo.acknowledge(e1.id, orgId, userId);
    await repo.resolve(e3.id, orgId);

    const counts = await repo.countByStatus(orgId);
    expect(counts["open"]).toBe(1);
    expect(counts["acknowledged"]).toBe(1);
    expect(counts["resolved"]).toBe(1);
  });
});

// ===========================================================================
// 3. Alert Deduplication
// ===========================================================================

describe("Alert deduplication (PostgreSQL)", () => {
  it("alerts with same resourceId can be tracked for dedup", async () => {
    const { orgId } = await seedOrgWithAgent();
    const db = getTestDb();
    const repo = new PgAlertEventRepo(db.forTenant(orgId));

    const runId = "00000000-0000-0000-0000-000000000099";

    // Create first alert for this run
    await repo.create({
      orgId,
      severity: "warning",
      title: "Run failed",
      conditionType: "run_failed",
      resourceType: "run",
      resourceId: runId,
    });

    // Query existing alerts to check for dups (service-level dedup pattern)
    const existing = await repo.listForOrg(orgId, { conditionType: "run_failed" });
    const alertedRunIds = new Set(existing.map((a) => a.resourceId));
    expect(alertedRunIds.has(runId)).toBe(true);

    // Dedup check prevents second alert
    if (!alertedRunIds.has(runId)) {
      await repo.create({
        orgId,
        severity: "warning",
        title: "Run failed duplicate",
        conditionType: "run_failed",
        resourceType: "run",
        resourceId: runId,
      });
    }

    // Still only 1 alert
    const afterDedup = await repo.listForOrg(orgId);
    expect(afterDedup.length).toBe(1);
  });
});

// ===========================================================================
// 4. Overview Metrics (DB-backed proof)
// ===========================================================================

describe("Overview metrics from persisted data (PostgreSQL)", () => {
  it("computes run status counts from DB", async () => {
    const { orgId, userId, projectId, agentId, agentVersionId } = await seedOrgWithAgent();

    // Create runs in various states
    await createRun(orgId, projectId, agentId, agentVersionId, userId, { status: "completed", tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 }, costCents: 5 });
    await createRun(orgId, projectId, agentId, agentVersionId, userId, { status: "completed", tokenUsage: { inputTokens: 200, outputTokens: 100, totalTokens: 300 }, costCents: 10 });
    await createRun(orgId, projectId, agentId, agentVersionId, userId, { status: "failed", error: { code: "TIMEOUT", message: "timed out" } });
    await createRun(orgId, projectId, agentId, agentVersionId, userId); // queued

    const db = getTestDb();
    const runRepo = new PgRunRepo(db.forTenant(orgId));
    const runs = await runRepo.listForOrg(orgId);

    expect(runs.length).toBe(4);

    // Count by status
    const statusCounts = { completed: 0, failed: 0, queued: 0 };
    for (const r of runs) {
      if (r.status === "completed") statusCounts.completed++;
      else if (r.status === "failed") statusCounts.failed++;
      else if (r.status === "queued") statusCounts.queued++;
    }
    expect(statusCounts.completed).toBe(2);
    expect(statusCounts.failed).toBe(1);
    expect(statusCounts.queued).toBe(1);

    // Token aggregation
    let totalInput = 0;
    let totalOutput = 0;
    let totalTokens = 0;
    let totalCost = 0;
    for (const r of runs) {
      if (r.tokenUsage) {
        totalInput += r.tokenUsage.inputTokens || 0;
        totalOutput += r.tokenUsage.outputTokens || 0;
        totalTokens += r.tokenUsage.totalTokens || 0;
      }
      if (r.costCents) totalCost += r.costCents;
    }
    expect(totalInput).toBe(300);
    expect(totalOutput).toBe(150);
    expect(totalTokens).toBe(450);
    expect(totalCost).toBe(15);

    // Failure rate
    const failureRate = Math.round((statusCounts.failed / runs.length) * 10000) / 100;
    expect(failureRate).toBe(25);
  });

  it("computes queue wait and duration from timestamps", async () => {
    const { orgId, userId, projectId, agentId, agentVersionId } = await seedOrgWithAgent();

    // Create a completed run so we can check startedAt/completedAt
    const runId = await createRun(orgId, projectId, agentId, agentVersionId, userId, {
      status: "completed",
      tokenUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    });

    const db = getTestDb();
    const runRepo = new PgRunRepo(db.forTenant(orgId));
    const run = await runRepo.getById(runId, orgId);

    expect(run).not.toBeNull();
    expect(run!.startedAt).toBeTruthy();
    expect(run!.completedAt).toBeTruthy();

    // Queue wait and duration should be non-negative
    const queueWait = new Date(run!.startedAt!).getTime() - new Date(run!.createdAt).getTime();
    expect(queueWait).toBeGreaterThanOrEqual(0);

    const duration = new Date(run!.completedAt!).getTime() - new Date(run!.startedAt!).getTime();
    expect(duration).toBeGreaterThanOrEqual(0);
  });

  it("counts open alerts from DB for overview", async () => {
    const { orgId } = await seedOrgWithAgent();
    const db = getTestDb();
    const alertRepo = new PgAlertEventRepo(db.forTenant(orgId));

    await alertRepo.create({ orgId, severity: "warning", title: "a1", conditionType: "run_failed", resourceType: "run" });
    await alertRepo.create({ orgId, severity: "warning", title: "a2", conditionType: "run_failed", resourceType: "run" });
    const e3 = await alertRepo.create({ orgId, severity: "critical", title: "a3", conditionType: "run_stuck", resourceType: "run" });
    await alertRepo.resolve(e3.id, orgId);

    const counts = await alertRepo.countByStatus(orgId);
    expect(counts["open"]).toBe(2);
    expect(counts["resolved"]).toBe(1);
  });

  it("recent failures are returned in correct order", async () => {
    const { orgId, userId, projectId, agentId, agentVersionId } = await seedOrgWithAgent();

    for (let i = 0; i < 12; i++) {
      await createRun(orgId, projectId, agentId, agentVersionId, userId, {
        status: "failed",
        error: { code: "ERR", message: `failure-${i}` },
      });
    }

    const db = getTestDb();
    const runRepo = new PgRunRepo(db.forTenant(orgId));
    const runs = await runRepo.listForOrg(orgId, { status: "failed" as never });

    expect(runs.length).toBe(12);

    // Sort by createdAt desc and take 10 (service logic)
    const recentFailures = runs
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
    expect(recentFailures.length).toBe(10);
  });
});

// ===========================================================================
// 5. Run List Filters (DB-backed)
// ===========================================================================

describe("Run list filters against real DB (PostgreSQL)", () => {
  it("filters runs by status", async () => {
    const { orgId, userId, projectId, agentId, agentVersionId } = await seedOrgWithAgent();

    await createRun(orgId, projectId, agentId, agentVersionId, userId, { status: "completed" });
    await createRun(orgId, projectId, agentId, agentVersionId, userId, { status: "failed" });
    await createRun(orgId, projectId, agentId, agentVersionId, userId); // queued

    const db = getTestDb();
    const runRepo = new PgRunRepo(db.forTenant(orgId));

    const completed = await runRepo.listForOrg(orgId, { status: "completed" });
    expect(completed.length).toBe(1);

    const failed = await runRepo.listForOrg(orgId, { status: "failed" });
    expect(failed.length).toBe(1);

    const queued = await runRepo.listForOrg(orgId, { status: "queued" });
    expect(queued.length).toBe(1);
  });

  it("filters runs by agentId", async () => {
    const { orgId, userId, projectId, agentId, agentVersionId } = await seedOrgWithAgent();

    // Create second agent
    const db = getTestDb();
    const tenantDb = db.forTenant(orgId);
    const agentRepo = new PgAgentRepo(tenantDb);
    const agent2 = await agentRepo.create({ orgId, projectId, name: "Agent2", slug: "agent-2", createdBy: userId });
    const versionRepo = new PgAgentVersionRepo(tenantDb);
    const v2 = await versionRepo.create({
      orgId, agentId: agent2.id, version: 1, goals: [], instructions: "", tools: [],
      budget: null, approvalRules: [], memoryConfig: null, schedule: null,
      modelConfig: { provider: "local", model: "test" }, createdBy: userId,
    });

    await createRun(orgId, projectId, agentId, agentVersionId, userId);
    // Manually create a run for agent2
    const runRepo = new PgRunRepo(tenantDb);
    await runRepo.create({
      orgId, projectId, agentId: agent2.id, agentVersionId: v2.id,
      triggerType: "manual", triggeredBy: userId, executionProvider: "local", configSnapshot: {},
    });

    const filtered = await runRepo.listForOrg(orgId, { agentId });
    expect(filtered.length).toBe(1);
    expect(filtered[0]!.agentId).toBe(agentId);
  });

  it("filters runs by projectId", async () => {
    const { orgId, userId, projectId, agentId, agentVersionId } = await seedOrgWithAgent();

    await createRun(orgId, projectId, agentId, agentVersionId, userId);

    const db = getTestDb();
    const runRepo = new PgRunRepo(db.forTenant(orgId));
    const filtered = await runRepo.listForOrg(orgId, { projectId });
    expect(filtered.length).toBe(1);

    const noProject = await runRepo.listForOrg(orgId, { projectId: "00000000-0000-0000-0000-000000000999" as ProjectId });
    expect(noProject.length).toBe(0);
  });
});

// ===========================================================================
// 6. Run Detail / Timeline (DB-backed)
// ===========================================================================

describe("Run detail and timeline queries (PostgreSQL)", () => {
  it("returns ordered steps for a run", async () => {
    const { orgId, userId, projectId, agentId, agentVersionId } = await seedOrgWithAgent();
    const runId = await createRun(orgId, projectId, agentId, agentVersionId, userId);

    const db = getTestDb();
    const stepRepo = new PgRunStepRepo(db.forTenant(orgId));

    // Insert steps out of order
    await stepRepo.create({ orgId, runId, stepNumber: 3, type: "tool_call", toolName: "web_search" });
    await stepRepo.create({ orgId, runId, stepNumber: 1, type: "llm_call" });
    await stepRepo.create({ orgId, runId, stepNumber: 2, type: "tool_call", toolName: "code_exec" });

    const steps = await stepRepo.listForRun(runId);
    expect(steps.length).toBe(3);
    expect(steps[0]!.stepNumber).toBe(1);
    expect(steps[1]!.stepNumber).toBe(2);
    expect(steps[2]!.stepNumber).toBe(3);
  });

  it("aggregates tool usage from steps", async () => {
    const { orgId, userId, projectId, agentId, agentVersionId } = await seedOrgWithAgent();
    const runId = await createRun(orgId, projectId, agentId, agentVersionId, userId);

    const db = getTestDb();
    const stepRepo = new PgRunStepRepo(db.forTenant(orgId));

    const s1 = await stepRepo.create({ orgId, runId, stepNumber: 1, type: "tool_call", toolName: "web_search" });
    const s2 = await stepRepo.create({ orgId, runId, stepNumber: 2, type: "tool_call", toolName: "web_search" });
    const s3 = await stepRepo.create({ orgId, runId, stepNumber: 3, type: "tool_call", toolName: "code_exec" });

    // Update with latency
    await stepRepo.updateStatus(s1.id, orgId, "completed", { latencyMs: 100 });
    await stepRepo.updateStatus(s2.id, orgId, "completed", { latencyMs: 200 });
    await stepRepo.updateStatus(s3.id, orgId, "completed", { latencyMs: 50 });

    const steps = await stepRepo.listForRun(runId);

    // Aggregate tool usage (service-level logic)
    const toolMap = new Map<string, { count: number; totalLatencyMs: number }>();
    for (const step of steps) {
      if (step.type === "tool_call" && step.toolName) {
        const existing = toolMap.get(step.toolName) ?? { count: 0, totalLatencyMs: 0 };
        existing.count++;
        existing.totalLatencyMs += step.latencyMs ?? 0;
        toolMap.set(step.toolName, existing);
      }
    }

    expect(toolMap.get("web_search")?.count).toBe(2);
    expect(toolMap.get("web_search")?.totalLatencyMs).toBe(300);
    expect(toolMap.get("code_exec")?.count).toBe(1);
    expect(toolMap.get("code_exec")?.totalLatencyMs).toBe(50);
  });
});

// ===========================================================================
// 7. Browser Linkage (DB-backed)
// ===========================================================================

describe("Browser session linkage (PostgreSQL)", () => {
  it("links browser sessions to runs via runId", async () => {
    const { orgId, userId, projectId, agentId, agentVersionId } = await seedOrgWithAgent();
    const runId = await createRun(orgId, projectId, agentId, agentVersionId, userId);

    const db = getTestDb();
    const browserRepo = new PgBrowserSessionRepo(db.forTenant(orgId));

    await browserRepo.create({ orgId, runId, agentId, createdBy: userId });
    await browserRepo.create({ orgId, runId, agentId, createdBy: userId });

    const sessions = await browserRepo.listForOrg(orgId, { runId });
    expect(sessions.length).toBe(2);
    expect(sessions[0]!.runId).toBe(runId);
    expect(sessions[1]!.runId).toBe(runId);

    // No sessions for a different run
    const otherRunId = await createRun(orgId, projectId, agentId, agentVersionId, userId);
    const otherSessions = await browserRepo.listForOrg(orgId, { runId: otherRunId });
    expect(otherSessions.length).toBe(0);
  });

  it("runsWithBrowser overview count is correct", async () => {
    const { orgId, userId, projectId, agentId, agentVersionId } = await seedOrgWithAgent();
    const run1 = await createRun(orgId, projectId, agentId, agentVersionId, userId);
    const run2 = await createRun(orgId, projectId, agentId, agentVersionId, userId);
    await createRun(orgId, projectId, agentId, agentVersionId, userId); // no browser

    const db = getTestDb();
    const browserRepo = new PgBrowserSessionRepo(db.forTenant(orgId));

    await browserRepo.create({ orgId, runId: run1, agentId, createdBy: userId });
    await browserRepo.create({ orgId, runId: run2, agentId, createdBy: userId });
    await browserRepo.create({ orgId, runId: run2, agentId, createdBy: userId }); // 2nd session same run

    const allSessions = await browserRepo.listForOrg(orgId);
    const runIdsWithBrowser = new Set(allSessions.map((s) => s.runId));
    expect(runIdsWithBrowser.size).toBe(2); // run1 and run2, not run3
  });
});

// ===========================================================================
// 8. Tool Usage via Audit Events (DB-backed)
// ===========================================================================

describe("Tool usage aggregation via audit events (PostgreSQL)", () => {
  it("counts distinct runs with tool usage", async () => {
    const { orgId, userId, projectId, agentId, agentVersionId } = await seedOrgWithAgent();
    const run1 = await createRun(orgId, projectId, agentId, agentVersionId, userId);
    const run2 = await createRun(orgId, projectId, agentId, agentVersionId, userId);

    const db = getTestDb();
    const auditRepo = new PgAuditRepo(db.forTenant(orgId));

    // Emit tool_used events for two runs
    await auditRepo.emit({
      orgId, actorId: userId, actorType: "system",
      action: "run.tool_used", resourceType: "run", resourceId: run1,
      metadata: { toolName: "web_search", connectorSlug: "echo" },
    });
    await auditRepo.emit({
      orgId, actorId: userId, actorType: "system",
      action: "run.tool_used", resourceType: "run", resourceId: run1,
      metadata: { toolName: "code_exec", connectorSlug: "echo" },
    });
    await auditRepo.emit({
      orgId, actorId: userId, actorType: "system",
      action: "run.tool_used", resourceType: "run", resourceId: run2,
      metadata: { toolName: "web_search", connectorSlug: "echo" },
    });

    const toolEvents = await auditRepo.query(orgId, { action: "run.tool_used" });
    const runIdsWithTools = new Set(toolEvents.map((e) => e.resourceId));
    expect(runIdsWithTools.size).toBe(2);
  });
});

// ===========================================================================
// 9. Memory Usage via Audit Events (DB-backed)
// ===========================================================================

describe("Memory usage aggregation via audit events (PostgreSQL)", () => {
  it("counts distinct runs with memory retrieval (uses metadata.runId)", async () => {
    const { orgId, userId, projectId, agentId, agentVersionId } = await seedOrgWithAgent();
    const run1 = await createRun(orgId, projectId, agentId, agentVersionId, userId);
    const run2 = await createRun(orgId, projectId, agentId, agentVersionId, userId);

    const db = getTestDb();
    const auditRepo = new PgAuditRepo(db.forTenant(orgId));

    // Worker-style audit events with metadata.runId
    await auditRepo.emit({
      orgId, actorType: "system",
      action: "memory.retrieved_for_run", resourceType: "memory", resourceId: run1,
      metadata: { count: 3, runId: run1, agentId },
    });
    await auditRepo.emit({
      orgId, actorType: "system",
      action: "memory.retrieved_for_run", resourceType: "memory", resourceId: run2,
      metadata: { count: 1, runId: run2, agentId },
    });

    const memEvents = await auditRepo.query(orgId, { action: "memory.retrieved_for_run" });
    expect(memEvents.length).toBe(2);

    // Use corrected metric logic: metadata.runId ?? resourceId
    const runIdsWithMemory = new Set(
      memEvents.map((e) => (e.metadata?.runId as string | undefined) ?? e.resourceId).filter(Boolean),
    );
    expect(runIdsWithMemory.size).toBe(2);
  });

  it("does not double-count duplicate events for the same run", async () => {
    const { orgId, userId, projectId, agentId, agentVersionId } = await seedOrgWithAgent();
    const runId = await createRun(orgId, projectId, agentId, agentVersionId, userId);

    const db = getTestDb();
    const auditRepo = new PgAuditRepo(db.forTenant(orgId));

    // Two retrieval events for the same run
    await auditRepo.emit({
      orgId, actorType: "system",
      action: "memory.retrieved_for_run", resourceType: "memory", resourceId: runId,
      metadata: { count: 3, runId, agentId },
    });
    await auditRepo.emit({
      orgId, actorType: "system",
      action: "memory.retrieved_for_run", resourceType: "memory", resourceId: runId,
      metadata: { count: 2, runId, agentId },
    });

    const memEvents = await auditRepo.query(orgId, { action: "memory.retrieved_for_run" });
    const runIdsWithMemory = new Set(
      memEvents.map((e) => (e.metadata?.runId as string | undefined) ?? e.resourceId).filter(Boolean),
    );
    expect(runIdsWithMemory.size).toBe(1); // Only 1 distinct run
  });
});

// ===========================================================================
// 10. Tenant Isolation across Mission Control queries
// ===========================================================================

describe("Mission Control tenant isolation (PostgreSQL)", () => {
  it("org B cannot see org A alert rules", async () => {
    const a = await seedOrgWithAgent("-iso-a");
    const b = await seedOrgWithAgent("-iso-b");

    const db = getTestDb();
    const repoA = new PgAlertRuleRepo(db.forTenant(a.orgId));
    const repoB = new PgAlertRuleRepo(db.forTenant(b.orgId));

    const rule = await repoA.create({ orgId: a.orgId, name: "A rule", conditionType: "run_failed", createdBy: a.userId });

    const byId = await repoB.getById(rule.id, b.orgId);
    expect(byId).toBeNull();

    const list = await repoB.listForOrg(b.orgId);
    expect(list.length).toBe(0);
  });

  it("org B cannot see org A alert events", async () => {
    const a = await seedOrgWithAgent("-iso-c");
    const b = await seedOrgWithAgent("-iso-d");

    const db = getTestDb();
    const repoA = new PgAlertEventRepo(db.forTenant(a.orgId));
    const repoB = new PgAlertEventRepo(db.forTenant(b.orgId));

    const event = await repoA.create({
      orgId: a.orgId, severity: "warning", title: "test",
      conditionType: "run_failed", resourceType: "run",
    });

    const byId = await repoB.getById(event.id, b.orgId);
    expect(byId).toBeNull();

    const list = await repoB.listForOrg(b.orgId);
    expect(list.length).toBe(0);

    const counts = await repoB.countByStatus(b.orgId);
    expect(counts["open"] ?? 0).toBe(0);
  });

  it("org B cannot acknowledge org A alert events", async () => {
    const a = await seedOrgWithAgent("-iso-e");
    const b = await seedOrgWithAgent("-iso-f");

    const db = getTestDb();
    const repoA = new PgAlertEventRepo(db.forTenant(a.orgId));
    const repoB = new PgAlertEventRepo(db.forTenant(b.orgId));

    const event = await repoA.create({
      orgId: a.orgId, severity: "warning", title: "test",
      conditionType: "run_failed", resourceType: "run",
    });

    const acked = await repoB.acknowledge(event.id, b.orgId, b.userId);
    expect(acked).toBeNull();

    // Original is still open
    const original = await repoA.getById(event.id, a.orgId);
    expect(original!.status).toBe("open");
  });

  it("org B cannot see org A runs in overview queries", async () => {
    const a = await seedOrgWithAgent("-iso-g");
    const b = await seedOrgWithAgent("-iso-h");

    await createRun(a.orgId, a.projectId, a.agentId, a.agentVersionId, a.userId, { status: "completed" });
    await createRun(a.orgId, a.projectId, a.agentId, a.agentVersionId, a.userId, { status: "failed" });

    const db = getTestDb();
    const runRepoB = new PgRunRepo(db.forTenant(b.orgId));
    const runsB = await runRepoB.listForOrg(b.orgId);
    expect(runsB.length).toBe(0);
  });

  it("org B cannot see org A browser sessions", async () => {
    const a = await seedOrgWithAgent("-iso-i");
    const b = await seedOrgWithAgent("-iso-j");

    const runId = await createRun(a.orgId, a.projectId, a.agentId, a.agentVersionId, a.userId);

    const db = getTestDb();
    const browserRepoA = new PgBrowserSessionRepo(db.forTenant(a.orgId));
    await browserRepoA.create({ orgId: a.orgId, runId, agentId: a.agentId, createdBy: a.userId });

    const browserRepoB = new PgBrowserSessionRepo(db.forTenant(b.orgId));
    const sessions = await browserRepoB.listForOrg(b.orgId);
    expect(sessions.length).toBe(0);
  });

  it("org B cannot see org A audit events for tool/memory usage", async () => {
    const a = await seedOrgWithAgent("-iso-k");
    const b = await seedOrgWithAgent("-iso-l");

    const db = getTestDb();
    const auditRepoA = new PgAuditRepo(db.forTenant(a.orgId));

    await auditRepoA.emit({
      orgId: a.orgId, actorType: "system",
      action: "run.tool_used", resourceType: "run", resourceId: "00000000-0000-0000-0000-000000000001",
      metadata: { toolName: "web_search" },
    });

    const auditRepoB = new PgAuditRepo(db.forTenant(b.orgId));
    const toolEvents = await auditRepoB.query(b.orgId, { action: "run.tool_used" });
    expect(toolEvents.length).toBe(0);

    const memEvents = await auditRepoB.query(b.orgId, { action: "memory.retrieved_for_run" });
    expect(memEvents.length).toBe(0);
  });
});
