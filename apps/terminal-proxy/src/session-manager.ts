// ---------------------------------------------------------------------------
// Session manager — manages terminal sessions and WebSocket connections
// ---------------------------------------------------------------------------

import type { WebSocket } from "ws";

export interface SessionInfo {
  readonly sessionId: string;
  readonly orgId: string;
  readonly userId: string;
  ws: WebSocket | null;
  lastActivity: number;
  idleTimer: ReturnType<typeof setTimeout> | null;
}

export interface SessionManagerOptions {
  readonly idleTimeoutMs: number;
}

/**
 * Manages terminal sessions, WebSocket bindings, and idle cleanup.
 *
 * In production, each session maps to a sandboxed container or SSH
 * connection. This implementation manages the WebSocket lifecycle
 * and idle timeout behavior.
 */
export class SessionManager {
  private readonly sessions = new Map<string, SessionInfo>();
  private readonly idleTimeoutMs: number;

  constructor(options: SessionManagerOptions) {
    this.idleTimeoutMs = options.idleTimeoutMs;
  }

  /** Attach a WebSocket to a session. Creates the session if it doesn't exist. */
  attach(
    sessionId: string,
    ws: WebSocket,
    context: { orgId: string; userId: string },
  ): void {
    const existing = this.sessions.get(sessionId);

    if (existing) {
      // Reconnect scenario — close old WebSocket if still open
      if (existing.ws && existing.ws.readyState <= 1) {
        existing.ws.close(4010, "Replaced by new connection");
      }
      existing.ws = ws;
      existing.lastActivity = Date.now();
      this.resetIdleTimer(sessionId);
    } else {
      const session: SessionInfo = {
        sessionId,
        orgId: context.orgId,
        userId: context.userId,
        ws,
        lastActivity: Date.now(),
        idleTimer: null,
      };
      this.sessions.set(sessionId, session);
      this.resetIdleTimer(sessionId);
    }

    ws.on("message", (data) => {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.lastActivity = Date.now();
        this.resetIdleTimer(sessionId);
      }
      // In production: forward data to PTY/container stdin
      // For now, echo back for proof-of-concept
      if (ws.readyState === 1) {
        ws.send(data);
      }
    });

    ws.on("close", () => {
      const session = this.sessions.get(sessionId);
      if (session && session.ws === ws) {
        session.ws = null;
        // Don't destroy session on disconnect — allow reconnect
      }
    });
  }

  /** Close a specific session and its WebSocket. */
  close(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (session.idleTimer) {
      clearTimeout(session.idleTimer);
    }
    if (session.ws && session.ws.readyState <= 1) {
      session.ws.close(1000, "Session closed");
    }
    this.sessions.delete(sessionId);
  }

  /** Close all sessions (for graceful shutdown). */
  closeAll(): void {
    for (const sessionId of this.sessions.keys()) {
      this.close(sessionId);
    }
  }

  /** Get the count of active sessions. */
  activeCount(): number {
    return this.sessions.size;
  }

  /** Get session info by ID. */
  get(sessionId: string): SessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  private resetIdleTimer(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (session.idleTimer) {
      clearTimeout(session.idleTimer);
    }

    session.idleTimer = setTimeout(() => {
      this.close(sessionId);
    }, this.idleTimeoutMs);
  }
}
