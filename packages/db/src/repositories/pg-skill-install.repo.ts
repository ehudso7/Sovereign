import {
  toSkillInstallId,
  toOrgId,
  toSkillId,
  toUserId,
  toISODateString,
} from "@sovereign/core";
import type {
  OrgId,
  SkillId,
  SkillInstall,
} from "@sovereign/core";
import type { TenantDb } from "../client.js";
import type { SkillInstallRepo } from "./types.js";

interface SkillInstallRow {
  id: string;
  org_id: string;
  skill_id: string;
  skill_slug: string;
  enabled: boolean;
  installed_by: string;
  created_at: string;
  updated_at: string;
}

function toInstall(row: SkillInstallRow): SkillInstall {
  return {
    id: toSkillInstallId(row.id),
    orgId: toOrgId(row.org_id),
    skillId: toSkillId(row.skill_id),
    skillSlug: row.skill_slug,
    enabled: row.enabled,
    installedBy: toUserId(row.installed_by),
    createdAt: toISODateString(row.created_at),
    updatedAt: toISODateString(row.updated_at),
  };
}

/**
 * Skill install repo is tenant-scoped.
 * All operations run inside transactions to ensure app.current_org_id is set for RLS.
 */
export class PgSkillInstallRepo implements SkillInstallRepo {
  constructor(private readonly db: TenantDb) {}

  async create(input: {
    orgId: OrgId;
    skillId: SkillId;
    skillSlug: string;
    installedBy: string;
  }): Promise<SkillInstall> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<SkillInstallRow>(
        `INSERT INTO skill_installs (org_id, skill_id, skill_slug, installed_by)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [
          this.db.orgId,
          input.skillId,
          input.skillSlug,
          input.installedBy,
        ],
      );
      if (!row) throw new Error("Failed to create skill install");
      return toInstall(row);
    });
  }

  async getBySkillId(skillId: SkillId, _orgId: OrgId): Promise<SkillInstall | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<SkillInstallRow>(
        "SELECT * FROM skill_installs WHERE skill_id = $1 AND org_id = $2",
        [skillId, this.db.orgId],
      );
      return row ? toInstall(row) : null;
    });
  }

  async listForOrg(_orgId: OrgId, filters?: { enabled?: boolean }): Promise<SkillInstall[]> {
    return this.db.transaction(async (tx) => {
      const conditions: string[] = ["org_id = $1"];
      const params: unknown[] = [this.db.orgId];
      let idx = 2;

      if (filters?.enabled !== undefined) {
        conditions.push(`enabled = $${idx++}`);
        params.push(filters.enabled);
      }

      const rows = await tx.query<SkillInstallRow>(
        `SELECT * FROM skill_installs WHERE ${conditions.join(" AND ")} ORDER BY created_at`,
        params,
      );
      return rows.map(toInstall);
    });
  }

  async delete(skillId: SkillId, _orgId: OrgId): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const count = await tx.execute(
        "DELETE FROM skill_installs WHERE skill_id = $1 AND org_id = $2",
        [skillId, this.db.orgId],
      );
      return count > 0;
    });
  }
}
