import { describe, it, expect } from "vitest";
import { hasPermission } from "@sovereign/core";
import type { Permission } from "@sovereign/core";

describe("browser session permissions", () => {
  const browserPermissions: Permission[] = ["browser:read", "browser:control", "browser:takeover"];

  describe("org_owner", () => {
    it("has all browser permissions", () => {
      for (const perm of browserPermissions) {
        expect(hasPermission("org_owner", perm)).toBe(true);
      }
    });
  });

  describe("org_admin", () => {
    it("has all browser permissions", () => {
      for (const perm of browserPermissions) {
        expect(hasPermission("org_admin", perm)).toBe(true);
      }
    });
  });

  describe("org_member", () => {
    it("has browser:read only", () => {
      expect(hasPermission("org_member", "browser:read")).toBe(true);
      expect(hasPermission("org_member", "browser:control")).toBe(false);
      expect(hasPermission("org_member", "browser:takeover")).toBe(false);
    });
  });

  describe("org_billing_admin", () => {
    it("has browser:read only", () => {
      expect(hasPermission("org_billing_admin", "browser:read")).toBe(true);
      expect(hasPermission("org_billing_admin", "browser:control")).toBe(false);
      expect(hasPermission("org_billing_admin", "browser:takeover")).toBe(false);
    });
  });

  describe("org_security_admin", () => {
    it("has browser:read only", () => {
      expect(hasPermission("org_security_admin", "browser:read")).toBe(true);
      expect(hasPermission("org_security_admin", "browser:control")).toBe(false);
      expect(hasPermission("org_security_admin", "browser:takeover")).toBe(false);
    });
  });
});
