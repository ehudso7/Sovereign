import {
  toOrgId,
  toISODateString,
} from "@sovereign/core";
import type { OrgId, UserId, Organization } from "@sovereign/core";
import type { UnscopedDb } from "../client.js";
import type { OrgRepo } from "./types.js";

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

function toOrg(row: OrgRow): Organization {
  return {
    id: toOrgId(row.id),
    name: row.name,
    slug: row.slug,
    plan: row.plan,
    settings: row.settings,
    createdAt: toISODateString(row.created_at),
    updatedAt: toISODateString(row.updated_at),
  };
}

export class PgOrgRepo implements OrgRepo {
  constructor(private readonly db: UnscopedDb) {}

  async create(input: { name: string; slug: string }): Promise<Organization> {
    const row = await this.db.queryOne<OrgRow>(
      `INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING *`,
      [input.name, input.slug],
    );
    if (!row) throw new Error("Failed to create organization");
    return toOrg(row);
  }

  async countAll(): Promise<number> {
    const row = await this.db.queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM organizations",
    );
    return parseInt(row?.count ?? "0", 10);
  }

  async getById(id: OrgId): Promise<Organization | null> {
    const row = await this.db.queryOne<OrgRow>(
      "SELECT * FROM organizations WHERE id = $1",
      [id],
    );
    return row ? toOrg(row) : null;
  }

  async getBySlug(slug: string): Promise<Organization | null> {
    const row = await this.db.queryOne<OrgRow>(
      "SELECT * FROM organizations WHERE slug = $1",
      [slug],
    );
    return row ? toOrg(row) : null;
  }

  async update(id: OrgId, input: { name?: string; settings?: Record<string, unknown> }): Promise<Organization | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (input.name !== undefined) {
      sets.push(`name = $${idx++}`);
      params.push(input.name);
    }
    if (input.settings !== undefined) {
      sets.push(`settings = $${idx++}`);
      params.push(JSON.stringify(input.settings));
    }
    if (sets.length === 0) return this.getById(id);

    sets.push("updated_at = now()");
    params.push(id);

    const row = await this.db.queryOne<OrgRow>(
      `UPDATE organizations SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      params,
    );
    return row ? toOrg(row) : null;
  }

  async listForUser(userId: UserId): Promise<Organization[]> {
    // memberships table has FORCE RLS, so cross-org JOINs require per-org context.
    // Query all orgs (organizations table has no RLS), then check membership per-org.
    const allOrgs = await this.db.query<OrgRow>(
      "SELECT * FROM organizations ORDER BY created_at",
    );

    const result: Organization[] = [];
    for (const org of allOrgs) {
      const orgId = toOrgId(org.id);
      const membership = await this.db.transactionWithOrg(orgId, async (tx) => {
        return tx.queryOne<{ id: string }>(
          "SELECT id FROM memberships WHERE org_id = $1 AND user_id = $2",
          [orgId, userId],
        );
      });
      if (membership) {
        result.push(toOrg(org));
      }
    }
    return result;
  }
}
