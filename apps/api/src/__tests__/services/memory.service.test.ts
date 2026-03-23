import { describe, it, expect, beforeEach } from "vitest";
import { PgMemoryService } from "../../services/memory.service.js";
import { PgAuditEmitter } from "../../services/audit.service.js";
import { toOrgId, toUserId, toMemoryId } from "@sovereign/core";
import { createTestRepos, type TestRepos } from "../helpers/test-repos.js";

const ORG_ID = toOrgId("00000000-0000-0000-0000-aaaaaaaaaaaa");
const USER_ID = toUserId("00000000-0000-0000-0000-bbbbbbbbbbbb");

describe("PgMemoryService", () => {
  let repos: TestRepos;
  let service: PgMemoryService;

  beforeEach(() => {
    repos = createTestRepos();
    const auditEmitter = new PgAuditEmitter(repos.audit);
    service = new PgMemoryService(repos.memories, repos.memoryLinks, auditEmitter);
  });

  describe("createMemory", () => {
    it("creates a semantic memory", async () => {
      const result = await service.createMemory({
        orgId: ORG_ID, scopeType: "org", scopeId: ORG_ID,
        kind: "semantic", title: "Test Fact", summary: "A test fact", content: "The sky is blue",
        createdBy: USER_ID,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.kind).toBe("semantic");
        expect(result.value.status).toBe("active");
        expect(result.value.title).toBe("Test Fact");
      }
    });

    it("emits memory.created audit event", async () => {
      await service.createMemory({
        orgId: ORG_ID, scopeType: "org", scopeId: ORG_ID,
        kind: "semantic", title: "T", summary: "S", content: "C",
        createdBy: USER_ID,
      });
      const events = await repos.audit.query(ORG_ID, { action: "memory.created" });
      expect(events.length).toBe(1);
    });

    it("detects duplicate content", async () => {
      await service.createMemory({
        orgId: ORG_ID, scopeType: "org", scopeId: ORG_ID,
        kind: "semantic", title: "First", summary: "", content: "same content",
        createdBy: USER_ID,
      });
      const result = await service.createMemory({
        orgId: ORG_ID, scopeType: "org", scopeId: ORG_ID,
        kind: "semantic", title: "Second", summary: "", content: "same content",
        createdBy: USER_ID,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("CONFLICT");
    });
  });

  describe("getMemory", () => {
    it("returns NOT_FOUND for missing memory", async () => {
      const result = await service.getMemory(toMemoryId("nonexistent"), ORG_ID);
      expect(result.ok).toBe(false);
    });
  });

  describe("listMemories", () => {
    it("lists memories with kind filter", async () => {
      await service.createMemory({ orgId: ORG_ID, scopeType: "org", scopeId: ORG_ID, kind: "semantic", title: "S", summary: "", content: "A", createdBy: USER_ID });
      await service.createMemory({ orgId: ORG_ID, scopeType: "org", scopeId: ORG_ID, kind: "episodic", title: "E", summary: "", content: "B", createdBy: USER_ID });

      const all = await service.listMemories(ORG_ID);
      expect(all.ok && all.value.length).toBe(2);

      const semantic = await service.listMemories(ORG_ID, { kind: "semantic" });
      expect(semantic.ok && semantic.value.length).toBe(1);
    });
  });

  describe("searchMemories", () => {
    it("searches by text", async () => {
      await service.createMemory({ orgId: ORG_ID, scopeType: "org", scopeId: ORG_ID, kind: "semantic", title: "Sky Color", summary: "", content: "The sky is blue", createdBy: USER_ID });
      await service.createMemory({ orgId: ORG_ID, scopeType: "org", scopeId: ORG_ID, kind: "semantic", title: "Grass Color", summary: "", content: "Grass is green", createdBy: USER_ID });

      const result = await service.searchMemories(ORG_ID, "sky");
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.length).toBe(1);
    });

    it("rejects empty query", async () => {
      const result = await service.searchMemories(ORG_ID, "");
      expect(result.ok).toBe(false);
    });
  });

  describe("redactMemory", () => {
    it("redacts content and marks as redacted", async () => {
      const created = await service.createMemory({ orgId: ORG_ID, scopeType: "org", scopeId: ORG_ID, kind: "semantic", title: "Secret", summary: "", content: "sensitive data", createdBy: USER_ID });
      if (!created.ok) return;

      const result = await service.redactMemory(created.value.id, ORG_ID, USER_ID);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe("redacted");
        expect(result.value.content).toBe("[REDACTED]");
      }
    });

    it("emits memory.redacted audit", async () => {
      const created = await service.createMemory({ orgId: ORG_ID, scopeType: "org", scopeId: ORG_ID, kind: "semantic", title: "S", summary: "", content: "data", createdBy: USER_ID });
      if (!created.ok) return;
      await service.redactMemory(created.value.id, ORG_ID, USER_ID);
      const events = await repos.audit.query(ORG_ID, { action: "memory.redacted" });
      expect(events.length).toBe(1);
    });
  });

  describe("expireMemory", () => {
    it("marks memory as expired", async () => {
      const created = await service.createMemory({ orgId: ORG_ID, scopeType: "org", scopeId: ORG_ID, kind: "episodic", title: "E", summary: "", content: "data", createdBy: USER_ID });
      if (!created.ok) return;

      const result = await service.expireMemory(created.value.id, ORG_ID, USER_ID);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.status).toBe("expired");
    });
  });

  describe("deleteMemory", () => {
    it("soft-deletes memory", async () => {
      const created = await service.createMemory({ orgId: ORG_ID, scopeType: "org", scopeId: ORG_ID, kind: "semantic", title: "D", summary: "", content: "delete me", createdBy: USER_ID });
      if (!created.ok) return;

      const result = await service.deleteMemory(created.value.id, ORG_ID, USER_ID);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.status).toBe("deleted");
    });
  });

  describe("promoteMemory", () => {
    it("promotes episodic to procedural", async () => {
      const created = await service.createMemory({ orgId: ORG_ID, scopeType: "agent", scopeId: "agent-1", kind: "episodic", title: "Episode", summary: "Good playbook", content: "steps", createdBy: USER_ID });
      if (!created.ok) return;

      const result = await service.promoteMemory(created.value.id, ORG_ID, USER_ID);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.kind).toBe("procedural");
      }
    });

    it("rejects promoting non-episodic memory", async () => {
      const created = await service.createMemory({ orgId: ORG_ID, scopeType: "org", scopeId: ORG_ID, kind: "semantic", title: "Fact", summary: "", content: "fact", createdBy: USER_ID });
      if (!created.ok) return;

      const result = await service.promoteMemory(created.value.id, ORG_ID, USER_ID);
      expect(result.ok).toBe(false);
    });
  });

  describe("retrieveForRun", () => {
    it("returns empty when readEnabled is false", async () => {
      const result = await service.retrieveForRun(ORG_ID, "agent", "a1", { readEnabled: false }, USER_ID);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.length).toBe(0);
    });

    it("retrieves active memories matching scope", async () => {
      await service.createMemory({ orgId: ORG_ID, scopeType: "agent", scopeId: "a1", kind: "semantic", title: "Helpful", summary: "", content: "data", createdBy: USER_ID });

      const result = await service.retrieveForRun(ORG_ID, "agent", "a1", { readEnabled: true, maxRetrievalCount: 10 }, USER_ID);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.length).toBe(1);
    });

    it("excludes redacted memories from retrieval", async () => {
      const created = await service.createMemory({ orgId: ORG_ID, scopeType: "agent", scopeId: "a1", kind: "semantic", title: "Secret", summary: "", content: "secret", createdBy: USER_ID });
      if (created.ok) await service.redactMemory(created.value.id, ORG_ID, USER_ID);

      const result = await service.retrieveForRun(ORG_ID, "agent", "a1", { readEnabled: true }, USER_ID);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.length).toBe(0);
    });
  });

  describe("writeEpisodicFromRun", () => {
    it("creates episodic memory with link", async () => {
      const result = await service.writeEpisodicFromRun(ORG_ID, "run-1", "agent-1", "Run completed", "output data", USER_ID);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.kind).toBe("episodic");
        const links = await repos.memoryLinks.listForMemory(result.value.id, ORG_ID);
        expect(links.length).toBe(1);
        expect(links[0]!.linkType).toBe("source_run");
      }
    });
  });
});
