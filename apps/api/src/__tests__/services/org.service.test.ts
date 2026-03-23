import { describe, it, expect, beforeEach } from "vitest";
import { PgOrgService } from "../../services/org.service.js";
import { PgAuditEmitter } from "../../services/audit.service.js";
import { createTestRepos, type TestRepos } from "../helpers/test-repos.js";
import type { UserId } from "@sovereign/core";

describe("OrgService", () => {
  let service: PgOrgService;
  let repos: TestRepos;
  let userId: UserId;

  beforeEach(() => {
    repos = createTestRepos();
    const audit = new PgAuditEmitter(repos.audit);
    service = new PgOrgService(repos.orgs, repos.memberships, audit);
    const user = repos.users.createSync({ email: "test@example.com", name: "Test User" });
    userId = user.id;
  });

  describe("create", () => {
    it("creates an org and adds creator as owner", async () => {
      const result = await service.create({ name: "Test Org", slug: "test-org" }, userId);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBe("Test Org");
        expect(result.value.slug).toBe("test-org");
        expect(result.value.plan).toBe("free");

        const membership = await repos.memberships.getForUser(result.value.id, userId);
        expect(membership).toBeDefined();
        expect(membership?.role).toBe("org_owner");
      }
    });

    it("rejects duplicate slugs", async () => {
      await service.create({ name: "Org 1", slug: "test-org" }, userId);
      const result = await service.create({ name: "Org 2", slug: "test-org" }, userId);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("CONFLICT");
    });
  });

  describe("getById", () => {
    it("returns org for a member", async () => {
      const createResult = await service.create({ name: "Test Org", slug: "test-org" }, userId);
      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      const result = await service.getById(createResult.value.id, userId);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.name).toBe("Test Org");
    });

    it("returns NOT_FOUND for non-member", async () => {
      const createResult = await service.create({ name: "Test Org", slug: "test-org" }, userId);
      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      const otherUser = repos.users.createSync({ email: "other@example.com", name: "Other" });
      const result = await service.getById(createResult.value.id, otherUser.id);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("update", () => {
    it("updates org name", async () => {
      const createResult = await service.create({ name: "Test Org", slug: "test-org" }, userId);
      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      const result = await service.update(createResult.value.id, userId, { name: "New Name" });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.name).toBe("New Name");
    });
  });

  describe("listForUser", () => {
    it("returns only orgs the user belongs to", async () => {
      await service.create({ name: "Org 1", slug: "org-1" }, userId);
      await service.create({ name: "Org 2", slug: "org-2" }, userId);

      const otherUser = repos.users.createSync({ email: "other@example.com", name: "Other" });
      await service.create({ name: "Other Org", slug: "other-org" }, otherUser.id);

      const result = await service.listForUser(userId);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.data.length).toBe(2);
        expect(result.value.total).toBe(2);
      }
    });
  });

  describe("checkSlugAvailable", () => {
    it("returns true for available slug", async () => {
      const result = await service.checkSlugAvailable("new-slug");
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(true);
    });

    it("returns false for taken slug", async () => {
      await service.create({ name: "Test", slug: "taken" }, userId);
      const result = await service.checkSlugAvailable("taken");
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(false);
    });
  });
});
