/**
 * Integration tests: RLS (Row-Level Security) tenant isolation proof.
 *
 * Proves:
 * - Correct-tenant access succeeds
 * - Wrong-tenant access fails or returns no rows
 * - Unscoped access without app.current_org_id set returns no rows on RLS tables
 * - app.current_org_id mechanism is correctly set in transactions via TenantDb
 * - FORCE ROW LEVEL SECURITY is enforced even for the table owner role
 * - Cross-tenant data isolation is absolute for all RLS-protected tables
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { OrgId, UserId } from "@sovereign/core";
import { setupTestDb, teardownTestDb, getTestDb, truncateAllTables } from "./db-test-harness.js";
import {
  PgUserRepo,
  PgOrgRepo,
  PgMembershipRepo,
  PgInvitationRepo,
  PgSessionRepo,
  PgProjectRepo,
  PgAuditRepo,
} from "../../repositories/index.js";

interface TestOrg {
  id: OrgId;
  slug: string;
}

let orgA: TestOrg;
let orgB: TestOrg;
let userA: { id: UserId; email: string };

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await truncateAllTables();

  const db = getTestDb();
  const userRepo = new PgUserRepo(db.unscoped());
  const orgRepo = new PgOrgRepo(db.unscoped());
  const memberRepo = new PgMembershipRepo(db.unscoped());

  // Create two separate orgs with their own users
  const uA = await userRepo.create({ email: "alice@orga.com", name: "Alice (Org A)" });
  const uB = await userRepo.create({ email: "bob@orgb.com", name: "Bob (Org B)" });
  const oA = await orgRepo.create({ name: "Org A", slug: "org-a" });
  const oB = await orgRepo.create({ name: "Org B", slug: "org-b" });

  // Each user is a member of their respective org
  await memberRepo.create({ orgId: oA.id, userId: uA.id, role: "org_owner", accepted: true });
  await memberRepo.create({ orgId: oB.id, userId: uB.id, role: "org_owner", accepted: true });

  orgA = { id: oA.id, slug: oA.slug };
  orgB = { id: oB.id, slug: oB.slug };
  userA = { id: uA.id, email: uA.email };
  // userB stored only in setup; not referenced in tests
});

describe("RLS: Projects table tenant isolation", () => {
  it("correct-tenant access returns own projects", async () => {
    const db = getTestDb();
    const tenantA = db.forTenant(orgA.id);
    const projectRepoA = new PgProjectRepo(tenantA);

    await projectRepoA.create({ orgId: orgA.id, name: "Org A Project", slug: "org-a-proj" });

    const found = await projectRepoA.listForOrg(orgA.id);
    expect(found).toHaveLength(1);
    expect(found[0]!.name).toBe("Org A Project");
  });

  it("wrong-tenant access returns no rows for other org's projects", async () => {
    const db = getTestDb();

    // Create a project for Org A
    const tenantA = db.forTenant(orgA.id);
    const projectRepoA = new PgProjectRepo(tenantA);
    await projectRepoA.create({ orgId: orgA.id, name: "Secret Project", slug: "secret" });

    // Org B tries to access — should see nothing
    const tenantB = db.forTenant(orgB.id);
    const projectRepoB = new PgProjectRepo(tenantB);
    const found = await projectRepoB.listForOrg(orgA.id); // Even passing orgA's id explicitly
    expect(found).toHaveLength(0);
  });

  it("wrong-tenant cannot read project by ID across tenants", async () => {
    const db = getTestDb();

    // Create project in Org A
    const tenantA = db.forTenant(orgA.id);
    const projectRepoA = new PgProjectRepo(tenantA);
    const project = await projectRepoA.create({ orgId: orgA.id, name: "Hidden", slug: "hidden" });

    // Org B tries to get it by ID
    const tenantB = db.forTenant(orgB.id);
    const projectRepoB = new PgProjectRepo(tenantB);
    const found = await projectRepoB.getById(project.id, orgA.id);
    expect(found).toBeNull();
  });
});

describe("RLS: Memberships table tenant isolation", () => {
  it("correct-tenant can see own memberships via raw SQL in transaction", async () => {
    const db = getTestDb();
    const tenantA = db.forTenant(orgA.id);

    const rows = await tenantA.transaction(async (tx) => {
      return tx.query<{ id: string; org_id: string }>(
        "SELECT id, org_id FROM memberships",
      );
    });

    // Should only see Org A's membership
    expect(rows.length).toBe(1);
    expect(rows[0]!.org_id).toBe(orgA.id);
  });

  it("wrong-tenant sees no memberships from other org", async () => {
    const db = getTestDb();
    const tenantB = db.forTenant(orgB.id);

    const rows = await tenantB.transaction(async (tx) => {
      return tx.query<{ id: string; org_id: string }>(
        "SELECT id, org_id FROM memberships WHERE org_id = $1",
        [orgA.id],
      );
    });

    // Org B should not see Org A's memberships even with explicit org_id filter
    expect(rows).toHaveLength(0);
  });
});

describe("RLS: Invitations table tenant isolation", () => {
  it("correct-tenant can see own invitations", async () => {
    const db = getTestDb();
    const invRepo = new PgInvitationRepo(db.unscoped());

    // Create invitation for Org A (uses transactionWithOrg internally)
    await invRepo.create({
      orgId: orgA.id,
      email: "newbie@orga.com",
      role: "org_member",
      invitedBy: userA.id,
      expiresAt: new Date(Date.now() + 86400_000).toISOString(),
    });

    // Tenant A should see it
    const tenantA = db.forTenant(orgA.id);
    const rows = await tenantA.transaction(async (tx) => {
      return tx.query<{ id: string; org_id: string; email: string }>(
        "SELECT id, org_id, email FROM invitations WHERE org_id = $1",
        [orgA.id],
      );
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.email).toBe("newbie@orga.com");
  });

  it("wrong-tenant cannot see other org's invitations", async () => {
    const db = getTestDb();
    const invRepo = new PgInvitationRepo(db.unscoped());

    await invRepo.create({
      orgId: orgA.id,
      email: "secret@orga.com",
      role: "org_member",
      invitedBy: userA.id,
      expiresAt: new Date(Date.now() + 86400_000).toISOString(),
    });

    // Tenant B tries to read Org A's invitations
    const tenantB = db.forTenant(orgB.id);
    const rows = await tenantB.transaction(async (tx) => {
      return tx.query<{ id: string }>(
        "SELECT id FROM invitations",
      );
    });
    expect(rows).toHaveLength(0);
  });
});

describe("RLS: Sessions table tenant isolation", () => {
  it("correct-tenant can see own sessions", async () => {
    const db = getTestDb();
    const sessionRepo = new PgSessionRepo(db.unscoped());

    await sessionRepo.create({
      userId: userA.id,
      orgId: orgA.id,
      role: "org_owner",
      tokenHash: "hash_rls_a",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    });

    const tenantA = db.forTenant(orgA.id);
    const rows = await tenantA.transaction(async (tx) => {
      return tx.query<{ id: string; org_id: string }>(
        "SELECT id, org_id FROM sessions",
      );
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.org_id).toBe(orgA.id);
  });

  it("wrong-tenant cannot see other org's sessions", async () => {
    const db = getTestDb();
    const sessionRepo = new PgSessionRepo(db.unscoped());

    await sessionRepo.create({
      userId: userA.id,
      orgId: orgA.id,
      role: "org_owner",
      tokenHash: "hash_rls_cross",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    });

    const tenantB = db.forTenant(orgB.id);
    const rows = await tenantB.transaction(async (tx) => {
      return tx.query<{ id: string }>(
        "SELECT id FROM sessions",
      );
    });
    expect(rows).toHaveLength(0);
  });
});

describe("RLS: Audit events table tenant isolation", () => {
  it("correct-tenant can see own audit events", async () => {
    const db = getTestDb();
    const tenantA = db.forTenant(orgA.id);
    const auditRepo = new PgAuditRepo(tenantA);

    await auditRepo.emit({
      orgId: orgA.id,
      actorId: userA.id,
      actorType: "user",
      action: "org.created",
      resourceType: "test",
    });

    const events = await auditRepo.query(orgA.id);
    expect(events).toHaveLength(1);
    expect(events[0]!.action).toBe("org.created");
  });

  it("wrong-tenant cannot see other org's audit events", async () => {
    const db = getTestDb();
    const tenantA = db.forTenant(orgA.id);
    const auditRepoA = new PgAuditRepo(tenantA);

    await auditRepoA.emit({
      orgId: orgA.id,
      actorId: userA.id,
      actorType: "user",
      action: "org.deleted",
      resourceType: "secret",
    });

    const tenantB = db.forTenant(orgB.id);
    const auditRepoB = new PgAuditRepo(tenantB);
    const events = await auditRepoB.query(orgA.id);
    expect(events).toHaveLength(0);
  });
});

describe("RLS: app.current_org_id mechanism verification", () => {
  it("verifies SET LOCAL app.current_org_id is set correctly in TenantDb transactions", async () => {
    const db = getTestDb();
    const tenantA = db.forTenant(orgA.id);

    const result = await tenantA.transaction(async (tx) => {
      const rows = await tx.query<{ current_org_id: string }>(
        "SELECT current_setting('app.current_org_id', true) as current_org_id",
      );
      return rows[0]!.current_org_id;
    });

    expect(result).toBe(orgA.id);
  });

  it("outside transactions, queries without tenant context see no RLS-protected rows", async () => {
    const db = getTestDb();

    // Insert data via repo (which handles its own transaction)
    const tenantA = db.forTenant(orgA.id);
    const projectRepo = new PgProjectRepo(tenantA);
    await projectRepo.create({ orgId: orgA.id, name: "Test", slug: "test-rls-no-ctx" });

    // Query without setting app.current_org_id — RLS blocks access.
    // current_setting('app.current_org_id', true) returns '' when unset,
    // and ''::uuid throws "invalid input syntax for type uuid".
    // This proves RLS rejects queries without proper tenant context.
    const pool = db.getPool();
    const client = await pool.connect();
    try {
      await expect(
        client.query("SELECT * FROM projects"),
      ).rejects.toThrow("invalid input syntax for type uuid");
    } finally {
      client.release();
    }
  });

  it("data inserted with one tenant context is invisible with another", async () => {
    const db = getTestDb();

    // Create data for both orgs
    const projectRepoA = new PgProjectRepo(db.forTenant(orgA.id));
    const projectRepoB = new PgProjectRepo(db.forTenant(orgB.id));

    await projectRepoA.create({ orgId: orgA.id, name: "A's Project", slug: "a-proj" });
    await projectRepoB.create({ orgId: orgB.id, name: "B's Project", slug: "b-proj" });

    // Verify each tenant only sees their own
    const aProjects = await projectRepoA.listForOrg(orgA.id);
    expect(aProjects).toHaveLength(1);
    expect(aProjects[0]!.name).toBe("A's Project");

    const bProjects = await projectRepoB.listForOrg(orgB.id);
    expect(bProjects).toHaveLength(1);
    expect(bProjects[0]!.name).toBe("B's Project");
  });

  it("wrong tenant cannot update or delete another tenant's data", async () => {
    const db = getTestDb();

    // Create project for Org A
    const projectRepoA = new PgProjectRepo(db.forTenant(orgA.id));
    const project = await projectRepoA.create({
      orgId: orgA.id,
      name: "Protected",
      slug: "protected",
    });

    // Org B tries to update it
    const projectRepoB = new PgProjectRepo(db.forTenant(orgB.id));
    const updateResult = await projectRepoB.update(project.id, orgA.id, { name: "Hacked" });
    expect(updateResult).toBeNull();

    // Org B tries to delete it
    const deleteResult = await projectRepoB.delete(project.id, orgA.id);
    expect(deleteResult).toBe(false);

    // Verify original data is untouched
    const original = await projectRepoA.getById(project.id, orgA.id);
    expect(original!.name).toBe("Protected");
  });

  it("RLS applies to INSERT — cannot insert into another tenant's scope via raw SQL", async () => {
    const db = getTestDb();
    const tenantB = db.forTenant(orgB.id);

    // In Org B's tenant context, try to insert a project with Org A's orgId via raw SQL
    await expect(
      tenantB.transaction(async (tx) => {
        await tx.execute(
          "INSERT INTO projects (org_id, name, slug) VALUES ($1, $2, $3)",
          [orgA.id, "Injected", "injected"],
        );
      }),
    ).rejects.toThrow(); // RLS policy prevents INSERT with wrong org_id
  });
});

describe("RLS: Comprehensive cross-table isolation check", () => {
  it("all RLS-protected tables are isolated between tenants", async () => {
    const db = getTestDb();
    const invRepo = new PgInvitationRepo(db.unscoped());
    const sessionRepo = new PgSessionRepo(db.unscoped());

    // Populate data for Org A across all RLS-protected tables
    // Memberships already created in beforeEach

    // Invitation for Org A
    await invRepo.create({
      orgId: orgA.id,
      email: "comprehensive@test.com",
      role: "org_member",
      invitedBy: userA.id,
      expiresAt: new Date(Date.now() + 86400_000).toISOString(),
    });

    // Session for Org A
    await sessionRepo.create({
      userId: userA.id,
      orgId: orgA.id,
      role: "org_owner",
      tokenHash: "hash_comprehensive",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    });

    // Project for Org A
    const projectRepoA = new PgProjectRepo(db.forTenant(orgA.id));
    await projectRepoA.create({
      orgId: orgA.id,
      name: "Comprehensive",
      slug: "comprehensive",
    });

    // Audit for Org A
    const auditRepoA = new PgAuditRepo(db.forTenant(orgA.id));
    await auditRepoA.emit({
      orgId: orgA.id,
      actorId: userA.id,
      actorType: "user",
      action: "org.updated",
      resourceType: "test",
    });

    // Now verify Org B sees NOTHING from Org A across all RLS tables
    const tenantB = db.forTenant(orgB.id);
    const results = await tenantB.transaction(async (tx) => {
      const memberships = await tx.query("SELECT * FROM memberships WHERE org_id = $1", [orgA.id]);
      const invitations = await tx.query("SELECT * FROM invitations WHERE org_id = $1", [orgA.id]);
      const sessions = await tx.query("SELECT * FROM sessions WHERE org_id = $1", [orgA.id]);
      const projects = await tx.query("SELECT * FROM projects WHERE org_id = $1", [orgA.id]);
      const audits = await tx.query("SELECT * FROM audit_events WHERE org_id = $1", [orgA.id]);

      return {
        memberships: memberships.length,
        invitations: invitations.length,
        sessions: sessions.length,
        projects: projects.length,
        audits: audits.length,
      };
    });

    expect(results.memberships).toBe(0);
    expect(results.invitations).toBe(0);
    expect(results.sessions).toBe(0);
    expect(results.projects).toBe(0);
    expect(results.audits).toBe(0);
  });
});
