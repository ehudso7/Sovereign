import {
  toAuditEventId,
  toOrgId,
  toUserId,
  toISODateString,
} from "@sovereign/core";
import type { OrgId, AuditEvent, EmitAuditEventInput, AuditQueryParams } from "@sovereign/core";
import type { TenantDb } from "../client.js";
import type { AuditRepo } from "./types.js";

interface AuditRow {
  id: string;
  org_id: string;
  actor_id: string | null;
  actor_type: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

function toAuditEvent(row: AuditRow): AuditEvent {
  return {
    id: toAuditEventId(row.id),
    orgId: toOrgId(row.org_id),
    actorId: row.actor_id ? toUserId(row.actor_id) : undefined,
    actorType: row.actor_type as AuditEvent["actorType"],
    action: row.action as AuditEvent["action"],
    resourceType: row.resource_type,
    resourceId: row.resource_id ?? undefined,
    metadata: row.metadata,
    ipAddress: row.ip_address ?? undefined,
    createdAt: toISODateString(row.created_at),
  };
}

/**
 * Audit repo is tenant-scoped.
 * All operations run inside transactions to ensure app.current_org_id is set for RLS.
 */
export class PgAuditRepo implements AuditRepo {
  constructor(private readonly db: TenantDb) {}

  async emit(input: EmitAuditEventInput): Promise<AuditEvent> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<AuditRow>(
        `INSERT INTO audit_events (org_id, actor_id, actor_type, action, resource_type, resource_id, metadata, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          this.db.orgId,
          input.actorId ?? null,
          input.actorType,
          input.action,
          input.resourceType,
          input.resourceId ?? null,
          JSON.stringify(input.metadata ?? {}),
          input.ipAddress ?? null,
        ],
      );
      if (!row) throw new Error("Failed to emit audit event");
      return toAuditEvent(row);
    });
  }

  async query(_orgId: OrgId, params?: AuditQueryParams): Promise<AuditEvent[]> {
    return this.db.transaction(async (tx) => {
      const conditions = ["org_id = $1"];
      const queryParams: unknown[] = [this.db.orgId];
      let idx = 2;

      if (params?.action) {
        conditions.push(`action = $${idx++}`);
        queryParams.push(params.action);
      }
      if (params?.resourceType) {
        conditions.push(`resource_type = $${idx++}`);
        queryParams.push(params.resourceType);
      }
      if (params?.resourceId) {
        conditions.push(`resource_id = $${idx++}`);
        queryParams.push(params.resourceId);
      }
      if (params?.actorId) {
        conditions.push(`actor_id = $${idx++}`);
        queryParams.push(params.actorId);
      }
      if (params?.since) {
        conditions.push(`created_at >= $${idx++}`);
        queryParams.push(params.since);
      }

      const limit = params?.limit ?? 100;
      const rows = await tx.query<AuditRow>(
        `SELECT * FROM audit_events WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC LIMIT ${limit}`,
        queryParams,
      );
      return rows.map(toAuditEvent);
    });
  }

  async getById(eventId: string): Promise<AuditEvent | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<AuditRow>(
        `SELECT * FROM audit_events WHERE id = $1 AND org_id = $2`,
        [eventId, this.db.orgId],
      );
      return row ? toAuditEvent(row) : null;
    });
  }
}
