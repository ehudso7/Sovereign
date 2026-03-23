import {
  toMembershipId,
  toOrgId,
  toUserId,
  toISODateString,
} from "@sovereign/core";
import type { OrgId, UserId, MembershipId, OrgRole, Membership, User } from "@sovereign/core";
import type { UnscopedDb } from "../client.js";
import type { MembershipRepo } from "./types.js";

interface MembershipRow {
  id: string;
  org_id: string;
  user_id: string;
  role: string;
  invited_by: string | null;
  accepted_at: string | null;
  created_at: string;
}

interface MembershipWithUserRow extends MembershipRow {
  user_email: string;
  user_name: string;
  user_avatar_url: string | null;
  user_created_at: string;
  user_updated_at: string;
}

function toMembership(row: MembershipRow): Membership {
  return {
    id: toMembershipId(row.id),
    orgId: toOrgId(row.org_id),
    userId: toUserId(row.user_id),
    role: row.role as OrgRole,
    invitedBy: row.invited_by ? toUserId(row.invited_by) : undefined,
    acceptedAt: row.accepted_at ? toISODateString(row.accepted_at) : undefined,
    createdAt: toISODateString(row.created_at),
  };
}

function toMembershipWithUser(row: MembershipWithUserRow): Membership & { user: User } {
  return {
    ...toMembership(row),
    user: {
      id: toUserId(row.user_id),
      email: row.user_email,
      name: row.user_name,
      avatarUrl: row.user_avatar_url ?? undefined,
      createdAt: toISODateString(row.user_created_at),
      updatedAt: toISODateString(row.user_updated_at),
    },
  };
}

export class PgMembershipRepo implements MembershipRepo {
  constructor(private readonly db: UnscopedDb) {}

  async create(input: {
    orgId: OrgId;
    userId: UserId;
    role: OrgRole;
    invitedBy?: UserId;
    accepted?: boolean;
  }): Promise<Membership> {
    const row = await this.db.queryOne<MembershipRow>(
      `INSERT INTO memberships (org_id, user_id, role, invited_by, accepted_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [input.orgId, input.userId, input.role, input.invitedBy ?? null, input.accepted ? new Date().toISOString() : null],
    );
    if (!row) throw new Error("Failed to create membership");
    return toMembership(row);
  }

  async getForUser(orgId: OrgId, userId: UserId): Promise<Membership | null> {
    const row = await this.db.queryOne<MembershipRow>(
      "SELECT * FROM memberships WHERE org_id = $1 AND user_id = $2",
      [orgId, userId],
    );
    return row ? toMembership(row) : null;
  }

  async listForOrg(orgId: OrgId): Promise<(Membership & { user: User })[]> {
    const rows = await this.db.query<MembershipWithUserRow>(
      `SELECT m.*,
              u.email as user_email,
              u.name as user_name,
              u.avatar_url as user_avatar_url,
              u.created_at as user_created_at,
              u.updated_at as user_updated_at
       FROM memberships m
       INNER JOIN users u ON u.id = m.user_id
       WHERE m.org_id = $1
       ORDER BY m.created_at`,
      [orgId],
    );
    return rows.map(toMembershipWithUser);
  }

  async listForUser(userId: UserId): Promise<Membership[]> {
    const rows = await this.db.query<MembershipRow>(
      "SELECT * FROM memberships WHERE user_id = $1 ORDER BY created_at",
      [userId],
    );
    return rows.map(toMembership);
  }

  async updateRole(id: MembershipId, role: OrgRole): Promise<Membership | null> {
    const row = await this.db.queryOne<MembershipRow>(
      "UPDATE memberships SET role = $1 WHERE id = $2 RETURNING *",
      [role, id],
    );
    return row ? toMembership(row) : null;
  }

  async delete(orgId: OrgId, userId: UserId): Promise<boolean> {
    const count = await this.db.execute(
      "DELETE FROM memberships WHERE org_id = $1 AND user_id = $2",
      [orgId, userId],
    );
    return count > 0;
  }

  async countByRole(orgId: OrgId, role: OrgRole): Promise<number> {
    const row = await this.db.queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM memberships WHERE org_id = $1 AND role = $2",
      [orgId, role],
    );
    return parseInt(row?.count ?? "0", 10);
  }
}
