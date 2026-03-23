import {
  toAgentVersionId,
  toOrgId,
  toAgentId,
  toUserId,
  toISODateString,
} from "@sovereign/core";
import type {
  OrgId,
  UserId,
  AgentId,
  AgentVersionId,
  AgentVersion,
  ToolConfig,
  BudgetConfig,
  ApprovalRuleConfig,
  MemoryConfig,
  ScheduleConfig,
  ModelConfig,
} from "@sovereign/core";
import type { TenantDb } from "../client.js";
import type { AgentVersionRepo } from "./types.js";

interface AgentVersionRow {
  id: string;
  org_id: string;
  agent_id: string;
  version: number;
  goals: unknown;
  instructions: string;
  tools: unknown;
  budget: unknown;
  approval_rules: unknown;
  memory_config: unknown;
  schedule: unknown;
  model_config: unknown;
  published: boolean;
  published_at: string | null;
  created_by: string;
  created_at: string;
}

function toAgentVersion(row: AgentVersionRow): AgentVersion {
  return {
    id: toAgentVersionId(row.id),
    orgId: toOrgId(row.org_id),
    agentId: toAgentId(row.agent_id),
    version: row.version,
    goals: row.goals as string[],
    instructions: row.instructions,
    tools: row.tools as ToolConfig[],
    budget: (row.budget as BudgetConfig) ?? null,
    approvalRules: row.approval_rules as ApprovalRuleConfig[],
    memoryConfig: (row.memory_config as MemoryConfig) ?? null,
    schedule: (row.schedule as ScheduleConfig) ?? null,
    modelConfig: row.model_config as ModelConfig,
    published: row.published,
    publishedAt: row.published_at ? toISODateString(row.published_at) : undefined,
    createdBy: toUserId(row.created_by),
    createdAt: toISODateString(row.created_at),
  };
}

/**
 * Agent version repo is tenant-scoped.
 * All operations run inside transactions to ensure app.current_org_id is set for RLS.
 */
export class PgAgentVersionRepo implements AgentVersionRepo {
  constructor(private readonly db: TenantDb) {}

  async create(input: {
    orgId: OrgId;
    agentId: AgentId;
    version: number;
    goals: readonly string[];
    instructions: string;
    tools: readonly ToolConfig[];
    budget: BudgetConfig | null;
    approvalRules: readonly ApprovalRuleConfig[];
    memoryConfig: MemoryConfig | null;
    schedule: ScheduleConfig | null;
    modelConfig: ModelConfig;
    createdBy: UserId;
  }): Promise<AgentVersion> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<AgentVersionRow>(
        `INSERT INTO agent_versions
           (org_id, agent_id, version, goals, instructions, tools,
            budget, approval_rules, memory_config, schedule, model_config, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          this.db.orgId,
          input.agentId,
          input.version,
          JSON.stringify(input.goals),
          input.instructions,
          JSON.stringify(input.tools),
          input.budget ? JSON.stringify(input.budget) : null,
          JSON.stringify(input.approvalRules),
          input.memoryConfig ? JSON.stringify(input.memoryConfig) : null,
          input.schedule ? JSON.stringify(input.schedule) : null,
          JSON.stringify(input.modelConfig),
          input.createdBy,
        ],
      );
      if (!row) throw new Error("Failed to create agent version");
      return toAgentVersion(row);
    });
  }

  async getById(id: AgentVersionId, _orgId: OrgId): Promise<AgentVersion | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<AgentVersionRow>(
        "SELECT * FROM agent_versions WHERE id = $1 AND org_id = $2",
        [id, this.db.orgId],
      );
      return row ? toAgentVersion(row) : null;
    });
  }

  async getByVersion(agentId: AgentId, version: number): Promise<AgentVersion | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<AgentVersionRow>(
        "SELECT * FROM agent_versions WHERE agent_id = $1 AND version = $2",
        [agentId, version],
      );
      return row ? toAgentVersion(row) : null;
    });
  }

  async listForAgent(agentId: AgentId): Promise<AgentVersion[]> {
    return this.db.transaction(async (tx) => {
      const rows = await tx.query<AgentVersionRow>(
        "SELECT * FROM agent_versions WHERE agent_id = $1 ORDER BY version",
        [agentId],
      );
      return rows.map(toAgentVersion);
    });
  }

  async getLatestVersion(agentId: AgentId): Promise<number> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<{ max_version: number }>(
        "SELECT COALESCE(MAX(version), 0) AS max_version FROM agent_versions WHERE agent_id = $1",
        [agentId],
      );
      return row?.max_version ?? 0;
    });
  }

  async getPublished(agentId: AgentId): Promise<AgentVersion | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<AgentVersionRow>(
        "SELECT * FROM agent_versions WHERE agent_id = $1 AND published = true",
        [agentId],
      );
      return row ? toAgentVersion(row) : null;
    });
  }

  async update(
    id: AgentVersionId,
    _orgId: OrgId,
    input: {
      goals?: readonly string[];
      instructions?: string;
      tools?: readonly ToolConfig[];
      budget?: BudgetConfig | null;
      approvalRules?: readonly ApprovalRuleConfig[];
      memoryConfig?: MemoryConfig | null;
      schedule?: ScheduleConfig | null;
      modelConfig?: ModelConfig;
    },
  ): Promise<AgentVersion | null> {
    return this.db.transaction(async (tx) => {
      const sets: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (input.goals !== undefined) { sets.push(`goals = $${idx++}`); params.push(JSON.stringify(input.goals)); }
      if (input.instructions !== undefined) { sets.push(`instructions = $${idx++}`); params.push(input.instructions); }
      if (input.tools !== undefined) { sets.push(`tools = $${idx++}`); params.push(JSON.stringify(input.tools)); }
      if (input.budget !== undefined) { sets.push(`budget = $${idx++}`); params.push(input.budget ? JSON.stringify(input.budget) : null); }
      if (input.approvalRules !== undefined) { sets.push(`approval_rules = $${idx++}`); params.push(JSON.stringify(input.approvalRules)); }
      if (input.memoryConfig !== undefined) { sets.push(`memory_config = $${idx++}`); params.push(input.memoryConfig ? JSON.stringify(input.memoryConfig) : null); }
      if (input.schedule !== undefined) { sets.push(`schedule = $${idx++}`); params.push(input.schedule ? JSON.stringify(input.schedule) : null); }
      if (input.modelConfig !== undefined) { sets.push(`model_config = $${idx++}`); params.push(JSON.stringify(input.modelConfig)); }

      if (sets.length === 0) {
        const row = await tx.queryOne<AgentVersionRow>(
          "SELECT * FROM agent_versions WHERE id = $1 AND org_id = $2",
          [id, this.db.orgId],
        );
        return row ? toAgentVersion(row) : null;
      }

      params.push(id);
      params.push(this.db.orgId);

      const row = await tx.queryOne<AgentVersionRow>(
        `UPDATE agent_versions SET ${sets.join(", ")} WHERE id = $${idx++} AND org_id = $${idx} RETURNING *`,
        params,
      );
      return row ? toAgentVersion(row) : null;
    });
  }

  async publish(id: AgentVersionId, _orgId: OrgId): Promise<AgentVersion | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<AgentVersionRow>(
        `UPDATE agent_versions SET published = true, published_at = now()
         WHERE id = $1 AND org_id = $2
         RETURNING *`,
        [id, this.db.orgId],
      );
      return row ? toAgentVersion(row) : null;
    });
  }

  async unpublishAll(agentId: AgentId): Promise<number> {
    return this.db.transaction(async (tx) => {
      const count = await tx.execute(
        "UPDATE agent_versions SET published = false, published_at = NULL WHERE agent_id = $1 AND published = true",
        [agentId],
      );
      return count;
    });
  }
}
