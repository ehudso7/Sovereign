import { describe, it, expect } from "vitest";
import { hasPermission } from "@sovereign/core";
import type { Permission } from "@sovereign/core";

describe("memory permissions", () => {
  const allMemoryPerms: Permission[] = ["memory:read", "memory:write", "memory:review", "memory:redact", "memory:delete"];

  describe("org_owner", () => {
    it("has all memory permissions", () => {
      for (const perm of allMemoryPerms) {
        expect(hasPermission("org_owner", perm)).toBe(true);
      }
    });
  });

  describe("org_admin", () => {
    it("has all memory permissions", () => {
      for (const perm of allMemoryPerms) {
        expect(hasPermission("org_admin", perm)).toBe(true);
      }
    });
  });

  describe("org_member", () => {
    it("has memory:read and memory:write", () => {
      expect(hasPermission("org_member", "memory:read")).toBe(true);
      expect(hasPermission("org_member", "memory:write")).toBe(true);
    });

    it("does not have memory:review, memory:redact, memory:delete", () => {
      expect(hasPermission("org_member", "memory:review")).toBe(false);
      expect(hasPermission("org_member", "memory:redact")).toBe(false);
      expect(hasPermission("org_member", "memory:delete")).toBe(false);
    });
  });

  describe("org_billing_admin", () => {
    it("has memory:read only", () => {
      expect(hasPermission("org_billing_admin", "memory:read")).toBe(true);
      expect(hasPermission("org_billing_admin", "memory:write")).toBe(false);
      expect(hasPermission("org_billing_admin", "memory:redact")).toBe(false);
    });
  });

  describe("org_security_admin", () => {
    it("has memory:read and memory:review", () => {
      expect(hasPermission("org_security_admin", "memory:read")).toBe(true);
      expect(hasPermission("org_security_admin", "memory:review")).toBe(true);
      expect(hasPermission("org_security_admin", "memory:redact")).toBe(false);
    });
  });
});
