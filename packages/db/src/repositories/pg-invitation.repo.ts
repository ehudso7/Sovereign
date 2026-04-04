import {
  toInvitationId,
  toOrgId,
  toUserId,
  toISODateString,
} from "@sovereign/core";
import type { OrgId, UserId, OrgRole, Invitation } from "@sovereign/core";
import type { UnscopedDb } from "../client.js";
import type { InvitationRepo } from "./types.js";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

interface InvitationRow {
  id: string;
  org_id: string;
  email: string;
  role: string;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

interface InvitationLookupRow {
  id: string;
  org_id: string;
  email_normalized: string;
  email: string;
  role: string;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

function toInvitation(row: InvitationRow): Invitation {
  return {
    id: toInvitationId(row.id),
    orgId: toOrgId(row.org_id),
    email: row.email,
    role: row.role as OrgRole,
    invitedBy: toUserId(row.invited_by),
    expiresAt: toISODateString(row.expires_at),
    acceptedAt: row.accepted_at ? toISODateString(row.accepted_at) : undefined,
    createdAt: toISODateString(row.created_at),
  };
}

export class PgInvitationRepo implements InvitationRepo {
  constructor(private readonly db: UnscopedDb) {}

  async create(input: {
    orgId: OrgId;
    email: string;
    role: OrgRole;
    invitedBy: UserId;
    expiresAt: string;
  }): Promise<Invitation> {
    const email = normalizeEmail(input.email);
    return this.db.transactionWithOrg(input.orgId, async (tx) => {
      const row = await tx.queryOne<InvitationRow>(
        `INSERT INTO invitations (org_id, email, role, invited_by, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [input.orgId, email, input.role, input.invitedBy, input.expiresAt],
      );
      if (!row) throw new Error("Failed to create invitation");
      return toInvitation(row);
    });
  }

  async getById(id: string): Promise<Invitation | null> {
    const lookup = await this.db.queryOne<InvitationLookupRow>(
      "SELECT * FROM invitation_lookup WHERE id = $1",
      [id],
    );

    if (!lookup) {
      return null;
    }

    return this.db.transactionWithOrg(toOrgId(lookup.org_id), async (tx) => {
      const row = await tx.queryOne<InvitationRow>(
        "SELECT * FROM invitations WHERE id = $1",
        [id],
      );
      return row ? toInvitation(row) : null;
    });
  }

  async listForOrg(orgId: OrgId): Promise<Invitation[]> {
    return this.db.transactionWithOrg(orgId, async (tx) => {
      const rows = await tx.query<InvitationRow>(
        "SELECT * FROM invitations WHERE org_id = $1 AND accepted_at IS NULL ORDER BY created_at DESC",
        [orgId],
      );
      return rows.map(toInvitation);
    });
  }

  async listPendingForEmail(email: string): Promise<Invitation[]> {
    const normalizedEmail = normalizeEmail(email);
    const rows = await this.db.query<InvitationLookupRow>(
      `SELECT *
       FROM invitation_lookup
       WHERE email_normalized = $1
         AND accepted_at IS NULL
         AND expires_at > now()
       ORDER BY created_at ASC`,
      [normalizedEmail],
    );

    return rows.map(toInvitation);
  }

  async accept(id: string): Promise<Invitation | null> {
    const lookup = await this.db.queryOne<InvitationLookupRow>(
      "SELECT * FROM invitation_lookup WHERE id = $1",
      [id],
    );

    if (!lookup) {
      return null;
    }

    return this.db.transactionWithOrg(toOrgId(lookup.org_id), async (tx) => {
      const row = await tx.queryOne<InvitationRow>(
        "UPDATE invitations SET accepted_at = now() WHERE id = $1 RETURNING *",
        [id],
      );
      return row ? toInvitation(row) : null;
    });
  }

  async delete(id: string): Promise<boolean> {
    const lookup = await this.db.queryOne<InvitationLookupRow>(
      "SELECT * FROM invitation_lookup WHERE id = $1",
      [id],
    );

    if (!lookup) {
      return false;
    }

    const count = await this.db.transactionWithOrg(toOrgId(lookup.org_id), async (tx) => {
      return tx.execute("DELETE FROM invitations WHERE id = $1", [id]);
    });
    return count > 0;
  }
}
