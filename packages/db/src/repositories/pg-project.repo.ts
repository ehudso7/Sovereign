import {
  toProjectId,
  toOrgId,
  toISODateString,
} from "@sovereign/core";
import type { OrgId, ProjectId, Project } from "@sovereign/core";
import type { TenantDb } from "../client.js";
import type { ProjectRepo } from "./types.js";

interface ProjectRow {
  id: string;
  org_id: string;
  name: string;
  slug: string;
  description: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

function toProject(row: ProjectRow): Project {
  return {
    id: toProjectId(row.id),
    orgId: toOrgId(row.org_id),
    name: row.name,
    slug: row.slug,
    description: row.description ?? undefined,
    settings: row.settings,
    createdAt: toISODateString(row.created_at),
    updatedAt: toISODateString(row.updated_at),
  };
}

/** Project repo is tenant-scoped — all queries automatically filter by orgId */
export class PgProjectRepo implements ProjectRepo {
  constructor(private readonly db: TenantDb) {}

  async create(input: {
    orgId: OrgId;
    name: string;
    slug: string;
    description?: string;
  }): Promise<Project> {
    const row = await this.db.queryOne<ProjectRow>(
      `INSERT INTO projects (org_id, name, slug, description)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [this.db.orgId, input.name, input.slug, input.description ?? null],
    );
    if (!row) throw new Error("Failed to create project");
    return toProject(row);
  }

  async getById(id: ProjectId, _orgId: OrgId): Promise<Project | null> {
    const row = await this.db.queryOne<ProjectRow>(
      "SELECT * FROM projects WHERE id = $1 AND org_id = $2",
      [id, this.db.orgId],
    );
    return row ? toProject(row) : null;
  }

  async listForOrg(_orgId: OrgId): Promise<Project[]> {
    const rows = await this.db.query<ProjectRow>(
      "SELECT * FROM projects WHERE org_id = $1 ORDER BY created_at",
      [this.db.orgId],
    );
    return rows.map(toProject);
  }

  async update(id: ProjectId, _orgId: OrgId, input: {
    name?: string;
    slug?: string;
    description?: string;
    settings?: Record<string, unknown>;
  }): Promise<Project | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (input.name !== undefined) { sets.push(`name = $${idx++}`); params.push(input.name); }
    if (input.slug !== undefined) { sets.push(`slug = $${idx++}`); params.push(input.slug); }
    if (input.description !== undefined) { sets.push(`description = $${idx++}`); params.push(input.description); }
    if (input.settings !== undefined) { sets.push(`settings = $${idx++}`); params.push(JSON.stringify(input.settings)); }
    if (sets.length === 0) return this.getById(id, _orgId);

    sets.push("updated_at = now()");
    params.push(id);
    params.push(this.db.orgId);

    const row = await this.db.queryOne<ProjectRow>(
      `UPDATE projects SET ${sets.join(", ")} WHERE id = $${idx++} AND org_id = $${idx} RETURNING *`,
      params,
    );
    return row ? toProject(row) : null;
  }

  async delete(id: ProjectId, _orgId: OrgId): Promise<boolean> {
    const count = await this.db.execute(
      "DELETE FROM projects WHERE id = $1 AND org_id = $2",
      [id, this.db.orgId],
    );
    return count > 0;
  }
}
