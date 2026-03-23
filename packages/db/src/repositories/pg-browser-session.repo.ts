import {
  toBrowserSessionId,
  toOrgId,
  toRunId,
  toAgentId,
  toUserId,
  toISODateString,
} from "@sovereign/core";
import type {
  OrgId,
  UserId,
  RunId,
  BrowserSessionId,
  BrowserSession,
  BrowserSessionStatus,
  CreateBrowserSessionInput,
  ISODateString,
} from "@sovereign/core";
import type { TenantDb } from "../client.js";
import type { BrowserSessionRepo } from "./types.js";

interface BrowserSessionRow {
  id: string;
  org_id: string;
  run_id: string;
  agent_id: string;
  status: string;
  browser_type: string;
  current_url: string | null;
  human_takeover: boolean;
  takeover_by: string | null;
  session_ref: string | null;
  artifact_keys: string[] | string;
  metadata: Record<string, unknown> | string;
  created_by: string;
  started_at: string | null;
  last_activity_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

function toBrowserSession(row: BrowserSessionRow): BrowserSession {
  const artifactKeys = typeof row.artifact_keys === "string"
    ? (JSON.parse(row.artifact_keys) as string[])
    : row.artifact_keys;
  const metadata = typeof row.metadata === "string"
    ? (JSON.parse(row.metadata) as Record<string, unknown>)
    : row.metadata;

  return {
    id: toBrowserSessionId(row.id),
    orgId: toOrgId(row.org_id),
    runId: toRunId(row.run_id),
    agentId: toAgentId(row.agent_id),
    status: row.status as BrowserSessionStatus,
    browserType: row.browser_type,
    currentUrl: row.current_url,
    humanTakeover: row.human_takeover,
    takeoverBy: row.takeover_by ? toUserId(row.takeover_by) : null,
    sessionRef: row.session_ref,
    artifactKeys,
    metadata,
    createdBy: toUserId(row.created_by),
    startedAt: row.started_at ? toISODateString(row.started_at) : null,
    lastActivityAt: row.last_activity_at ? toISODateString(row.last_activity_at) : null,
    endedAt: row.ended_at ? toISODateString(row.ended_at) : null,
    createdAt: toISODateString(row.created_at),
    updatedAt: toISODateString(row.updated_at),
  };
}

export class PgBrowserSessionRepo implements BrowserSessionRepo {
  constructor(private readonly db: TenantDb) {}

  async create(input: CreateBrowserSessionInput): Promise<BrowserSession> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<BrowserSessionRow>(
        `INSERT INTO browser_sessions (
          org_id, run_id, agent_id, browser_type, created_by
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *`,
        [
          this.db.orgId,
          input.runId,
          input.agentId,
          input.browserType ?? "chromium",
          input.createdBy,
        ],
      );
      if (!row) throw new Error("Failed to create browser session");
      return toBrowserSession(row);
    });
  }

  async getById(id: BrowserSessionId, _orgId: OrgId): Promise<BrowserSession | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<BrowserSessionRow>(
        "SELECT * FROM browser_sessions WHERE id = $1 AND org_id = $2",
        [id, this.db.orgId],
      );
      return row ? toBrowserSession(row) : null;
    });
  }

  async listForOrg(
    _orgId: OrgId,
    filters?: { runId?: RunId; status?: BrowserSessionStatus },
  ): Promise<BrowserSession[]> {
    return this.db.transaction(async (tx) => {
      const conditions: string[] = ["org_id = $1"];
      const params: unknown[] = [this.db.orgId];
      let idx = 2;

      if (filters?.runId !== undefined) {
        conditions.push(`run_id = $${idx++}`);
        params.push(filters.runId);
      }
      if (filters?.status !== undefined) {
        conditions.push(`status = $${idx++}`);
        params.push(filters.status);
      }

      const rows = await tx.query<BrowserSessionRow>(
        `SELECT * FROM browser_sessions WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`,
        params,
      );
      return rows.map(toBrowserSession);
    });
  }

  async listForRun(runId: RunId, _orgId: OrgId): Promise<BrowserSession[]> {
    return this.db.transaction(async (tx) => {
      const rows = await tx.query<BrowserSessionRow>(
        "SELECT * FROM browser_sessions WHERE run_id = $1 AND org_id = $2 ORDER BY created_at DESC",
        [runId, this.db.orgId],
      );
      return rows.map(toBrowserSession);
    });
  }

  async updateStatus(
    id: BrowserSessionId,
    _orgId: OrgId,
    status: BrowserSessionStatus,
    extras?: {
      currentUrl?: string;
      humanTakeover?: boolean;
      takeoverBy?: UserId | null;
      sessionRef?: string;
      artifactKeys?: readonly string[];
      metadata?: Record<string, unknown>;
      startedAt?: ISODateString;
      lastActivityAt?: ISODateString;
      endedAt?: ISODateString;
    },
  ): Promise<BrowserSession | null> {
    return this.db.transaction(async (tx) => {
      const sets: string[] = ["status = $1"];
      const params: unknown[] = [status];
      let idx = 2;

      if (extras?.currentUrl !== undefined) {
        sets.push(`current_url = $${idx++}`);
        params.push(extras.currentUrl);
      }
      if (extras?.humanTakeover !== undefined) {
        sets.push(`human_takeover = $${idx++}`);
        params.push(extras.humanTakeover);
      }
      if (extras?.takeoverBy !== undefined) {
        sets.push(`takeover_by = $${idx++}`);
        params.push(extras.takeoverBy);
      }
      if (extras?.sessionRef !== undefined) {
        sets.push(`session_ref = $${idx++}`);
        params.push(extras.sessionRef);
      }
      if (extras?.artifactKeys !== undefined) {
        sets.push(`artifact_keys = $${idx++}`);
        params.push(JSON.stringify(extras.artifactKeys));
      }
      if (extras?.metadata !== undefined) {
        sets.push(`metadata = $${idx++}`);
        params.push(JSON.stringify(extras.metadata));
      }
      if (extras?.startedAt !== undefined) {
        sets.push(`started_at = $${idx++}`);
        params.push(extras.startedAt);
      }
      if (extras?.lastActivityAt !== undefined) {
        sets.push(`last_activity_at = $${idx++}`);
        params.push(extras.lastActivityAt);
      }
      if (extras?.endedAt !== undefined) {
        sets.push(`ended_at = $${idx++}`);
        params.push(extras.endedAt);
      }

      sets.push("updated_at = now()");
      params.push(id);
      params.push(this.db.orgId);

      const row = await tx.queryOne<BrowserSessionRow>(
        `UPDATE browser_sessions SET ${sets.join(", ")} WHERE id = $${idx++} AND org_id = $${idx} RETURNING *`,
        params,
      );
      return row ? toBrowserSession(row) : null;
    });
  }

  async delete(id: BrowserSessionId, _orgId: OrgId): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const count = await tx.execute(
        "DELETE FROM browser_sessions WHERE id = $1 AND org_id = $2",
        [id, this.db.orgId],
      );
      return count > 0;
    });
  }
}
