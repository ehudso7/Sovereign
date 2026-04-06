// ---------------------------------------------------------------------------
// Session manager — manages terminal sessions and WebSocket connections
// ---------------------------------------------------------------------------

import type { WebSocket } from "ws";
import { PtyBridge } from "./pty-bridge.js";

/** Maximum number of output lines retained per session for replay. */
const MAX_OUTPUT_HISTORY = 500;

/** Default terminal dimensions. */
const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;

export interface SessionDimensions {
  cols: number;
  rows: number;
}

/**
 * Serializable state snapshot for a terminal session.
 * Used for persistence and reconnection replay.
 */
export interface SessionState {
  readonly outputHistory: readonly string[];
  readonly cwd: string;
  readonly envVars: Readonly<Record<string, string>>;
  readonly commandCount: number;
}

export interface SessionInfo {
  readonly sessionId: string;
  readonly orgId: string;
  readonly userId: string;
  ws: WebSocket | null;
  lastActivity: number;
  idleTimer: ReturnType<typeof setTimeout> | null;
  dimensions: SessionDimensions;
  outputHistory: string[];
  commandHistory: string[];
  commandCount: number;
  ptyBridge: PtyBridge;
}

export interface SessionManagerOptions {
  readonly idleTimeoutMs: number;
}

/**
 * Manages terminal sessions, WebSocket bindings, and idle cleanup.
 *
 * In production, each session maps to a sandboxed container or SSH
 * connection. This implementation manages the WebSocket lifecycle
 * and idle timeout behavior with PTY simulation and reconnection support.
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
      this.replayOutput(existing, ws);
    } else {
      const session: SessionInfo = {
        sessionId,
        orgId: context.orgId,
        userId: context.userId,
        ws,
        lastActivity: Date.now(),
        idleTimer: null,
        dimensions: { cols: DEFAULT_COLS, rows: DEFAULT_ROWS },
        outputHistory: [],
        commandHistory: [],
        commandCount: 0,
        ptyBridge: new PtyBridge(),
      };
      this.sessions.set(sessionId, session);
      this.resetIdleTimer(sessionId);
    }

    this.bindWebSocket(sessionId, ws);
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

  /** Resize a session's terminal dimensions. */
  resize(sessionId: string, dimensions: SessionDimensions): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.dimensions = { cols: dimensions.cols, rows: dimensions.rows };
  }

  /** Get serializable session state for persistence. */
  getState(sessionId: string): SessionState | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    return {
      outputHistory: [...session.outputHistory],
      cwd: session.ptyBridge.getCwd(),
      envVars: session.ptyBridge.getEnvSnapshot(),
      commandCount: session.commandCount,
    };
  }

  /** Replay output history to a newly connected WebSocket. */
  private replayOutput(session: SessionInfo, ws: WebSocket): void {
    if (session.outputHistory.length === 0) return;

    const replay = JSON.stringify({
      type: "replay",
      lines: session.outputHistory,
    });

    if (ws.readyState === 1) {
      ws.send(replay);
    }
  }

  /** Append a line to output history, trimming to MAX_OUTPUT_HISTORY. */
  private appendOutput(session: SessionInfo, line: string): void {
    session.outputHistory.push(line);
    if (session.outputHistory.length > MAX_OUTPUT_HISTORY) {
      session.outputHistory.splice(
        0,
        session.outputHistory.length - MAX_OUTPUT_HISTORY,
      );
    }
  }

  /** Bind message and close handlers on a WebSocket for a given session. */
  private bindWebSocket(sessionId: string, ws: WebSocket): void {
    ws.on("message", (data) => {
      const session = this.sessions.get(sessionId);
      if (!session) return;

      session.lastActivity = Date.now();
      this.resetIdleTimer(sessionId);

      const raw = typeof data === "string" ? data : data.toString("utf-8");

      // Try to parse structured messages
      let parsed: { type?: string; command?: string; cols?: number; rows?: number } | undefined;
      try {
        parsed = JSON.parse(raw) as {
          type?: string;
          command?: string;
          cols?: number;
          rows?: number;
        };
      } catch {
        // Not JSON — treat as raw command
      }

      if (parsed?.type === "resize" && typeof parsed.cols === "number" && typeof parsed.rows === "number") {
        this.resize(sessionId, { cols: parsed.cols, rows: parsed.rows });
        return;
      }

      const command = parsed?.type === "command" && typeof parsed.command === "string"
        ? parsed.command
        : raw;

      // Execute command via PTY bridge
      void this.executeCommand(session, command, ws);
    });

    ws.on("close", () => {
      const session = this.sessions.get(sessionId);
      if (session && session.ws === ws) {
        session.ws = null;
        // Don't destroy session on disconnect — allow reconnect
      }
    });
  }

  /** Execute a command through the PTY bridge and send results back. */
  private async executeCommand(
    session: SessionInfo,
    command: string,
    ws: WebSocket,
  ): Promise<void> {
    session.commandHistory.push(command);
    session.commandCount++;

    try {
      const result = await session.ptyBridge.execute(command);

      const outputLine = result.stdout || result.stderr || "";
      if (outputLine) {
        this.appendOutput(session, outputLine);
      }

      const response = JSON.stringify({
        type: "output",
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        cwd: session.ptyBridge.getCwd(),
      });

      if (ws.readyState === 1) {
        ws.send(response);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Command execution failed";
      this.appendOutput(session, `error: ${message}`);

      const errorResponse = JSON.stringify({
        type: "error",
        message,
      });

      if (ws.readyState === 1) {
        ws.send(errorResponse);
      }
    }
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
