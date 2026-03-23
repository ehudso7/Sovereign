/**
 * Mission Control route tests (service-level contract).
 *
 * Tests the mission control service layer using in-memory test repos.
 * Validates overview metrics, run filtering, run detail/timeline,
 * browser/tool/memory linkage, alerting, and org scoping.
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { AgentId } from "@sovereign/core";
import { toOrgId, toUserId, toProjectId, toRunId, toAlertEventId } from "@sovereign/core";
import { MissionControlService } from "../../services/mission-control.service.js";
import { PgAuditEmitter } from "../../services/audit.service.js";
import {
  createTestRepos,
  type TestRepos,
} from "../helpers/test-repos.js";

const ORG_ID = toOrgId("00000000-0000-0000-0000-aaaaaaaaaaaa");
const OTHER_ORG_ID = toOrgId("00000000-0000-0000-0000-dddddddddddd");
const USER_ID = toUserId("00000000-0000-0000-0000-bbbbbbbbbbbb");
const PROJECT_ID = toProjectId("00000000-0000-0000-0000-cccccccccccc");

/** Helper to create a test run via repos */
async function createTestRun(
  repos: TestRepos,
  overrides: Partial<{
    status: string;
    agentId: AgentId;
    startedAt: string;
    completedAt: string;
    tokenUsage: { inputTokens: number; outputTokens: number; totalTokens: number };
    costCents: number;
    error: { code: string; message: string };
  }> = {},
) {
  const agent = await repos.agents.create({
    orgId: ORG_ID,
    projectId: PROJECT_ID,
    name: "Test Agent",
    slug: `test-agent-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdBy: USER_ID,
  });

  const version = await repos.agentVersions.create({
    orgId: ORG_ID,
    agentId: agent.id,
    version: 1,
    goals: [],
    instructions: "test",
    tools: [],
    budget: null,
    approvalRules: [],
    memoryConfig: null,
    schedule: null,
    modelConfig: { provider: "local", model: "test" },
    createdBy: USER_ID,
  });

  const run = await repos.runs.create({
    orgId: ORG_ID,
    projectId: PROJECT_ID,
    agentId: overrides.agentId ?? agent.id,
    agentVersionId: version.id,
    triggerType: "manual",
    triggeredBy: USER_ID,
    executionProvider: "local",
    configSnapshot: {},
  });

  // Apply overrides if any
  if (overrides.status || overrides.startedAt || overrides.completedAt || overrides.tokenUsage || overrides.costCents || overrides.error) {
    await repos.runs.updateStatus(run.id, ORG_ID, (overrides.status ?? run.status) as never, {
      startedAt: overrides.startedAt,
      completedAt: overrides.completedAt,
      tokenUsage: overrides.tokenUsage,
      costCents: overrides.costCents,
      error: overrides.error,
    } as never);
  }

  return { run, agent, version };
}

describe("Mission Control Routes (service-level contract)", () => {
  let repos: TestRepos;
  let mc: MissionControlService;

  beforeEach(() => {
    repos = createTestRepos();
    const auditEmitter = new PgAuditEmitter(repos.audit);
    mc = new MissionControlService(
      repos.runs,
      repos.runSteps,
      repos.browserSessions,
      repos.alertRules,
      repos.alertEvents,
      repos.audit,
      auditEmitter,
    );
  });

  // -----------------------------------------------------------------------
  // GET /api/v1/mission-control/overview
  // -----------------------------------------------------------------------

  describe("getOverview", () => {
    it("returns zero metrics when no runs exist", async () => {
      const result = await mc.getOverview(ORG_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.runs.total).toBe(0);
      expect(result.value.avgQueueWaitMs).toBeNull();
      expect(result.value.avgDurationMs).toBeNull();
      expect(result.value.failureRate).toBeNull();
      expect(result.value.tokenUsage.totalTokens).toBe(0);
      expect(result.value.estimatedCostCents).toBe(0);
      expect(result.value.openAlerts).toBe(0);
      expect(result.value.recentFailures.length).toBe(0);
    });

    it("computes run status counts", async () => {
      await createTestRun(repos, { status: "completed" });
      await createTestRun(repos, { status: "failed" });
      await createTestRun(repos, { status: "failed" });

      const result = await mc.getOverview(ORG_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.runs.total).toBe(3);
      expect(result.value.runs.completed).toBe(1);
      expect(result.value.runs.failed).toBe(2);
    });

    it("computes failure rate", async () => {
      await createTestRun(repos, { status: "completed" });
      await createTestRun(repos, { status: "failed" });
      await createTestRun(repos, { status: "completed" });
      await createTestRun(repos, { status: "completed" });

      const result = await mc.getOverview(ORG_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.failureRate).toBe(25); // 1/4 = 25%
    });

    it("aggregates token usage and cost", async () => {
      await createTestRun(repos, {
        status: "completed",
        tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        costCents: 10,
      });
      await createTestRun(repos, {
        status: "completed",
        tokenUsage: { inputTokens: 200, outputTokens: 100, totalTokens: 300 },
        costCents: 20,
      });

      const result = await mc.getOverview(ORG_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.tokenUsage.totalTokens).toBe(450);
      expect(result.value.estimatedCostCents).toBe(30);
    });

    it("includes open alert count", async () => {
      await repos.alertEvents.create({
        orgId: ORG_ID,
        severity: "warning",
        title: "Test alert",
        conditionType: "run_failed",
        resourceType: "run",
      });

      const result = await mc.getOverview(ORG_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.openAlerts).toBe(1);
    });

    it("shows recent failures", async () => {
      await createTestRun(repos, {
        status: "failed",
        error: { code: "TIMEOUT", message: "Timed out" },
      });

      const result = await mc.getOverview(ORG_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.recentFailures.length).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/v1/mission-control/runs
  // -----------------------------------------------------------------------

  describe("listRuns", () => {
    it("returns all runs for the org", async () => {
      await createTestRun(repos);
      await createTestRun(repos);

      const result = await mc.listRuns(ORG_ID);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.length).toBe(2);
    });

    it("filters by status", async () => {
      await createTestRun(repos, { status: "completed" });
      await createTestRun(repos, { status: "failed" });

      const result = await mc.listRuns(ORG_ID, { status: "completed" });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(1);
        expect(result.value[0]!.status).toBe("completed");
      }
    });

    it("applies limit", async () => {
      for (let i = 0; i < 5; i++) await createTestRun(repos);

      const result = await mc.listRuns(ORG_ID, { limit: 3 });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.length).toBe(3);
    });

    it("returns empty for other org (org scoping)", async () => {
      await createTestRun(repos);

      const result = await mc.listRuns(OTHER_ORG_ID);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.length).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/v1/mission-control/runs/:runId
  // -----------------------------------------------------------------------

  describe("getRunDetail", () => {
    it("returns run detail with steps and timing", async () => {
      const { run } = await createTestRun(repos, {
        status: "completed",
        startedAt: "2026-01-01T00:00:00Z",
        completedAt: "2026-01-01T00:01:00Z",
      });

      // Add a step
      await repos.runSteps.create({
        orgId: ORG_ID,
        runId: run.id,
        stepNumber: 1,
        type: "llm_call",
      });

      const result = await mc.getRunDetail(run.id, ORG_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.run.id).toBe(run.id);
      expect(result.value.steps.length).toBe(1);
      expect(result.value.timeline.length).toBe(1);
    });

    it("aggregates tool usage from steps", async () => {
      const { run } = await createTestRun(repos);

      await repos.runSteps.create({
        orgId: ORG_ID, runId: run.id, stepNumber: 1, type: "tool_call", toolName: "echo",
      });
      await repos.runSteps.create({
        orgId: ORG_ID, runId: run.id, stepNumber: 2, type: "tool_call", toolName: "echo",
      });
      await repos.runSteps.create({
        orgId: ORG_ID, runId: run.id, stepNumber: 3, type: "tool_call", toolName: "weather",
      });

      const result = await mc.getRunDetail(run.id, ORG_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.toolUsage.length).toBe(2);
      const echoUsage = result.value.toolUsage.find((t) => t.toolName === "echo");
      expect(echoUsage?.count).toBe(2);
    });

    it("returns NOT_FOUND for nonexistent run", async () => {
      const result = await mc.getRunDetail(toRunId("nonexistent"), ORG_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });

    it("returns NOT_FOUND for wrong org", async () => {
      const { run } = await createTestRun(repos);
      const result = await mc.getRunDetail(run.id, OTHER_ORG_ID);
      expect(result.ok).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/v1/mission-control/runs/:runId/timeline
  // -----------------------------------------------------------------------

  describe("getRunTimeline", () => {
    it("returns ordered steps", async () => {
      const { run } = await createTestRun(repos);

      await repos.runSteps.create({ orgId: ORG_ID, runId: run.id, stepNumber: 2, type: "tool_call" });
      await repos.runSteps.create({ orgId: ORG_ID, runId: run.id, stepNumber: 1, type: "llm_call" });
      await repos.runSteps.create({ orgId: ORG_ID, runId: run.id, stepNumber: 3, type: "system" });

      const result = await mc.getRunTimeline(run.id, ORG_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.length).toBe(3);
      expect(result.value[0]!.stepNumber).toBe(1);
      expect(result.value[1]!.stepNumber).toBe(2);
      expect(result.value[2]!.stepNumber).toBe(3);
    });

    it("returns NOT_FOUND for wrong org", async () => {
      const { run } = await createTestRun(repos);
      const result = await mc.getRunTimeline(run.id, OTHER_ORG_ID);
      expect(result.ok).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/v1/mission-control/runs/:runId/steps
  // -----------------------------------------------------------------------

  describe("getRunSteps", () => {
    it("returns steps for a run", async () => {
      const { run } = await createTestRun(repos);
      await repos.runSteps.create({ orgId: ORG_ID, runId: run.id, stepNumber: 1, type: "llm_call" });

      const result = await mc.getRunSteps(run.id, ORG_ID);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.length).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/v1/mission-control/runs/:runId/linked-browser-sessions
  // -----------------------------------------------------------------------

  describe("getLinkedBrowserSessions", () => {
    it("returns browser sessions linked to run", async () => {
      const { run } = await createTestRun(repos);

      await repos.browserSessions.create({
        orgId: ORG_ID,
        runId: run.id,
        agentId: run.agentId,
        createdBy: USER_ID,
      });

      const result = await mc.getLinkedBrowserSessions(run.id, ORG_ID);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.length).toBe(1);
    });

    it("returns empty when no browser sessions", async () => {
      const { run } = await createTestRun(repos);

      const result = await mc.getLinkedBrowserSessions(run.id, ORG_ID);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.length).toBe(0);
    });

    it("returns NOT_FOUND for wrong org", async () => {
      const { run } = await createTestRun(repos);
      const result = await mc.getLinkedBrowserSessions(run.id, OTHER_ORG_ID);
      expect(result.ok).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Alerts
  // -----------------------------------------------------------------------

  describe("listAlerts", () => {
    it("returns alerts for the org", async () => {
      await repos.alertEvents.create({
        orgId: ORG_ID,
        severity: "warning",
        title: "Test",
        conditionType: "run_failed",
        resourceType: "run",
      });

      const result = await mc.listAlerts(ORG_ID);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.length).toBe(1);
    });

    it("filters by status", async () => {
      await repos.alertEvents.create({
        orgId: ORG_ID, severity: "warning", title: "Open",
        conditionType: "run_failed", resourceType: "run",
      });

      const result = await mc.listAlerts(ORG_ID, { status: "acknowledged" });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.length).toBe(0);
    });

    it("returns empty for other org", async () => {
      await repos.alertEvents.create({
        orgId: ORG_ID, severity: "warning", title: "Org A",
        conditionType: "run_failed", resourceType: "run",
      });

      const result = await mc.listAlerts(OTHER_ORG_ID);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.length).toBe(0);
    });
  });

  describe("acknowledgeAlert", () => {
    it("acknowledges an open alert", async () => {
      const alert = await repos.alertEvents.create({
        orgId: ORG_ID, severity: "warning", title: "To ack",
        conditionType: "run_failed", resourceType: "run",
      });

      const result = await mc.acknowledgeAlert(alert.id, ORG_ID, USER_ID);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe("acknowledged");
        expect(result.value.acknowledgedBy).toBe(USER_ID);
      }
    });

    it("emits alert.acknowledged audit event", async () => {
      const alert = await repos.alertEvents.create({
        orgId: ORG_ID, severity: "warning", title: "Audit test",
        conditionType: "run_failed", resourceType: "run",
      });

      await mc.acknowledgeAlert(alert.id, ORG_ID, USER_ID);

      const events = await repos.audit.query(ORG_ID, { action: "alert.acknowledged" });
      expect(events.length).toBe(1);
    });

    it("returns NOT_FOUND for nonexistent alert", async () => {
      const result = await mc.acknowledgeAlert(
        toAlertEventId("nonexistent"), ORG_ID, USER_ID,
      );
      expect(result.ok).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Alert generation
  // -----------------------------------------------------------------------

  describe("generateAlerts", () => {
    it("generates alert for failed run", async () => {
      await createTestRun(repos, {
        status: "failed",
        error: { code: "ERR", message: "something broke" },
      });

      await mc.generateAlerts(ORG_ID);

      const alerts = await repos.alertEvents.listForOrg(ORG_ID, { conditionType: "run_failed" });
      expect(alerts.length).toBe(1);
      expect(alerts[0]!.severity).toBe("warning");
    });

    it("does not duplicate alerts for same failed run", async () => {
      await createTestRun(repos, { status: "failed" });

      await mc.generateAlerts(ORG_ID);
      await mc.generateAlerts(ORG_ID);

      const alerts = await repos.alertEvents.listForOrg(ORG_ID, { conditionType: "run_failed" });
      expect(alerts.length).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Permission tests
  // -----------------------------------------------------------------------

  describe("observability permissions", () => {
    it("observability:read is available to all roles", async () => {
      const { hasPermission } = await import("@sovereign/core");
      for (const role of ["org_owner", "org_admin", "org_member", "org_billing_admin", "org_security_admin"] as const) {
        expect(hasPermission(role, "observability:read")).toBe(true);
      }
    });

    it("observability:alerts requires elevated role", async () => {
      const { hasPermission } = await import("@sovereign/core");
      expect(hasPermission("org_owner", "observability:alerts")).toBe(true);
      expect(hasPermission("org_admin", "observability:alerts")).toBe(true);
      expect(hasPermission("org_security_admin", "observability:alerts")).toBe(true);
      expect(hasPermission("org_member", "observability:alerts")).toBe(false);
      expect(hasPermission("org_billing_admin", "observability:alerts")).toBe(false);
    });
  });
});
