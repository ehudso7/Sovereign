// ---------------------------------------------------------------------------
// Browser session manager — manages active browser sessions in-process
// ---------------------------------------------------------------------------

import type { BrowserContext } from "./browser-provider.js";

interface ManagedSession {
  readonly sessionId: string;
  readonly dbSessionId: string;
  readonly context: BrowserContext;
  readonly createdAt: number;
  lastActivityAt: number;
}

export class SessionManager {
  private readonly sessions = new Map<string, ManagedSession>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly idleTimeoutMs = 5 * 60 * 1000) {}

  start(): void {
    this.cleanupInterval = setInterval(() => this.cleanupIdle(), 30_000);
  }

  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  register(dbSessionId: string, context: BrowserContext): void {
    this.sessions.set(dbSessionId, {
      sessionId: context.sessionId,
      dbSessionId,
      context,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    });
  }

  get(dbSessionId: string): BrowserContext | null {
    const managed = this.sessions.get(dbSessionId);
    if (!managed) return null;
    managed.lastActivityAt = Date.now();
    return managed.context;
  }

  async remove(dbSessionId: string): Promise<void> {
    const managed = this.sessions.get(dbSessionId);
    if (managed) {
      await managed.context.close();
      this.sessions.delete(dbSessionId);
    }
  }

  async closeAll(): Promise<void> {
    const entries = [...this.sessions.values()];
    this.sessions.clear();
    for (const entry of entries) {
      try {
        await entry.context.close();
      } catch {
        // ignore close errors during shutdown
      }
    }
  }

  getActiveCount(): number {
    return this.sessions.size;
  }

  private async cleanupIdle(): Promise<void> {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastActivityAt > this.idleTimeoutMs) {
        try {
          await session.context.close();
        } catch {
          // ignore
        }
        this.sessions.delete(id);
      }
    }
  }
}
