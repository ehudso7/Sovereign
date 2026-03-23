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
    return this.db.transactionWithOrg(input.orgId, async (tx) => {
      const row = await tx.queryOne<SessionRow>(
        `INSERT INTO sessions (user_id, org_id, role, token_hash, expires_at, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [input.userId, input.orgId, input.role, input.tokenHash, input.expiresAt, input.ipAddress ?? null, input.userAgent ?? null],
      );
      if (!row) throw new Error("Failed to create session");
      return toSession(row);
    });
  }

  async getById(id: SessionId): Promise<Session | null> {
    // Session lookup without known org — scan each org context.
    const orgs = await this.db.query<{ id: string }>("SELECT id FROM organizations");
    for (const org of orgs) {
      const orgId = toOrgId(org.id);
      const row = await this.db.transactionWithOrg(orgId, async (tx) => {
        return tx.queryOne<SessionRow>(
          "SELECT * FROM sessions WHERE id = $1",
          [id],
        );
      });
      if (row) return toSession(row);
    }
    return null;
  }

  async getByTokenHash(tokenHash: string): Promise<Session | null> {
    // Session token lookup is the auth bootstrap path.
    // With FORCE RLS on sessions, we need to scan each org context.
    // In production, this should be optimized with a SECURITY DEFINER function
    // or proper role separation (app role vs owner role).
    const orgs = await this.db.query<{ id: string }>("SELECT id FROM organizations");
    for (const org of orgs) {
      const orgId = toOrgId(org.id);
      const row = await this.db.transactionWithOrg(orgId, async (tx) => {
        return tx.queryOne<SessionRow>(
          "SELECT * FROM sessions WHERE token_hash = $1",
          [tokenHash],
        );
      });
      if (row) return toSession(row);
    }
    return null;
  }

  async listForUser(orgId: OrgId, userId: UserId): Promise<Session[]> {
    return this.db.transactionWithOrg(orgId, async (tx) => {
      const rows = await tx.query<SessionRow>(
        "SELECT * FROM sessions WHERE org_id = $1 AND user_id = $2 AND expires_at > now() ORDER BY created_at DESC",
        [orgId, userId],
      );
      return rows.map(toSession);
    });
  }

  async delete(id: SessionId): Promise<boolean> {
    const orgs = await this.db.query<{ id: string }>("SELECT id FROM organizations");
    for (const org of orgs) {
      const orgId = toOrgId(org.id);
      const count = await this.db.transactionWithOrg(orgId, async (tx) => {
        return tx.execute("DELETE FROM sessions WHERE id = $1", [id]);
      });
      if (count > 0) return true;
    }
    return false;
  }

  async deleteExpired(): Promise<number> {
    let total = 0;
    const orgs = await this.db.query<{ id: string }>("SELECT id FROM organizations");
    for (const org of orgs) {
      const orgId = toOrgId(org.id);
      const count = await this.db.transactionWithOrg(orgId, async (tx) => {
        return tx.execute("DELETE FROM sessions WHERE expires_at < now()");
      });
      total += count;
    }
    return total;
  }
}
