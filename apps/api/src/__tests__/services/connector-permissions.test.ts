/**
 * Permission enforcement tests for Tooling and Connector Hub (Phase 6).
 *
 * Verifies that the permission model correctly gates connector/skill actions by role:
 * - connector:read     — all 5 roles
 * - connector:install  — org_owner, org_admin only
 * - connector:configure — org_owner, org_admin only
 * - connector:test     — org_owner, org_admin only
 * - connector:revoke   — org_owner, org_admin only
 * - skill:read         — all 5 roles
 * - skill:install      — org_owner, org_admin only
 * - skill:uninstall    — org_owner, org_admin only
 */

import { describe, it, expect } from "vitest";
import { hasPermission, permissionsForRole, type OrgRole } from "@sovereign/core";

describe("Connector & Skill permission model", () => {
  const allRoles: OrgRole[] = [
    "org_owner",
    "org_admin",
    "org_member",
    "org_billing_admin",
    "org_security_admin",
  ];

  // -------------------------------------------------------------------------
  // connector:read
  // -------------------------------------------------------------------------

  describe("connector:read", () => {
    it("is available to all roles", () => {
      for (const role of allRoles) {
        expect(hasPermission(role, "connector:read")).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // connector:install
  // -------------------------------------------------------------------------

  describe("connector:install", () => {
    it("is available to org_owner", () => {
      expect(hasPermission("org_owner", "connector:install")).toBe(true);
    });

    it("is available to org_admin", () => {
      expect(hasPermission("org_admin", "connector:install")).toBe(true);
    });

    it("is NOT available to org_member", () => {
      expect(hasPermission("org_member", "connector:install")).toBe(false);
    });

    it("is NOT available to org_billing_admin", () => {
      expect(hasPermission("org_billing_admin", "connector:install")).toBe(false);
    });

    it("is NOT available to org_security_admin", () => {
      expect(hasPermission("org_security_admin", "connector:install")).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // connector:configure
  // -------------------------------------------------------------------------

  describe("connector:configure", () => {
    it("is available to org_owner", () => {
      expect(hasPermission("org_owner", "connector:configure")).toBe(true);
    });

    it("is available to org_admin", () => {
      expect(hasPermission("org_admin", "connector:configure")).toBe(true);
    });

    it("is NOT available to org_member", () => {
      expect(hasPermission("org_member", "connector:configure")).toBe(false);
    });

    it("is NOT available to org_billing_admin", () => {
      expect(hasPermission("org_billing_admin", "connector:configure")).toBe(false);
    });

    it("is NOT available to org_security_admin", () => {
      expect(hasPermission("org_security_admin", "connector:configure")).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // connector:test
  // -------------------------------------------------------------------------

  describe("connector:test", () => {
    it("is available to org_owner", () => {
      expect(hasPermission("org_owner", "connector:test")).toBe(true);
    });

    it("is available to org_admin", () => {
      expect(hasPermission("org_admin", "connector:test")).toBe(true);
    });

    it("is NOT available to org_member", () => {
      expect(hasPermission("org_member", "connector:test")).toBe(false);
    });

    it("is NOT available to org_billing_admin", () => {
      expect(hasPermission("org_billing_admin", "connector:test")).toBe(false);
    });

    it("is NOT available to org_security_admin", () => {
      expect(hasPermission("org_security_admin", "connector:test")).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // connector:revoke
  // -------------------------------------------------------------------------

  describe("connector:revoke", () => {
    it("is available to org_owner", () => {
      expect(hasPermission("org_owner", "connector:revoke")).toBe(true);
    });

    it("is available to org_admin", () => {
      expect(hasPermission("org_admin", "connector:revoke")).toBe(true);
    });

    it("is NOT available to org_member", () => {
      expect(hasPermission("org_member", "connector:revoke")).toBe(false);
    });

    it("is NOT available to org_billing_admin", () => {
      expect(hasPermission("org_billing_admin", "connector:revoke")).toBe(false);
    });

    it("is NOT available to org_security_admin", () => {
      expect(hasPermission("org_security_admin", "connector:revoke")).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // skill:read
  // -------------------------------------------------------------------------

  describe("skill:read", () => {
    it("is available to all roles", () => {
      for (const role of allRoles) {
        expect(hasPermission(role, "skill:read")).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // skill:install
  // -------------------------------------------------------------------------

  describe("skill:install", () => {
    it("is available to org_owner", () => {
      expect(hasPermission("org_owner", "skill:install")).toBe(true);
    });

    it("is available to org_admin", () => {
      expect(hasPermission("org_admin", "skill:install")).toBe(true);
    });

    it("is NOT available to org_member", () => {
      expect(hasPermission("org_member", "skill:install")).toBe(false);
    });

    it("is NOT available to org_billing_admin", () => {
      expect(hasPermission("org_billing_admin", "skill:install")).toBe(false);
    });

    it("is NOT available to org_security_admin", () => {
      expect(hasPermission("org_security_admin", "skill:install")).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // skill:uninstall
  // -------------------------------------------------------------------------

  describe("skill:uninstall", () => {
    it("is available to org_owner", () => {
      expect(hasPermission("org_owner", "skill:uninstall")).toBe(true);
    });

    it("is available to org_admin", () => {
      expect(hasPermission("org_admin", "skill:uninstall")).toBe(true);
    });

    it("is NOT available to org_member", () => {
      expect(hasPermission("org_member", "skill:uninstall")).toBe(false);
    });

    it("is NOT available to org_billing_admin", () => {
      expect(hasPermission("org_billing_admin", "skill:uninstall")).toBe(false);
    });

    it("is NOT available to org_security_admin", () => {
      expect(hasPermission("org_security_admin", "skill:uninstall")).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Summary assertions
  // -------------------------------------------------------------------------

  describe("permission mapping summary", () => {
    it("connector:read is present in all role permission sets", () => {
      for (const role of allRoles) {
        const perms = permissionsForRole(role);
        expect(perms).toContain("connector:read");
      }
    });

    it("skill:read is present in all role permission sets", () => {
      for (const role of allRoles) {
        const perms = permissionsForRole(role);
        expect(perms).toContain("skill:read");
      }
    });

    it("only owner/admin can install connectors", () => {
      const rolesWithInstall = allRoles.filter((r) => hasPermission(r, "connector:install"));
      expect(rolesWithInstall).toEqual(["org_owner", "org_admin"]);
    });

    it("only owner/admin can install skills", () => {
      const rolesWithInstall = allRoles.filter((r) => hasPermission(r, "skill:install"));
      expect(rolesWithInstall).toEqual(["org_owner", "org_admin"]);
    });
  });
});
