import { describe, it, expect, beforeEach } from "vitest";
import type { AuthConfig } from "@sovereign/core";
import { PgAuthService } from "../../services/auth.service.js";
import { PgOrgService } from "../../services/org.service.js";
import { PgAuditEmitter } from "../../services/audit.service.js";
import { createTestRepos, type TestRepos } from "../helpers/test-repos.js";

describe("AuthService", () => {
  let service: PgAuthService;
  let repos: TestRepos;
  const authConfig: AuthConfig = {
    mode: "local",
    sessionSecret: "test-session-secret-that-is-at-least-32-chars",
    sessionTtlMs: 60 * 60 * 1000,
  };

  beforeEach(async () => {
    repos = createTestRepos();
    const audit = new PgAuditEmitter(repos.audit);
    service = new PgAuthService(authConfig, repos.users, repos.memberships, repos.sessions, audit);

    const user = repos.users.createSync({ email: "test@example.com", name: "Test User" });
    const orgService = new PgOrgService(repos.orgs, repos.memberships, audit);
    await orgService.create({ name: "Test Org", slug: "test-org" }, user.id);
  });

  describe("signIn", () => {
    it("creates a session for valid user", async () => {
      const result = await service.signIn("test@example.com");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sessionToken).toBeDefined();
        expect(result.value.user.email).toBe("test@example.com");
        expect(result.value.expiresAt).toBeDefined();
      }
    });

    it("rejects unknown email", async () => {
      const result = await service.signIn("unknown@example.com");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("validateSession", () => {
    it("validates a valid session token", async () => {
      const signInResult = await service.signIn("test@example.com");
      expect(signInResult.ok).toBe(true);
      if (!signInResult.ok) return;

      const result = await service.validateSession(signInResult.value.sessionToken);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.userId).toBeDefined();
        expect(result.value.orgId).toBeDefined();
        expect(result.value.role).toBe("org_owner");
      }
    });

    it("rejects invalid token", async () => {
      const result = await service.validateSession("invalid-token");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("signOut", () => {
    it("invalidates a session", async () => {
      const signInResult = await service.signIn("test@example.com");
      expect(signInResult.ok).toBe(true);
      if (!signInResult.ok) return;

      const valid = await service.validateSession(signInResult.value.sessionToken);
      expect(valid.ok).toBe(true);
      if (!valid.ok) return;

      const signOutResult = await service.signOut(valid.value.id);
      expect(signOutResult.ok).toBe(true);

      const invalid = await service.validateSession(signInResult.value.sessionToken);
      expect(invalid.ok).toBe(false);
    });
  });

  describe("revokeSession", () => {
    it("revokes a specific session", async () => {
      const signInResult = await service.signIn("test@example.com");
      expect(signInResult.ok).toBe(true);
      if (!signInResult.ok) return;

      const valid = await service.validateSession(signInResult.value.sessionToken);
      expect(valid.ok).toBe(true);
      if (!valid.ok) return;

      const revokeResult = await service.revokeSession(valid.value.id, valid.value.userId);
      expect(revokeResult.ok).toBe(true);

      const invalid = await service.validateSession(signInResult.value.sessionToken);
      expect(invalid.ok).toBe(false);
    });
  });

  describe("signInToOrg", () => {
    it("creates session for specific org", async () => {
      const user = (await repos.users.getByEmail("test@example.com"))!;
      const orgService = new PgOrgService(repos.orgs, repos.memberships, new PgAuditEmitter(repos.audit));
      const orgResult = await orgService.create({ name: "Second Org", slug: "second-org" }, user.id);
      expect(orgResult.ok).toBe(true);
      if (!orgResult.ok) return;

      const result = await service.signInToOrg(user.id, orgResult.value.id);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.sessionToken).toBeDefined();
    });

    it("rejects non-member", async () => {
      const user = (await repos.users.getByEmail("test@example.com"))!;
      const otherUser = repos.users.createSync({ email: "other@example.com", name: "Other" });
      const orgService = new PgOrgService(repos.orgs, repos.memberships, new PgAuditEmitter(repos.audit));
      const orgResult = await orgService.create({ name: "Other Org", slug: "other-org" }, otherUser.id);
      expect(orgResult.ok).toBe(true);
      if (!orgResult.ok) return;

      const result = await service.signInToOrg(user.id, orgResult.value.id);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    });
  });
});
