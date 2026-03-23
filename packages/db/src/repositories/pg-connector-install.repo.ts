import {
  toConnectorInstallId,
  toOrgId,
  toConnectorId,
  toUserId,
  toISODateString,
} from "@sovereign/core";
import type {
  OrgId,
  UserId,
  ConnectorId,
  ConnectorInstallId,
  ConnectorInstall,
  CreateConnectorInstallInput,
} from "@sovereign/core";
import type { TenantDb } from "../client.js";
import type { ConnectorInstallRepo } from "./types.js";

interface ConnectorInstallRow {
  id: string;
  org_id: string;
  connector_id: string;
  connector_slug: string;
  enabled: boolean;
  config: Record<string, unknown> | string;
  granted_scopes: readonly string[] | string;
  installed_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

function parseJsonRequired<T>(val: T | string): T {
  if (typeof val === "string") return JSON.parse(val) as T;
  return val;
}

function toInstall(row: ConnectorInstallRow): ConnectorInstall {
  return {
    id: toConnectorInstallId(row.id),
    orgId: toOrgId(row.org_id),
    connectorId: toConnectorId(row.connector_id),
    connectorSlug: row.connector_slug,
    enabled: row.enabled,
    config: parseJsonRequired<Record<string, unknown>>(row.config),
    grantedScopes: parseJsonRequired<readonly string[]>(row.granted_scopes),
    installedBy: toUserId(row.installed_by),
    updatedBy: row.updated_by ? toUserId(row.updated_by) : null,
    createdAt: toISODateString(row.created_at),
    updatedAt: toISODateString(row.updated_at),
  };
}

/**
 * Connector install repo is tenant-scoped.
 * All operations run inside transactions to ensure app.current_org_id is set for RLS.
 */
export class PgConnectorInstallRepo implements ConnectorInstallRepo {
  constructor(private readonly db: TenantDb) {}

  async create(input: CreateConnectorInstallInput): Promise<ConnectorInstall> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<ConnectorInstallRow>(
        `INSERT INTO connector_installs (org_id, connector_id, connector_slug, config, granted_scopes, installed_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          this.db.orgId,
          input.connectorId,
          input.connectorSlug,
          JSON.stringify(input.config ?? {}),
          JSON.stringify(input.grantedScopes ?? []),
          input.installedBy,
        ],
      );
      if (!row) throw new Error("Failed to create connector install");
      return toInstall(row);
    });
  }

  async getById(id: ConnectorInstallId, _orgId: OrgId): Promise<ConnectorInstall | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<ConnectorInstallRow>(
        "SELECT * FROM connector_installs WHERE id = $1 AND org_id = $2",
        [id, this.db.orgId],
      );
      return row ? toInstall(row) : null;
    });
  }

  async getByConnectorId(connectorId: ConnectorId, _orgId: OrgId): Promise<ConnectorInstall | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<ConnectorInstallRow>(
        "SELECT * FROM connector_installs WHERE connector_id = $1 AND org_id = $2",
        [connectorId, this.db.orgId],
      );
      return row ? toInstall(row) : null;
    });
  }

  async listForOrg(_orgId: OrgId, filters?: { enabled?: boolean }): Promise<ConnectorInstall[]> {
    return this.db.transaction(async (tx) => {
      const conditions: string[] = ["org_id = $1"];
      const params: unknown[] = [this.db.orgId];
      let idx = 2;

      if (filters?.enabled !== undefined) {
        conditions.push(`enabled = $${idx++}`);
        params.push(filters.enabled);
      }

      const rows = await tx.query<ConnectorInstallRow>(
        `SELECT * FROM connector_installs WHERE ${conditions.join(" AND ")} ORDER BY created_at`,
        params,
      );
      return rows.map(toInstall);
    });
  }

  async update(
    id: ConnectorInstallId,
    _orgId: OrgId,
    input: { enabled?: boolean; config?: Record<string, unknown>; grantedScopes?: readonly string[]; updatedBy: UserId },
  ): Promise<ConnectorInstall | null> {
    return this.db.transaction(async (tx) => {
      const sets: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (input.enabled !== undefined) { sets.push(`enabled = $${idx++}`); params.push(input.enabled); }
      if (input.config !== undefined) { sets.push(`config = $${idx++}`); params.push(JSON.stringify(input.config)); }
      if (input.grantedScopes !== undefined) { sets.push(`granted_scopes = $${idx++}`); params.push(JSON.stringify(input.grantedScopes)); }
      sets.push(`updated_by = $${idx++}`); params.push(input.updatedBy);
      sets.push("updated_at = now()");

      params.push(id);
      params.push(this.db.orgId);

      const row = await tx.queryOne<ConnectorInstallRow>(
        `UPDATE connector_installs SET ${sets.join(", ")} WHERE id = $${idx++} AND org_id = $${idx} RETURNING *`,
        params,
      );
      return row ? toInstall(row) : null;
    });
  }

  async delete(id: ConnectorInstallId, _orgId: OrgId): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const count = await tx.execute(
        "DELETE FROM connector_installs WHERE id = $1 AND org_id = $2",
        [id, this.db.orgId],
      );
      return count > 0;
    });
  }
}
