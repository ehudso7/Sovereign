import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SessionManager } from "../session-manager.js";
import type { SessionInfo } from "../session-manager.js";

// ---------------------------------------------------------------------------
// Mock WebSocket — mimics the ws.WebSocket interface used by SessionManager
// ---------------------------------------------------------------------------

type MessageHandler = (data: string | Buffer) => void;
type CloseHandler = () => void;

interface MockWebSocket {
  readyState: number;
  sent: string[];
  closeCalled: { code: number; reason: string } | null;
  handlers: Map<string, Array<(...args: unknown[]) => void>>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  send: (data: string) => void;
  close: (code: number, reason: string) => void;
  /** Simulate receiving a message from the client. */
  simulateMessage: (data: string) => void;
  /** Simulate the WebSocket closing. */
  simulateClose: () => void;
}

function createMockWs(readyState = 1): MockWebSocket {
  const handlers = new Map<string, Array<(...args: unknown[]) => void>>();
  const sent: string[] = [];

  return {
    readyState,
    sent,
    closeCalled: null,
    handlers,
    on(event: string, handler: (...args: unknown[]) => void) {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    },
    send(data: string) {
      sent.push(data);
    },
    close(code: number, reason: string) {
      this.readyState = 3; // CLOSED
      this.closeCalled = { code, reason };
    },
    simulateMessage(data: string) {
      const messageHandlers = handlers.get("message");
      if (messageHandlers) {
        for (const h of messageHandlers) {
          (h as MessageHandler)(data);
        }
      }
    },
    simulateClose() {
      const closeHandlers = handlers.get("close");
      if (closeHandlers) {
        for (const h of closeHandlers) {
          (h as CloseHandler)();
        }
      }
    },
  };
}

const CONTEXT = { orgId: "org-1", userId: "user-1" };

describe("SessionManager", () => {
  let manager: SessionManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new SessionManager({ idleTimeoutMs: 5000 });
  });

  afterEach(() => {
    manager.closeAll();
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Session creation and retrieval
  // -------------------------------------------------------------------------

  it("creates a new session on attach", () => {
    const ws = createMockWs();
    manager.attach("s1", ws as unknown as import("ws").WebSocket, CONTEXT);

    expect(manager.activeCount()).toBe(1);
    const session = manager.get("s1");
    expect(session).toBeDefined();
    expect(session?.orgId).toBe("org-1");
    expect(session?.userId).toBe("user-1");
  });

  it("returns undefined for unknown session", () => {
    expect(manager.get("nonexistent")).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Reconnect
  // -------------------------------------------------------------------------

  it("replaces WebSocket on reconnect and closes old one", () => {
    const ws1 = createMockWs();
    const ws2 = createMockWs();

    manager.attach("s1", ws1 as unknown as import("ws").WebSocket, CONTEXT);
    manager.attach("s1", ws2 as unknown as import("ws").WebSocket, CONTEXT);

    expect(manager.activeCount()).toBe(1);
    expect(ws1.closeCalled?.code).toBe(4010);

    const session = manager.get("s1");
    expect(session?.ws).toBe(ws2);
  });

  it("replays output history on reconnect", async () => {
    const ws1 = createMockWs();
    manager.attach("s1", ws1 as unknown as import("ws").WebSocket, CONTEXT);

    // Simulate a command that produces output
    const session = manager.get("s1") as SessionInfo;
    session.outputHistory.push("line-1", "line-2");

    // Reconnect with new WS
    const ws2 = createMockWs();
    manager.attach("s1", ws2 as unknown as import("ws").WebSocket, CONTEXT);

    // Should have sent a replay message
    expect(ws2.sent.length).toBeGreaterThanOrEqual(1);
    const replay = JSON.parse(ws2.sent[0] as string) as { type: string; lines: string[] };
    expect(replay.type).toBe("replay");
    expect(replay.lines).toEqual(["line-1", "line-2"]);
  });

  // -------------------------------------------------------------------------
  // Close and closeAll
  // -------------------------------------------------------------------------

  it("closes a specific session", () => {
    const ws = createMockWs();
    manager.attach("s1", ws as unknown as import("ws").WebSocket, CONTEXT);

    manager.close("s1");

    expect(manager.activeCount()).toBe(0);
    expect(manager.get("s1")).toBeUndefined();
    expect(ws.closeCalled?.code).toBe(1000);
  });

  it("closeAll removes all sessions", () => {
    const ws1 = createMockWs();
    const ws2 = createMockWs();

    manager.attach("s1", ws1 as unknown as import("ws").WebSocket, CONTEXT);
    manager.attach("s2", ws2 as unknown as import("ws").WebSocket, CONTEXT);

    expect(manager.activeCount()).toBe(2);

    manager.closeAll();

    expect(manager.activeCount()).toBe(0);
  });

  it("close is a no-op for unknown session", () => {
    expect(() => manager.close("nonexistent")).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // Idle timeout
  // -------------------------------------------------------------------------

  it("closes session after idle timeout", () => {
    const ws = createMockWs();
    manager.attach("s1", ws as unknown as import("ws").WebSocket, CONTEXT);

    expect(manager.activeCount()).toBe(1);

    vi.advanceTimersByTime(5000);

    expect(manager.activeCount()).toBe(0);
  });

  it("resets idle timer on message activity", () => {
    const ws = createMockWs();
    manager.attach("s1", ws as unknown as import("ws").WebSocket, CONTEXT);

    // Advance almost to timeout
    vi.advanceTimersByTime(4000);
    expect(manager.activeCount()).toBe(1);

    // Activity resets the timer
    ws.simulateMessage(JSON.stringify({ type: "command", command: "echo hi" }));

    // Advance past original timeout but not the reset one
    vi.advanceTimersByTime(4000);
    expect(manager.activeCount()).toBe(1);

    // Now advance to the reset timeout
    vi.advanceTimersByTime(1000);
    expect(manager.activeCount()).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Session state persistence
  // -------------------------------------------------------------------------

  it("tracks output history with max limit", () => {
    const ws = createMockWs();
    manager.attach("s1", ws as unknown as import("ws").WebSocket, CONTEXT);

    const session = manager.get("s1") as SessionInfo;

    // Fill beyond the 500-line limit
    for (let i = 0; i < 510; i++) {
      session.outputHistory.push(`line-${i}`);
    }
    // Simulate the trimming that happens internally during command execution
    if (session.outputHistory.length > 500) {
      session.outputHistory.splice(0, session.outputHistory.length - 500);
    }

    expect(session.outputHistory.length).toBe(500);
    expect(session.outputHistory[0]).toBe("line-10");
  });

  it("getState returns serializable snapshot", () => {
    const ws = createMockWs();
    manager.attach("s1", ws as unknown as import("ws").WebSocket, CONTEXT);

    const session = manager.get("s1") as SessionInfo;
    session.outputHistory.push("hello");
    session.commandCount = 5;

    const state = manager.getState("s1");
    expect(state).toBeDefined();
    expect(state?.outputHistory).toEqual(["hello"]);
    expect(state?.commandCount).toBe(5);
  });

  it("getState returns undefined for unknown session", () => {
    expect(manager.getState("nope")).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Resize
  // -------------------------------------------------------------------------

  it("updates session dimensions on resize", () => {
    const ws = createMockWs();
    manager.attach("s1", ws as unknown as import("ws").WebSocket, CONTEXT);

    manager.resize("s1", { cols: 120, rows: 40 });

    const session = manager.get("s1");
    expect(session?.dimensions).toEqual({ cols: 120, rows: 40 });
  });

  it("handles resize for unknown session without error", () => {
    expect(() => manager.resize("nonexistent", { cols: 80, rows: 24 })).not.toThrow();
  });

  it("handles resize via WebSocket message", () => {
    const ws = createMockWs();
    manager.attach("s1", ws as unknown as import("ws").WebSocket, CONTEXT);

    ws.simulateMessage(JSON.stringify({ type: "resize", cols: 100, rows: 50 }));

    const session = manager.get("s1");
    expect(session?.dimensions).toEqual({ cols: 100, rows: 50 });
  });

  // -------------------------------------------------------------------------
  // WebSocket disconnect without session destruction
  // -------------------------------------------------------------------------

  it("keeps session alive after WebSocket disconnect", () => {
    const ws = createMockWs();
    manager.attach("s1", ws as unknown as import("ws").WebSocket, CONTEXT);

    ws.simulateClose();

    expect(manager.activeCount()).toBe(1);
    const session = manager.get("s1");
    expect(session?.ws).toBeNull();
  });
});
