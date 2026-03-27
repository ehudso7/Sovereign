/**
 * Integration test harness for real PostgreSQL tests.
 *
 * Manages database lifecycle: creates a fresh test DB, runs migrations,
 * provides a DatabaseClient, and tears down cleanly.
 */

import { Pool } from "pg";
import { DatabaseClient } from "../../client.js";
import { runMigrations } from "../../migrate.js";
import { join } from "node:path";

const BASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://sovereign:sovereign_test@localhost:5432/sovereign_test";

// Parse the base URL to get connection parameters
function parseUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: parseInt(u.port || "5432", 10),
    user: u.username,
    password: u.password,
    database: u.pathname.slice(1), // remove leading /
  };
}

const migrationsDir = join(import.meta.dirname ?? __dirname, "..", "..", "migrations");

let _dbClient: DatabaseClient | null = null;
let _testDbName: string | null = null;
let _adminPool: Pool | null = null;
let _appRole: string | null = null;

/**
 * Set up a fresh test database with all migrations applied.
 * Call this in beforeAll().
 */
export async function setupTestDb(): Promise<DatabaseClient> {
  const parsed = parseUrl(BASE_URL);

  // Connect to the base database to create our test-specific DB
  _adminPool = new Pool({
    host: parsed.host,
    port: parsed.port,
    user: parsed.user,
    password: parsed.password,
    database: parsed.database,
  });

  // Create a unique database name for this test run
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  _testDbName = `sovereign_inttest_${suffix}`;

  await _adminPool.query(`CREATE DATABASE ${_testDbName}`);

  const testDbUrl = `postgresql://${parsed.user}:${parsed.password}@${parsed.host}:${parsed.port}/${_testDbName}`;

  // Run all migrations against the fresh DB (as superuser)
  const migrationResult = await runMigrations(testDbUrl, migrationsDir);
  if (migrationResult.failed.length > 0) {
    throw new Error(`Migrations failed: ${migrationResult.failed.join(", ")}`);
  }

  // Create a non-superuser role for the app so RLS is enforced.
  // Superusers bypass RLS even with FORCE ROW LEVEL SECURITY.
  const setupPool = new Pool({ connectionString: testDbUrl });
  try {
    const appRole = `sovereign_app_${suffix}`;
    await setupPool.query(`CREATE ROLE ${appRole} LOGIN PASSWORD '${parsed.password}' NOSUPERUSER`);
    await setupPool.query(`GRANT ALL ON DATABASE ${_testDbName} TO ${appRole}`);
    await setupPool.query(`GRANT ALL ON ALL TABLES IN SCHEMA public TO ${appRole}`);
    await setupPool.query(`GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${appRole}`);
    await setupPool.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${appRole}`);
    await setupPool.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${appRole}`);
    _appRole = appRole;

    // Connect the DatabaseClient as the non-superuser app role
    const appDbUrl = `postgresql://${appRole}:${parsed.password}@${parsed.host}:${parsed.port}/${_testDbName}`;
    _dbClient = new DatabaseClient({
      url: appDbUrl,
      maxConnections: 5,
      connectionTimeoutMs: 5_000,
    });
  } finally {
    await setupPool.end();
  }

  return _dbClient;
}

/**
 * Tear down the test database.
 * Call this in afterAll().
 */
export async function teardownTestDb(): Promise<void> {
  if (_dbClient) {
    await _dbClient.destroy();
    _dbClient = null;
  }

  if (_adminPool && _testDbName) {
    // Wait briefly for connections to drain, then terminate any lingering ones
    await new Promise((resolve) => setTimeout(resolve, 100));
    try {
      await _adminPool.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [_testDbName],
      );
    } catch {
      // Ignore errors during cleanup
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
    await _adminPool.query(`DROP DATABASE IF EXISTS ${_testDbName}`);
    if (_appRole) {
      await _adminPool.query(`DROP ROLE IF EXISTS ${_appRole}`);
      _appRole = null;
    }
    await _adminPool.end();
    _adminPool = null;
    _testDbName = null;
  }
}

/**
 * Get the current test DatabaseClient.
 */
export function getTestDb(): DatabaseClient {
  if (!_dbClient) {
    throw new Error("Test database not set up. Call setupTestDb() first.");
  }
  return _dbClient;
}

/**
 * Clean all data from tables (preserving schema).
 * Call this in beforeEach() or afterEach() for test isolation.
 */
export async function truncateAllTables(): Promise<void> {
  const db = getTestDb();
  const unscoped = db.unscoped();
  await unscoped.execute(`
    TRUNCATE TABLE spend_alerts, invoices, usage_events, billing_accounts, crm_sync_log, outreach_drafts, crm_notes, crm_tasks, crm_deals, crm_contacts, crm_accounts, policy_decisions, approvals, quarantine_records, policies, alert_events, alert_rules, memory_links, memories, browser_sessions, skill_installs, skills, connector_credentials, connector_installs, connectors, run_steps, runs, agent_versions, agents, audit_events, sessions, invitations, projects, memberships, organizations, users CASCADE
  `);
}

/**
 * Get the test database URL (for migration runner tests that need the raw URL).
 */
export function getTestDbUrl(): string {
  if (!_testDbName) {
    throw new Error("Test database not set up. Call setupTestDb() first.");
  }
  const parsed = parseUrl(BASE_URL);
  const user = _appRole ?? parsed.user;
  return `postgresql://${user}:${parsed.password}@${parsed.host}:${parsed.port}/${_testDbName}`;
}
