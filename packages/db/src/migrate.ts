// ---------------------------------------------------------------------------
// Migration runner — reads SQL files and applies them in order
// ---------------------------------------------------------------------------

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "pg";

export interface MigrationResult {
  applied: string[];
  skipped: string[];
  failed: string[];
}

const MIGRATIONS_TABLE = "schema_migrations";

async function ensureMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function getAppliedMigrations(pool: Pool): Promise<Set<string>> {
  const result = await pool.query(`SELECT version FROM ${MIGRATIONS_TABLE} ORDER BY version`);
  return new Set(result.rows.map((r: { version: string }) => r.version));
}

export async function runMigrations(databaseUrl: string, migrationsDir?: string): Promise<MigrationResult> {
  const dir = migrationsDir ?? join(import.meta.dirname ?? __dirname, "migrations");
  const pool = new Pool({ connectionString: databaseUrl });
  const result: MigrationResult = { applied: [], skipped: [], failed: [] };

  try {
    await ensureMigrationsTable(pool);
    const applied = await getAppliedMigrations(pool);

    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

    for (const file of files) {
      const version = file.replace(".sql", "");
      if (applied.has(version)) {
        result.skipped.push(version);
        continue;
      }

      const sql = await readFile(join(dir, file), "utf-8");
      // Extract only the UP portion (before DOWN comment block)
      const upSql = sql.split(/^-- =+\s*\n-- DOWN/m)[0] ?? sql;

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(upSql);
        await client.query(
          `INSERT INTO ${MIGRATIONS_TABLE} (version) VALUES ($1)`,
          [version],
        );
        await client.query("COMMIT");
        result.applied.push(version);
      } catch (e) {
        await client.query("ROLLBACK");
        result.failed.push(version);
        throw new Error(`Migration ${version} failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        client.release();
      }
    }

    return result;
  } finally {
    await pool.end();
  }
}

export async function rollbackMigration(databaseUrl: string, migrationsDir?: string): Promise<MigrationResult> {
  const dir = migrationsDir ?? join(import.meta.dirname ?? __dirname, "migrations");
  const pool = new Pool({ connectionString: databaseUrl });
  const result: MigrationResult = { applied: [], skipped: [], failed: [] };

  try {
    await ensureMigrationsTable(pool);
    const applied = await getAppliedMigrations(pool);
    if (applied.size === 0) return result;

    const lastVersion = Array.from(applied).sort().pop()!;
    const file = `${lastVersion}.sql`;
    const sql = await readFile(join(dir, file), "utf-8");

    // Extract DOWN portion — uncomment `-- DROP` lines or use raw DOWN SQL
    let downSql: string;
    const downMatch = sql.match(/^-- =+\s*\n-- DOWN.*?\n-- =+\s*\n([\s\S]+)$/m);
    if (downMatch) {
      // DOWN section found — uncomment any `-- ` prefixed lines
      downSql = downMatch[1]!
        .split("\n")
        .map((line) => line.startsWith("-- ") ? line.slice(3) : line)
        .join("\n")
        .trim();
    } else {
      // Try extracting commented-out DROP statements from anywhere in the file
      const dropStatements = sql
        .split("\n")
        .filter((line) => line.startsWith("-- DROP"))
        .map((line) => line.replace(/^-- /, ""));
      if (dropStatements.length === 0) {
        throw new Error(`No DOWN section found in migration ${lastVersion}`);
      }
      downSql = dropStatements.join(";\n");
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(downSql);
      await client.query(`DELETE FROM ${MIGRATIONS_TABLE} WHERE version = $1`, [lastVersion]);
      await client.query("COMMIT");
      result.applied.push(lastVersion);
    } catch (e) {
      await client.query("ROLLBACK");
      result.failed.push(lastVersion);
      throw e;
    } finally {
      client.release();
    }

    return result;
  } finally {
    await pool.end();
  }
}

export async function getMigrationStatus(
  databaseUrl: string,
): Promise<{ version: string; appliedAt: string }[]> {
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await ensureMigrationsTable(pool);
    const result = await pool.query(
      `SELECT version, applied_at as "appliedAt" FROM ${MIGRATIONS_TABLE} ORDER BY version`,
    );
    return result.rows;
  } finally {
    await pool.end();
  }
}

// CLI entry point
if (process.argv[1] && (process.argv[1].endsWith("migrate.ts") || process.argv[1].endsWith("migrate.js"))) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  runMigrations(url)
    .then((r) => {
      console.warn("Migration result:", JSON.stringify(r, null, 2));
    })
    .catch((e) => {
      console.error("Migration failed:", e);
      process.exit(1);
    });
}
