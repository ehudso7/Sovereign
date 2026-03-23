/**
 * @sovereign/connectors
 *
 * Connector framework types for integrating external services and data
 * sources into the Sovereign platform.
 */

import type {
  ConnectorId,
  OrgId,
  UserId,
  TenantContext,
  Result,
  AuditFields,
  ISODateString,
} from "@sovereign/core";

export type { ConnectorId } from "@sovereign/core";

// ---------------------------------------------------------------------------
// Connector status
// ---------------------------------------------------------------------------

export type ConnectorStatus =
  | "pending_auth"
  | "active"
  | "error"
  | "revoked"
  | "disabled";

export type ConnectorAuthType =
  | "oauth2"
  | "api_key"
  | "basic"
  | "bearer"
  | "custom";

// ---------------------------------------------------------------------------
// Connector category
// ---------------------------------------------------------------------------

export type ConnectorCategory =
  | "crm"
  | "communication"
  | "storage"
  | "calendar"
  | "analytics"
  | "database"
  | "finance"
  | "hr"
  | "marketing"
  | "ecommerce"
  | "custom";

// ---------------------------------------------------------------------------
// Connector definition (static metadata about a connector type)
// ---------------------------------------------------------------------------

export interface ConnectorScope {
  readonly name: string;
  readonly description: string;
  readonly required: boolean;
}

export interface ConnectorDefinition {
  /** Unique slug, e.g. "salesforce", "slack", "google-drive". */
  readonly slug: string;
  readonly displayName: string;
  readonly description: string;
  readonly category: ConnectorCategory;
  readonly authType: ConnectorAuthType;
  readonly logoUrl?: string;
  readonly docsUrl?: string;
  readonly scopes: readonly ConnectorScope[];
  readonly version: string;
}

// ---------------------------------------------------------------------------
// Connector instance (per-org installation of a connector)
// ---------------------------------------------------------------------------

export interface ConnectorCredentials {
  /** Opaque – stored encrypted at rest. Never logged. */
  readonly accessToken?: string;
  readonly refreshToken?: string;
  readonly expiresAt?: ISODateString;
  readonly apiKey?: string;
  readonly extra?: Record<string, string>;
}

export interface Connector extends AuditFields {
  readonly id: ConnectorId;
  readonly orgId: OrgId;
  readonly installedBy: UserId;
  readonly definitionSlug: string;
  readonly displayName: string;
  readonly status: ConnectorStatus;
  readonly grantedScopes: readonly string[];
  readonly lastSyncAt?: ISODateString;
  readonly errorMessage?: string;
  readonly metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Sync / event types
// ---------------------------------------------------------------------------

export type SyncDirection = "inbound" | "outbound" | "bidirectional";
export type SyncStatus = "idle" | "running" | "completed" | "failed";

export interface SyncJob {
  readonly id: string;
  readonly connectorId: ConnectorId;
  readonly orgId: OrgId;
  readonly direction: SyncDirection;
  readonly status: SyncStatus;
  readonly startedAt: ISODateString;
  readonly completedAt?: ISODateString;
  readonly recordsProcessed: number;
  readonly errorMessage?: string;
}

export interface ConnectorEvent {
  readonly id: string;
  readonly connectorId: ConnectorId;
  readonly orgId: OrgId;
  readonly eventType: string;
  readonly payload: unknown;
  readonly receivedAt: ISODateString;
  readonly processedAt?: ISODateString;
}

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

export interface ConnectorService {
  getDefinition(slug: string): ConnectorDefinition | undefined;
  listDefinitions(): readonly ConnectorDefinition[];
  get(ctx: TenantContext, id: ConnectorId): Promise<Result<Connector>>;
  list(ctx: TenantContext): Promise<Result<readonly Connector[]>>;
  install(ctx: TenantContext, input: InstallConnectorInput): Promise<Result<Connector>>;
  uninstall(ctx: TenantContext, id: ConnectorId): Promise<Result<void>>;
  sync(ctx: TenantContext, id: ConnectorId): Promise<Result<SyncJob>>;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface InstallConnectorInput {
  readonly definitionSlug: string;
  readonly displayName?: string;
  readonly credentials: ConnectorCredentials;
  readonly scopes: readonly string[];
  readonly metadata?: Record<string, unknown>;
}
