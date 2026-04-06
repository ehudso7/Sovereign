// ---------------------------------------------------------------------------
// Seed script — populates a local dev database with sample data for testing
// ---------------------------------------------------------------------------

import { Pool } from "pg";
import crypto from "node:crypto";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://sovereign:sovereign_dev@localhost:5432/sovereign";

interface SeedIds {
  orgId: string;
  userId: string;
  projectId: string;
  agentIds: string[];
}

function uuid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

async function seed(): Promise<void> {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    console.warn("[seed] Starting seed...");

    // Check if data already exists
    const existingOrgs = await pool.query("SELECT COUNT(*)::int AS count FROM organizations");
    if (existingOrgs.rows[0].count > 0) {
      console.warn("[seed] Database already has data. Skipping seed. To re-seed, truncate tables first.");
      return;
    }

    const ids: SeedIds = {
      orgId: uuid(),
      userId: uuid(),
      projectId: uuid(),
      agentIds: [uuid(), uuid(), uuid()],
    };

    const ts = now();

    // --- Organization ---
    await pool.query(
      `INSERT INTO organizations (id, name, slug, plan, settings, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)`,
      [ids.orgId, "Demo Organization", "demo-org", "team", "{}", ts],
    );
    console.warn("[seed] Created organization: Demo Organization (demo-org)");

    // --- User ---
    await pool.query(
      `INSERT INTO users (id, email, name, avatar_url, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $5)`,
      [ids.userId, "admin@demo.local", "Demo Admin", null, ts],
    );
    console.warn("[seed] Created user: admin@demo.local");

    // --- Membership (owner) ---
    await pool.query(
      `INSERT INTO memberships (id, org_id, user_id, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $5)`,
      [uuid(), ids.orgId, ids.userId, "org_owner", ts],
    );

    // --- Project ---
    await pool.query(
      `INSERT INTO projects (id, org_id, name, slug, description, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)`,
      [ids.projectId, ids.orgId, "Demo Project", "demo-project", "Sample project for testing all platform features", ts],
    );
    console.warn("[seed] Created project: Demo Project");

    // --- Agents ---
    const agentDefs = [
      { name: "Code Review Agent", slug: "code-review", desc: "Reviews pull requests and suggests improvements", status: "active" },
      { name: "Data Pipeline Agent", slug: "data-pipeline", desc: "Monitors and manages ETL pipelines", status: "active" },
      { name: "Customer Support Agent", slug: "customer-support", desc: "Handles tier-1 customer inquiries", status: "draft" },
    ];

    // Use RLS context for org-scoped tables
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.current_org_id', $1, true)", [ids.orgId]);

      for (const [i, def] of agentDefs.entries()) {
        await client.query(
          `INSERT INTO agents (id, org_id, project_id, name, slug, description, status, model_config, created_by, updated_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $10, $10)`,
          [
            ids.agentIds[i], ids.orgId, ids.projectId,
            def.name, def.slug, def.desc, def.status,
            JSON.stringify({ provider: "openai", model: "gpt-4o", temperature: 0.7 }),
            ids.userId, ts,
          ],
        );
      }
      console.warn(`[seed] Created ${agentDefs.length} agents`);

      // --- Agent Versions ---
      for (const [i, def] of agentDefs.entries()) {
        await client.query(
          `INSERT INTO agent_versions (id, org_id, agent_id, version_number, status, goals, instructions, tools, budget, approval_rules, memory_config, schedule, model_config, created_by, updated_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14, $15, $15)`,
          [
            uuid(), ids.orgId, ids.agentIds[i], 1,
            i < 2 ? "published" : "draft",
            JSON.stringify([`Execute ${def.name} tasks`]),
            `You are the ${def.name}. ${def.desc}.`,
            "[]", "{}", "[]", "{}", "{}",
            JSON.stringify({ provider: "openai", model: "gpt-4o", temperature: 0.7 }),
            ids.userId, ts,
          ],
        );
      }
      console.warn("[seed] Created agent versions");

      // --- Policies ---
      const policyId = uuid();
      await client.query(
        `INSERT INTO policies (id, org_id, name, description, status, policy_type, enforcement, scope_type, scope_id, action_pattern, rules, priority, created_by, updated_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13, $14, $14)`,
        [
          policyId, ids.orgId,
          "Require Approval for Browser Actions",
          "All browser upload and download actions require admin approval",
          "active", "action", "require_approval", "org", ids.orgId,
          "browser.*",
          JSON.stringify([{ action: "browser.upload_file", effect: "require_approval" }]),
          100, ids.userId, ts,
        ],
      );
      console.warn("[seed] Created sample policy");

      // --- CRM Accounts ---
      const accountIds = [uuid(), uuid()];
      const accounts = [
        { name: "Acme Corp", domain: "acme.com", industry: "Technology", status: "active" },
        { name: "Globex Industries", domain: "globex.com", industry: "Manufacturing", status: "prospect" },
      ];

      for (const [i, acct] of accounts.entries()) {
        await client.query(
          `INSERT INTO crm_accounts (id, org_id, name, domain, industry, status, owner_id, metadata, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
          [accountIds[i], ids.orgId, acct.name, acct.domain, acct.industry, acct.status, ids.userId, "{}", ts],
        );
      }
      console.warn("[seed] Created 2 CRM accounts");

      // --- CRM Contacts ---
      const contacts = [
        { name: "Alice Johnson", email: "alice@acme.com", title: "CTO", accountId: accountIds[0] },
        { name: "Bob Smith", email: "bob@globex.com", title: "VP Engineering", accountId: accountIds[1] },
      ];

      for (const contact of contacts) {
        await client.query(
          `INSERT INTO crm_contacts (id, org_id, account_id, name, email, title, status, metadata, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
          [uuid(), ids.orgId, contact.accountId, contact.name, contact.email, contact.title, "active", "{}", ts],
        );
      }
      console.warn("[seed] Created 2 CRM contacts");

      // --- CRM Deals ---
      await client.query(
        `INSERT INTO crm_deals (id, org_id, account_id, name, stage, value_cents, currency, owner_id, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
        [uuid(), ids.orgId, accountIds[0], "Enterprise License", "negotiation", 15000000, "USD", ids.userId, "{}", ts],
      );
      console.warn("[seed] Created 1 CRM deal");

      // --- Billing Account ---
      await client.query(
        `INSERT INTO billing_accounts (id, org_id, plan, status, overage_policy, billing_email, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
        [uuid(), ids.orgId, "team", "active", "allow", "billing@demo.local", "{}", ts],
      );
      console.warn("[seed] Created billing account (team plan)");

      // --- Audit Events ---
      const auditActions = [
        "org.created", "user.created", "project.created",
        "agent.created", "agent.created", "agent.created",
        "policy.created", "billing.account_created",
      ];

      for (const action of auditActions) {
        await client.query(
          `INSERT INTO audit_events (id, org_id, action, actor_type, actor_id, resource_type, resource_id, metadata, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [uuid(), ids.orgId, action, "user", ids.userId, "system", ids.orgId, "{}", ts],
        );
      }
      console.warn("[seed] Created audit trail");

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    console.warn("\n[seed] Seed complete. You can now sign in with:");
    console.warn("  Email: admin@demo.local");
    console.warn("  URL:   http://localhost:3000");
    console.warn("\n[seed] Sample data created:");
    console.warn("  - 1 organization (Demo Organization)");
    console.warn("  - 1 user (Demo Admin)");
    console.warn("  - 1 project (Demo Project)");
    console.warn("  - 3 agents (Code Review, Data Pipeline, Customer Support)");
    console.warn("  - 1 policy (require approval for browser actions)");
    console.warn("  - 2 CRM accounts + 2 contacts + 1 deal");
    console.warn("  - 1 billing account (team plan)");
    console.warn("  - 8 audit events");
  } finally {
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("[seed] Failed:", err);
  process.exit(1);
});
