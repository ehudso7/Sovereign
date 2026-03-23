import { describe, it, expect } from "vitest";
import { isValidTransition, isTerminal, TERMINAL_STATES, assertTransition } from "../run-state-machine.js";
import type { RunStatus } from "../entities.js";

describe("Run state machine", () => {
  describe("valid transitions", () => {
    const validCases: [RunStatus, RunStatus][] = [
      ["queued", "starting"],
      ["queued", "cancelling"],
      ["starting", "running"],
      ["starting", "failed"],
      ["running", "paused"],
      ["running", "cancelling"],
      ["running", "completed"],
      ["running", "failed"],
      ["paused", "running"],
      ["paused", "cancelling"],
      ["cancelling", "cancelled"],
      ["cancelling", "failed"],
    ];

    for (const [from, to] of validCases) {
      it(`allows ${from} → ${to}`, () => {
        expect(isValidTransition(from, to)).toBe(true);
      });
    }
  });

  describe("invalid transitions", () => {
    const invalidCases: [RunStatus, RunStatus][] = [
      ["completed", "running"],
      ["completed", "paused"],
      ["failed", "running"],
      ["failed", "completed"],
      ["cancelled", "running"],
      ["cancelled", "completed"],
      ["queued", "completed"],
      ["queued", "paused"],
      ["paused", "completed"],
      ["starting", "paused"],
    ];

    for (const [from, to] of invalidCases) {
      it(`rejects ${from} → ${to}`, () => {
        expect(isValidTransition(from, to)).toBe(false);
      });
    }
  });

  describe("terminal states", () => {
    it("identifies completed as terminal", () => {
      expect(isTerminal("completed")).toBe(true);
    });

    it("identifies failed as terminal", () => {
      expect(isTerminal("failed")).toBe(true);
    });

    it("identifies cancelled as terminal", () => {
      expect(isTerminal("cancelled")).toBe(true);
    });

    it("does not identify queued as terminal", () => {
      expect(isTerminal("queued")).toBe(false);
    });

    it("does not identify starting as terminal", () => {
      expect(isTerminal("starting")).toBe(false);
    });

    it("does not identify running as terminal", () => {
      expect(isTerminal("running")).toBe(false);
    });

    it("does not identify paused as terminal", () => {
      expect(isTerminal("paused")).toBe(false);
    });

    it("does not identify cancelling as terminal", () => {
      expect(isTerminal("cancelling")).toBe(false);
    });

    it("TERMINAL_STATES contains exactly 3 states", () => {
      expect(TERMINAL_STATES).toHaveLength(3);
      expect(TERMINAL_STATES).toContain("completed");
      expect(TERMINAL_STATES).toContain("failed");
      expect(TERMINAL_STATES).toContain("cancelled");
    });
  });

  describe("assertTransition", () => {
    it("does not throw for valid transitions", () => {
      expect(() => assertTransition("queued", "starting")).not.toThrow();
    });

    it("throws for invalid transitions", () => {
      expect(() => assertTransition("completed", "running")).toThrow(
        "Invalid run state transition: completed → running",
      );
    });
  });
});
