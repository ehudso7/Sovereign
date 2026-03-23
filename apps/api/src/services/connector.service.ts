// ---------------------------------------------------------------------------
// Connector service — catalog, install, configure, test, revoke
// ---------------------------------------------------------------------------

import { ok, err, AppError } from "@sovereign/core";
import type {
  Connector,
  ConnectorInstall,
  ConnectorId,
  OrgId,
  UserId,
  Result,
  AuditEmitter,
} from "@sovereign/core";
import type { ConnectorRepo, ConnectorInstallRepo, ConnectorCredentialRepo } from "@sovereign/db";
import { executeTool, listToolsForConnector } from "@sovereign/gateway-mcp";

export class PgConnectorService {
  constructor(
    private readonly connectorRepo: ConnectorRepo,
    private readonly installRepo: ConnectorInstallRepo,
    private readonly credentialRepo: ConnectorCredentialRepo,
    private readonly audit: AuditEmitter,
  ) {}

  // -------------------------------------------------------------------------
  // Catalog
  // -------------------------------------------------------------------------

  async listCatalog(filters?: { category?: string; trustTier?: string }): Promise<Result<Connector[]>> {
    const connectors = await this.connectorRepo.listAll(filters);
    return ok(connectors);
  }

  async getConnector(connectorId: ConnectorId): Promise<Result<Connector>> {
    const connector = await this.connectorRepo.getById(connectorId);
    if (!connector) return err(AppError.notFound("Connector", connectorId));
    return ok(connector);
  }

  async getConnectorBySlug(slug: string): Promise<Result<Connector>> {
    const connector = await this.connectorRepo.getBySlug(slug);
    if (!connector) return err(AppError.notFound("Connector", slug));
    return ok(connector);
  }

  // -------------------------------------------------------------------------
  // Installs
  // -------------------------------------------------------------------------

  async listInstalled(orgId: OrgId, filters?: { enabled?: boolean }): Promise<Result<ConnectorInstall[]>> {
    const installs = await this.installRepo.listForOrg(orgId, filters);
    return ok(installs);
  }

  async install(
    connectorId: ConnectorId,
    orgId: OrgId,
    userId: UserId,
    config?: Record<string, unknown>,
    grantedScopes?: readonly string[],
  ): Promise<Result<ConnectorInstall>> {
    try {
      const connector = await this.connectorRepo.getById(connectorId);
      if (!connector) return err(AppError.notFound("Connector", connectorId));

      if (connector.status !== "active") {
        return err(new AppError("BAD_REQUEST", `Connector "${connector.name}" is not active`, 400));
      }

      // Check if already installed
      const existing = await this.installRepo.getByConnectorId(connectorId, orgId);
      if (existing) {
        return err(new AppError("CONFLICT", `Connector "${connector.name}" is already installed`, 409));
      }

      const install = await this.installRepo.create({
        orgId,
        connectorId,
        connectorSlug: connector.slug,
        config: config ?? {},
        grantedScopes: grantedScopes ?? connector.scopes.map((s) => s.id),
        installedBy: userId,
      });

      await this.audit.emit({
        orgId,
        actorId: userId,
        actorType: "user",
        action: "connector.installed",
        resourceType: "connector",
        resourceId: connectorId,
        metadata: { connectorSlug: connector.slug, installId: install.id },
      });

      return ok(install);
    } catch (e) {
      return err(AppError.internal(e instanceof Error ? e.message : "Failed to install connector"));
    }
  }

  async configure(
    connectorId: ConnectorId,
    orgId: OrgId,
    userId: UserId,
    config?: Record<string, unknown>,
    credentials?: { type: string; data: string },
  ): Promise<Result<ConnectorInstall>> {
    try {
      const install = await this.installRepo.getByConnectorId(connectorId, orgId);
      if (!install) {
        return err(new AppError("NOT_FOUND", "Connector is not installed", 404));
      }

      // Update config if provided
      if (config) {
        await this.installRepo.update(install.id, orgId, { config, updatedBy: userId });
      }

      // Store credentials if provided (simple encryption: base64 for dev, real encryption in prod)
      if (credentials) {
        const encrypted = Buffer.from(credentials.data).toString("base64");
        await this.credentialRepo.upsert({
          orgId,
          connectorInstallId: install.id,
          credentialType: credentials.type,
          encryptedData: encrypted,
        });
      }

      const updated = await this.installRepo.getByConnectorId(connectorId, orgId);

      await this.audit.emit({
        orgId,
        actorId: userId,
        actorType: "user",
        action: "connector.configured",
        resourceType: "connector",
        resourceId: connectorId,
        metadata: { connectorSlug: install.connectorSlug, hasCredentials: !!credentials },
      });

      return ok(updated!);
    } catch (e) {
      return err(AppError.internal(e instanceof Error ? e.message : "Failed to configure connector"));
    }
  }

  async test(
    connectorId: ConnectorId,
    orgId: OrgId,
    userId: UserId,
  ): Promise<Result<{ success: boolean; message: string; toolResults?: Record<string, unknown>[] }>> {
    try {
      const connector = await this.connectorRepo.getById(connectorId);
      if (!connector) return err(AppError.notFound("Connector", connectorId));

      const install = await this.installRepo.getByConnectorId(connectorId, orgId);
      if (!install) {
        return err(new AppError("NOT_FOUND", "Connector is not installed", 404));
      }

      // Get credentials if connector requires them
      let credentials: Record<string, unknown> | undefined;
      if (connector.authMode !== "none") {
        const cred = await this.credentialRepo.getByInstallId(install.id, orgId);
        if (!cred) {
          return ok({ success: false, message: `Connector "${connector.name}" requires credentials but none are configured` });
        }
        // Decrypt (base64 for dev)
        const decrypted = Buffer.from(cred.encryptedData, "base64").toString("utf-8");
        credentials = { apiKey: decrypted };
      }

      // Test by executing the first available tool
      const tools = listToolsForConnector(connector.slug);
      if (tools.length === 0) {
        return ok({ success: false, message: `No tools registered for connector "${connector.slug}"` });
      }

      const testTool = tools[0]!;
      const testArgs: Record<string, unknown> = {};
      // Provide reasonable test args based on parameter types
      for (const param of testTool.parameters) {
        if (param.required) {
          if (param.type === "string") testArgs[param.name] = "test";
          else if (param.type === "number") testArgs[param.name] = 1;
          else testArgs[param.name] = "test";
        }
      }

      const result = await executeTool(testTool.name, testArgs, {
        orgId,
        runId: "test",
        connectorSlug: connector.slug,
        credentials,
      });

      await this.audit.emit({
        orgId,
        actorId: userId,
        actorType: "user",
        action: "connector.tested",
        resourceType: "connector",
        resourceId: connectorId,
        metadata: {
          connectorSlug: connector.slug,
          success: !result.error,
          toolTested: testTool.name,
        },
      });

      if (result.error) {
        return ok({ success: false, message: result.error.message });
      }

      return ok({ success: true, message: "Connector test passed", toolResults: [result.output] });
    } catch (e) {
      return err(AppError.internal(e instanceof Error ? e.message : "Failed to test connector"));
    }
  }

  async revoke(
    connectorId: ConnectorId,
    orgId: OrgId,
    userId: UserId,
  ): Promise<Result<void>> {
    try {
      const install = await this.installRepo.getByConnectorId(connectorId, orgId);
      if (!install) {
        return err(new AppError("NOT_FOUND", "Connector is not installed", 404));
      }

      // Delete credentials first
      await this.credentialRepo.deleteByInstallId(install.id, orgId);

      // Delete the install
      await this.installRepo.delete(install.id, orgId);

      await this.audit.emit({
        orgId,
        actorId: userId,
        actorType: "user",
        action: "connector.revoked",
        resourceType: "connector",
        resourceId: connectorId,
        metadata: { connectorSlug: install.connectorSlug },
      });

      return ok(undefined);
    } catch (e) {
      return err(AppError.internal(e instanceof Error ? e.message : "Failed to revoke connector"));
    }
  }

  async getScopes(connectorId: ConnectorId): Promise<Result<Array<{ id: string; name: string; description: string }>>> {
    const connector = await this.connectorRepo.getById(connectorId);
    if (!connector) return err(AppError.notFound("Connector", connectorId));
    return ok([...connector.scopes]);
  }
}
