import type { OrgId } from "@sovereign/core";

// ---------------------------------------------------------------------------
// Database client configuration
// ---------------------------------------------------------------------------

export interface DatabaseConfig {
  /** Primary connection URL (e.g. postgres://user:pass@host:5432/dbname) */
  url: string;
  /** Read-replica URL, falls back to `url` when not set. */
  readUrl?: string;
  /** Maximum connections in the pool. Defaults to 10. */
  maxConnections?: number;
  /** Idle timeout in milliseconds. Defaults to 30_000. */
  idleTimeoutMs?: number;
  /** Connection timeout in milliseconds. Defaults to 5_000. */
  connectionTimeoutMs?: number;
  /** Enable query logging in development. Defaults to false. */
  debug?: boolean;
}

// ---------------------------------------------------------------------------
// Tenant-scoped query context
// ---------------------------------------------------------------------------

/**
 * A scoped database handle restricted to a single organisation's data.
 * Concrete adapters (Drizzle, Prisma, Kysley, etc.) will extend this.
 */
export interface TenantDb {
  readonly orgId: OrgId;
  /** Execute a raw parameterised query. Use with caution. */
  execute<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Begin a transaction, yielding a child TenantDb scoped to that tx. */
  transaction<T>(fn: (tx: TenantDb) => Promise<T>): Promise<T>;
  /** Release any held resources. */
  destroy(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Client factory stub
// ---------------------------------------------------------------------------

/**
 * Global database client singleton.
 * Replace this stub with a real adapter (e.g. `drizzle(pool)`) once a
 * concrete driver is chosen.
 */
export class DatabaseClient {
  private readonly config: Required<
    Pick<DatabaseConfig, "url" | "maxConnections" | "idleTimeoutMs" | "connectionTimeoutMs" | "debug">
  > &
    Pick<DatabaseConfig, "readUrl">;

  constructor(config: DatabaseConfig) {
    this.config = {
      url: config.url,
      readUrl: config.readUrl,
      maxConnections: config.maxConnections ?? 10,
      idleTimeoutMs: config.idleTimeoutMs ?? 30_000,
      connectionTimeoutMs: config.connectionTimeoutMs ?? 5_000,
      debug: config.debug ?? false,
    };
  }

  /**
   * Return a tenant-scoped db handle.
   * The implementation will set a `app.current_org_id` session variable
   * (or equivalent) before each statement to enforce row-level security.
   */
  forTenant(_orgId: OrgId): TenantDb {
    throw new Error(
      "DatabaseClient.forTenant() is a stub – wire up a real adapter."
    );
  }

  getConfig() {
    return this.config;
  }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
    throw new Error(
      "DatabaseClient.healthCheck() is a stub – wire up a real adapter."
    );
  }

  async destroy(): Promise<void> {
    // no-op in stub
  }
}

let _client: DatabaseClient | null = null;

/** Initialise (or return the existing) singleton client. */
export function initDb(config: DatabaseConfig): DatabaseClient {
  if (!_client) {
    _client = new DatabaseClient(config);
  }
  return _client;
}

/** Return the already-initialised client, throwing if not set up yet. */
export function getDb(): DatabaseClient {
  if (!_client) {
    throw new Error(
      "Database client has not been initialised. Call initDb() first."
    );
  }
  return _client;
}
