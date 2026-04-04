/**
 * Onboarding, Docs, Support, Admin (service-level contract) — Phase 13 tests.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { toOrgId, toUserId, toProjectId } from "@sovereign/core";
import { PgOnboardingService } from "../../services/onboarding.service.js";
import { PgAuditEmitter } from "../../services/audit.service.js";
import {
  createTestRepos,
  type TestRepos,
} from "../helpers/test-repos.js";

const ORG_A = toOrgId("00000000-0000-0000-0000-aaaaaaaaaaaa");
const ORG_B = toOrgId("00000000-0000-0000-0000-bbbbbbbbbbbb");
const USER_ID = toUserId("00000000-0000-0000-0000-cccccccccccc");
const PROJECT_ID = toProjectId("00000000-0000-0000-0000-ffffffffffff");

describe("Onboarding, Docs, Support, Admin (service-level contract)", () => {
  let repos: TestRepos;
  let svc: PgOnboardingService;

  beforeEach(() => {
    repos = createTestRepos();
    const auditEmitter = new PgAuditEmitter(repos.audit);
    svc = new PgOnboardingService(
      repos.agents, repos.runs, repos.connectorInstalls,
      repos.billingAccounts, repos.policyRepo,
      repos.memberships, repos.projects,
      repos.alertEvents, repos.browserSessions,
      auditEmitter,
      repos.orgs,
    );
  });

  // =========================================================================
  // Onboarding Progress
  // =========================================================================

  describe("Onboarding Progress", () => {
    it("returns initial progress with only org_created completed", async () => {
      const result = await svc.getProgress(ORG_A);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.completedCount).toBe(1); // org_created is always true
      expect(result.value.totalCount).toBe(8);
      expect(result.value.steps.find(s => s.key === "org_created")?.completed).toBe(true);
      expect(result.value.steps.find(s => s.key === "agent_created")?.completed).toBe(false);
    });

    it("reflects agent creation in progress", async () => {
      await repos.agents.create({ orgId: ORG_A, projectId: PROJECT_ID, name: "Agent", slug: "agent", createdBy: USER_ID });
      const result = await svc.getProgress(ORG_A);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.steps.find(s => s.key === "agent_created")?.completed).toBe(true);
      expect(result.value.completedCount).toBe(2); // org + agent
    });

    it("reflects published agent in progress", async () => {
      const agent = await repos.agents.create({ orgId: ORG_A, projectId: PROJECT_ID, name: "Agent", slug: "agent", createdBy: USER_ID });
      await repos.agents.updateStatus(agent.id, ORG_A, "published");
      const result = await svc.getProgress(ORG_A);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.steps.find(s => s.key === "agent_published")?.completed).toBe(true);
    });

    it("reflects connector install in progress", async () => {
      await repos.connectorInstalls.create({ orgId: ORG_A, connectorId: "c1" as import("@sovereign/core").ConnectorId, connectorSlug: "echo", installedBy: USER_ID });
      const result = await svc.getProgress(ORG_A);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.steps.find(s => s.key === "connector_installed")?.completed).toBe(true);
    });

    it("reflects billing account in progress", async () => {
      await repos.billingAccounts.create({ orgId: ORG_A, createdBy: USER_ID });
      const result = await svc.getProgress(ORG_A);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.steps.find(s => s.key === "billing_setup")?.completed).toBe(true);
    });

    it("100% when all steps completed", async () => {
      await repos.projects.create({ orgId: ORG_A, name: "P", slug: "p" });
      const agent = await repos.agents.create({ orgId: ORG_A, projectId: PROJECT_ID, name: "A", slug: "a", createdBy: USER_ID });
      await repos.agents.updateStatus(agent.id, ORG_A, "published");
      const version = await repos.agentVersions.create({ orgId: ORG_A, agentId: agent.id, version: 1, goals: [], instructions: "x", tools: [], budget: null, approvalRules: [], memoryConfig: null, schedule: null, modelConfig: { provider: "local", model: "test" }, createdBy: USER_ID });
      await repos.agentVersions.publish(version.id, ORG_A);
      const run = await repos.runs.create({ orgId: ORG_A, projectId: PROJECT_ID, agentId: agent.id, agentVersionId: version.id, triggerType: "manual", triggeredBy: USER_ID, executionProvider: "local", configSnapshot: {} });
      await repos.runs.updateStatus(run.id, ORG_A, "completed");
      await repos.connectorInstalls.create({ orgId: ORG_A, connectorId: "c1" as import("@sovereign/core").ConnectorId, connectorSlug: "echo", installedBy: USER_ID });
      await repos.billingAccounts.create({ orgId: ORG_A, createdBy: USER_ID });
      await repos.policyRepo.create({ orgId: ORG_A, name: "p", policyType: "access_control", enforcementMode: "allow", scopeType: "org", createdBy: USER_ID });

      const result = await svc.getProgress(ORG_A);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.percentComplete).toBe(100);
      expect(result.value.completedCount).toBe(8);
    });

    it("dismissOnboarding emits audit event", async () => {
      await svc.dismissOnboarding(ORG_A, USER_ID);
      const events = await repos.audit.query(ORG_A, { action: "onboarding.dismissed" as import("@sovereign/core").AuditAction });
      expect(events.length).toBe(1);
    });
  });

  // =========================================================================
  // Docs
  // =========================================================================

  describe("Docs", () => {
    it("lists all doc categories", async () => {
      const result = await svc.listDocs();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.length).toBeGreaterThanOrEqual(10);
      expect(result.value.map(c => c.slug)).toContain("getting-started");
      expect(result.value.map(c => c.slug)).toContain("agents");
      expect(result.value.map(c => c.slug)).toContain("billing");
    });

    it("gets a specific doc article", async () => {
      const result = await svc.getDoc("getting-started-overview");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.title).toBe("Welcome to SOVEREIGN");
      expect(result.value.content).toContain("Quick Start");
    });

    it("returns NOT_FOUND for nonexistent doc", async () => {
      const result = await svc.getDoc("nonexistent-slug");
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  // =========================================================================
  // Support Diagnostics
  // =========================================================================

  describe("Support Diagnostics", () => {
    it("returns diagnostics with platform summary", async () => {
      const result = await svc.getDiagnostics(ORG_A, USER_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.platform.agentCount).toBe(0);
      expect(result.value.platform.runCount).toBe(0);
      expect(result.value.generatedAt).toBeDefined();
    });

    it("includes billing info when present", async () => {
      await repos.billingAccounts.create({ orgId: ORG_A, plan: "team", createdBy: USER_ID });
      const result = await svc.getDiagnostics(ORG_A, USER_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.billing?.plan).toBe("team");
    });

    it("redacts secrets — no tokens or credentials in output", async () => {
      const result = await svc.getDiagnostics(ORG_A, USER_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const json = JSON.stringify(result.value);
      expect(json).not.toContain("token");
      expect(json).not.toContain("secret");
      expect(json).not.toContain("password");
      expect(json).not.toContain("credential");
    });

    it("emits audit event on diagnostics view", async () => {
      await svc.getDiagnostics(ORG_A, USER_ID);
      const events = await repos.audit.query(ORG_A, { action: "support.diagnostics_viewed" as import("@sovereign/core").AuditAction });
      expect(events.length).toBe(1);
    });

    it("diagnostics include onboarding progress", async () => {
      const result = await svc.getDiagnostics(ORG_A, USER_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.onboarding.totalCount).toBe(8);
    });
  });

  // =========================================================================
  // Admin Overview
  // =========================================================================

  describe("Admin Overview", () => {
    it("returns admin overview with counts", async () => {
      await repos.agents.create({ orgId: ORG_A, projectId: PROJECT_ID, name: "Agent", slug: "agent", createdBy: USER_ID });
      const result = await svc.getAdminOverview(ORG_A, USER_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.agentCount).toBe(1);
      expect(result.value.orgId).toBe(ORG_A);
    });

    it("emits audit event on admin view", async () => {
      await svc.getAdminOverview(ORG_A, USER_ID);
      const events = await repos.audit.query(ORG_A, { action: "admin.overview_viewed" as import("@sovereign/core").AuditAction });
      expect(events.length).toBe(1);
    });

    it("returns settings summary", async () => {
      await repos.billingAccounts.create({ orgId: ORG_A, plan: "enterprise", billingEmail: "pay@test.com", createdBy: USER_ID });
      const result = await svc.getSettingsSummary(ORG_A);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.plan).toBe("enterprise");
      expect(result.value.billingEmail).toBe("pay@test.com");
    });
  });

  // =========================================================================
  // Tenant Isolation
  // =========================================================================

  describe("Tenant Isolation", () => {
    it("onboarding progress is org-scoped", async () => {
      await repos.agents.create({ orgId: ORG_A, projectId: PROJECT_ID, name: "A-Agent", slug: "a-agent", createdBy: USER_ID });
      const progressA = await svc.getProgress(ORG_A);
      const progressB = await svc.getProgress(ORG_B);
      expect(progressA.ok).toBe(true);
      expect(progressB.ok).toBe(true);
      if (!progressA.ok || !progressB.ok) return;
      expect(progressA.value.steps.find(s => s.key === "agent_created")?.completed).toBe(true);
      expect(progressB.value.steps.find(s => s.key === "agent_created")?.completed).toBe(false);
    });

    it("admin overview is org-scoped", async () => {
      await repos.agents.create({ orgId: ORG_A, projectId: PROJECT_ID, name: "A-Agent", slug: "a-agent", createdBy: USER_ID });
      const overviewA = await svc.getAdminOverview(ORG_A, USER_ID);
      const overviewB = await svc.getAdminOverview(ORG_B, USER_ID);
      expect(overviewA.ok).toBe(true);
      expect(overviewB.ok).toBe(true);
      if (!overviewA.ok || !overviewB.ok) return;
      expect(overviewA.value.agentCount).toBe(1);
      expect(overviewB.value.agentCount).toBe(0);
    });
  });
});
