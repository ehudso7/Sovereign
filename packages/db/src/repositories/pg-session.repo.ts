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
  provider_session_id: string | null;
  token_hash: string;
  expires_at: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

interface SessionLookupRow {
  id: string;
  org_id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
}

function toSession(row: SessionRow): Session {
  return {
    id: toSessionId(row.id),
    userId: toUserId(row.user_id),
    orgId: toOrgId(row.org_id),
    role: row.role as OrgRole,
    providerSessionId: row.provider_session_id ?? undefined,
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
    providerSessionId?: string;
    tokenHash: string;
    expiresAt: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<Session> {
    return this.db.transactionWithOrg(input.orgId, async (tx) => {
      const row = await tx.queryOne<SessionRow>(
        `INSERT INTO sessions (
           user_id,
           org_id,
           role,
           provider_session_id,
           token_hash,
           expires_at,
           ip_address,
           user_agent
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          input.userId,
          input.orgId,
          input.role,
          input.providerSessionId ?? null,
          input.tokenHash,
          input.expiresAt,
          input.ipAddress ?? null,
          input.userAgent ?? null,
        ],
      );
      if (!row) throw new Error("Failed to create session");
      return toSession(row);
    });
  }

  async getById(id: SessionId): Promise<Session | null> {
    const lookup = await this.db.queryOne<SessionLookupRow>(
      "SELECT * FROM session_lookup WHERE id = $1",
      [id],
    );

    if (!lookup) {
      return null;
    }

    return this.db.transactionWithOrg(toOrgId(lookup.org_id), async (tx) => {
      const row = await tx.queryOne<SessionRow>(
        "SELECT * FROM sessions WHERE id = $1",
        [id],
      );
      return row ? toSession(row) : null;
    });
  }

  async getByTokenHash(tokenHash: string): Promise<Session | null> {
    const lookup = await this.db.queryOne<SessionLookupRow>(
      "SELECT * FROM session_lookup WHERE token_hash = $1",
      [tokenHash],
    );

    if (!lookup) {
      return null;
    }

    return this.db.transactionWithOrg(toOrgId(lookup.org_id), async (tx) => {
      const row = await tx.queryOne<SessionRow>(
        "SELECT * FROM sessions WHERE token_hash = $1",
        [tokenHash],
      );
      return row ? toSession(row) : null;
    });
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
    const lookup = await this.db.queryOne<SessionLookupRow>(
      "SELECT * FROM session_lookup WHERE id = $1",
      [id],
    );

    if (!lookup) {
      return false;
    }

    const count = await this.db.transactionWithOrg(toOrgId(lookup.org_id), async (tx) => {
      return tx.execute("DELETE FROM sessions WHERE id = $1", [id]);
    });
    return count > 0;
  }

  async deleteExpired(): Promise<number> {
    const expired = await this.db.query<SessionLookupRow>(
      "SELECT * FROM session_lookup WHERE expires_at < now() ORDER BY org_id",
    );

    let total = 0;
    const sessionsByOrg = new Map<string, string[]>();

    for (const session of expired) {
      const current = sessionsByOrg.get(session.org_id) ?? [];
      current.push(session.id);
      sessionsByOrg.set(session.org_id, current);
    }

    for (const [orgId, sessionIds] of sessionsByOrg) {
      const count = await this.db.transactionWithOrg(toOrgId(orgId), async (tx) => {
        return tx.execute("DELETE FROM sessions WHERE id = ANY($1::uuid[])", [sessionIds]);
      });
      total += count;
    }

    return total;
  }
}
