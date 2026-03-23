import { describe, it, expect, beforeEach } from "vitest";
import type { OrgId, UserId } from "@sovereign/core";
import { PgInvitationService } from "../../services/invitation.service.js";
import { PgOrgService } from "../../services/org.service.js";
import { PgAuditEmitter } from "../../services/audit.service.js";
import { createTestRepos, type TestRepos } from "../helpers/test-repos.js";

describe("InvitationService", () => {
  let service: PgInvitationService;
  let repos: TestRepos;
  let ownerId: UserId;
  let orgId: OrgId;

  beforeEach(async () => {
    repos = createTestRepos();
    const audit = new PgAuditEmitter(repos.audit);
    service = new PgInvitationService(repos.invitations, repos.memberships, repos.users, audit);
    const orgService = new PgOrgService(repos.orgs, repos.memberships, audit);

    const owner = repos.users.createSync({ email: "owner@example.com", name: "Owner" });
    ownerId = owner.id;

    const orgResult = await orgService.create({ name: "Test Org", slug: "test-org" }, ownerId);
    expect(orgResult.ok).toBe(true);
    if (orgResult.ok) orgId = orgResult.value.id;
  });

  describe("create", () => {
    it("creates an invitation", async () => {
      const result = await service.create({
        orgId,
        email: "invite@example.com",
        role: "org_member",
        invitedBy: ownerId,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.email).toBe("invite@example.com");
        expect(result.value.role).toBe("org_member");
        expect(result.value.orgId).toBe(orgId);
      }
    });

    it("rejects invitation for existing member", async () => {
      const result = await service.create({
        orgId,
        email: "owner@example.com",
        role: "org_member",
        invitedBy: ownerId,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("CONFLICT");
    });
  });

  describe("accept", () => {
    it("accepts an invitation and creates membership", async () => {
      const invitee = repos.users.createSync({ email: "invite@example.com", name: "Invitee" });

      const createResult = await service.create({
        orgId,
        email: "invite@example.com",
        role: "org_member",
        invitedBy: ownerId,
      });
      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      const acceptResult = await service.accept(createResult.value.id, invitee.id);
      expect(acceptResult.ok).toBe(true);
      if (acceptResult.ok) {
        expect(acceptResult.value.role).toBe("org_member");
        expect(acceptResult.value.orgId).toBe(orgId);
      }
    });

    it("rejects acceptance by wrong user", async () => {
      const wrongUser = repos.users.createSync({ email: "wrong@example.com", name: "Wrong" });

      const createResult = await service.create({
        orgId,
        email: "invite@example.com",
        role: "org_member",
        invitedBy: ownerId,
      });
      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      const acceptResult = await service.accept(createResult.value.id, wrongUser.id);
      expect(acceptResult.ok).toBe(false);
      if (!acceptResult.ok) expect(acceptResult.error.code).toBe("FORBIDDEN");
    });
  });

  describe("listForOrg", () => {
    it("returns pending invitations only", async () => {
      await service.create({ orgId, email: "invite1@example.com", role: "org_member", invitedBy: ownerId });
      await service.create({ orgId, email: "invite2@example.com", role: "org_admin", invitedBy: ownerId });

      const result = await service.listForOrg(orgId);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.length).toBe(2);
    });
  });
});
