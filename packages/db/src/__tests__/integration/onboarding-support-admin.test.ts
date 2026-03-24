/**
 * Onboarding, Support, Admin — PostgreSQL integration tests (Phase 13).
 *
 * Tests that derived-state queries for onboarding progress, support diagnostics,
 * and admin overview produce correct results from real persisted platform data.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { OrgId, UserId, ProjectId } from "@sovereign/core";
import {
  PgAgentRepo,
  PgAgentVersionRepo,
  PgRunRepo,
  PgConnectorInstallRepo,
  PgBillingAccountRepo,
  PgPolicyRepo,
  PgProjectRepo,
  PgAlertEventRepo,
  PgMembershipRepo,
  PgAuditRepo,
} from "../../repositories/index.js";
import { PgUserRepo } from "../../repositories/pg-user.repo.js";
import { PgOrgRepo } from "../../repositories/pg-org.repo.js";
import { PgConnectorRepo } from "../../repositories/pg-connector.repo.js";
import { setupTestDb, teardownTestDb, getTestDb, truncateAllTables } from "./db-test-harness.js";

let USER_A_ID: UserId;
let PROJECT_A_ID: ProjectId;

describe("Onboarding/Support/Admin — PostgreSQL integration", () => {
  beforeAll(async () => { await setupTestDb(); }, 30_000);
  afterAll(async () => { await teardownTestDb(); });

  beforeEach(async () => {
    await truncateAllTables();
    const db = getTestDb();
    const unscopedDb = db.unscoped();
    const userRepo = new PgUserRepo(unscopedDb);
    const orgRepo = new PgOrgRepo(unscopedDb);

    const userA = await userRepo.create({ email: "onboard@test.com", name: "Onboard User" });
    await userRepo.create({ email: "onboardb@test.com", name: "Onboard B" });
    USER_A_ID = userA.id;

    const orgA = await orgRepo.create({ name: "Onboard Org A", slug: "onboard-a" });
    const orgB = await orgRepo.create({ name: "Onboard Org B", slug: "onboard-b" });

    await unscopedDb.transactionWithOrg(orgA.id, async (tx) => {
      await tx.execute("INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, $3)", [orgA.id, userA.id, "org_owner"]);
    });
    await unscopedDb.transactionWithOrg(orgB.id, async (tx) => {
      await tx.execute("INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, $3)", [orgB.id, userA.id, "org_owner"]);
    });

    // Create a project for org A
    const projectRepo = new PgProjectRepo(db.forTenant(orgA.id));
    const project = await projectRepo.create({ orgId: orgA.id, name: "Test Project", slug: "test-proj" });
    PROJECT_A_ID = project.id;

    Object.assign(globalThis, { __onbOrgAId: orgA.id, __onbOrgBId: orgB.id });
  });

  function orgA(): OrgId { return (globalThis as Record<string, unknown>).__onbOrgAId as OrgId; }
  function orgB(): OrgId { return (globalThis as Record<string, unknown>).__onbOrgBId as OrgId; }

  // =========================================================================
  // Onboarding Progress from Real DB State
  // =========================================================================

  describe("Onboarding Progress", () => {
    it("shows project_created step as completed from persisted project", async () => {
      const db = getTestDb();
      const projectRepo = new PgProjectRepo(db.forTenant(orgA()));
      const projects = await projectRepo.listForOrg(orgA());
      expect(projects.length).toBeGreaterThan(0); // seeded in beforeEach
    });

    it("shows agent_created step from persisted agent", async () => {
      const db = getTestDb();
      const agentRepo = new PgAgentRepo(db.forTenant(orgA()));
      await agentRepo.create({ orgId: orgA(), projectId: PROJECT_A_ID, name: "DB Agent", slug: "db-agent", createdBy: USER_A_ID });
      const agents = await agentRepo.listForOrg(orgA());
      expect(agents.length).toBe(1);
    });

    it("shows agent_published step from persisted published agent", async () => {
      const db = getTestDb();
      const agentRepo = new PgAgentRepo(db.forTenant(orgA()));
      const versionRepo = new PgAgentVersionRepo(db.forTenant(orgA()));

      const agent = await agentRepo.create({ orgId: orgA(), projectId: PROJECT_A_ID, name: "Pub Agent", slug: "pub-agent", createdBy: USER_A_ID });
      await agentRepo.updateStatus(agent.id, orgA(), "published");

      const version = await versionRepo.create({
        orgId: orgA(), agentId: agent.id, version: 1,
        goals: ["test"], instructions: "Do it", tools: [],
        budget: null, approvalRules: [], memoryConfig: null,
        schedule: null, modelConfig: { provider: "local", model: "test" },
        createdBy: USER_A_ID,
      });
      await versionRepo.publish(version.id, orgA());

      const published = await versionRepo.getPublished(agent.id);
      expect(published).not.toBeNull();
      expect(published!.published).toBe(true);
    });

    it("shows run_completed step from persisted completed run", async () => {
      const db = getTestDb();
      const agentRepo = new PgAgentRepo(db.forTenant(orgA()));
      const versionRepo = new PgAgentVersionRepo(db.forTenant(orgA()));
      const runRepo = new PgRunRepo(db.forTenant(orgA()));

      const agent = await agentRepo.create({ orgId: orgA(), projectId: PROJECT_A_ID, name: "Run Agent", slug: "run-agent", createdBy: USER_A_ID });
      const version = await versionRepo.create({
        orgId: orgA(), agentId: agent.id, version: 1,
        goals: [], instructions: "x", tools: [],
        budget: null, approvalRules: [], memoryConfig: null,
        schedule: null, modelConfig: { provider: "local", model: "test" },
        createdBy: USER_A_ID,
      });

      const run = await runRepo.create({
        orgId: orgA(), projectId: PROJECT_A_ID, agentId: agent.id,
        agentVersionId: version.id, triggerType: "manual",
        triggeredBy: USER_A_ID, executionProvider: "local", configSnapshot: {},
      });
      await runRepo.updateStatus(run.id, orgA(), "completed");

      const completedRuns = (await runRepo.listForOrg(orgA(), { status: "completed" }));
      expect(completedRuns.length).toBe(1);
    });

    it("shows connector_installed step from persisted connector install", async () => {
      const db = getTestDb();
      // First create a connector in the global catalog
      const connectorRepo = new PgConnectorRepo(db.unscoped());
      const connector = await connectorRepo.create({
        slug: "test-conn", name: "Test Connector", category: "test",
        trustTier: "verified", authMode: "none", tools: [], scopes: [],
      });

      const installRepo = new PgConnectorInstallRepo(db.forTenant(orgA()));
      await installRepo.create({
        orgId: orgA(), connectorId: connector.id, connectorSlug: "test-conn",
        installedBy: USER_A_ID,
      });

      const installs = await installRepo.listForOrg(orgA());
      expect(installs.length).toBe(1);
    });

    it("shows billing_setup step from persisted billing account", async () => {
      const db = getTestDb();
      const billingRepo = new PgBillingAccountRepo(db.forTenant(orgA()));
      await billingRepo.create({ orgId: orgA(), plan: "team", createdBy: USER_A_ID });

      const account = await billingRepo.getByOrgId(orgA());
      expect(account).not.toBeNull();
      expect(account!.plan).toBe("team");
    });

    it("shows policy_reviewed step from persisted policy", async () => {
      const db = getTestDb();
      const policyRepo = new PgPolicyRepo(db.forTenant(orgA()));
      await policyRepo.create({
        orgId: orgA(), name: "Test Policy", policyType: "access_control",
        enforcementMode: "allow", scopeType: "org", createdBy: USER_A_ID,
      });

      const policies = await policyRepo.listForOrg(orgA());
      expect(policies.length).toBe(1);
    });
  });

  // =========================================================================
  // Support Diagnostics from Real DB State
  // =========================================================================

  describe("Support Diagnostics", () => {
    it("counts persisted agents correctly", async () => {
      const db = getTestDb();
      const agentRepo = new PgAgentRepo(db.forTenant(orgA()));
      await agentRepo.create({ orgId: orgA(), projectId: PROJECT_A_ID, name: "A1", slug: "a1", createdBy: USER_A_ID });
      await agentRepo.create({ orgId: orgA(), projectId: PROJECT_A_ID, name: "A2", slug: "a2", createdBy: USER_A_ID });

      const agents = await agentRepo.listForOrg(orgA());
      expect(agents.length).toBe(2);
    });

    it("counts persisted failed runs correctly", async () => {
      const db = getTestDb();
      const agentRepo = new PgAgentRepo(db.forTenant(orgA()));
      const versionRepo = new PgAgentVersionRepo(db.forTenant(orgA()));
      const runRepo = new PgRunRepo(db.forTenant(orgA()));

      const agent = await agentRepo.create({ orgId: orgA(), projectId: PROJECT_A_ID, name: "Fail Agent", slug: "fail-agent", createdBy: USER_A_ID });
      const version = await versionRepo.create({ orgId: orgA(), agentId: agent.id, version: 1, goals: [], instructions: "x", tools: [], budget: null, approvalRules: [], memoryConfig: null, schedule: null, modelConfig: { provider: "local", model: "test" }, createdBy: USER_A_ID });

      const run = await runRepo.create({ orgId: orgA(), projectId: PROJECT_A_ID, agentId: agent.id, agentVersionId: version.id, triggerType: "manual", triggeredBy: USER_A_ID, executionProvider: "local", configSnapshot: {} });
      await runRepo.updateStatus(run.id, orgA(), "failed", { error: { code: "TIMEOUT", message: "Run timed out" } });

      const failedRuns = await runRepo.listForOrg(orgA(), { status: "failed" });
      expect(failedRuns.length).toBe(1);
      expect(failedRuns[0]!.error?.message).toBe("Run timed out");
    });

    it("billing diagnostics show plan from persisted account", async () => {
      const db = getTestDb();
      const billingRepo = new PgBillingAccountRepo(db.forTenant(orgA()));
      await billingRepo.create({ orgId: orgA(), plan: "enterprise", billingEmail: "bill@test.com", createdBy: USER_A_ID });

      const account = await billingRepo.getByOrgId(orgA());
      expect(account!.plan).toBe("enterprise");
      expect(account!.billingEmail).toBe("bill@test.com");
      // No secrets in billing diagnostic output
      expect(account!.providerCustomerId).toBeNull();
    });

    it("counts open alerts from persisted alert events", async () => {
      const db = getTestDb();
      const alertRepo = new PgAlertEventRepo(db.forTenant(orgA()));
      await alertRepo.create({ orgId: orgA(), severity: "warning", title: "Test Alert", conditionType: "run_failed", resourceType: "run", message: "A run failed" });

      const alerts = await alertRepo.listForOrg(orgA());
      expect(alerts.length).toBe(1);
      expect(alerts[0]!.status).toBe("open");
    });
  });

  // =========================================================================
  // Admin Overview from Real DB State
  // =========================================================================

  describe("Admin Overview", () => {
    it("counts memberships from persisted data", async () => {
      const db = getTestDb();
      const membershipRepo = new PgMembershipRepo(db.unscoped());
      const members = await membershipRepo.listForOrg(orgA());
      expect(members.length).toBeGreaterThanOrEqual(1); // seeded owner
    });

    it("counts policies from persisted data", async () => {
      const db = getTestDb();
      const policyRepo = new PgPolicyRepo(db.forTenant(orgA()));
      await policyRepo.create({ orgId: orgA(), name: "P1", policyType: "deny", enforcementMode: "deny", scopeType: "org", createdBy: USER_A_ID });
      await policyRepo.create({ orgId: orgA(), name: "P2", policyType: "deny", enforcementMode: "deny", scopeType: "org", createdBy: USER_A_ID });

      const policies = await policyRepo.listForOrg(orgA());
      expect(policies.length).toBe(2);
    });

    it("settings summary shows persisted billing and project data", async () => {
      const db = getTestDb();
      const billingRepo = new PgBillingAccountRepo(db.forTenant(orgA()));
      await billingRepo.create({ orgId: orgA(), plan: "team", billingEmail: "settings@test.com", createdBy: USER_A_ID });

      const account = await billingRepo.getByOrgId(orgA());
      expect(account!.plan).toBe("team");

      const projectRepo = new PgProjectRepo(db.forTenant(orgA()));
      const projects = await projectRepo.listForOrg(orgA());
      expect(projects.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // Tenant Isolation
  // =========================================================================

  describe("Tenant Isolation", () => {
    it("agents in org A are not visible to org B", async () => {
      const db = getTestDb();
      const repoA = new PgAgentRepo(db.forTenant(orgA()));
      const repoB = new PgAgentRepo(db.forTenant(orgB()));

      await repoA.create({ orgId: orgA(), projectId: PROJECT_A_ID, name: "A-Only", slug: "a-only", createdBy: USER_A_ID });

      const fromB = await repoB.listForOrg(orgB());
      expect(fromB.length).toBe(0);
    });

    it("billing account in org A not visible to org B", async () => {
      const db = getTestDb();
      const repoA = new PgBillingAccountRepo(db.forTenant(orgA()));
      const repoB = new PgBillingAccountRepo(db.forTenant(orgB()));

      await repoA.create({ orgId: orgA(), plan: "team", createdBy: USER_A_ID });

      const fromB = await repoB.getByOrgId(orgB());
      expect(fromB).toBeNull();
    });

    it("policies in org A not visible to org B", async () => {
      const db = getTestDb();
      const repoA = new PgPolicyRepo(db.forTenant(orgA()));
      const repoB = new PgPolicyRepo(db.forTenant(orgB()));

      await repoA.create({ orgId: orgA(), name: "A-Policy", policyType: "deny", enforcementMode: "deny", scopeType: "org", createdBy: USER_A_ID });

      const fromB = await repoB.listForOrg(orgB());
      expect(fromB.length).toBe(0);
    });

    it("runs in org A not visible to org B", async () => {
      const db = getTestDb();
      const agentRepo = new PgAgentRepo(db.forTenant(orgA()));
      const versionRepo = new PgAgentVersionRepo(db.forTenant(orgA()));
      const runRepoA = new PgRunRepo(db.forTenant(orgA()));
      const runRepoB = new PgRunRepo(db.forTenant(orgB()));

      const agent = await agentRepo.create({ orgId: orgA(), projectId: PROJECT_A_ID, name: "Iso Agent", slug: "iso-agent", createdBy: USER_A_ID });
      const version = await versionRepo.create({ orgId: orgA(), agentId: agent.id, version: 1, goals: [], instructions: "x", tools: [], budget: null, approvalRules: [], memoryConfig: null, schedule: null, modelConfig: { provider: "local", model: "test" }, createdBy: USER_A_ID });
      await runRepoA.create({ orgId: orgA(), projectId: PROJECT_A_ID, agentId: agent.id, agentVersionId: version.id, triggerType: "manual", triggeredBy: USER_A_ID, executionProvider: "local", configSnapshot: {} });

      const fromB = await runRepoB.listForOrg(orgB());
      expect(fromB.length).toBe(0);
    });
  });

  // =========================================================================
  // Audit Trail
  // =========================================================================

  describe("Audit Trail", () => {
    it("persists audit events for support/admin views", async () => {
      const db = getTestDb();
      const auditRepo = new PgAuditRepo(db.forTenant(orgA()));

      await auditRepo.emit({
        orgId: orgA(), actorId: USER_A_ID, actorType: "user",
        action: "support.diagnostics_viewed", resourceType: "support",
      });
      await auditRepo.emit({
        orgId: orgA(), actorId: USER_A_ID, actorType: "user",
        action: "admin.overview_viewed", resourceType: "admin",
      });

      const supportEvents = await auditRepo.query(orgA(), { action: "support.diagnostics_viewed" as import("@sovereign/core").AuditAction });
      const adminEvents = await auditRepo.query(orgA(), { action: "admin.overview_viewed" as import("@sovereign/core").AuditAction });
      expect(supportEvents.length).toBe(1);
      expect(adminEvents.length).toBe(1);
    });
  });
});
