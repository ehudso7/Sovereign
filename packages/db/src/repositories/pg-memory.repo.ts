import { createHash } from "node:crypto";
import {
  toMemoryId,
  toOrgId,
  toUserId,
  toISODateString,
} from "@sovereign/core";
import type {
  OrgId,
  MemoryId,
  Memory,
  MemoryScopeType,
  MemoryKind,
  MemoryStatus,
  CreateMemoryInput,
  UpdateMemoryInput,
  ISODateString,
} from "@sovereign/core";
import type { TenantDb } from "../client.js";
import type { MemoryRepo } from "./types.js";

interface MemoryRow {
  id: string;
  org_id: string;
  scope_type: string;
  scope_id: string;
  kind: string;
  status: string;
  title: string;
  summary: string;
  content: string;
  content_hash: string;
  metadata: Record<string, unknown> | string;
  source_run_id: string | null;
  source_agent_id: string | null;
  created_by: string;
  updated_by: string;
  expires_at: string | null;
  redacted_at: string | null;
  last_accessed_at: string | null;
  created_at: string;
  updated_at: string;
}

function toMemory(row: MemoryRow): Memory {
  const metadata = typeof row.metadata === "string"
    ? (JSON.parse(row.metadata) as Record<string, unknown>)
    : row.metadata;

  return {
    id: toMemoryId(row.id),
    orgId: toOrgId(row.org_id),
    scopeType: row.scope_type as MemoryScopeType,
    scopeId: row.scope_id,
    kind: row.kind as MemoryKind,
    status: row.status as MemoryStatus,
    title: row.title,
    summary: row.summary,
    content: row.content,
    contentHash: row.content_hash,
    metadata,
    sourceRunId: row.source_run_id,
    sourceAgentId: row.source_agent_id,
    createdBy: toUserId(row.created_by),
    updatedBy: toUserId(row.updated_by),
    expiresAt: row.expires_at ? toISODateString(row.expires_at) : null,
    redactedAt: row.redacted_at ? toISODateString(row.redacted_at) : null,
    lastAccessedAt: row.last_accessed_at ? toISODateString(row.last_accessed_at) : null,
    createdAt: toISODateString(row.created_at),
    updatedAt: toISODateString(row.updated_at),
  };
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Memory repo is tenant-scoped.
 * All operations run inside transactions to ensure app.current_org_id is set for RLS.
 */
export class PgMemoryRepo implements MemoryRepo {
  constructor(private readonly db: TenantDb) {}

  async create(input: CreateMemoryInput): Promise<Memory> {
    return this.db.transaction(async (tx) => {
      const contentHash = hashContent(input.content);
      const row = await tx.queryOne<MemoryRow>(
        `INSERT INTO memories (
          org_id, scope_type, scope_id, kind, title, summary,
          content, content_hash, metadata, source_run_id, source_agent_id,
          created_by, updated_by, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
          this.db.orgId,
          input.scopeType,
          input.scopeId,
          input.kind,
          input.title,
          input.summary,
          input.content,
          contentHash,
          JSON.stringify(input.metadata ?? {}),
          input.sourceRunId ?? null,
          input.sourceAgentId ?? null,
          input.createdBy,
          input.createdBy,
          input.expiresAt ?? null,
        ],
      );
      if (!row) throw new Error("Failed to create memory");
      return toMemory(row);
    });
  }

  async getById(id: MemoryId, _orgId: OrgId): Promise<Memory | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<MemoryRow>(
        "SELECT * FROM memories WHERE id = $1 AND org_id = $2",
        [id, this.db.orgId],
      );
      return row ? toMemory(row) : null;
    });
  }

  async listForOrg(
    _orgId: OrgId,
    filters?: { scopeType?: MemoryScopeType; scopeId?: string; kind?: MemoryKind; status?: MemoryStatus },
  ): Promise<Memory[]> {
    return this.db.transaction(async (tx) => {
      const conditions: string[] = ["org_id = $1"];
      const params: unknown[] = [this.db.orgId];
      let idx = 2;

      if (filters?.scopeType !== undefined) {
        conditions.push(`scope_type = $${idx++}`);
        params.push(filters.scopeType);
      }
      if (filters?.scopeId !== undefined) {
        conditions.push(`scope_id = $${idx++}`);
        params.push(filters.scopeId);
      }
      if (filters?.kind !== undefined) {
        conditions.push(`kind = $${idx++}`);
        params.push(filters.kind);
      }
      if (filters?.status !== undefined) {
        conditions.push(`status = $${idx++}`);
        params.push(filters.status);
      }

      const rows = await tx.query<MemoryRow>(
        `SELECT * FROM memories WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`,
        params,
      );
      return rows.map(toMemory);
    });
  }

  async search(
    _orgId: OrgId,
    query: string,
    filters?: { scopeType?: MemoryScopeType; scopeId?: string; kind?: MemoryKind; maxResults?: number },
  ): Promise<Memory[]> {
    return this.db.transaction(async (tx) => {
      const conditions: string[] = [
        "org_id = $1",
        "status NOT IN ('redacted', 'expired', 'deleted')",
        "(expires_at IS NULL OR expires_at > now())",
        `(title ILIKE $2 OR summary ILIKE $2 OR content ILIKE $2)`,
      ];
      const likePattern = `%${query}%`;
      const params: unknown[] = [this.db.orgId, likePattern];
      let idx = 3;

      if (filters?.scopeType !== undefined) {
        conditions.push(`scope_type = $${idx++}`);
        params.push(filters.scopeType);
      }
      if (filters?.scopeId !== undefined) {
        conditions.push(`scope_id = $${idx++}`);
        params.push(filters.scopeId);
      }
      if (filters?.kind !== undefined) {
        conditions.push(`kind = $${idx++}`);
        params.push(filters.kind);
      }

      const limit = filters?.maxResults ?? 50;
      params.push(limit);

      const rows = await tx.query<MemoryRow>(
        `SELECT * FROM memories WHERE ${conditions.join(" AND ")}
         ORDER BY updated_at DESC
         LIMIT $${idx}`,
        params,
      );

      // Update last_accessed_at for returned memories
      if (rows.length > 0) {
        const ids = rows.map((r) => r.id);
        await tx.execute(
          `UPDATE memories SET last_accessed_at = now()
           WHERE id = ANY($1) AND org_id = $2`,
          [ids, this.db.orgId],
        );
      }

      return rows.map(toMemory);
    });
  }

  async update(id: MemoryId, _orgId: OrgId, input: UpdateMemoryInput): Promise<Memory | null> {
    return this.db.transaction(async (tx) => {
      const sets: string[] = ["updated_by = $1"];
      const params: unknown[] = [input.updatedBy];
      let idx = 2;

      if (input.title !== undefined) {
        sets.push(`title = $${idx++}`);
        params.push(input.title);
      }
      if (input.summary !== undefined) {
        sets.push(`summary = $${idx++}`);
        params.push(input.summary);
      }
      if (input.content !== undefined) {
        sets.push(`content = $${idx++}`);
        params.push(input.content);
        sets.push(`content_hash = $${idx++}`);
        params.push(hashContent(input.content));
      }
      if (input.metadata !== undefined) {
        sets.push(`metadata = $${idx++}`);
        params.push(JSON.stringify(input.metadata));
      }

      sets.push("updated_at = now()");
      params.push(id);
      params.push(this.db.orgId);

      const row = await tx.queryOne<MemoryRow>(
        `UPDATE memories SET ${sets.join(", ")} WHERE id = $${idx++} AND org_id = $${idx} RETURNING *`,
        params,
      );
      return row ? toMemory(row) : null;
    });
  }

  async updateStatus(
    id: MemoryId,
    _orgId: OrgId,
    status: MemoryStatus,
    extras?: { redactedAt?: ISODateString; expiresAt?: ISODateString; content?: string; contentHash?: string },
  ): Promise<Memory | null> {
    return this.db.transaction(async (tx) => {
      const sets: string[] = ["status = $1"];
      const params: unknown[] = [status];
      let idx = 2;

      if (extras?.redactedAt !== undefined) {
        sets.push(`redacted_at = $${idx++}`);
        params.push(extras.redactedAt);
      }
      if (extras?.expiresAt !== undefined) {
        sets.push(`expires_at = $${idx++}`);
        params.push(extras.expiresAt);
      }
      if (extras?.content !== undefined) {
        sets.push(`content = $${idx++}`);
        params.push(extras.content);
      }
      if (extras?.contentHash !== undefined) {
        sets.push(`content_hash = $${idx++}`);
        params.push(extras.contentHash);
      }

      sets.push("updated_at = now()");
      params.push(id);
      params.push(this.db.orgId);

      const row = await tx.queryOne<MemoryRow>(
        `UPDATE memories SET ${sets.join(", ")} WHERE id = $${idx++} AND org_id = $${idx} RETURNING *`,
        params,
      );
      return row ? toMemory(row) : null;
    });
  }

  async getByContentHash(_orgId: OrgId, contentHash: string): Promise<Memory | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<MemoryRow>(
        "SELECT * FROM memories WHERE content_hash = $1 AND org_id = $2",
        [contentHash, this.db.orgId],
      );
      return row ? toMemory(row) : null;
    });
  }

  async delete(id: MemoryId, _orgId: OrgId): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const count = await tx.execute(
        "DELETE FROM memories WHERE id = $1 AND org_id = $2",
        [id, this.db.orgId],
      );
      return count > 0;
    });
  }
}
