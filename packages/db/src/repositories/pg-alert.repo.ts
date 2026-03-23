import {
  toAlertRuleId,
  toAlertEventId,
  toOrgId,
  toUserId,
  toISODateString,
} from "@sovereign/core";
import type {
  OrgId,
  UserId,
  AlertRuleId,
  AlertEventId,
  AlertRule,
  AlertEvent,
  AlertConditionType,
  AlertSeverity,
  AlertStatus,
} from "@sovereign/core";
import type { TenantDb } from "../client.js";
import type { AlertRuleRepo, AlertEventRepo } from "./types.js";

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

interface AlertRuleRow {
  id: string;
  org_id: string;
  name: string;
  description: string;
  condition_type: string;
  threshold_minutes: number | null;
  enabled: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface AlertEventRow {
  id: string;
  org_id: string;
  alert_rule_id: string | null;
  severity: string;
  title: string;
  message: string;
  condition_type: string;
  resource_type: string;
  resource_id: string | null;
  status: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  metadata: Record<string, unknown> | string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Row → entity mappers
// ---------------------------------------------------------------------------

function toAlertRule(row: AlertRuleRow): AlertRule {
  return {
    id: toAlertRuleId(row.id),
    orgId: toOrgId(row.org_id),
    name: row.name,
    description: row.description,
    conditionType: row.condition_type as AlertConditionType,
    thresholdMinutes: row.threshold_minutes,
    enabled: row.enabled,
    createdBy: toUserId(row.created_by),
    createdAt: toISODateString(row.created_at),
    updatedAt: toISODateString(row.updated_at),
  };
}

function toAlertEvent(row: AlertEventRow): AlertEvent {
  const metadata =
    typeof row.metadata === "string"
      ? (JSON.parse(row.metadata) as Record<string, unknown>)
      : row.metadata;

  return {
    id: toAlertEventId(row.id),
    orgId: toOrgId(row.org_id),
    alertRuleId: row.alert_rule_id ? toAlertRuleId(row.alert_rule_id) : null,
    severity: row.severity as AlertSeverity,
    title: row.title,
    message: row.message,
    conditionType: row.condition_type as AlertConditionType,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    status: row.status as AlertStatus,
    acknowledgedBy: row.acknowledged_by ? toUserId(row.acknowledged_by) : null,
    acknowledgedAt: row.acknowledged_at
      ? toISODateString(row.acknowledged_at)
      : null,
    resolvedAt: row.resolved_at ? toISODateString(row.resolved_at) : null,
    metadata,
    createdAt: toISODateString(row.created_at),
    updatedAt: toISODateString(row.updated_at),
  };
}

// ---------------------------------------------------------------------------
// PgAlertRuleRepo
// ---------------------------------------------------------------------------

export class PgAlertRuleRepo implements AlertRuleRepo {
  constructor(private readonly db: TenantDb) {}

  async create(input: {
    orgId: OrgId;
    name: string;
    description?: string;
    conditionType: string;
    thresholdMinutes?: number;
    enabled?: boolean;
    createdBy: UserId;
  }): Promise<AlertRule> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<AlertRuleRow>(
        `INSERT INTO alert_rules (
          org_id, name, description, condition_type,
          threshold_minutes, enabled, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          this.db.orgId,
          input.name,
          input.description ?? "",
          input.conditionType,
          input.thresholdMinutes ?? null,
          input.enabled ?? true,
          input.createdBy,
        ],
      );
      if (!row) throw new Error("Failed to create alert rule");
      return toAlertRule(row);
    });
  }

  async getById(id: AlertRuleId, _orgId: OrgId): Promise<AlertRule | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<AlertRuleRow>(
        "SELECT * FROM alert_rules WHERE id = $1 AND org_id = $2",
        [id, this.db.orgId],
      );
      return row ? toAlertRule(row) : null;
    });
  }

  async listForOrg(
    _orgId: OrgId,
    filters?: { conditionType?: string; enabled?: boolean },
  ): Promise<AlertRule[]> {
    return this.db.transaction(async (tx) => {
      const conditions: string[] = ["org_id = $1"];
      const params: unknown[] = [this.db.orgId];
      let idx = 2;

      if (filters?.conditionType !== undefined) {
        conditions.push(`condition_type = $${idx++}`);
        params.push(filters.conditionType);
      }
      if (filters?.enabled !== undefined) {
        conditions.push(`enabled = $${idx++}`);
        params.push(filters.enabled);
      }

      const rows = await tx.query<AlertRuleRow>(
        `SELECT * FROM alert_rules WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`,
        params,
      );
      return rows.map(toAlertRule);
    });
  }

  async update(
    id: AlertRuleId,
    _orgId: OrgId,
    input: {
      name?: string;
      description?: string;
      thresholdMinutes?: number;
      enabled?: boolean;
    },
  ): Promise<AlertRule | null> {
    return this.db.transaction(async (tx) => {
      const sets: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (input.name !== undefined) {
        sets.push(`name = $${idx++}`);
        params.push(input.name);
      }
      if (input.description !== undefined) {
        sets.push(`description = $${idx++}`);
        params.push(input.description);
      }
      if (input.thresholdMinutes !== undefined) {
        sets.push(`threshold_minutes = $${idx++}`);
        params.push(input.thresholdMinutes);
      }
      if (input.enabled !== undefined) {
        sets.push(`enabled = $${idx++}`);
        params.push(input.enabled);
      }

      if (sets.length === 0) {
        return this.getById(id, _orgId);
      }

      sets.push("updated_at = now()");
      params.push(id);
      params.push(this.db.orgId);

      const row = await tx.queryOne<AlertRuleRow>(
        `UPDATE alert_rules SET ${sets.join(", ")} WHERE id = $${idx++} AND org_id = $${idx} RETURNING *`,
        params,
      );
      return row ? toAlertRule(row) : null;
    });
  }

  async delete(id: AlertRuleId, _orgId: OrgId): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const count = await tx.execute(
        "DELETE FROM alert_rules WHERE id = $1 AND org_id = $2",
        [id, this.db.orgId],
      );
      return count > 0;
    });
  }
}

// ---------------------------------------------------------------------------
// PgAlertEventRepo
// ---------------------------------------------------------------------------

export class PgAlertEventRepo implements AlertEventRepo {
  constructor(private readonly db: TenantDb) {}

  async create(input: {
    orgId: OrgId;
    alertRuleId?: string;
    severity: string;
    title: string;
    message?: string;
    conditionType: string;
    resourceType: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<AlertEvent> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<AlertEventRow>(
        `INSERT INTO alert_events (
          org_id, alert_rule_id, severity, title, message,
          condition_type, resource_type, resource_id, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          this.db.orgId,
          input.alertRuleId ?? null,
          input.severity,
          input.title,
          input.message ?? "",
          input.conditionType,
          input.resourceType,
          input.resourceId ?? null,
          JSON.stringify(input.metadata ?? {}),
        ],
      );
      if (!row) throw new Error("Failed to create alert event");
      return toAlertEvent(row);
    });
  }

  async getById(id: AlertEventId, _orgId: OrgId): Promise<AlertEvent | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<AlertEventRow>(
        "SELECT * FROM alert_events WHERE id = $1 AND org_id = $2",
        [id, this.db.orgId],
      );
      return row ? toAlertEvent(row) : null;
    });
  }

  async listForOrg(
    _orgId: OrgId,
    filters?: {
      status?: string;
      severity?: string;
      conditionType?: string;
      limit?: number;
    },
  ): Promise<AlertEvent[]> {
    return this.db.transaction(async (tx) => {
      const conditions: string[] = ["org_id = $1"];
      const params: unknown[] = [this.db.orgId];
      let idx = 2;

      if (filters?.status !== undefined) {
        conditions.push(`status = $${idx++}`);
        params.push(filters.status);
      }
      if (filters?.severity !== undefined) {
        conditions.push(`severity = $${idx++}`);
        params.push(filters.severity);
      }
      if (filters?.conditionType !== undefined) {
        conditions.push(`condition_type = $${idx++}`);
        params.push(filters.conditionType);
      }

      const limit = filters?.limit ?? 100;
      params.push(limit);

      const rows = await tx.query<AlertEventRow>(
        `SELECT * FROM alert_events WHERE ${conditions.join(" AND ")}
         ORDER BY created_at DESC
         LIMIT $${idx}`,
        params,
      );
      return rows.map(toAlertEvent);
    });
  }

  async acknowledge(
    id: AlertEventId,
    _orgId: OrgId,
    userId: UserId,
  ): Promise<AlertEvent | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<AlertEventRow>(
        `UPDATE alert_events
         SET status = 'acknowledged',
             acknowledged_by = $1,
             acknowledged_at = now(),
             updated_at = now()
         WHERE id = $2 AND org_id = $3 AND status = 'open'
         RETURNING *`,
        [userId, id, this.db.orgId],
      );
      return row ? toAlertEvent(row) : null;
    });
  }

  async resolve(
    id: AlertEventId,
    _orgId: OrgId,
  ): Promise<AlertEvent | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<AlertEventRow>(
        `UPDATE alert_events
         SET status = 'resolved',
             resolved_at = now(),
             updated_at = now()
         WHERE id = $1 AND org_id = $2 AND status != 'resolved'
         RETURNING *`,
        [id, this.db.orgId],
      );
      return row ? toAlertEvent(row) : null;
    });
  }

  async countByStatus(_orgId: OrgId): Promise<Record<string, number>> {
    return this.db.transaction(async (tx) => {
      const rows = await tx.query<{ status: string; count: string }>(
        `SELECT status, COUNT(*)::text AS count
         FROM alert_events
         WHERE org_id = $1
         GROUP BY status`,
        [this.db.orgId],
      );
      const result: Record<string, number> = {};
      for (const row of rows) {
        result[row.status] = parseInt(row.count, 10);
      }
      return result;
    });
  }
}
