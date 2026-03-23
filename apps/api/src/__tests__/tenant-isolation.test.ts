import { describe, it, expect, beforeEach } from "vitest";
import type { OrgId, UserId, AuthConfig } from "@sovereign/core";
import { PgOrgService } from "../services/org.service.js";
import { PgMembershipService } from "../services/membership.service.js";
import { PgProjectService } from "../services/project.service.js";
import { PgAuthService } from "../services/auth.service.js";
import { PgAuditEmitter } from "../services/audit.service.js";
import { createTestRepos, TestProjectRepo, TestAuditRepo, type TestRepos } from "./helpers/test-repos.js";

/**
 * Cross-tenant isolation tests
 */
describe("Tenant Isolation", () => {
  let repos: TestRepos;
  let orgService: PgOrgService;
  let membershipService: PgMembershipService;

  let orgAId: OrgId;
  let orgBId: OrgId;
  let userAId: UserId;
  let userBId: UserId;

  function projectServiceForOrg(orgId: OrgId): PgProjectService {
    return new PgProjectService(
      new TestProjectRepo(orgId),
      new PgAuditEmitter(new TestAuditRepo(orgId)),
    );
  }

  beforeEach(async () => {
    repos = createTestRepos();
    const audit = new PgAuditEmitter(repos.audit);
    orgService = new PgOrgService(repos.orgs, repos.memberships, audit);
    membershipService = new PgMembershipService(repos.memberships, audit);

    const userA = repos.users.createSync({ email: "alice@org-a.com", name: "Alice" });
    userAId = userA.id;
    const orgA = await orgService.create({ name: "Org A", slug: "org-a" }, userAId);
    expect(orgA.ok).toBe(true);
    if (orgA.ok) orgAId = orgA.value.id;

    const userB = repos.users.createSync({ email: "bob@org-b.com", name: "Bob" });
    userBId = userB.id;
    const orgB = await orgService.create({ name: "Org B", slug: "org-b" }, userBId);
    expect(orgB.ok).toBe(true);
    if (orgB.ok) orgBId = orgB.value.id;
  });

  describe("Organization isolation", () => {
    it("user A cannot view org B", async () => {
      const result = await orgService.getById(orgBId, userAId);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });

    it("user B cannot view org A", async () => {
      const result = await orgService.getById(orgAId, userBId);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });

    it("user A only sees their orgs", async () => {
      const result = await orgService.listForUser(userAId);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.data.length).toBe(1);
        expect(result.value.data[0]!.id).toBe(orgAId);
      }
    });

    it("user B only sees their orgs", async () => {
      const result = await orgService.listForUser(userBId);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.data.length).toBe(1);
        expect(result.value.data[0]!.id).toBe(orgBId);
      }
    });
  });

  describe("Project isolation", () => {
    it("org A project is not accessible from org B context", async () => {
      const serviceA = projectServiceForOrg(orgAId);
      const projectResult = await serviceA.create(
        { orgId: orgAId, name: "Secret Project", slug: "secret" },
        userAId,
      );
      expect(projectResult.ok).toBe(true);
      if (!projectResult.ok) return;

      const serviceB = projectServiceForOrg(orgBId);
      const result = await serviceB.getById(projectResult.value.id, orgBId);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });

    it("listing projects for org B does not include org A projects", async () => {
      const serviceA = projectServiceForOrg(orgAId);
      await serviceA.create({ orgId: orgAId, name: "Project A", slug: "project-a" }, userAId);

      const serviceB = projectServiceForOrg(orgBId);
      await serviceB.create({ orgId: orgBId, name: "Project B", slug: "project-b" }, userBId);

      const orgBProjects = await serviceB.listForOrg(orgBId);
      expect(orgBProjects.ok).toBe(true);
      if (orgBProjects.ok) {
        expect(orgBProjects.value.data.length).toBe(1);
        expect(orgBProjects.value.data[0]!.name).toBe("Project B");
      }
    });

    it("cannot delete project from wrong org", async () => {
      const serviceA = projectServiceForOrg(orgAId);
      const projectResult = await serviceA.create(
        { orgId: orgAId, name: "Project A", slug: "project-a" },
        userAId,
      );
      expect(projectResult.ok).toBe(true);
      if (!projectResult.ok) return;

      const serviceB = projectServiceForOrg(orgBId);
      const deleteResult = await serviceB.delete(projectResult.value.id, orgBId);
      expect(deleteResult.ok).toBe(false);
      if (!deleteResult.ok) expect(deleteResult.error.code).toBe("NOT_FOUND");

      const getResult = await serviceA.getById(projectResult.value.id, orgAId);
      expect(getResult.ok).toBe(true);
    });
  });

  describe("Membership isolation", () => {
    it("user A not in org B members", async () => {
      const result = await membershipService.listForOrg(orgBId);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const hasUserA = result.value.data.some((m: { userId: UserId }) => m.userId === userAId);
        expect(hasUserA).toBe(false);
      }
    });

    it("user B cannot get membership in org A", async () => {
      const result = await membershipService.getForUser(orgAId, userBId);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("Auth session isolation", () => {
    it("user cannot create session for org they are not a member of", async () => {
      const authConfig: AuthConfig = {
        mode: "local",
        sessionSecret: "test-secret-that-is-at-least-32-chars-long",
        sessionTtlMs: 3600000,
      };
      const audit = new PgAuditEmitter(repos.audit);
      const authService = new PgAuthService(authConfig, repos.users, repos.memberships, repos.sessions, audit);

      const result = await authService.signInToOrg(userAId, orgBId);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    });
  });

  describe("Audit event isolation", () => {
    it("audit events are scoped to org", async () => {
      const auditA = new PgAuditEmitter(new TestAuditRepo(orgAId));
      const auditB = new PgAuditEmitter(new TestAuditRepo(orgBId));

      await auditA.emit({
        orgId: orgAId,
        actorId: userAId,
        actorType: "user",
        action: "org.updated",
        resourceType: "organization",
      });

      await auditB.emit({
        orgId: orgBId,
        actorId: userBId,
        actorType: "user",
        action: "org.updated",
        resourceType: "organization",
      });

      const orgAEvents = await auditA.query(orgAId);
      expect(orgAEvents.length).toBeGreaterThanOrEqual(1);
      for (const event of orgAEvents) {
        expect(event.orgId).toBe(orgAId);
      }

      const orgBEvents = await auditB.query(orgBId);
      expect(orgBEvents.length).toBeGreaterThanOrEqual(1);
      for (const event of orgBEvents) {
        expect(event.orgId).toBe(orgBId);
      }
    });
  });
});
