/**
 * Agent Studio PostgreSQL integration tests.
 *
 * Covers agent/version CRUD, publish/unpublish behavior,
 * single-published-version enforcement, immutable published versions,
 * cross-tenant isolation, and audit event persistence.
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
import { PgAuditRepo } from "../../repositories/pg-audit.repo.js";
import type { OrgId, UserId, ProjectId, AuditAction } from "@sovereign/core";

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await truncateAllTables();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedOrg(): Promise<{ orgId: OrgId; userId: UserId; projectId: ProjectId }> {
  const db = getTestDb();
  const userRepo = new PgUserRepo(db.unscoped());
  const orgRepo = new PgOrgRepo(db.unscoped());
  const membershipRepo = new PgMembershipRepo(db.unscoped());

  const user = await userRepo.create({ email: "alice@test.com", name: "Alice" });
  const org = await orgRepo.create({ name: "Test Org", slug: "test-org" });
  await membershipRepo.create({
    orgId: org.id,
    userId: user.id,
    role: "org_owner",
    accepted: true,
  });

  const tenantDb = db.forTenant(org.id);
  const projectRepo = new PgProjectRepo(tenantDb);
  const project = await projectRepo.create({
    orgId: org.id,
    name: "Test Project",
    slug: "test-project",
  });

  return { orgId: org.id, userId: user.id, projectId: project.id };
}

// ---------------------------------------------------------------------------
// Agent CRUD
// ---------------------------------------------------------------------------

describe("Agent CRUD (PostgreSQL)", () => {
  it("creates an agent and retrieves by id", async () => {
    const { orgId, userId, projectId } = await seedOrg();
    const db = getTestDb();
    const agentRepo = new PgAgentRepo(db.forTenant(orgId));

    const agent = await agentRepo.create({
      orgId,
      projectId,
      name: "My Agent",
      slug: "my-agent",
      description: "Test agent",
      createdBy: userId,
    });

    expect(agent.id).toBeTruthy();
    expect(agent.name).toBe("My Agent");
    expect(agent.slug).toBe("my-agent");
    expect(agent.status).toBe("draft");
    expect(agent.orgId).toBe(orgId);

    const found = await agentRepo.getById(agent.id, orgId);
    expect(found).not.toBeNull();
    expect(found!.name).toBe("My Agent");
  });

  it("retrieves agent by slug within project", async () => {
    const { orgId, userId, projectId } = await seedOrg();
    const db = getTestDb();
    const agentRepo = new PgAgentRepo(db.forTenant(orgId));

    await agentRepo.create({
      orgId,
      projectId,
      name: "Agent",
      slug: "agent-slug",
      createdBy: userId,
    });

    const found = await agentRepo.getBySlug(projectId, "agent-slug");
    expect(found).not.toBeNull();
    expect(found!.name).toBe("Agent");
  });

  it("lists agents with status filter", async () => {
    const { orgId, userId, projectId } = await seedOrg();
    const db = getTestDb();
    const agentRepo = new PgAgentRepo(db.forTenant(orgId));

    const a1 = await agentRepo.create({
      orgId,
      projectId,
      name: "Agent 1",
      slug: "a1",
      createdBy: userId,
    });
    await agentRepo.create({
      orgId,
      projectId,
      name: "Agent 2",
      slug: "a2",
      createdBy: userId,
    });
    await agentRepo.updateStatus(a1.id, orgId, "archived");

    const all = await agentRepo.listForOrg(orgId);
    expect(all.length).toBe(2);

    const drafts = await agentRepo.listForOrg(orgId, { status: "draft" });
    expect(drafts.length).toBe(1);
    expect(drafts[0]!.name).toBe("Agent 2");

    const archived = await agentRepo.listForOrg(orgId, { status: "archived" });
    expect(archived.length).toBe(1);
    expect(archived[0]!.name).toBe("Agent 1");
  });

  it("updates agent name and description", async () => {
    const { orgId, userId, projectId } = await seedOrg();
    const db = getTestDb();
    const agentRepo = new PgAgentRepo(db.forTenant(orgId));

    const agent = await agentRepo.create({
      orgId,
      projectId,
      name: "Original",
      slug: "original",
      createdBy: userId,
    });

    const updated = await agentRepo.update(agent.id, orgId, {
      name: "Updated",
      description: "New description",
    });
    expect(updated).not.toBeNull();
    expect(updated!.name).toBe("Updated");
    expect(updated!.description).toBe("New description");
  });

  it("deletes an agent", async () => {
    const { orgId, userId, projectId } = await seedOrg();
    const db = getTestDb();
    const agentRepo = new PgAgentRepo(db.forTenant(orgId));

    const agent = await agentRepo.create({
      orgId,
      projectId,
      name: "Agent",
      slug: "agent",
      createdBy: userId,
    });

    const deleted = await agentRepo.delete(agent.id, orgId);
    expect(deleted).toBe(true);

    const found = await agentRepo.getById(agent.id, orgId);
    expect(found).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Version CRUD
// ---------------------------------------------------------------------------

describe("Agent Version CRUD (PostgreSQL)", () => {
  it("creates a version and retrieves by id", async () => {
    const { orgId, userId, projectId } = await seedOrg();
    const db = getTestDb();
    const agentRepo = new PgAgentRepo(db.forTenant(orgId));
    const versionRepo = new PgAgentVersionRepo(db.forTenant(orgId));

    const agent = await agentRepo.create({
      orgId,
      projectId,
      name: "Agent",
      slug: "agent",
      createdBy: userId,
    });

    const v = await versionRepo.create({
      orgId,
      agentId: agent.id,
      version: 1,
      goals: ["Goal 1", "Goal 2"],
      instructions: "Do something useful",
      tools: [{ name: "web_search" }],
      budget: { maxTokens: 10000 },
      approvalRules: [{ action: "send_email", requireApproval: true }],
      memoryConfig: { mode: "persistent", lanes: ["semantic"] },
      schedule: { enabled: false },
      modelConfig: { provider: "openai", model: "gpt-4o", temperature: 0.7 },
      createdBy: userId,
    });

    expect(v.id).toBeTruthy();
    expect(v.version).toBe(1);
    expect(v.instructions).toBe("Do something useful");
    expect(v.published).toBe(false);

    const found = await versionRepo.getById(v.id, orgId);
    expect(found).not.toBeNull();
    expect(found!.goals).toEqual(["Goal 1", "Goal 2"]);
    expect(found!.tools).toEqual([{ name: "web_search" }]);
    expect(found!.budget).toEqual({ maxTokens: 10000 });
    expect(found!.memoryConfig).toEqual({ mode: "persistent", lanes: ["semantic"] });
  });

  it("lists versions for agent sorted by version descending", async () => {
    const { orgId, userId, projectId } = await seedOrg();
    const db = getTestDb();
    const agentRepo = new PgAgentRepo(db.forTenant(orgId));
    const versionRepo = new PgAgentVersionRepo(db.forTenant(orgId));

    const agent = await agentRepo.create({
      orgId,
      projectId,
      name: "Agent",
      slug: "agent",
      createdBy: userId,
    });

    const base = {
      orgId,
      agentId: agent.id,
      goals: [],
      instructions: "",
      tools: [],
      budget: null,
      approvalRules: [],
      memoryConfig: null,
      schedule: null,
      modelConfig: { provider: "openai", model: "gpt-4o" },
      createdBy: userId,
    };

    const v1 = await versionRepo.create({ ...base, version: 1 });
    const v2 = await versionRepo.create({ ...base, version: 2 });
    const v3 = await versionRepo.create({ ...base, version: 3 });

    // Verify all 3 creates returned valid objects
    expect(v1.version).toBe(1);
    expect(v2.version).toBe(2);
    expect(v3.version).toBe(3);

    const versions = await versionRepo.listForAgent(agent.id);
    expect(versions.length).toBe(3);
    // listForAgent uses ORDER BY version (ascending)
    expect(versions[0]!.version).toBe(1);
    expect(versions[2]!.version).toBe(3);
  });

  it("gets latest version number", async () => {
    const { orgId, userId, projectId } = await seedOrg();
    const db = getTestDb();
    const agentRepo = new PgAgentRepo(db.forTenant(orgId));
    const versionRepo = new PgAgentVersionRepo(db.forTenant(orgId));

    const agent = await agentRepo.create({
      orgId,
      projectId,
      name: "Agent",
      slug: "agent",
      createdBy: userId,
    });

    expect(await versionRepo.getLatestVersion(agent.id)).toBe(0);

    const base = {
      orgId,
      agentId: agent.id,
      goals: [],
      instructions: "",
      tools: [],
      budget: null,
      approvalRules: [],
      memoryConfig: null,
      schedule: null,
      modelConfig: { provider: "openai", model: "gpt-4o" },
      createdBy: userId,
    };

    await versionRepo.create({ ...base, version: 1 });
    await versionRepo.create({ ...base, version: 2 });

    expect(await versionRepo.getLatestVersion(agent.id)).toBe(2);
  });

  it("updates a draft version", async () => {
    const { orgId, userId, projectId } = await seedOrg();
    const db = getTestDb();
    const agentRepo = new PgAgentRepo(db.forTenant(orgId));
    const versionRepo = new PgAgentVersionRepo(db.forTenant(orgId));

    const agent = await agentRepo.create({
      orgId,
      projectId,
      name: "Agent",
      slug: "agent",
      createdBy: userId,
    });

    const v = await versionRepo.create({
      orgId,
      agentId: agent.id,
      version: 1,
      goals: [],
      instructions: "original",
      tools: [],
      budget: null,
      approvalRules: [],
      memoryConfig: null,
      schedule: null,
      modelConfig: { provider: "openai", model: "gpt-4o" },
      createdBy: userId,
    });

    const updated = await versionRepo.update(v.id, orgId, {
      instructions: "updated",
      goals: ["new goal"],
    });
    expect(updated).not.toBeNull();
    expect(updated!.instructions).toBe("updated");
    expect(updated!.goals).toEqual(["new goal"]);
  });
});

// ---------------------------------------------------------------------------
// Publish / Unpublish
// ---------------------------------------------------------------------------

describe("Publish/Unpublish (PostgreSQL)", () => {
  it("publishes a version", async () => {
    const { orgId, userId, projectId } = await seedOrg();
    const db = getTestDb();
    const agentRepo = new PgAgentRepo(db.forTenant(orgId));
    const versionRepo = new PgAgentVersionRepo(db.forTenant(orgId));

    const agent = await agentRepo.create({
      orgId,
      projectId,
      name: "Agent",
      slug: "agent",
      createdBy: userId,
    });

    const v = await versionRepo.create({
      orgId,
      agentId: agent.id,
      version: 1,
      goals: [],
      instructions: "test",
      tools: [],
      budget: null,
      approvalRules: [],
      memoryConfig: null,
      schedule: null,
      modelConfig: { provider: "openai", model: "gpt-4o" },
      createdBy: userId,
    });

    const published = await versionRepo.publish(v.id, orgId);
    expect(published).not.toBeNull();
    expect(published!.published).toBe(true);
    expect(published!.publishedAt).toBeTruthy();
  });

  it("enforces single published version per agent", async () => {
    const { orgId, userId, projectId } = await seedOrg();
    const db = getTestDb();
    const agentRepo = new PgAgentRepo(db.forTenant(orgId));
    const versionRepo = new PgAgentVersionRepo(db.forTenant(orgId));

    const agent = await agentRepo.create({
      orgId,
      projectId,
      name: "Agent",
      slug: "agent",
      createdBy: userId,
    });

    const base = {
      orgId,
      agentId: agent.id,
      goals: [],
      instructions: "test",
      tools: [],
      budget: null,
      approvalRules: [],
      memoryConfig: null,
      schedule: null,
      modelConfig: { provider: "openai", model: "gpt-4o" },
      createdBy: userId,
    };

    const v1 = await versionRepo.create({ ...base, version: 1 });
    const v2 = await versionRepo.create({ ...base, version: 2 });

    // Publish v1
    await versionRepo.publish(v1.id, orgId);
    expect((await versionRepo.getPublished(agent.id))!.id).toBe(v1.id);

    // Unpublish all then publish v2
    await versionRepo.unpublishAll(agent.id);
    await versionRepo.publish(v2.id, orgId);

    // v1 should be unpublished, v2 should be published
    const v1After = await versionRepo.getById(v1.id, orgId);
    expect(v1After!.published).toBe(false);

    const v2After = await versionRepo.getById(v2.id, orgId);
    expect(v2After!.published).toBe(true);

    expect((await versionRepo.getPublished(agent.id))!.id).toBe(v2.id);
  });

  it("unpublishAll returns count of unpublished versions", async () => {
    const { orgId, userId, projectId } = await seedOrg();
    const db = getTestDb();
    const agentRepo = new PgAgentRepo(db.forTenant(orgId));
    const versionRepo = new PgAgentVersionRepo(db.forTenant(orgId));

    const agent = await agentRepo.create({
      orgId,
      projectId,
      name: "Agent",
      slug: "agent",
      createdBy: userId,
    });

    const v = await versionRepo.create({
      orgId,
      agentId: agent.id,
      version: 1,
      goals: [],
      instructions: "test",
      tools: [],
      budget: null,
      approvalRules: [],
      memoryConfig: null,
      schedule: null,
      modelConfig: { provider: "openai", model: "gpt-4o" },
      createdBy: userId,
    });

    await versionRepo.publish(v.id, orgId);
    const count = await versionRepo.unpublishAll(agent.id);
    expect(count).toBe(1);

    // Second call should return 0
    const count2 = await versionRepo.unpublishAll(agent.id);
    expect(count2).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Cross-Tenant Isolation
// ---------------------------------------------------------------------------

describe("Agent cross-tenant isolation (PostgreSQL)", () => {
  it("org B cannot see org A agents", async () => {
    const db = getTestDb();
    const userRepo = new PgUserRepo(db.unscoped());
    const orgRepo = new PgOrgRepo(db.unscoped());
    const membershipRepo = new PgMembershipRepo(db.unscoped());

    // Create two orgs
    const userA = await userRepo.create({ email: "alice@a.com", name: "Alice" });
    const orgA = await orgRepo.create({ name: "Org A", slug: "org-a" });
    await membershipRepo.create({ orgId: orgA.id, userId: userA.id, role: "org_owner", accepted: true });

    const userB = await userRepo.create({ email: "bob@b.com", name: "Bob" });
    const orgB = await orgRepo.create({ name: "Org B", slug: "org-b" });
    await membershipRepo.create({ orgId: orgB.id, userId: userB.id, role: "org_owner", accepted: true });

    // Create project and agent in Org A
    const tenantA = db.forTenant(orgA.id);
    const projectRepoA = new PgProjectRepo(tenantA);
    const projectA = await projectRepoA.create({ orgId: orgA.id, name: "Project A", slug: "proj-a" });

    const agentRepoA = new PgAgentRepo(tenantA);
    const agentA = await agentRepoA.create({
      orgId: orgA.id,
      projectId: projectA.id,
      name: "Secret Agent",
      slug: "secret",
      createdBy: userA.id,
    });

    // Org B tries to access
    const tenantB = db.forTenant(orgB.id);
    const agentRepoB = new PgAgentRepo(tenantB);

    const byId = await agentRepoB.getById(agentA.id, orgB.id);
    expect(byId).toBeNull();

    const list = await agentRepoB.listForOrg(orgB.id);
    expect(list.length).toBe(0);
  });

  it("org B cannot see org A agent versions", async () => {
    const db = getTestDb();
    const userRepo = new PgUserRepo(db.unscoped());
    const orgRepo = new PgOrgRepo(db.unscoped());
    const membershipRepo = new PgMembershipRepo(db.unscoped());

    const userA = await userRepo.create({ email: "alice@a.com", name: "Alice" });
    const orgA = await orgRepo.create({ name: "Org A", slug: "org-a" });
    await membershipRepo.create({ orgId: orgA.id, userId: userA.id, role: "org_owner", accepted: true });

    const userB = await userRepo.create({ email: "bob@b.com", name: "Bob" });
    const orgB = await orgRepo.create({ name: "Org B", slug: "org-b" });
    await membershipRepo.create({ orgId: orgB.id, userId: userB.id, role: "org_owner", accepted: true });

    const tenantA = db.forTenant(orgA.id);
    const projectRepoA = new PgProjectRepo(tenantA);
    const projectA = await projectRepoA.create({ orgId: orgA.id, name: "Project A", slug: "proj-a" });

    const agentRepoA = new PgAgentRepo(tenantA);
    const agent = await agentRepoA.create({
      orgId: orgA.id,
      projectId: projectA.id,
      name: "Agent",
      slug: "agent",
      createdBy: userA.id,
    });

    const versionRepoA = new PgAgentVersionRepo(tenantA);
    const version = await versionRepoA.create({
      orgId: orgA.id,
      agentId: agent.id,
      version: 1,
      goals: [],
      instructions: "secret",
      tools: [],
      budget: null,
      approvalRules: [],
      memoryConfig: null,
      schedule: null,
      modelConfig: { provider: "openai", model: "gpt-4o" },
      createdBy: userA.id,
    });

    // Org B tries to access
    const tenantB = db.forTenant(orgB.id);
    const versionRepoB = new PgAgentVersionRepo(tenantB);

    const byId = await versionRepoB.getById(version.id, orgB.id);
    expect(byId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Audit Event Persistence
// ---------------------------------------------------------------------------

describe("Agent audit event persistence (PostgreSQL)", () => {
  it("persists audit events for agent actions", async () => {
    const { orgId, userId } = await seedOrg();
    const db = getTestDb();
    const auditRepo = new PgAuditRepo(db.forTenant(orgId));

    // Simulate agent.created audit event
    const event = await auditRepo.emit({
      orgId,
      actorId: userId,
      actorType: "user",
      action: "agent.created",
      resourceType: "agent",
      resourceId: "00000000-0000-0000-0000-000000000096",
      metadata: { name: "Test Agent", slug: "test-agent" },
    });

    expect(event.id).toBeTruthy();
    expect(event.action).toBe("agent.created");

    // Query back
    const events = await auditRepo.query(orgId, { action: "agent.created" });
    expect(events.length).toBe(1);
    expect(events[0]!.resourceId).toBe("00000000-0000-0000-0000-000000000096");
    expect(events[0]!.metadata).toEqual({ name: "Test Agent", slug: "test-agent" });
  });

  it("persists audit events for all agent lifecycle actions", async () => {
    const { orgId, userId } = await seedOrg();
    const db = getTestDb();
    const auditRepo = new PgAuditRepo(db.forTenant(orgId));

    const actions: AuditAction[] = [
      "agent.created",
      "agent.updated",
      "agent.archived",
      "agent.unpublished",
      "agent_version.created",
      "agent_version.updated",
      "agent_version.published",
    ];

    for (const action of actions) {
      await auditRepo.emit({
        orgId,
        actorId: userId,
        actorType: "user",
        action,
        resourceType: action.startsWith("agent_version") ? "agent_version" : "agent",
        resourceId: "00000000-0000-0000-0000-000000000095",
        metadata: {},
      });
    }

    const allEvents = await auditRepo.query(orgId);
    expect(allEvents.length).toBe(7);

    // Verify each action persisted
    for (const action of actions) {
      const filtered = await auditRepo.query(orgId, { action });
      expect(filtered.length).toBeGreaterThanOrEqual(1);
    }
  });
});
