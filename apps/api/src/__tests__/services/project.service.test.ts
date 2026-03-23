import { describe, it, expect, beforeEach } from "vitest";
import type { OrgId, UserId } from "@sovereign/core";
import { PgProjectService } from "../../services/project.service.js";
import { PgOrgService } from "../../services/org.service.js";
import { PgAuditEmitter } from "../../services/audit.service.js";
import { createTestRepos, TestProjectRepo, TestAuditRepo, type TestRepos } from "../helpers/test-repos.js";

describe("ProjectService", () => {
  let repos: TestRepos;
  let ownerId: UserId;
  let orgId: OrgId;

  function projectServiceForOrg(id: OrgId): PgProjectService {
    const projectRepo = new TestProjectRepo(id);
    const auditRepo = new TestAuditRepo(id);
    return new PgProjectService(projectRepo, new PgAuditEmitter(auditRepo));
  }

  beforeEach(async () => {
    repos = createTestRepos();
    const audit = new PgAuditEmitter(repos.audit);
    const orgService = new PgOrgService(repos.orgs, repos.memberships, audit);

    const owner = repos.users.createSync({ email: "owner@example.com", name: "Owner" });
    ownerId = owner.id;

    const orgResult = await orgService.create({ name: "Test Org", slug: "test-org" }, ownerId);
    expect(orgResult.ok).toBe(true);
    if (orgResult.ok) orgId = orgResult.value.id;
  });

  describe("create", () => {
    it("creates a project", async () => {
      const service = projectServiceForOrg(orgId);
      const result = await service.create({
        orgId,
        name: "My Project",
        slug: "my-project",
        description: "A test project",
      }, ownerId);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBe("My Project");
        expect(result.value.slug).toBe("my-project");
        expect(result.value.orgId).toBe(orgId);
      }
    });

    it("rejects duplicate slugs within org", async () => {
      const service = projectServiceForOrg(orgId);
      await service.create({ orgId, name: "Project 1", slug: "my-project" }, ownerId);
      const result = await service.create({ orgId, name: "Project 2", slug: "my-project" }, ownerId);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("CONFLICT");
    });
  });

  describe("getById", () => {
    it("returns project for correct org", async () => {
      const service = projectServiceForOrg(orgId);
      const createResult = await service.create({ orgId, name: "Project", slug: "project" }, ownerId);
      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      const result = await service.getById(createResult.value.id, orgId);
      expect(result.ok).toBe(true);
    });

    it("returns NOT_FOUND for wrong org (cross-tenant protection)", async () => {
      const service = projectServiceForOrg(orgId);
      const createResult = await service.create({ orgId, name: "Project", slug: "project" }, ownerId);
      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      const otherUser = repos.users.createSync({ email: "other@example.com", name: "Other" });
      const audit = new PgAuditEmitter(repos.audit);
      const orgService = new PgOrgService(repos.orgs, repos.memberships, audit);
      const otherOrgResult = await orgService.create({ name: "Other Org", slug: "other-org" }, otherUser.id);
      expect(otherOrgResult.ok).toBe(true);
      if (!otherOrgResult.ok) return;

      // Use a service scoped to the OTHER org
      const otherService = projectServiceForOrg(otherOrgResult.value.id);
      const result = await otherService.getById(createResult.value.id, otherOrgResult.value.id);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("listForOrg", () => {
    it("returns only projects for the specified org", async () => {
      const service = projectServiceForOrg(orgId);
      await service.create({ orgId, name: "Project 1", slug: "p1" }, ownerId);
      await service.create({ orgId, name: "Project 2", slug: "p2" }, ownerId);

      const result = await service.listForOrg(orgId);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.data.length).toBe(2);
    });
  });

  describe("delete", () => {
    it("deletes a project", async () => {
      const service = projectServiceForOrg(orgId);
      const createResult = await service.create({ orgId, name: "Project", slug: "project" }, ownerId);
      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      const deleteResult = await service.delete(createResult.value.id, orgId);
      expect(deleteResult.ok).toBe(true);

      const getResult = await service.getById(createResult.value.id, orgId);
      expect(getResult.ok).toBe(false);
    });

    it("returns NOT_FOUND for wrong org", async () => {
      const service = projectServiceForOrg(orgId);
      const createResult = await service.create({ orgId, name: "Project", slug: "project" }, ownerId);
      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      const otherUser = repos.users.createSync({ email: "other@example.com", name: "Other" });
      const audit = new PgAuditEmitter(repos.audit);
      const orgService = new PgOrgService(repos.orgs, repos.memberships, audit);
      const otherOrgResult = await orgService.create({ name: "Other Org", slug: "other-org" }, otherUser.id);
      expect(otherOrgResult.ok).toBe(true);
      if (!otherOrgResult.ok) return;

      const otherService = projectServiceForOrg(otherOrgResult.value.id);
      const deleteResult = await otherService.delete(createResult.value.id, otherOrgResult.value.id);
      expect(deleteResult.ok).toBe(false);
    });
  });
});
