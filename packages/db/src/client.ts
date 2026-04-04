// ---------------------------------------------------------------------------
// Real PostgreSQL database client with connection pooling and tenant scoping
// ---------------------------------------------------------------------------

import { Pool, type PoolClient, type PoolConfig, type QueryResult } from "pg";
import type { OrgId } from "@sovereign/core";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface DatabaseConfig {
  url: string;
  readUrl?: string;
  maxConnections?: number;
  idleTimeoutMs?: number;
  connectionTimeoutMs?: number;
  debug?: boolean;
}

// ---------------------------------------------------------------------------
// Tenant-scoped query context
// ---------------------------------------------------------------------------

export interface TenantDb {
  readonly orgId: OrgId;
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<T[]>;
  queryOne<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<T | null>;
  execute(sql: string, params?: unknown[]): Promise<number>;
  transaction<T>(fn: (tx: TenantDb) => Promise<T>): Promise<T>;
}

// ---------------------------------------------------------------------------
// Unscoped query context (for user lookups, migrations, etc.)
// ---------------------------------------------------------------------------

export interface UnscopedDb {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<T[]>;
  queryOne<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<T | null>;
  execute(sql: string, params?: unknown[]): Promise<number>;
  transaction<T>(fn: (tx: UnscopedDb) => Promise<T>): Promise<T>;
  /**
   * Run a transaction with app.current_org_id set for RLS-protected table writes.
   * Use this when an unscoped repo needs to INSERT/UPDATE/DELETE on RLS-enabled tables.
   */
  transactionWithOrg<T>(orgId: OrgId, fn: (tx: UnscopedDb) => Promise<T>): Promise<T>;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildPoolConfig(config: DatabaseConfig): PoolConfig {
  return {
    connectionString: config.url,
    max: config.maxConnections ?? 10,
    idleTimeoutMillis: config.idleTimeoutMs ?? 30_000,
    connectionTimeoutMillis: config.connectionTimeoutMs ?? 5_000,
  };
}

class PgTenantDb implements TenantDb {
  constructor(
    readonly orgId: OrgId,
    private readonly client: PoolClient | Pool,
    private readonly debug: boolean,
  ) {}

  async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
    if (this.debug) {
      console.warn("[DB]", sql, params);
    }
    const result: QueryResult = await this.client.query(sql, params);
    return result.rows as T[];
  }

  async queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] ?? null;
  }

  async execute(sql: string, params?: unknown[]): Promise<number> {
    if (this.debug) {
      console.warn("[DB]", sql, params);
    }
    const result: QueryResult = await this.client.query(sql, params);
    return result.rowCount ?? 0;
  }

  async transaction<T>(fn: (tx: TenantDb) => Promise<T>): Promise<T> {
    if (this.client instanceof Pool) {
      const poolClient = await this.client.connect();
      try {
        await poolClient.query("BEGIN");
        await poolClient.query("SELECT set_config('app.current_org_id', $1::text, true)", [this.orgId]);
        const txDb = new PgTenantDb(this.orgId, poolClient, this.debug);
        const result = await fn(txDb);
        await poolClient.query("COMMIT");
        return result;
      } catch (e) {
        await poolClient.query("ROLLBACK");
        throw e;
      } finally {
        poolClient.release();
      }
    } else {
      // Already inside a transaction (client is a PoolClient)
      await this.client.query("SAVEPOINT sp");
      try {
        const result = await fn(this);
        await this.client.query("RELEASE SAVEPOINT sp");
        return result;
      } catch (e) {
        await this.client.query("ROLLBACK TO SAVEPOINT sp");
        throw e;
      }
    }
  }
}

class PgUnscopedDb implements UnscopedDb {
  constructor(
    private readonly client: PoolClient | Pool,
    private readonly debug: boolean,
  ) {}

  async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
    if (this.debug) {
      console.warn("[DB]", sql, params);
    }
    const result: QueryResult = await this.client.query(sql, params);
    return result.rows as T[];
  }

  async queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] ?? null;
  }

  async execute(sql: string, params?: unknown[]): Promise<number> {
    if (this.debug) {
      console.warn("[DB]", sql, params);
    }
    const result: QueryResult = await this.client.query(sql, params);
    return result.rowCount ?? 0;
  }

  async transaction<T>(fn: (tx: UnscopedDb) => Promise<T>): Promise<T> {
    if (this.client instanceof Pool) {
      const poolClient = await this.client.connect();
      try {
        await poolClient.query("BEGIN");
        const txDb = new PgUnscopedDb(poolClient, this.debug);
        const result = await fn(txDb);
        await poolClient.query("COMMIT");
        return result;
      } catch (e) {
        await poolClient.query("ROLLBACK");
        throw e;
      } finally {
        poolClient.release();
      }
    } else {
      await this.client.query("SAVEPOINT sp");
      try {
        const result = await fn(this);
        await this.client.query("RELEASE SAVEPOINT sp");
        return result;
      } catch (e) {
        await this.client.query("ROLLBACK TO SAVEPOINT sp");
        throw e;
      }
    }
  }

  async transactionWithOrg<T>(orgId: OrgId, fn: (tx: UnscopedDb) => Promise<T>): Promise<T> {
    if (this.client instanceof Pool) {
      const poolClient = await this.client.connect();
      try {
        await poolClient.query("BEGIN");
        await poolClient.query("SELECT set_config('app.current_org_id', $1::text, true)", [orgId]);
        const txDb = new PgUnscopedDb(poolClient, this.debug);
        const result = await fn(txDb);
        await poolClient.query("COMMIT");
        return result;
      } catch (e) {
        await poolClient.query("ROLLBACK");
        throw e;
      } finally {
        poolClient.release();
      }
    } else {
      // Nested: use savepoint and set org context
      await this.client.query("SAVEPOINT sp_org");
      await this.client.query("SELECT set_config('app.current_org_id', $1::text, true)", [orgId]);
      try {
        const result = await fn(this);
        await this.client.query("RELEASE SAVEPOINT sp_org");
        return result;
      } catch (e) {
        await this.client.query("ROLLBACK TO SAVEPOINT sp_org");
        throw e;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Database client
// ---------------------------------------------------------------------------

export class DatabaseClient {
  private readonly pool: Pool;
  private readonly debug: boolean;

  constructor(config: DatabaseConfig) {
    this.pool = new Pool(buildPoolConfig(config));
    this.debug = config.debug ?? false;
  }

  forTenant(orgId: OrgId): TenantDb {
    return new PgTenantDb(orgId, this.pool, this.debug);
  }

  unscoped(): UnscopedDb {
    return new PgUnscopedDb(this.pool, this.debug);
  }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      await this.pool.query("SELECT 1");
      return { ok: true, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  async destroy(): Promise<void> {
    await this.pool.end();
  }

  getPool(): Pool {
    return this.pool;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _client: DatabaseClient | null = null;

export function initDb(config: DatabaseConfig): DatabaseClient {
  if (!_client) {
    _client = new DatabaseClient(config);
  }
  return _client;
}

export function getDb(): DatabaseClient {
  if (!_client) {
    throw new Error("Database client has not been initialised. Call initDb() first.");
  }
  return _client;
}

export function resetDbClient(): void {
  _client = null;
}
