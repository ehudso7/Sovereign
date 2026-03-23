import {
  toOrgId,
  toRunId,
  toISODateString,
} from "@sovereign/core";
import type {
  OrgId,
  RunId,
  RunStep,
  RunStepType,
  RunStepStatus,
  ISODateString,
} from "@sovereign/core";
import type { TenantDb } from "../client.js";
import type { RunStepRepo } from "./types.js";

interface RunStepRow {
  id: string;
  org_id: string;
  run_id: string;
  step_number: number;
  type: string;
  status: string;
  attempt: number;
  tool_name: string | null;
  input: Record<string, unknown> | string | null;
  output: Record<string, unknown> | string | null;
  error: Record<string, unknown> | string | null;
  token_usage: { inputTokens: number; outputTokens: number; totalTokens: number } | string | null;
  provider_metadata: Record<string, unknown> | string | null;
  latency_ms: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

function parseJson<T>(val: T | string | null): T | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "string") return JSON.parse(val) as T;
  return val;
}

function toRunStep(row: RunStepRow): RunStep {
  return {
    id: row.id,
    orgId: toOrgId(row.org_id),
    runId: toRunId(row.run_id),
    stepNumber: row.step_number,
    type: row.type as RunStepType,
    status: row.status as RunStepStatus,
    attempt: row.attempt,
    toolName: row.tool_name,
    input: parseJson<Record<string, unknown>>(row.input),
    output: parseJson<Record<string, unknown>>(row.output),
    error: parseJson<Record<string, unknown>>(row.error),
    tokenUsage: parseJson<{ inputTokens: number; outputTokens: number; totalTokens: number }>(row.token_usage),
    providerMetadata: parseJson<Record<string, unknown>>(row.provider_metadata),
    latencyMs: row.latency_ms,
    startedAt: row.started_at ? toISODateString(row.started_at) : null,
    completedAt: row.completed_at ? toISODateString(row.completed_at) : null,
    createdAt: toISODateString(row.created_at),
  };
}

/**
 * Run step repo is tenant-scoped.
 * All operations run inside transactions to ensure app.current_org_id is set for RLS.
 */
export class PgRunStepRepo implements RunStepRepo {
  constructor(private readonly db: TenantDb) {}

  async create(input: {
    orgId: OrgId;
    runId: RunId;
    stepNumber: number;
    type: RunStepType;
    attempt?: number;
    toolName?: string;
    input?: Record<string, unknown>;
  }): Promise<RunStep> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<RunStepRow>(
        `INSERT INTO run_steps (
          org_id, run_id, step_number, type, attempt, tool_name, input
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          this.db.orgId,
          input.runId,
          input.stepNumber,
          input.type,
          input.attempt ?? 1,
          input.toolName ?? null,
          input.input ? JSON.stringify(input.input) : null,
        ],
      );
      if (!row) throw new Error("Failed to create run step");
      return toRunStep(row);
    });
  }

  async getById(id: string, _orgId: OrgId): Promise<RunStep | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<RunStepRow>(
        "SELECT * FROM run_steps WHERE id = $1 AND org_id = $2",
        [id, this.db.orgId],
      );
      return row ? toRunStep(row) : null;
    });
  }

  async listForRun(runId: RunId): Promise<RunStep[]> {
    return this.db.transaction(async (tx) => {
      const rows = await tx.query<RunStepRow>(
        "SELECT * FROM run_steps WHERE run_id = $1 AND org_id = $2 ORDER BY step_number ASC",
        [runId, this.db.orgId],
      );
      return rows.map(toRunStep);
    });
  }

  async updateStatus(
    id: string,
    _orgId: OrgId,
    status: RunStepStatus,
    extras?: {
      output?: Record<string, unknown>;
      error?: Record<string, unknown>;
      tokenUsage?: { inputTokens: number; outputTokens: number; totalTokens: number };
      providerMetadata?: Record<string, unknown>;
      latencyMs?: number;
      startedAt?: ISODateString;
      completedAt?: ISODateString;
    },
  ): Promise<RunStep | null> {
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
      if (extras?.providerMetadata !== undefined) {
        sets.push(`provider_metadata = $${idx++}`);
        params.push(JSON.stringify(extras.providerMetadata));
      }
      if (extras?.latencyMs !== undefined) {
        sets.push(`latency_ms = $${idx++}`);
        params.push(extras.latencyMs);
      }
      if (extras?.startedAt !== undefined) {
        sets.push(`started_at = $${idx++}`);
        params.push(extras.startedAt);
      }
      if (extras?.completedAt !== undefined) {
        sets.push(`completed_at = $${idx++}`);
        params.push(extras.completedAt);
      }

      params.push(id);
      params.push(this.db.orgId);

      const row = await tx.queryOne<RunStepRow>(
        `UPDATE run_steps SET ${sets.join(", ")} WHERE id = $${idx++} AND org_id = $${idx} RETURNING *`,
        params,
      );
      return row ? toRunStep(row) : null;
    });
  }

  async getNextStepNumber(runId: RunId): Promise<number> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<{ max_step: number | null }>(
        "SELECT MAX(step_number) AS max_step FROM run_steps WHERE run_id = $1 AND org_id = $2",
        [runId, this.db.orgId],
      );
      return (row?.max_step ?? 0) + 1;
    });
  }
}
