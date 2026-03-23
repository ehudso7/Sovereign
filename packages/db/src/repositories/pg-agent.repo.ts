import {
  toAgentId,
  toOrgId,
  toProjectId,
  toUserId,
  toISODateString,
} from "@sovereign/core";
import type {
  OrgId,
  UserId,
  ProjectId,
  AgentId,
  AgentStatus,
  Agent,
} from "@sovereign/core";
import type { TenantDb } from "../client.js";
import type { AgentRepo } from "./types.js";

interface AgentRow {
  id: string;
  org_id: string;
  project_id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

function toAgent(row: AgentRow): Agent {
  return {
    id: toAgentId(row.id),
    orgId: toOrgId(row.org_id),
    projectId: toProjectId(row.project_id),
    name: row.name,
    slug: row.slug,
    description: row.description ?? undefined,
    status: row.status as AgentStatus,
    createdBy: toUserId(row.created_by),
    createdAt: toISODateString(row.created_at),
    updatedAt: toISODateString(row.updated_at),
  };
}

/**
 * Agent repo is tenant-scoped.
 * All operations run inside transactions to ensure app.current_org_id is set for RLS.
 */
export class PgAgentRepo implements AgentRepo {
  constructor(private readonly db: TenantDb) {}

  async create(input: {
    orgId: OrgId;
    projectId: ProjectId;
    name: string;
    slug: string;
    description?: string;
    createdBy: UserId;
  }): Promise<Agent> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<AgentRow>(
        `INSERT INTO agents (org_id, project_id, name, slug, description, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          this.db.orgId,
          input.projectId,
          input.name,
          input.slug,
          input.description ?? null,
          input.createdBy,
        ],
      );
      if (!row) throw new Error("Failed to create agent");
      return toAgent(row);
    });
  }

  async getById(id: AgentId, _orgId: OrgId): Promise<Agent | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<AgentRow>(
        "SELECT * FROM agents WHERE id = $1 AND org_id = $2",
        [id, this.db.orgId],
      );
      return row ? toAgent(row) : null;
    });
  }

  async getBySlug(projectId: ProjectId, slug: string): Promise<Agent | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<AgentRow>(
        "SELECT * FROM agents WHERE project_id = $1 AND slug = $2 AND org_id = $3",
        [projectId, slug, this.db.orgId],
      );
      return row ? toAgent(row) : null;
    });
  }

  async listForOrg(
    _orgId: OrgId,
    filters?: { projectId?: ProjectId; status?: AgentStatus },
  ): Promise<Agent[]> {
    return this.db.transaction(async (tx) => {
      const conditions: string[] = ["org_id = $1"];
      const params: unknown[] = [this.db.orgId];
      let idx = 2;

      if (filters?.projectId !== undefined) {
        conditions.push(`project_id = $${idx++}`);
        params.push(filters.projectId);
      }
      if (filters?.status !== undefined) {
        conditions.push(`status = $${idx++}`);
        params.push(filters.status);
      }

      const rows = await tx.query<AgentRow>(
        `SELECT * FROM agents WHERE ${conditions.join(" AND ")} ORDER BY created_at`,
        params,
      );
      return rows.map(toAgent);
    });
  }

  async update(
    id: AgentId,
    _orgId: OrgId,
    input: { name?: string; description?: string },
  ): Promise<Agent | null> {
    return this.db.transaction(async (tx) => {
      const sets: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (input.name !== undefined) { sets.push(`name = $${idx++}`); params.push(input.name); }
      if (input.description !== undefined) { sets.push(`description = $${idx++}`); params.push(input.description); }
      if (sets.length === 0) {
        const row = await tx.queryOne<AgentRow>(
          "SELECT * FROM agents WHERE id = $1 AND org_id = $2",
          [id, this.db.orgId],
        );
        return row ? toAgent(row) : null;
      }

      sets.push("updated_at = now()");
      params.push(id);
      params.push(this.db.orgId);

      const row = await tx.queryOne<AgentRow>(
        `UPDATE agents SET ${sets.join(", ")} WHERE id = $${idx++} AND org_id = $${idx} RETURNING *`,
        params,
      );
      return row ? toAgent(row) : null;
    });
  }

  async updateStatus(id: AgentId, _orgId: OrgId, status: AgentStatus): Promise<Agent | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<AgentRow>(
        `UPDATE agents SET status = $1, updated_at = now()
         WHERE id = $2 AND org_id = $3
         RETURNING *`,
        [status, id, this.db.orgId],
      );
      return row ? toAgent(row) : null;
    });
  }

  async delete(id: AgentId, _orgId: OrgId): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const count = await tx.execute(
        "DELETE FROM agents WHERE id = $1 AND org_id = $2",
        [id, this.db.orgId],
      );
      return count > 0;
    });
  }
}
