/**
 * @sovereign/db
 *
 * Database client, tenant-scoped query utilities, and migration helpers
 * for the Sovereign platform.
 */

export type { DatabaseConfig, TenantDb } from "./client.js";
export { DatabaseClient, initDb, getDb } from "./client.js";

// ---------------------------------------------------------------------------
// Migration utilities (stub – replace with a real migration runner)
// ---------------------------------------------------------------------------

export interface MigrationResult {
  applied: string[];
  skipped: string[];
  failed: string[];
}

/**
 * Run all pending migrations against the target database URL.
 * Stub implementation – wire up a real migration runner (e.g. drizzle-kit,
 * node-postgres migrate, etc.) here.
 */
export async function runMigrations(
  _databaseUrl: string
): Promise<MigrationResult> {
  throw new Error(
    "runMigrations() is a stub – wire up a real migration runner."
  );
}

/**
 * Roll back the last applied migration batch.
 */
export async function rollbackMigration(
  _databaseUrl: string
): Promise<MigrationResult> {
  throw new Error(
    "rollbackMigration() is a stub – wire up a real migration runner."
  );
}

/**
 * Return the current schema version / applied migration list.
 */
export async function getMigrationStatus(
  _databaseUrl: string
): Promise<{ version: string; appliedAt: string }[]> {
  throw new Error(
    "getMigrationStatus() is a stub – wire up a real migration runner."
  );
}
