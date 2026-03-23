/**
 * Memory Engine PostgreSQL integration tests — Phase 8.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { toOrgId, toUserId } from "@sovereign/core";
import type { OrgId, UserId } from "@sovereign/core";
import { DatabaseClient } from "../../client.js";
import { PgMemoryRepo } from "../../repositories/pg-memory.repo.js";
import { PgMemoryLinkRepo } from "../../repositories/pg-memory-link.repo.js";
import { PgAuditRepo } from "../../repositories/pg-audit.repo.js";

const DB_URL = process.env.DATABASE_URL ?? "postgresql://sovereign:sovereign_dev@localhost:5432/sovereign";

let db: DatabaseClient;

const ORG_A = toOrgId("a0000000-0000-0000-0000-000000000001");
const ORG_B = toOrgId("b0000000-0000-0000-0000-000000000002");
const USER_A = toUserId("a0000000-0000-0000-0000-000000000010");

async function ensureOrg(orgId: OrgId, slug: string): Promise<void> {
  const unscoped = db.unscoped();
  await unscoped.transaction(async (tx) => {
    const existing = await tx.queryOne("SELECT id FROM organizations WHERE id = $1", [orgId]);
    if (!existing) {
      await tx.execute("INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)", [orgId, `Org ${slug}`, slug]);
    }
  });
}

async function ensureUser(userId: UserId, email: string): Promise<void> {
  const unscoped = db.unscoped();
  await unscoped.transaction(async (tx) => {
    const existing = await tx.queryOne("SELECT id FROM users WHERE id = $1", [userId]);
    if (!existing) {
      await tx.execute("INSERT INTO users (id, email, name) VALUES ($1, $2, $3)", [userId, email, `User ${email}`]);
    }
  });
}

beforeAll(async () => {
  db = new DatabaseClient({ url: DB_URL, maxConnections: 3 });
  await ensureOrg(ORG_A, "memory-test-a");
  await ensureOrg(ORG_B, "memory-test-b");
  await ensureUser(USER_A, "memory-a@test.com");
});

afterAll(async () => {
  const unscoped = db.unscoped();
  await unscoped.transaction(async (tx) => {
    await tx.execute("DELETE FROM memory_links WHERE org_id IN ($1, $2)", [ORG_A, ORG_B]);
    await tx.execute("DELETE FROM memories WHERE org_id IN ($1, $2)", [ORG_A, ORG_B]);
  });
  await db.destroy();
});

beforeEach(async () => {
  const unscoped = db.unscoped();
  await unscoped.transaction(async (tx) => {
    await tx.execute("DELETE FROM memory_links WHERE org_id IN ($1, $2)", [ORG_A, ORG_B]);
    await tx.execute("DELETE FROM memories WHERE org_id IN ($1, $2)", [ORG_A, ORG_B]);
  });
});

describe("PgMemoryRepo integration", () => {
  describe("create and retrieve", () => {
    it("creates and retrieves a memory", async () => {
      const repo = new PgMemoryRepo(db.forTenant(ORG_A));
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
      const repo = new PgMemoryRepo(db.forTenant(ORG_A));
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
      const repo = new PgMemoryRepo(db.forTenant(ORG_A));
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
      const repo = new PgMemoryRepo(db.forTenant(ORG_A));
      const m = await repo.create({ orgId: ORG_A, scopeType: "org", scopeId: ORG_A, kind: "semantic", title: "Secret", summary: "", content: "sensitive", createdBy: USER_A });

      const updated = await repo.updateStatus(m.id, ORG_A, "redacted", { content: "[REDACTED]", contentHash: "redacted" });
      expect(updated!.status).toBe("redacted");
      expect(updated!.content).toBe("[REDACTED]");
    });
  });

  describe("dedup by content hash", () => {
    it("finds existing memory by content hash", async () => {
      const repo = new PgMemoryRepo(db.forTenant(ORG_A));
      const m = await repo.create({ orgId: ORG_A, scopeType: "org", scopeId: ORG_A, kind: "semantic", title: "First", summary: "", content: "unique content", createdBy: USER_A });

      const found = await repo.getByContentHash(ORG_A, m.contentHash);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(m.id);
    });
  });

  describe("tenant isolation", () => {
    it("org B cannot see org A's memories", async () => {
      const repoA = new PgMemoryRepo(db.forTenant(ORG_A));
      const m = await repoA.create({ orgId: ORG_A, scopeType: "org", scopeId: ORG_A, kind: "semantic", title: "A only", summary: "", content: "private", createdBy: USER_A });

      const repoB = new PgMemoryRepo(db.forTenant(ORG_B));
      const retrieved = await repoB.getById(m.id, ORG_B);
      expect(retrieved).toBeNull();

      const listed = await repoB.listForOrg(ORG_B);
      expect(listed.length).toBe(0);
    });
  });
});

describe("PgMemoryLinkRepo integration", () => {
  it("creates and lists links", async () => {
    const memRepo = new PgMemoryRepo(db.forTenant(ORG_A));
    const linkRepo = new PgMemoryLinkRepo(db.forTenant(ORG_A));

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
    const auditRepo = new PgAuditRepo(db.forTenant(ORG_A));

    await auditRepo.emit({
      orgId: ORG_A, actorId: USER_A, actorType: "user",
      action: "memory.created", resourceType: "memory", resourceId: "test-id",
      metadata: { kind: "semantic" },
    });

    const events = await auditRepo.query(ORG_A, { action: "memory.created" });
    expect(events.length).toBeGreaterThanOrEqual(1);
  });
});
