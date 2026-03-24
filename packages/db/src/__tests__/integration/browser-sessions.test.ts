/**
 * Browser Session PostgreSQL integration tests — Phase 7.
 *
 * Tests PgBrowserSessionRepo against a real PostgreSQL database.
 * Validates CRUD operations, state transitions, tenant isolation,
 * and audit event persistence for browser sessions.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  toOrgId,
  toUserId,
  toRunId,
  toAgentId,
  toProjectId,
  toAgentVersionId,
  toISODateString,
} from "@sovereign/core";
import type { OrgId, UserId, RunId, AgentId, ProjectId, AgentVersionId } from "@sovereign/core";
import { PgBrowserSessionRepo } from "../../repositories/pg-browser-session.repo.js";
import { PgAuditRepo } from "../../repositories/pg-audit.repo.js";
import { setupTestDb, teardownTestDb, getTestDb } from "./db-test-harness.js";

const ORG_A = toOrgId("a0000000-0000-0000-0000-000000000001");
const ORG_B = toOrgId("b0000000-0000-0000-0000-000000000002");
const USER_A = toUserId("a0000000-0000-0000-0000-000000000010");
const USER_B = toUserId("b0000000-0000-0000-0000-000000000020");

let runIdA: RunId;
let agentIdA: AgentId;
let projectIdA: ProjectId;

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

async function ensureOrg(orgId: OrgId, slug: string): Promise<void> {
  const unscoped = getTestDb().unscoped();
  await unscoped.transaction(async (tx) => {
    const existing = await tx.queryOne("SELECT id FROM organizations WHERE id = $1", [orgId]);
    if (!existing) {
      await tx.execute(
        "INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)",
        [orgId, `Org ${slug}`, slug],
      );
    }
  });
}

async function ensureUser(userId: UserId, email: string): Promise<void> {
  const unscoped = getTestDb().unscoped();
  await unscoped.transaction(async (tx) => {
    const existing = await tx.queryOne("SELECT id FROM users WHERE id = $1", [userId]);
    if (!existing) {
      await tx.execute(
        "INSERT INTO users (id, email, name) VALUES ($1, $2, $3)",
        [userId, email, `User ${email}`],
      );
    }
  });
}

async function ensureProject(projectId: ProjectId, orgId: OrgId, slug: string): Promise<void> {
  const unscoped = getTestDb().unscoped();
  await unscoped.transactionWithOrg(orgId, async (tx) => {
    const existing = await tx.queryOne("SELECT id FROM projects WHERE id = $1", [projectId]);
    if (!existing) {
      await tx.execute(
        "INSERT INTO projects (id, org_id, name, slug) VALUES ($1, $2, $3, $4)",
        [projectId, orgId, `Project ${slug}`, slug],
      );
    }
  });
}

async function ensureAgent(agentId: AgentId, orgId: OrgId, projectId: ProjectId, userId: UserId): Promise<void> {
  const unscoped = getTestDb().unscoped();
  await unscoped.transactionWithOrg(orgId, async (tx) => {
    const existing = await tx.queryOne("SELECT id FROM agents WHERE id = $1", [agentId]);
    if (!existing) {
      await tx.execute(
        "INSERT INTO agents (id, org_id, project_id, name, slug, created_by) VALUES ($1, $2, $3, $4, $5, $6)",
        [agentId, orgId, projectId, "Browser Agent", "browser-agent", userId],
      );
    }
  });
}

async function ensureAgentVersion(versionId: AgentVersionId, orgId: OrgId, agentId: AgentId, userId: UserId): Promise<void> {
  const unscoped = getTestDb().unscoped();
  await unscoped.transactionWithOrg(orgId, async (tx) => {
    const existing = await tx.queryOne("SELECT id FROM agent_versions WHERE id = $1", [versionId]);
    if (!existing) {
      await tx.execute(
        `INSERT INTO agent_versions (id, org_id, agent_id, version, goals, instructions, tools, approval_rules, model_config, created_by)
         VALUES ($1, $2, $3, 1, '[]', 'test', '[]', '[]', '{"provider":"local","model":"test"}', $4)`,
        [versionId, orgId, agentId, userId],
      );
    }
  });
}

async function ensureRun(runId: RunId, orgId: OrgId, projectId: ProjectId, agentId: AgentId, versionId: AgentVersionId, userId: UserId): Promise<void> {
  const unscoped = getTestDb().unscoped();
  await unscoped.transactionWithOrg(orgId, async (tx) => {
    const existing = await tx.queryOne("SELECT id FROM runs WHERE id = $1", [runId]);
    if (!existing) {
      await tx.execute(
        `INSERT INTO runs (id, org_id, project_id, agent_id, agent_version_id, triggered_by, input, config_snapshot)
         VALUES ($1, $2, $3, $4, $5, $6, '{}', '{}')`,
        [runId, orgId, projectId, agentId, versionId, userId],
      );
    }
  });
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await setupTestDb();

  // Ensure test orgs, users, and prerequisite data exist
  await ensureOrg(ORG_A, "browser-test-a");
  await ensureOrg(ORG_B, "browser-test-b");
  await ensureUser(USER_A, "browser-a@test.com");
  await ensureUser(USER_B, "browser-b@test.com");

  projectIdA = toProjectId("a0000000-0000-0000-0000-000000000100");
  agentIdA = toAgentId("a0000000-0000-0000-0000-000000000200");
  const versionId = toAgentVersionId("a0000000-0000-0000-0000-000000000300");
  runIdA = toRunId("a0000000-0000-0000-0000-000000000400");

  await ensureProject(projectIdA, ORG_A, "browser-proj-a");
  await ensureAgent(agentIdA, ORG_A, projectIdA, USER_A);
  await ensureAgentVersion(versionId, ORG_A, agentIdA, USER_A);
  await ensureRun(runIdA, ORG_A, projectIdA, agentIdA, versionId, USER_A);
}, 30_000);

afterAll(async () => {
  // Clean up test data — per-org due to FORCE RLS
  await teardownTestDb();
}, 30_000);

beforeEach(async () => {
  const unscoped = getTestDb().unscoped();
  for (const orgId of [ORG_A, ORG_B]) {
    await unscoped.transactionWithOrg(orgId, async (tx) => {
      await tx.execute("DELETE FROM browser_sessions WHERE org_id = $1", [orgId]);
    });
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PgBrowserSessionRepo integration", () => {
  describe("create and retrieve", () => {
    it("creates a browser session and retrieves it", async () => {
      const tenantDb = getTestDb().forTenant(ORG_A);
      const repo = new PgBrowserSessionRepo(tenantDb);

      const session = await repo.create({
        orgId: ORG_A,
        runId: runIdA,
        agentId: agentIdA,
        createdBy: USER_A,
      });

      expect(session.id).toBeDefined();
      expect(session.orgId).toBe(ORG_A);
      expect(session.runId).toBe(runIdA);
      expect(session.status).toBe("provisioning");
      expect(session.browserType).toBe("chromium");
      expect(session.humanTakeover).toBe(false);

      const retrieved = await repo.getById(session.id, ORG_A);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(session.id);
    });
  });

  describe("listForOrg", () => {
    it("lists sessions with filters", async () => {
      const tenantDb = getTestDb().forTenant(ORG_A);
      const repo = new PgBrowserSessionRepo(tenantDb);

      await repo.create({ orgId: ORG_A, runId: runIdA, agentId: agentIdA, createdBy: USER_A });
      await repo.create({ orgId: ORG_A, runId: runIdA, agentId: agentIdA, createdBy: USER_A });

      const all = await repo.listForOrg(ORG_A);
      expect(all.length).toBe(2);

      const filtered = await repo.listForOrg(ORG_A, { status: "active" });
      expect(filtered.length).toBe(0);

      const byRun = await repo.listForOrg(ORG_A, { runId: runIdA });
      expect(byRun.length).toBe(2);
    });
  });

  describe("updateStatus", () => {
    it("updates status and extras", async () => {
      const tenantDb = getTestDb().forTenant(ORG_A);
      const repo = new PgBrowserSessionRepo(tenantDb);

      const session = await repo.create({ orgId: ORG_A, runId: runIdA, agentId: agentIdA, createdBy: USER_A });

      const updated = await repo.updateStatus(session.id, ORG_A, "ready", {
        startedAt: toISODateString(new Date()),
      });

      expect(updated).not.toBeNull();
      expect(updated!.status).toBe("ready");
      expect(updated!.startedAt).not.toBeNull();
    });

    it("updates takeover fields", async () => {
      const tenantDb = getTestDb().forTenant(ORG_A);
      const repo = new PgBrowserSessionRepo(tenantDb);

      const session = await repo.create({ orgId: ORG_A, runId: runIdA, agentId: agentIdA, createdBy: USER_A });
      await repo.updateStatus(session.id, ORG_A, "ready");
      await repo.updateStatus(session.id, ORG_A, "active");

      const takeover = await repo.updateStatus(session.id, ORG_A, "human_control", {
        humanTakeover: true,
        takeoverBy: USER_A,
      });

      expect(takeover!.humanTakeover).toBe(true);
      expect(takeover!.takeoverBy).toBe(USER_A);
    });
  });

  describe("tenant isolation", () => {
    it("org B cannot see org A's browser sessions", async () => {
      const tenantDbA = getTestDb().forTenant(ORG_A);
      const repoA = new PgBrowserSessionRepo(tenantDbA);

      const session = await repoA.create({ orgId: ORG_A, runId: runIdA, agentId: agentIdA, createdBy: USER_A });

      // Org B tries to read
      const tenantDbB = getTestDb().forTenant(ORG_B);
      const repoB = new PgBrowserSessionRepo(tenantDbB);

      const retrieved = await repoB.getById(session.id, ORG_B);
      expect(retrieved).toBeNull();

      const listed = await repoB.listForOrg(ORG_B);
      expect(listed.length).toBe(0);
    });

    it("org B cannot update org A's sessions", async () => {
      const tenantDbA = getTestDb().forTenant(ORG_A);
      const repoA = new PgBrowserSessionRepo(tenantDbA);

      const session = await repoA.create({ orgId: ORG_A, runId: runIdA, agentId: agentIdA, createdBy: USER_A });

      const tenantDbB = getTestDb().forTenant(ORG_B);
      const repoB = new PgBrowserSessionRepo(tenantDbB);

      const result = await repoB.updateStatus(session.id, ORG_B, "failed");
      expect(result).toBeNull();
    });

    it("org B cannot delete org A's sessions", async () => {
      const tenantDbA = getTestDb().forTenant(ORG_A);
      const repoA = new PgBrowserSessionRepo(tenantDbA);

      const session = await repoA.create({ orgId: ORG_A, runId: runIdA, agentId: agentIdA, createdBy: USER_A });

      const tenantDbB = getTestDb().forTenant(ORG_B);
      const repoB = new PgBrowserSessionRepo(tenantDbB);

      const deleted = await repoB.delete(session.id, ORG_B);
      expect(deleted).toBe(false);

      // Verify still exists for org A
      const still = await repoA.getById(session.id, ORG_A);
      expect(still).not.toBeNull();
    });
  });

  describe("delete", () => {
    it("deletes a browser session", async () => {
      const tenantDb = getTestDb().forTenant(ORG_A);
      const repo = new PgBrowserSessionRepo(tenantDb);

      const session = await repo.create({ orgId: ORG_A, runId: runIdA, agentId: agentIdA, createdBy: USER_A });
      const deleted = await repo.delete(session.id, ORG_A);
      expect(deleted).toBe(true);

      const retrieved = await repo.getById(session.id, ORG_A);
      expect(retrieved).toBeNull();
    });
  });

  describe("audit event persistence", () => {
    it("persists browser audit events", async () => {
      const tenantDb = getTestDb().forTenant(ORG_A);
      const auditRepo = new PgAuditRepo(tenantDb);

      await auditRepo.emit({
        orgId: ORG_A,
        actorId: USER_A,
        actorType: "user",
        action: "browser.session_created",
        resourceType: "browser_session",
        resourceId: "a0000000-0000-0000-0000-000000000999",
        metadata: { browserType: "chromium" },
      });

      await auditRepo.emit({
        orgId: ORG_A,
        actorId: USER_A,
        actorType: "user",
        action: "browser.action_blocked",
        resourceType: "browser_session",
        resourceId: "a0000000-0000-0000-0000-000000000999",
        metadata: { actionType: "download_file", reason: "policy_denied" },
      });

      const sessionEvents = await auditRepo.query(ORG_A, {
        action: "browser.session_created",
        resourceType: "browser_session",
      });
      expect(sessionEvents.length).toBeGreaterThanOrEqual(1);

      const blockedEvents = await auditRepo.query(ORG_A, {
        action: "browser.action_blocked",
        resourceType: "browser_session",
      });
      expect(blockedEvents.length).toBeGreaterThanOrEqual(1);
    });
  });
});
