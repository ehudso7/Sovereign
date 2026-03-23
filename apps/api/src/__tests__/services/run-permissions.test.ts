/**
 * Permission enforcement tests for Run Engine (Phase 5).
 *
 * Verifies that the permission model correctly gates run actions by role:
 * - run:read    — all 5 roles
 * - run:create  — org_owner, org_admin, org_member
 * - run:control — org_owner, org_admin only
 */

import { describe, it, expect } from "vitest";
import { hasPermission, permissionsForRole, type OrgRole } from "@sovereign/core";

describe("Run Engine permission model", () => {
  const allRoles: OrgRole[] = [
    "org_owner",
    "org_admin",
    "org_member",
    "org_billing_admin",
    "org_security_admin",
  ];

  describe("run:read", () => {
    it("is available to all roles", () => {
      for (const role of allRoles) {
        expect(hasPermission(role, "run:read")).toBe(true);
      }
    });
  });

  describe("run:create", () => {
    it("is available to org_owner", () => {
      expect(hasPermission("org_owner", "run:create")).toBe(true);
    });

    it("is available to org_admin", () => {
      expect(hasPermission("org_admin", "run:create")).toBe(true);
    });

    it("is available to org_member", () => {
      expect(hasPermission("org_member", "run:create")).toBe(true);
    });

    it("is NOT available to org_billing_admin", () => {
      expect(hasPermission("org_billing_admin", "run:create")).toBe(false);
    });

    it("is NOT available to org_security_admin", () => {
      expect(hasPermission("org_security_admin", "run:create")).toBe(false);
    });
  });

  describe("run:control", () => {
    it("is available to org_owner", () => {
      expect(hasPermission("org_owner", "run:control")).toBe(true);
    });

    it("is available to org_admin", () => {
      expect(hasPermission("org_admin", "run:control")).toBe(true);
    });

    it("is NOT available to org_member", () => {
      expect(hasPermission("org_member", "run:control")).toBe(false);
    });

    it("is NOT available to org_billing_admin", () => {
      expect(hasPermission("org_billing_admin", "run:control")).toBe(false);
    });

    it("is NOT available to org_security_admin", () => {
      expect(hasPermission("org_security_admin", "run:control")).toBe(false);
    });
  });

  describe("permission mapping summary", () => {
    it("run:read is present in all role permission sets", () => {
      for (const role of allRoles) {
        const perms = permissionsForRole(role);
        expect(perms).toContain("run:read");
      }
    });

    it("only owner/admin/member can create runs", () => {
      const rolesWithCreate = allRoles.filter((r) => hasPermission(r, "run:create"));
      expect(rolesWithCreate).toEqual(["org_owner", "org_admin", "org_member"]);
    });

    it("only owner/admin can control runs", () => {
      const rolesWithControl = allRoles.filter((r) => hasPermission(r, "run:control"));
      expect(rolesWithControl).toEqual(["org_owner", "org_admin"]);
    });
  });
});
