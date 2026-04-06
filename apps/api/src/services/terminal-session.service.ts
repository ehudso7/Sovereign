// ---------------------------------------------------------------------------
// Terminal Session Service — Phase 15
// ---------------------------------------------------------------------------

import type {
  OrgId,
  UserId,
  TerminalSessionId,
  TerminalSession,
  TerminalSessionStatus,
  Result,
  AuditEmitter,
} from "@sovereign/core";
import { ok, err, AppError, toTerminalSessionId, toISODateString } from "@sovereign/core";
import crypto from "node:crypto";

interface CreateSessionInput {
  orgId: OrgId;
  userId: UserId;
  projectId?: string;
  metadata: Record<string, unknown>;
}

interface ListSessionsInput {
  userId: UserId;
  status?: TerminalSessionStatus;
}

/**
 * In-memory terminal session service for Phase 15a foundation.
 * Will be replaced with PgTerminalSessionService backed by real repos
 * in Phase 15b when the terminal proxy is fully wired.
 */
export class TerminalSessionService {
  private readonly sessions = new Map<string, TerminalSession>();

  constructor(
    private readonly orgId: OrgId,
    private readonly audit: AuditEmitter,
  ) {}

  async createSession(input: CreateSessionInput): Promise<Result<TerminalSession>> {
    const id = toTerminalSessionId(crypto.randomUUID());
    const now = toISODateString(new Date());

    const session: TerminalSession = {
      id,
      orgId: input.orgId,
      userId: input.userId,
      projectId: input.projectId ? (input.projectId as never) : null,
      status: "active",
      containerId: null,
      startedAt: now,
      lastActive: now,
      closedAt: null,
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.set(id, session);

    await this.audit.emit({
      orgId: input.orgId,
      action: "terminal.session_created" as never,
      actorType: "user",
      actorId: input.userId,
      resourceType: "terminal_session",
      resourceId: id,
      metadata: {},
    });

    return ok(session);
  }

  async listSessions(input: ListSessionsInput): Promise<Result<TerminalSession[]>> {
    const results: TerminalSession[] = [];
    for (const session of this.sessions.values()) {
      if (session.orgId !== this.orgId) continue;
      if (session.userId !== input.userId) continue;
      if (input.status && session.status !== input.status) continue;
      results.push(session);
    }
    return ok(results);
  }

  async getSession(sessionId: TerminalSessionId): Promise<Result<TerminalSession>> {
    const session = this.sessions.get(sessionId);
    if (!session || session.orgId !== this.orgId) {
      return err(AppError.notFound("TerminalSession", sessionId));
    }
    return ok(session);
  }

  async closeSession(sessionId: TerminalSessionId): Promise<Result<TerminalSession>> {
    const session = this.sessions.get(sessionId);
    if (!session || session.orgId !== this.orgId) {
      return err(AppError.notFound("TerminalSession", sessionId));
    }

    const now = toISODateString(new Date());
    const updated: TerminalSession = {
      ...session,
      status: "closed",
      closedAt: now,
      updatedAt: now,
    };
    this.sessions.set(sessionId, updated);

    await this.audit.emit({
      orgId: this.orgId,
      action: "terminal.session_closed" as never,
      actorType: "user",
      actorId: session.userId,
      resourceType: "terminal_session",
      resourceId: sessionId,
      metadata: {},
    });

    return ok(updated);
  }

  async updateSessionMetadata(
    sessionId: TerminalSessionId,
    metadata: Record<string, unknown>,
  ): Promise<Result<TerminalSession>> {
    const session = this.sessions.get(sessionId);
    if (!session || session.orgId !== this.orgId) {
      return err(AppError.notFound("TerminalSession", sessionId));
    }

    const now = toISODateString(new Date());
    const updated: TerminalSession = {
      ...session,
      metadata: { ...session.metadata, ...metadata },
      updatedAt: now,
    };
    this.sessions.set(sessionId, updated);
    return ok(updated);
  }
}
