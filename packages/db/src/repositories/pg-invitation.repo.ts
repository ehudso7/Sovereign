import {
  toInvitationId,
  toOrgId,
  toUserId,
  toISODateString,
} from "@sovereign/core";
import type { OrgId, UserId, OrgRole, Invitation } from "@sovereign/core";
import type { UnscopedDb } from "../client.js";
import type { InvitationRepo } from "./types.js";

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
    const row = await this.db.queryOne<InvitationRow>(
      `INSERT INTO invitations (org_id, email, role, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [input.orgId, input.email, input.role, input.invitedBy, input.expiresAt],
    );
    if (!row) throw new Error("Failed to create invitation");
    return toInvitation(row);
  }

  async getById(id: string): Promise<Invitation | null> {
    const row = await this.db.queryOne<InvitationRow>(
      "SELECT * FROM invitations WHERE id = $1",
      [id],
    );
    return row ? toInvitation(row) : null;
  }

  async listForOrg(orgId: OrgId): Promise<Invitation[]> {
    const rows = await this.db.query<InvitationRow>(
      "SELECT * FROM invitations WHERE org_id = $1 AND accepted_at IS NULL ORDER BY created_at DESC",
      [orgId],
    );
    return rows.map(toInvitation);
  }

  async accept(id: string): Promise<Invitation | null> {
    const row = await this.db.queryOne<InvitationRow>(
      "UPDATE invitations SET accepted_at = now() WHERE id = $1 RETURNING *",
      [id],
    );
    return row ? toInvitation(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    const count = await this.db.execute(
      "DELETE FROM invitations WHERE id = $1",
      [id],
    );
    return count > 0;
  }
}
