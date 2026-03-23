import {
  toMemoryLinkId,
  toOrgId,
  toMemoryId,
  toISODateString,
} from "@sovereign/core";
import type {
  OrgId,
  MemoryId,
  MemoryLinkId,
  MemoryLink,
  MemoryLinkType,
  CreateMemoryLinkInput,
} from "@sovereign/core";
import type { TenantDb } from "../client.js";
import type { MemoryLinkRepo } from "./types.js";

interface MemoryLinkRow {
  id: string;
  org_id: string;
  memory_id: string;
  linked_entity_type: string;
  linked_entity_id: string;
  link_type: string;
  metadata: Record<string, unknown> | string;
  created_at: string;
}

function toMemoryLink(row: MemoryLinkRow): MemoryLink {
  const metadata = typeof row.metadata === "string"
    ? (JSON.parse(row.metadata) as Record<string, unknown>)
    : row.metadata;

  return {
    id: toMemoryLinkId(row.id),
    orgId: toOrgId(row.org_id),
    memoryId: toMemoryId(row.memory_id),
    linkedEntityType: row.linked_entity_type,
    linkedEntityId: row.linked_entity_id,
    linkType: row.link_type as MemoryLinkType,
    metadata,
    createdAt: toISODateString(row.created_at),
  };
}

/**
 * Memory link repo is tenant-scoped.
 * All operations run inside transactions to ensure app.current_org_id is set for RLS.
 */
export class PgMemoryLinkRepo implements MemoryLinkRepo {
  constructor(private readonly db: TenantDb) {}

  async create(input: CreateMemoryLinkInput): Promise<MemoryLink> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<MemoryLinkRow>(
        `INSERT INTO memory_links (
          org_id, memory_id, linked_entity_type, linked_entity_id,
          link_type, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [
          this.db.orgId,
          input.memoryId,
          input.linkedEntityType,
          input.linkedEntityId,
          input.linkType,
          JSON.stringify(input.metadata ?? {}),
        ],
      );
      if (!row) throw new Error("Failed to create memory link");
      return toMemoryLink(row);
    });
  }

  async listForMemory(memoryId: MemoryId, _orgId: OrgId): Promise<MemoryLink[]> {
    return this.db.transaction(async (tx) => {
      const rows = await tx.query<MemoryLinkRow>(
        "SELECT * FROM memory_links WHERE memory_id = $1 AND org_id = $2 ORDER BY created_at DESC",
        [memoryId, this.db.orgId],
      );
      return rows.map(toMemoryLink);
    });
  }

  async listForEntity(entityType: string, entityId: string, _orgId: OrgId): Promise<MemoryLink[]> {
    return this.db.transaction(async (tx) => {
      const rows = await tx.query<MemoryLinkRow>(
        `SELECT * FROM memory_links
         WHERE linked_entity_type = $1 AND linked_entity_id = $2 AND org_id = $3
         ORDER BY created_at DESC`,
        [entityType, entityId, this.db.orgId],
      );
      return rows.map(toMemoryLink);
    });
  }

  async delete(id: MemoryLinkId, _orgId: OrgId): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const count = await tx.execute(
        "DELETE FROM memory_links WHERE id = $1 AND org_id = $2",
        [id, this.db.orgId],
      );
      return count > 0;
    });
  }
}
