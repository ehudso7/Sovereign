import {
  toRunId,
  toOrgId,
  toProjectId,
  toAgentId,
  toAgentVersionId,
  toUserId,
  toISODateString,
} from "@sovereign/core";
import type {
  OrgId,
  AgentId,
  ProjectId,
  RunId,
  RunStatus,
  Run,
  CreateRunInput,
  ISODateString,
} from "@sovereign/core";
import type { TenantDb } from "../client.js";
import type { RunRepo } from "./types.js";

interface RunRow {
  id: string;
  org_id: string;
  project_id: string;
  agent_id: string;
  agent_version_id: string;
  status: string;
  trigger_type: string;
  triggered_by: string;
  execution_provider: string;
  input: Record<string, unknown> | string;
  config_snapshot: Record<string, unknown> | string;
  output: Record<string, unknown> | string | null;
  error: { code: string; message: string } | string | null;
  token_usage: { inputTokens: number; outputTokens: number; totalTokens: number } | string | null;
  cost_cents: number | null;
  attempt_count: number;
  temporal_workflow_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

function parseJson<T>(val: T | string | null): T | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "string") return JSON.parse(val) as T;
  return val;
}

function parseJsonRequired<T>(val: T | string): T {
  if (typeof val === "string") return JSON.parse(val) as T;
  return val;
}

function toRun(row: RunRow): Run {
  return {
    id: toRunId(row.id),
    orgId: toOrgId(row.org_id),
    projectId: toProjectId(row.project_id),
    agentId: toAgentId(row.agent_id),
    agentVersionId: toAgentVersionId(row.agent_version_id),
    status: row.status as RunStatus,
    triggerType: row.trigger_type as Run["triggerType"],
    triggeredBy: toUserId(row.triggered_by),
    executionProvider: row.execution_provider as Run["executionProvider"],
    input: parseJsonRequired<Record<string, unknown>>(row.input),
    configSnapshot: parseJsonRequired<Record<string, unknown>>(row.config_snapshot),
    output: parseJson<Record<string, unknown>>(row.output),
    error: parseJson<{ code: string; message: string }>(row.error),
    tokenUsage: parseJson<{ inputTokens: number; outputTokens: number; totalTokens: number }>(row.token_usage),
    costCents: row.cost_cents,
    attemptCount: row.attempt_count,
    temporalWorkflowId: row.temporal_workflow_id,
    startedAt: row.started_at ? toISODateString(row.started_at) : null,
    completedAt: row.completed_at ? toISODateString(row.completed_at) : null,
    createdAt: toISODateString(row.created_at),
    updatedAt: toISODateString(row.updated_at),
  };
}

/**
 * Run repo is tenant-scoped.
 * All operations run inside transactions to ensure app.current_org_id is set for RLS.
 */
export class PgRunRepo implements RunRepo {
  constructor(private readonly db: TenantDb) {}

  async create(input: CreateRunInput): Promise<Run> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<RunRow>(
        `INSERT INTO runs (
          org_id, project_id, agent_id, agent_version_id,
          trigger_type, triggered_by, execution_provider,
          input, config_snapshot
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          this.db.orgId,
          input.projectId,
          input.agentId,
          input.agentVersionId,
          input.triggerType,
          input.triggeredBy,
          input.executionProvider,
          JSON.stringify(input.input ?? {}),
          JSON.stringify(input.configSnapshot),
        ],
      );
      if (!row) throw new Error("Failed to create run");
      return toRun(row);
    });
  }

  async getById(id: RunId, _orgId: OrgId): Promise<Run | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<RunRow>(
        "SELECT * FROM runs WHERE id = $1 AND org_id = $2",
        [id, this.db.orgId],
      );
      return row ? toRun(row) : null;
    });
  }

  async listForOrg(
    _orgId: OrgId,
    filters?: { agentId?: AgentId; projectId?: ProjectId; status?: RunStatus },
  ): Promise<Run[]> {
    return this.db.transaction(async (tx) => {
      const conditions: string[] = ["org_id = $1"];
      const params: unknown[] = [this.db.orgId];
      let idx = 2;

      if (filters?.agentId !== undefined) {
        conditions.push(`agent_id = $${idx++}`);
        params.push(filters.agentId);
      }
      if (filters?.projectId !== undefined) {
        conditions.push(`project_id = $${idx++}`);
        params.push(filters.projectId);
      }
      if (filters?.status !== undefined) {
        conditions.push(`status = $${idx++}`);
        params.push(filters.status);
      }

      const rows = await tx.query<RunRow>(
        `SELECT * FROM runs WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`,
        params,
      );
      return rows.map(toRun);
    });
  }

  async listForAgent(agentId: AgentId, _orgId: OrgId): Promise<Run[]> {
    return this.db.transaction(async (tx) => {
      const rows = await tx.query<RunRow>(
        "SELECT * FROM runs WHERE agent_id = $1 AND org_id = $2 ORDER BY created_at DESC",
        [agentId, this.db.orgId],
      );
      return rows.map(toRun);
    });
  }

  async updateStatus(
    id: RunId,
    _orgId: OrgId,
    status: RunStatus,
    extras?: {
      output?: Record<string, unknown>;
      error?: { code: string; message: string };
      tokenUsage?: { inputTokens: number; outputTokens: number; totalTokens: number };
      costCents?: number;
      startedAt?: ISODateString;
      completedAt?: ISODateString;
    },
  ): Promise<Run | null> {
    return this.db.transaction(async (tx) => {
      const sets: string[] = ["status = $1"];
      const params: unknown[] = [status];
      let idx = 2;

      if (extras?.output !== undefined) {
        sets.push(`output = $${idx++}`);
        params.push(JSON.stringify(extras.output));
      }
      if (extras?.error !== undefined) {
        sets.push(`error = $${idx++}`);
        params.push(JSON.stringify(extras.error));
      }
      if (extras?.tokenUsage !== undefined) {
        sets.push(`token_usage = $${idx++}`);
        params.push(JSON.stringify(extras.tokenUsage));
      }
      if (extras?.costCents !== undefined) {
        sets.push(`cost_cents = $${idx++}`);
        params.push(extras.costCents);
      }
      if (extras?.startedAt !== undefined) {
        sets.push(`started_at = $${idx++}`);
        params.push(extras.startedAt);
      }
      if (extras?.completedAt !== undefined) {
        sets.push(`completed_at = $${idx++}`);
        params.push(extras.completedAt);
      }

      sets.push("updated_at = now()");
      params.push(id);
      params.push(this.db.orgId);

      const row = await tx.queryOne<RunRow>(
        `UPDATE runs SET ${sets.join(", ")} WHERE id = $${idx++} AND org_id = $${idx} RETURNING *`,
        params,
      );
      return row ? toRun(row) : null;
    });
  }

  async delete(id: RunId, _orgId: OrgId): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const count = await tx.execute(
        "DELETE FROM runs WHERE id = $1 AND org_id = $2",
        [id, this.db.orgId],
      );
      return count > 0;
    });
  }
}
