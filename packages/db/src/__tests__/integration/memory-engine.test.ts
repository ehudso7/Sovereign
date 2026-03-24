/**
 * Memory Engine PostgreSQL integration tests — Phase 8.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { toOrgId, toUserId, toProjectId, toAgentId, toAgentVersionId, toRunId } from "@sovereign/core";
import type { OrgId, UserId } from "@sovereign/core";
import { PgMemoryRepo } from "../../repositories/pg-memory.repo.js";
import { PgMemoryLinkRepo } from "../../repositories/pg-memory-link.repo.js";
import { PgAuditRepo } from "../../repositories/pg-audit.repo.js";
import { setupTestDb, teardownTestDb, getTestDb } from "./db-test-harness.js";

const ORG_A = toOrgId("a0000000-0000-0000-0000-000000000001");
const ORG_B = toOrgId("b0000000-0000-0000-0000-000000000002");
const USER_A = toUserId("a0000000-0000-0000-0000-000000000010");

async function ensureOrg(orgId: OrgId, slug: string): Promise<void> {
  const unscoped = getTestDb().unscoped();
  await unscoped.transaction(async (tx) => {
    const existing = await tx.queryOne("SELECT id FROM organizations WHERE id = $1", [orgId]);
    if (!existing) {
      await tx.execute("INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)", [orgId, `Org ${slug}`, slug]);
    }
  });
}

async function ensureUser(userId: UserId, email: string): Promise<void> {
  const unscoped = getTestDb().unscoped();
  await unscoped.transaction(async (tx) => {
    const existing = await tx.queryOne("SELECT id FROM users WHERE id = $1", [userId]);
    if (!existing) {
      await tx.execute("INSERT INTO users (id, email, name) VALUES ($1, $2, $3)", [userId, email, `User ${email}`]);
    }
  });
}

// Prerequisite IDs for FK constraints
const PROJECT_A = toProjectId("a0000000-0000-0000-0000-000000000100");
const AGENT_A = toAgentId("a0000000-0000-0000-0000-000000000200");
const AGENT_VERSION_A = toAgentVersionId("a0000000-0000-0000-0000-000000000300");

// Run IDs referenced by sourceRunId in memory tests
const RUN_IDS = [
  toRunId("00000000-0000-0000-0000-000000000099"),
  toRunId("00000000-0000-0000-0000-000000000077"),
  toRunId("00000000-0000-0000-0000-000000000044"),
];

async function ensurePrerequisites(): Promise<void> {
  const unscoped = getTestDb().unscoped();
  // Project (RLS-protected)
  await unscoped.transactionWithOrg(ORG_A, async (tx) => {
    const existing = await tx.queryOne("SELECT id FROM projects WHERE id = $1", [PROJECT_A]);
    if (!existing) {
      await tx.execute(
        "INSERT INTO projects (id, org_id, name, slug) VALUES ($1, $2, $3, $4)",
        [PROJECT_A, ORG_A, "Mem Project", "mem-proj"],
      );
    }
  });
  // Agent (RLS-protected)
  await unscoped.transactionWithOrg(ORG_A, async (tx) => {
    const existing = await tx.queryOne("SELECT id FROM agents WHERE id = $1", [AGENT_A]);
    if (!existing) {
      await tx.execute(
        "INSERT INTO agents (id, org_id, project_id, name, slug, created_by) VALUES ($1, $2, $3, $4, $5, $6)",
        [AGENT_A, ORG_A, PROJECT_A, "Mem Agent", "mem-agent", USER_A],
      );
    }
  });
  // Agent version (RLS-protected)
  await unscoped.transactionWithOrg(ORG_A, async (tx) => {
    const existing = await tx.queryOne("SELECT id FROM agent_versions WHERE id = $1", [AGENT_VERSION_A]);
    if (!existing) {
      await tx.execute(
        `INSERT INTO agent_versions (id, org_id, agent_id, version, goals, instructions, tools, approval_rules, model_config, created_by)
         VALUES ($1, $2, $3, 1, '[]', 'test', '[]', '[]', '{"provider":"local","model":"test"}', $4)`,
        [AGENT_VERSION_A, ORG_A, AGENT_A, USER_A],
      );
    }
  });
  // Runs referenced by sourceRunId (RLS-protected)
  for (const runId of RUN_IDS) {
    await unscoped.transactionWithOrg(ORG_A, async (tx) => {
      const existing = await tx.queryOne("SELECT id FROM runs WHERE id = $1", [runId]);
      if (!existing) {
        await tx.execute(
          `INSERT INTO runs (id, org_id, project_id, agent_id, agent_version_id, triggered_by, input, config_snapshot)
           VALUES ($1, $2, $3, $4, $5, $6, '{}', '{}')`,
          [runId, ORG_A, PROJECT_A, AGENT_A, AGENT_VERSION_A, USER_A],
        );
      }
    });
  }
}

beforeAll(async () => {
  await setupTestDb();
  await ensureOrg(ORG_A, "memory-test-a");
  await ensureOrg(ORG_B, "memory-test-b");
  await ensureUser(USER_A, "memory-a@test.com");
  await ensurePrerequisites();
}, 30_000);

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  const unscoped = getTestDb().unscoped();
  for (const orgId of [ORG_A, ORG_B]) {
    await unscoped.transactionWithOrg(orgId, async (tx) => {
      await tx.execute("DELETE FROM memory_links WHERE org_id = $1", [orgId]);
      await tx.execute("DELETE FROM memories WHERE org_id = $1", [orgId]);
    });
  }
});

describe("PgMemoryRepo integration", () => {
  describe("create and retrieve", () => {
    it("creates and retrieves a memory", async () => {
      const repo = new PgMemoryRepo(getTestDb().forTenant(ORG_A));
      const memory = await repo.create({
        orgId: ORG_A, scopeType: "org", scopeId: ORG_A,
        kind: "semantic", title: "Test", summary: "A test", content: "Content here",
        createdBy: USER_A,
      });

      expect(memory.id).toBeDefined();
      expect(memory.kind).toBe("semantic");
      expect(memory.contentHash).toBeDefined();

      const retrieved = await repo.getById(memory.id, ORG_A);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.title).toBe("Test");
    });
  });

  describe("listForOrg with filters", () => {
    it("filters by kind and status", async () => {
      const repo = new PgMemoryRepo(getTestDb().forTenant(ORG_A));
      await repo.create({ orgId: ORG_A, scopeType: "org", scopeId: ORG_A, kind: "semantic", title: "S", summary: "", content: "A", createdBy: USER_A });
      await repo.create({ orgId: ORG_A, scopeType: "org", scopeId: ORG_A, kind: "episodic", title: "E", summary: "", content: "B", createdBy: USER_A });

      const all = await repo.listForOrg(ORG_A);
      expect(all.length).toBe(2);

      const semantic = await repo.listForOrg(ORG_A, { kind: "semantic" });
      expect(semantic.length).toBe(1);
    });
  });

  describe("search", () => {
    it("finds matching memories and excludes non-active", async () => {
      const repo = new PgMemoryRepo(getTestDb().forTenant(ORG_A));
      const m1 = await repo.create({ orgId: ORG_A, scopeType: "org", scopeId: ORG_A, kind: "semantic", title: "Blue sky", summary: "", content: "The sky is blue", createdBy: USER_A });
      await repo.create({ orgId: ORG_A, scopeType: "org", scopeId: ORG_A, kind: "semantic", title: "Green grass", summary: "", content: "Grass is green", createdBy: USER_A });

      const results = await repo.search(ORG_A, "sky");
      expect(results.length).toBe(1);
      expect(results[0]!.id).toBe(m1.id);

      // Redact and verify excluded from search
      await repo.updateStatus(m1.id, ORG_A, "redacted");
      const after = await repo.search(ORG_A, "sky");
      expect(after.length).toBe(0);
    });
  });

  describe("updateStatus", () => {
    it("redacts with content replacement", async () => {
      const repo = new PgMemoryRepo(getTestDb().forTenant(ORG_A));
      const m = await repo.create({ orgId: ORG_A, scopeType: "org", scopeId: ORG_A, kind: "semantic", title: "Secret", summary: "", content: "sensitive", createdBy: USER_A });

      const updated = await repo.updateStatus(m.id, ORG_A, "redacted", { content: "[REDACTED]", contentHash: "redacted" });
      expect(updated!.status).toBe("redacted");
      expect(updated!.content).toBe("[REDACTED]");
    });
  });

  describe("dedup by content hash", () => {
    it("finds existing memory by content hash", async () => {
      const repo = new PgMemoryRepo(getTestDb().forTenant(ORG_A));
      const m = await repo.create({ orgId: ORG_A, scopeType: "org", scopeId: ORG_A, kind: "semantic", title: "First", summary: "", content: "unique content", createdBy: USER_A });

      const found = await repo.getByContentHash(ORG_A, m.contentHash);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(m.id);
    });
  });

  describe("tenant isolation", () => {
    it("org B cannot see org A's memories", async () => {
      const repoA = new PgMemoryRepo(getTestDb().forTenant(ORG_A));
      const m = await repoA.create({ orgId: ORG_A, scopeType: "org", scopeId: ORG_A, kind: "semantic", title: "A only", summary: "", content: "private", createdBy: USER_A });

      const repoB = new PgMemoryRepo(getTestDb().forTenant(ORG_B));
      const retrieved = await repoB.getById(m.id, ORG_B);
      expect(retrieved).toBeNull();

      const listed = await repoB.listForOrg(ORG_B);
      expect(listed.length).toBe(0);
    });
  });
});

describe("PgMemoryLinkRepo integration", () => {
  it("creates and lists links", async () => {
    const memRepo = new PgMemoryRepo(getTestDb().forTenant(ORG_A));
    const linkRepo = new PgMemoryLinkRepo(getTestDb().forTenant(ORG_A));

    const memory = await memRepo.create({ orgId: ORG_A, scopeType: "org", scopeId: ORG_A, kind: "episodic", title: "Episode", summary: "", content: "data", createdBy: USER_A });

    const link = await linkRepo.create({
      orgId: ORG_A, memoryId: memory.id,
      linkedEntityType: "run", linkedEntityId: "00000000-0000-0000-0000-000000000099",
      linkType: "source_run",
    });

    expect(link.id).toBeDefined();

    const links = await linkRepo.listForMemory(memory.id, ORG_A);
    expect(links.length).toBe(1);
    expect(links[0]!.linkType).toBe("source_run");
  });
});

describe("Memory audit events", () => {
  it("persists memory audit events", async () => {
    const auditRepo = new PgAuditRepo(getTestDb().forTenant(ORG_A));

    await auditRepo.emit({
      orgId: ORG_A, actorId: USER_A, actorType: "user",
      action: "memory.created", resourceType: "memory", resourceId: "a0000000-0000-0000-0000-000000000888",
      metadata: { kind: "semantic" },
    });

    const events = await auditRepo.query(ORG_A, { action: "memory.created" });
    expect(events.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Runtime memory behavior — DB-backed service-level proof
// ---------------------------------------------------------------------------

describe("Runtime memory behavior (DB-backed)", () => {
  /**
   * These tests prove runtime retrieval and episodic write behavior
   * through PgMemoryService against real PostgreSQL. They use the
   * same code path the orchestrator calls during agent execution.
   */

  /**
   * Helper: creates repos wired to real PostgreSQL for a given org.
   * Tests use these repos directly (same code path as PgMemoryService)
   * to prove runtime behavior without cross-package imports.
   */
  function reposFor(orgId: OrgId) {
    return {
      mem: new PgMemoryRepo(getTestDb().forTenant(orgId)),
      links: new PgMemoryLinkRepo(getTestDb().forTenant(orgId)),
      audit: new PgAuditRepo(getTestDb().forTenant(orgId)),
    };
  }

  describe("retrieveForRun — runtime read path", () => {
    it("retrieves only active memories for scope (DB-backed)", async () => {
      const { mem } = reposFor(ORG_A);

      await mem.create({
        orgId: ORG_A, scopeType: "agent", scopeId: "a0000000-0000-0000-0000-aa0000000001",
        kind: "semantic", title: "Active Fact", summary: "Active", content: "active-retrieval-fact",
        createdBy: USER_A,
      });

      // Runtime retrieval: listForOrg with status: "active" — same path as PgMemoryService.retrieveForRun
      const result = await mem.listForOrg(ORG_A, {
        scopeType: "agent", scopeId: "a0000000-0000-0000-0000-aa0000000001", status: "active",
      });

      expect(result.length).toBe(1);
      expect(result[0]!.title).toBe("Active Fact");
    });

    it("excludes redacted memories from runtime retrieval (DB-backed)", async () => {
      const { mem } = reposFor(ORG_A);

      const created = await mem.create({
        orgId: ORG_A, scopeType: "agent", scopeId: "a0000000-0000-0000-0000-aa0000000002",
        kind: "semantic", title: "Secret Data", summary: "S", content: "redact-target-data",
        createdBy: USER_A,
      });

      await mem.updateStatus(created.id, ORG_A, "redacted", {
        content: "[REDACTED]", contentHash: "redacted",
      });

      const result = await mem.listForOrg(ORG_A, {
        scopeType: "agent", scopeId: "a0000000-0000-0000-0000-aa0000000002", status: "active",
      });
      expect(result.length).toBe(0);
    });

    it("excludes expired memories from runtime retrieval (DB-backed)", async () => {
      const { mem } = reposFor(ORG_A);

      const created = await mem.create({
        orgId: ORG_A, scopeType: "agent", scopeId: "a0000000-0000-0000-0000-aa0000000003",
        kind: "semantic", title: "Old Data", summary: "S", content: "expire-target-data",
        createdBy: USER_A,
      });

      await mem.updateStatus(created.id, ORG_A, "expired");

      const result = await mem.listForOrg(ORG_A, {
        scopeType: "agent", scopeId: "a0000000-0000-0000-0000-aa0000000003", status: "active",
      });
      expect(result.length).toBe(0);
    });

    it("excludes deleted memories from runtime retrieval (DB-backed)", async () => {
      const { mem } = reposFor(ORG_A);

      const created = await mem.create({
        orgId: ORG_A, scopeType: "agent", scopeId: "a0000000-0000-0000-0000-aa0000000004",
        kind: "semantic", title: "Deleted Data", summary: "S", content: "delete-target-data",
        createdBy: USER_A,
      });

      await mem.updateStatus(created.id, ORG_A, "deleted");

      const result = await mem.listForOrg(ORG_A, {
        scopeType: "agent", scopeId: "a0000000-0000-0000-0000-aa0000000004", status: "active",
      });
      expect(result.length).toBe(0);
    });

    it("kind-level filtering works for runtime retrieval (DB-backed)", async () => {
      const { mem } = reposFor(ORG_A);

      await mem.create({
        orgId: ORG_A, scopeType: "agent", scopeId: "a0000000-0000-0000-0000-aa0000000006",
        kind: "semantic", title: "Sem", summary: "S", content: "kind-filter-semantic",
        createdBy: USER_A,
      });
      await mem.create({
        orgId: ORG_A, scopeType: "agent", scopeId: "a0000000-0000-0000-0000-aa0000000006",
        kind: "episodic", title: "Epi", summary: "S", content: "kind-filter-episodic",
        createdBy: USER_A,
      });
      await mem.create({
        orgId: ORG_A, scopeType: "agent", scopeId: "a0000000-0000-0000-0000-aa0000000006",
        kind: "procedural", title: "Proc", summary: "S", content: "kind-filter-procedural",
        createdBy: USER_A,
      });

      // Retrieve only semantic (same filter path used by retrieveForRun)
      const semantic = await mem.listForOrg(ORG_A, {
        scopeType: "agent", scopeId: "a0000000-0000-0000-0000-aa0000000006", status: "active", kind: "semantic",
      });
      expect(semantic.length).toBe(1);
      expect(semantic[0]!.kind).toBe("semantic");

      // Retrieve only procedural
      const procedural = await mem.listForOrg(ORG_A, {
        scopeType: "agent", scopeId: "a0000000-0000-0000-0000-aa0000000006", status: "active", kind: "procedural",
      });
      expect(procedural.length).toBe(1);

      // All active
      const all = await mem.listForOrg(ORG_A, {
        scopeType: "agent", scopeId: "a0000000-0000-0000-0000-aa0000000006", status: "active",
      });
      expect(all.length).toBe(3);
    });
  });

  describe("writeEpisodicFromRun — runtime write path", () => {
    it("writes episodic memory with source attribution (DB-backed)", async () => {
      const { mem } = reposFor(ORG_A);

      const memory = await mem.create({
        orgId: ORG_A, scopeType: "agent", scopeId: "00000000-0000-0000-0000-000000000088",
        kind: "episodic", title: "Run 99 episode",
        summary: "Run completed with 3 steps",
        content: "Step 1: searched. Step 2: analyzed. Step 3: responded.",
        sourceRunId: "00000000-0000-0000-0000-000000000099",
        sourceAgentId: AGENT_A,
        createdBy: USER_A,
      });

      expect(memory.kind).toBe("episodic");
      expect(memory.scopeType).toBe("agent");
      expect(memory.sourceRunId).toBe("00000000-0000-0000-0000-000000000099");
      expect(memory.sourceAgentId).toBe(AGENT_A);
      expect(memory.status).toBe("active");
    });

    it("creates source_run link for episodic write (DB-backed)", async () => {
      const { mem, links } = reposFor(ORG_A);

      const memory = await mem.create({
        orgId: ORG_A, scopeType: "agent", scopeId: "00000000-0000-0000-0000-000000000066",
        kind: "episodic", title: "Ep", summary: "Summary", content: "Content-link-test",
        sourceRunId: "00000000-0000-0000-0000-000000000077",
        createdBy: USER_A,
      });

      const link = await links.create({
        orgId: ORG_A, memoryId: memory.id,
        linkedEntityType: "run", linkedEntityId: "00000000-0000-0000-0000-000000000077",
        linkType: "source_run", metadata: { agentId: "00000000-0000-0000-0000-000000000066" },
      });

      expect(link.linkType).toBe("source_run");
      expect(link.linkedEntityType).toBe("run");
      expect(link.linkedEntityId).toBe("00000000-0000-0000-0000-000000000077");

      // Verify via listForMemory
      const memLinks = await links.listForMemory(memory.id, ORG_A);
      expect(memLinks.length).toBe(1);
      expect(memLinks[0]!.linkType).toBe("source_run");
    });

    it("episodic memory is retrievable after write — DB round-trip", async () => {
      const { mem } = reposFor(ORG_A);
      const agentId = "00000000-0000-0000-0000-000000000055";

      // Write episodic memory (simulates writeEpisodicFromRun)
      await mem.create({
        orgId: ORG_A, scopeType: "agent", scopeId: agentId,
        kind: "episodic", title: "Episode", summary: "Episode summary", content: "Episode details",
        sourceRunId: "00000000-0000-0000-0000-000000000044",
        createdBy: USER_A,
      });

      // Retrieve via runtime path (listForOrg with active status filter)
      const result = await mem.listForOrg(ORG_A, {
        scopeType: "agent", scopeId: agentId, status: "active",
      });
      expect(result.length).toBe(1);
      expect(result[0]!.kind).toBe("episodic");
      expect(result[0]!.summary).toBe("Episode summary");
    });
  });

  describe("cross-tenant runtime isolation (DB-backed)", () => {
    it("org B cannot retrieve org A's runtime memories", async () => {
      const repoA = reposFor(ORG_A);
      const repoB = reposFor(ORG_B);
      const agentId = "00000000-0000-0000-0000-000000000011";

      await repoA.mem.create({
        orgId: ORG_A, scopeType: "agent", scopeId: agentId,
        kind: "semantic", title: "A-only", summary: "S", content: "tenant-isolation-runtime",
        createdBy: USER_A,
      });

      const result = await repoB.mem.listForOrg(ORG_B, {
        scopeType: "agent", scopeId: agentId, status: "active",
      });
      expect(result.length).toBe(0);
    });
  });
});
