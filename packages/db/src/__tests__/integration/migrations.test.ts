/**
 * Integration tests: Migration proof against a real PostgreSQL instance.
 *
 * Proves:
 * - Migrations run from scratch on a fresh empty database
 * - All expected tables and indexes are created
 * - Schema state is consistent
 * - Rerunning migrations is idempotent (skips already-applied)
 * - Migration status tracking works
 * - RLS policies are applied
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { runMigrations, getMigrationStatus } from "../../migrate.js";
import { join } from "node:path";

const BASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://sovereign:sovereign_test@localhost:5432/sovereign_test";

const migrationsDir = join(import.meta.dirname ?? __dirname, "..", "..", "migrations");

function parseUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: parseInt(u.port || "5432", 10),
    user: u.username,
    password: u.password,
    database: u.pathname.slice(1),
  };
}

let adminPool: Pool;
let testDbName: string;
let testDbUrl: string;

beforeAll(async () => {
  const parsed = parseUrl(BASE_URL);
  adminPool = new Pool({
    host: parsed.host,
    port: parsed.port,
    user: parsed.user,
    password: parsed.password,
    database: parsed.database,
  });

  testDbName = `sovereign_migration_test_${Date.now().toString(36)}`;
  await adminPool.query(`CREATE DATABASE ${testDbName}`);
  testDbUrl = `postgresql://${parsed.user}:${parsed.password}@${parsed.host}:${parsed.port}/${testDbName}`;
});

afterAll(async () => {
  if (adminPool && testDbName) {
    await adminPool.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [testDbName],
    );
    await adminPool.query(`DROP DATABASE IF EXISTS ${testDbName}`);
    await adminPool.end();
  }
});

describe("Migration runner against real PostgreSQL", () => {
  it("applies all migrations from scratch on a fresh database", async () => {
    const result = await runMigrations(testDbUrl, migrationsDir);

    expect(result.failed).toEqual([]);
    expect(result.applied).toContain("001_phase2_identity");
    expect(result.applied).toContain("002_row_level_security");
    expect(result.skipped).toEqual([]);
  });

  it("creates all expected tables", async () => {
    const pool = new Pool({ connectionString: testDbUrl });
    try {
      const tables = await pool.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
         ORDER BY table_name`,
      );
      const tableNames = tables.rows.map((r: { table_name: string }) => r.table_name);

      expect(tableNames).toContain("users");
      expect(tableNames).toContain("organizations");
      expect(tableNames).toContain("memberships");
      expect(tableNames).toContain("invitations");
      expect(tableNames).toContain("sessions");
      expect(tableNames).toContain("projects");
      expect(tableNames).toContain("audit_events");
      expect(tableNames).toContain("schema_migrations");
    } finally {
      await pool.end();
    }
  });

  it("creates schema_migrations tracking table with correct entries", async () => {
    const status = await getMigrationStatus(testDbUrl);

    expect(status).toHaveLength(11);
    expect(status[0]!.version).toBe("001_phase2_identity");
    expect(status[1]!.version).toBe("002_row_level_security");
    expect(status[2]!.version).toBe("003_phase4_agents");
    expect(status[3]!.version).toBe("004_phase5_runs");
    expect(status[4]!.version).toBe("005_phase6_connectors");
    expect(status[5]!.version).toBe("006_phase7_browser");
    expect(status[6]!.version).toBe("007_phase8_memory");
    expect(status[7]!.version).toBe("008_phase9_alerts");
    expect(status[8]!.version).toBe("009_phase10_policies");
    expect(status[9]!.version).toBe("010_phase11_revenue");
    expect(status[10]!.version).toBe("011_phase12_billing");
    expect(status[0]!.appliedAt).toBeTruthy();
    expect(status[1]!.appliedAt).toBeTruthy();
  });

  it("skips already-applied migrations on rerun (idempotent)", async () => {
    const result = await runMigrations(testDbUrl, migrationsDir);

    expect(result.applied).toEqual([]);
    expect(result.failed).toEqual([]);
    expect(result.skipped).toContain("001_phase2_identity");
    expect(result.skipped).toContain("002_row_level_security");
  });

  it("verifies RLS is enabled on org-scoped tables", async () => {
    const pool = new Pool({ connectionString: testDbUrl });
    try {
      const rlsTables = await pool.query(
        `SELECT relname, relrowsecurity, relforcerowsecurity
         FROM pg_class
         WHERE relname IN ('memberships', 'invitations', 'projects', 'audit_events', 'sessions')
         ORDER BY relname`,
      );

      for (const row of rlsTables.rows) {
        const r = row as { relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean };
        expect(r.relrowsecurity).toBe(true);
        expect(r.relforcerowsecurity).toBe(true);
      }

      expect(rlsTables.rows).toHaveLength(5);
    } finally {
      await pool.end();
    }
  });

  it("verifies RLS policies exist for all org-scoped tables", async () => {
    const pool = new Pool({ connectionString: testDbUrl });
    try {
      const policies = await pool.query(
        `SELECT schemaname, tablename, policyname
         FROM pg_policies
         WHERE schemaname = 'public'
         ORDER BY tablename`,
      );

      const policyMap = new Map<string, string[]>();
      for (const row of policies.rows) {
        const r = row as { tablename: string; policyname: string };
        if (!policyMap.has(r.tablename)) policyMap.set(r.tablename, []);
        policyMap.get(r.tablename)!.push(r.policyname);
      }

      expect(policyMap.get("memberships")).toContain("memberships_tenant_policy");
      expect(policyMap.get("invitations")).toContain("invitations_tenant_policy");
      expect(policyMap.get("projects")).toContain("projects_tenant_policy");
      expect(policyMap.get("audit_events")).toContain("audit_events_tenant_policy");
      expect(policyMap.get("sessions")).toContain("sessions_tenant_policy");
    } finally {
      await pool.end();
    }
  });

  it("verifies key indexes exist", async () => {
    const pool = new Pool({ connectionString: testDbUrl });
    try {
      const indexes = await pool.query(
        `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname`,
      );
      const indexNames = indexes.rows.map((r: { indexname: string }) => r.indexname);

      expect(indexNames).toContain("idx_users_email");
      expect(indexNames).toContain("idx_memberships_org_user");
      expect(indexNames).toContain("idx_sessions_token_hash");
      expect(indexNames).toContain("idx_projects_org_slug");
      expect(indexNames).toContain("idx_audit_events_org_created");
    } finally {
      await pool.end();
    }
  });

  it("verifies column types match DB_SCHEMA.md spec", async () => {
    const pool = new Pool({ connectionString: testDbUrl });
    try {
      const columns = await pool.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'users'
         ORDER BY ordinal_position`,
      );

      const colMap = new Map(
        columns.rows.map((r: { column_name: string; data_type: string; is_nullable: string }) => [
          r.column_name,
          { type: r.data_type, nullable: r.is_nullable },
        ]),
      );

      expect(colMap.get("id")?.type).toBe("uuid");
      expect(colMap.get("email")?.nullable).toBe("NO");
      expect(colMap.get("name")?.nullable).toBe("NO");
      expect(colMap.get("created_at")?.type).toContain("timestamp");
    } finally {
      await pool.end();
    }
  });
});
