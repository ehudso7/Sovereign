import { describe, it, expect } from "vitest";
import {
  isValidBrowserTransition,
  assertBrowserTransition,
  isBrowserTerminal,
  BROWSER_TERMINAL_STATES,
} from "../browser-state-machine.js";
import type { BrowserSessionStatus } from "../entities.js";

describe("browser session state machine", () => {
  describe("isValidBrowserTransition", () => {
    const validCases: [BrowserSessionStatus, BrowserSessionStatus][] = [
      ["provisioning", "ready"],
      ["provisioning", "failed"],
      ["ready", "active"],
      ["ready", "closing"],
      ["ready", "failed"],
      ["active", "takeover_requested"],
      ["active", "closing"],
      ["active", "failed"],
      ["takeover_requested", "human_control"],
      ["takeover_requested", "active"],
      ["takeover_requested", "closing"],
      ["takeover_requested", "failed"],
      ["human_control", "active"],
      ["human_control", "closing"],
      ["human_control", "failed"],
      ["closing", "closed"],
      ["closing", "failed"],
    ];

    for (const [from, to] of validCases) {
      it(`allows ${from} → ${to}`, () => {
        expect(isValidBrowserTransition(from, to)).toBe(true);
      });
    }

    const invalidCases: [BrowserSessionStatus, BrowserSessionStatus][] = [
      ["closed", "active"],
      ["closed", "ready"],
      ["failed", "active"],
      ["failed", "ready"],
      ["provisioning", "active"],
      ["provisioning", "human_control"],
      ["ready", "human_control"],
      ["active", "ready"],
      ["active", "provisioning"],
      ["closing", "active"],
    ];

    for (const [from, to] of invalidCases) {
      it(`rejects ${from} → ${to}`, () => {
        expect(isValidBrowserTransition(from, to)).toBe(false);
      });
    }
  });

  describe("assertBrowserTransition", () => {
    it("does not throw for valid transition", () => {
      expect(() => assertBrowserTransition("provisioning", "ready")).not.toThrow();
    });

    it("throws for invalid transition", () => {
      expect(() => assertBrowserTransition("closed", "active")).toThrow(
        "Invalid browser session state transition: closed → active",
      );
    });
  });

  describe("isBrowserTerminal", () => {
    it("closed is terminal", () => {
      expect(isBrowserTerminal("closed")).toBe(true);
    });

    it("failed is terminal", () => {
      expect(isBrowserTerminal("failed")).toBe(true);
    });

    it("active is not terminal", () => {
      expect(isBrowserTerminal("active")).toBe(false);
    });

    it("provisioning is not terminal", () => {
      expect(isBrowserTerminal("provisioning")).toBe(false);
    });
  });

  describe("BROWSER_TERMINAL_STATES", () => {
    it("contains closed and failed", () => {
      expect(BROWSER_TERMINAL_STATES).toContain("closed");
      expect(BROWSER_TERMINAL_STATES).toContain("failed");
      expect(BROWSER_TERMINAL_STATES).toHaveLength(2);
    });
  });
});
