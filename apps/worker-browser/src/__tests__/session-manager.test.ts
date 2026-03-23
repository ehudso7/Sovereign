import { describe, it, expect } from "vitest";
import { SessionManager } from "../session-manager.js";
import type { BrowserContext } from "../browser-provider.js";

function createMockContext(sessionId: string): BrowserContext {
  return {
    sessionId,
    navigate: async () => {},
    click: async () => {},
    type: async () => {},
    select: async () => {},
    waitForSelector: async () => {},
    extractText: async () => "",
    screenshot: async () => Buffer.from(""),
    uploadFile: async () => {},
    currentUrl: async () => "about:blank",
    close: async () => {},
  };
}

describe("SessionManager", () => {
  it("registers and retrieves a session", () => {
    const mgr = new SessionManager();
    const ctx = createMockContext("s1");
    mgr.register("db-1", ctx);

    expect(mgr.get("db-1")).toBe(ctx);
    expect(mgr.getActiveCount()).toBe(1);
  });

  it("returns null for unknown session", () => {
    const mgr = new SessionManager();
    expect(mgr.get("nonexistent")).toBeNull();
  });

  it("removes a session", async () => {
    const mgr = new SessionManager();
    const ctx = createMockContext("s1");
    mgr.register("db-1", ctx);

    await mgr.remove("db-1");
    expect(mgr.get("db-1")).toBeNull();
    expect(mgr.getActiveCount()).toBe(0);
  });

  it("closes all sessions", async () => {
    const mgr = new SessionManager();
    mgr.register("db-1", createMockContext("s1"));
    mgr.register("db-2", createMockContext("s2"));

    expect(mgr.getActiveCount()).toBe(2);

    await mgr.closeAll();
    expect(mgr.getActiveCount()).toBe(0);
  });
});
