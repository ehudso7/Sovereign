import { describe, it, expect, beforeEach } from "vitest";
import { PgMembershipService } from "../../services/membership.service.js";
import { PgOrgService } from "../../services/org.service.js";
import { PgAuditEmitter } from "../../services/audit.service.js";
import { createTestRepos, type TestRepos } from "../helpers/test-repos.js";
import type { OrgId, UserId } from "@sovereign/core";

describe("MembershipService", () => {
  let service: PgMembershipService;
  let orgService: PgOrgService;
  let repos: TestRepos;
  let ownerId: UserId;
  let orgId: OrgId;

  beforeEach(async () => {
    repos = createTestRepos();
    const audit = new PgAuditEmitter(repos.audit);
    service = new PgMembershipService(repos.memberships, audit);
    orgService = new PgOrgService(repos.orgs, repos.memberships, audit);

    const owner = repos.users.createSync({ email: "owner@example.com", name: "Owner" });
    ownerId = owner.id;

    const orgResult = await orgService.create({ name: "Test Org", slug: "test-org" }, ownerId);
    expect(orgResult.ok).toBe(true);
    if (orgResult.ok) orgId = orgResult.value.id;
  });

  describe("add", () => {
    it("adds a new member", async () => {
      const newUser = repos.users.createSync({ email: "member@example.com", name: "Member" });
      const result = await service.add({ orgId, userId: newUser.id, role: "org_member", invitedBy: ownerId });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.role).toBe("org_member");
        expect(result.value.orgId).toBe(orgId);
      }
    });

    it("rejects duplicate membership", async () => {
      const newUser = repos.users.createSync({ email: "member@example.com", name: "Member" });
      await service.add({ orgId, userId: newUser.id, role: "org_member", invitedBy: ownerId });
      const result = await service.add({ orgId, userId: newUser.id, role: "org_member", invitedBy: ownerId });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("CONFLICT");
    });
  });

  describe("remove", () => {
    it("removes a member", async () => {
      const newUser = repos.users.createSync({ email: "member@example.com", name: "Member" });
      await service.add({ orgId, userId: newUser.id, role: "org_member", invitedBy: ownerId });
      const result = await service.remove(orgId, newUser.id, ownerId);
      expect(result.ok).toBe(true);
      const getResult = await service.getForUser(orgId, newUser.id);
      expect(getResult.ok).toBe(false);
    });

    it("prevents removing the last owner", async () => {
      const result = await service.remove(orgId, ownerId, ownerId);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("BAD_REQUEST");
    });
  });

  describe("changeRole", () => {
    it("owner can change member role", async () => {
      const newUser = repos.users.createSync({ email: "member@example.com", name: "Member" });
      await service.add({ orgId, userId: newUser.id, role: "org_member", invitedBy: ownerId });
      const result = await service.changeRole(orgId, newUser.id, "org_admin", ownerId);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.role).toBe("org_admin");
    });

    it("prevents demoting the last owner", async () => {
      const result = await service.changeRole(orgId, ownerId, "org_admin", ownerId);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("BAD_REQUEST");
    });

    it("member cannot change roles", async () => {
      const memberUser = repos.users.createSync({ email: "member@example.com", name: "Member" });
      await service.add({ orgId, userId: memberUser.id, role: "org_member", invitedBy: ownerId });
      const anotherUser = repos.users.createSync({ email: "another@example.com", name: "Another" });
      await service.add({ orgId, userId: anotherUser.id, role: "org_member", invitedBy: ownerId });
      const result = await service.changeRole(orgId, anotherUser.id, "org_admin", memberUser.id);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    });
  });

  describe("listForOrg", () => {
    it("returns all members with user details", async () => {
      const newUser = repos.users.createSync({ email: "member@example.com", name: "Member" });
      await service.add({ orgId, userId: newUser.id, role: "org_member", invitedBy: ownerId });
      const result = await service.listForOrg(orgId);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.data.length).toBe(2);
        expect(result.value.data[0]!.user).toBeDefined();
        expect(result.value.data[0]!.user.email).toBeDefined();
      }
    });
  });
});
