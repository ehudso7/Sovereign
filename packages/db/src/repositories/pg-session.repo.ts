import {
  toSessionId,
  toUserId,
  toOrgId,
  toISODateString,
} from "@sovereign/core";
import type { OrgId, UserId, SessionId, OrgRole, Session } from "@sovereign/core";
import type { UnscopedDb } from "../client.js";
import type { SessionRepo } from "./types.js";

interface SessionRow {
  id: string;
  user_id: string;
  org_id: string;
  role: string;
  token_hash: string;
  expires_at: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

function toSession(row: SessionRow): Session {
  return {
    id: toSessionId(row.id),
    userId: toUserId(row.user_id),
    orgId: toOrgId(row.org_id),
    role: row.role as OrgRole,
    expiresAt: toISODateString(row.expires_at),
    createdAt: toISODateString(row.created_at),
    ipAddress: row.ip_address ?? undefined,
    userAgent: row.user_agent ?? undefined,
  };
}

export class PgSessionRepo implements SessionRepo {
  constructor(private readonly db: UnscopedDb) {}

  async create(input: {
    userId: UserId;
    orgId: OrgId;
    role: OrgRole;
    tokenHash: string;
    expiresAt: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<Session> {
    const row = await this.db.queryOne<SessionRow>(
      `INSERT INTO sessions (user_id, org_id, role, token_hash, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [input.userId, input.orgId, input.role, input.tokenHash, input.expiresAt, input.ipAddress ?? null, input.userAgent ?? null],
    );
    if (!row) throw new Error("Failed to create session");
    return toSession(row);
  }

  async getById(id: SessionId): Promise<Session | null> {
    const row = await this.db.queryOne<SessionRow>(
      "SELECT * FROM sessions WHERE id = $1",
      [id],
    );
    return row ? toSession(row) : null;
  }

  async getByTokenHash(tokenHash: string): Promise<Session | null> {
    const row = await this.db.queryOne<SessionRow>(
      "SELECT * FROM sessions WHERE token_hash = $1",
      [tokenHash],
    );
    return row ? toSession(row) : null;
  }

  async listForUser(orgId: OrgId, userId: UserId): Promise<Session[]> {
    const rows = await this.db.query<SessionRow>(
      "SELECT * FROM sessions WHERE org_id = $1 AND user_id = $2 AND expires_at > now() ORDER BY created_at DESC",
      [orgId, userId],
    );
    return rows.map(toSession);
  }

  async delete(id: SessionId): Promise<boolean> {
    const count = await this.db.execute(
      "DELETE FROM sessions WHERE id = $1",
      [id],
    );
    return count > 0;
  }

  async deleteExpired(): Promise<number> {
    return this.db.execute(
      "DELETE FROM sessions WHERE expires_at < now()",
    );
  }
}
