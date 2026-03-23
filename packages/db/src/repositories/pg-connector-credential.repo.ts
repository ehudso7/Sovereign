import type {
  OrgId,
  ConnectorInstallId,
} from "@sovereign/core";
import type { TenantDb } from "../client.js";
import type { ConnectorCredentialRepo } from "./types.js";

interface CredentialRow {
  id: string;
  org_id: string;
  connector_install_id: string;
  credential_type: string;
  encrypted_data: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Connector credential repo is tenant-scoped.
 * All operations run inside transactions to ensure app.current_org_id is set for RLS.
 */
export class PgConnectorCredentialRepo implements ConnectorCredentialRepo {
  constructor(private readonly db: TenantDb) {}

  async upsert(input: {
    orgId: OrgId;
    connectorInstallId: ConnectorInstallId;
    credentialType: string;
    encryptedData: string;
    expiresAt?: string;
  }): Promise<{ id: string }> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<CredentialRow>(
        `INSERT INTO connector_credentials (org_id, connector_install_id, credential_type, encrypted_data, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (connector_install_id)
         DO UPDATE SET credential_type = EXCLUDED.credential_type,
                       encrypted_data = EXCLUDED.encrypted_data,
                       expires_at = EXCLUDED.expires_at,
                       updated_at = now()
         RETURNING *`,
        [
          this.db.orgId,
          input.connectorInstallId,
          input.credentialType,
          input.encryptedData,
          input.expiresAt ?? null,
        ],
      );
      if (!row) throw new Error("Failed to upsert connector credential");
      return { id: row.id };
    });
  }

  async getByInstallId(
    connectorInstallId: ConnectorInstallId,
    _orgId: OrgId,
  ): Promise<{ id: string; credentialType: string; encryptedData: string; expiresAt: string | null } | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<CredentialRow>(
        "SELECT * FROM connector_credentials WHERE connector_install_id = $1 AND org_id = $2",
        [connectorInstallId, this.db.orgId],
      );
      if (!row) return null;
      return {
        id: row.id,
        credentialType: row.credential_type,
        encryptedData: row.encrypted_data,
        expiresAt: row.expires_at,
      };
    });
  }

  async deleteByInstallId(connectorInstallId: ConnectorInstallId, _orgId: OrgId): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const count = await tx.execute(
        "DELETE FROM connector_credentials WHERE connector_install_id = $1 AND org_id = $2",
        [connectorInstallId, this.db.orgId],
      );
      return count > 0;
    });
  }
}
