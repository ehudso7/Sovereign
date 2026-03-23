/**
 * Integration tests: Repository CRUD operations against real PostgreSQL.
 *
 * Proves:
 * - All repository implementations work with a real database
 * - CRUD operations for users, orgs, memberships, invitations, sessions, projects, audit events
 * - Transaction behavior (commit, rollback, nested savepoints)
 * - Session persistence and revocation
 * - Invitation acceptance and org membership flows
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { toUserId } from "@sovereign/core";
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

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await truncateAllTables();
});

describe("PgUserRepo", () => {
  it("creates a user and retrieves by id", async () => {
    const db = getTestDb();
    const repo = new PgUserRepo(db.unscoped());

    const user = await repo.create({ email: "alice@test.com", name: "Alice" });

    expect(user.id).toBeTruthy();
    expect(user.email).toBe("alice@test.com");
    expect(user.name).toBe("Alice");
    expect(user.createdAt).toBeTruthy();

    const found = await repo.getById(user.id);
    expect(found).not.toBeNull();
    expect(found!.email).toBe("alice@test.com");
  });

  it("retrieves user by email", async () => {
    const db = getTestDb();
    const repo = new PgUserRepo(db.unscoped());

    await repo.create({ email: "bob@test.com", name: "Bob", passwordHash: "hashed123" });

    const found = await repo.getByEmail("bob@test.com");
    expect(found).not.toBeNull();
    expect(found!.name).toBe("Bob");
    expect(found!.passwordHash).toBe("hashed123");
  });

  it("returns null for non-existent user", async () => {
    const db = getTestDb();
    const repo = new PgUserRepo(db.unscoped());

    const found = await repo.getById(toUserId("00000000-0000-0000-0000-000000000000"));
    expect(found).toBeNull();
  });

  it("updates user name", async () => {
    const db = getTestDb();
    const repo = new PgUserRepo(db.unscoped());

    const user = await repo.create({ email: "carol@test.com", name: "Carol" });
    const updated = await repo.update(user.id, { name: "Carolina" });

    expect(updated).not.toBeNull();
    expect(updated!.name).toBe("Carolina");
  });

  it("enforces unique email constraint", async () => {
    const db = getTestDb();
    const repo = new PgUserRepo(db.unscoped());

    await repo.create({ email: "dup@test.com", name: "First" });
    await expect(repo.create({ email: "dup@test.com", name: "Second" })).rejects.toThrow();
  });
});

describe("PgOrgRepo", () => {
  it("creates an org and retrieves by id and slug", async () => {
    const db = getTestDb();
    const repo = new PgOrgRepo(db.unscoped());

    const org = await repo.create({ name: "Acme Corp", slug: "acme" });

    expect(org.id).toBeTruthy();
    expect(org.name).toBe("Acme Corp");
    expect(org.slug).toBe("acme");
    expect(org.plan).toBe("free");

    const byId = await repo.getById(org.id);
    expect(byId!.name).toBe("Acme Corp");

    const bySlug = await repo.getBySlug("acme");
    expect(bySlug!.id).toBe(org.id);
  });

  it("updates org name and settings", async () => {
    const db = getTestDb();
    const repo = new PgOrgRepo(db.unscoped());

    const org = await repo.create({ name: "Old Name", slug: "oldname" });
    const updated = await repo.update(org.id, {
      name: "New Name",
      settings: { feature: true },
    });

    expect(updated!.name).toBe("New Name");
    expect(updated!.settings).toEqual({ feature: true });
  });

  it("lists orgs for a user via memberships", async () => {
    const db = getTestDb();
    const orgRepo = new PgOrgRepo(db.unscoped());
    const userRepo = new PgUserRepo(db.unscoped());
    const memberRepo = new PgMembershipRepo(db.unscoped());

    const user = await userRepo.create({ email: "member@test.com", name: "Member" });
    const org1 = await orgRepo.create({ name: "Org One", slug: "org-one" });
    const org2 = await orgRepo.create({ name: "Org Two", slug: "org-two" });

    await memberRepo.create({ orgId: org1.id, userId: user.id, role: "org_member" });
    await memberRepo.create({ orgId: org2.id, userId: user.id, role: "org_admin" });

    const orgs = await orgRepo.listForUser(user.id);
    expect(orgs).toHaveLength(2);
    expect(orgs.map((o) => o.slug).sort()).toEqual(["org-one", "org-two"]);
  });
});

describe("PgMembershipRepo", () => {
  it("creates membership and retrieves it", async () => {
    const db = getTestDb();
    const userRepo = new PgUserRepo(db.unscoped());
    const orgRepo = new PgOrgRepo(db.unscoped());
    const memberRepo = new PgMembershipRepo(db.unscoped());

    const user = await userRepo.create({ email: "mem@test.com", name: "Mem" });
    const org = await orgRepo.create({ name: "Org", slug: "org" });

    const mem = await memberRepo.create({
      orgId: org.id,
      userId: user.id,
      role: "org_owner",
      accepted: true,
    });

    expect(mem.orgId).toBe(org.id);
    expect(mem.userId).toBe(user.id);
    expect(mem.role).toBe("org_owner");
    expect(mem.acceptedAt).toBeTruthy();

    const found = await memberRepo.getForUser(org.id, user.id);
    expect(found).not.toBeNull();
    expect(found!.role).toBe("org_owner");
  });

  it("lists members for org with user details", async () => {
    const db = getTestDb();
    const userRepo = new PgUserRepo(db.unscoped());
    const orgRepo = new PgOrgRepo(db.unscoped());
    const memberRepo = new PgMembershipRepo(db.unscoped());

    const user1 = await userRepo.create({ email: "u1@test.com", name: "User 1" });
    const user2 = await userRepo.create({ email: "u2@test.com", name: "User 2" });
    const org = await orgRepo.create({ name: "Team", slug: "team" });

    await memberRepo.create({ orgId: org.id, userId: user1.id, role: "org_owner" });
    await memberRepo.create({ orgId: org.id, userId: user2.id, role: "org_member" });

    const members = await memberRepo.listForOrg(org.id);
    expect(members).toHaveLength(2);
    expect(members[0]!.user.email).toBeTruthy();
  });

  it("updates role and deletes membership", async () => {
    const db = getTestDb();
    const userRepo = new PgUserRepo(db.unscoped());
    const orgRepo = new PgOrgRepo(db.unscoped());
    const memberRepo = new PgMembershipRepo(db.unscoped());

    const user = await userRepo.create({ email: "role@test.com", name: "Role" });
    const org = await orgRepo.create({ name: "RoleOrg", slug: "roleorg" });
    const mem = await memberRepo.create({ orgId: org.id, userId: user.id, role: "org_member" });

    const updated = await memberRepo.updateRole(mem.id, "org_admin");
    expect(updated!.role).toBe("org_admin");

    const deleted = await memberRepo.delete(org.id, user.id);
    expect(deleted).toBe(true);

    const gone = await memberRepo.getForUser(org.id, user.id);
    expect(gone).toBeNull();
  });

  it("counts by role", async () => {
    const db = getTestDb();
    const userRepo = new PgUserRepo(db.unscoped());
    const orgRepo = new PgOrgRepo(db.unscoped());
    const memberRepo = new PgMembershipRepo(db.unscoped());

    const u1 = await userRepo.create({ email: "cnt1@test.com", name: "Cnt1" });
    const u2 = await userRepo.create({ email: "cnt2@test.com", name: "Cnt2" });
    const org = await orgRepo.create({ name: "CntOrg", slug: "cntorg" });

    await memberRepo.create({ orgId: org.id, userId: u1.id, role: "org_owner" });
    await memberRepo.create({ orgId: org.id, userId: u2.id, role: "org_member" });

    const ownerCount = await memberRepo.countByRole(org.id, "org_owner");
    expect(ownerCount).toBe(1);
  });

  it("enforces unique org_id + user_id constraint", async () => {
    const db = getTestDb();
    const userRepo = new PgUserRepo(db.unscoped());
    const orgRepo = new PgOrgRepo(db.unscoped());
    const memberRepo = new PgMembershipRepo(db.unscoped());

    const user = await userRepo.create({ email: "uniq@test.com", name: "Uniq" });
    const org = await orgRepo.create({ name: "UniqOrg", slug: "uniqorg" });

    await memberRepo.create({ orgId: org.id, userId: user.id, role: "org_member" });
    await expect(
      memberRepo.create({ orgId: org.id, userId: user.id, role: "org_admin" }),
    ).rejects.toThrow();
  });
});

describe("PgInvitationRepo", () => {
  it("creates invitation and accepts it", async () => {
    const db = getTestDb();
    const userRepo = new PgUserRepo(db.unscoped());
    const orgRepo = new PgOrgRepo(db.unscoped());
    const invRepo = new PgInvitationRepo(db.unscoped());

    const inviter = await userRepo.create({ email: "inviter@test.com", name: "Inviter" });
    const org = await orgRepo.create({ name: "InvOrg", slug: "invorg" });

    const inv = await invRepo.create({
      orgId: org.id,
      email: "newbie@test.com",
      role: "org_member",
      invitedBy: inviter.id,
      expiresAt: new Date(Date.now() + 86400_000).toISOString(),
    });

    expect(inv.email).toBe("newbie@test.com");
    expect(inv.acceptedAt).toBeUndefined();

    // List pending invitations
    const pending = await invRepo.listForOrg(org.id);
    expect(pending).toHaveLength(1);

    // Accept invitation
    const accepted = await invRepo.accept(inv.id);
    expect(accepted!.acceptedAt).toBeTruthy();

    // Accepted invitation should not appear in pending list
    const afterAccept = await invRepo.listForOrg(org.id);
    expect(afterAccept).toHaveLength(0);
  });

  it("deletes invitation", async () => {
    const db = getTestDb();
    const userRepo = new PgUserRepo(db.unscoped());
    const orgRepo = new PgOrgRepo(db.unscoped());
    const invRepo = new PgInvitationRepo(db.unscoped());

    const inviter = await userRepo.create({ email: "inv2@test.com", name: "Inv2" });
    const org = await orgRepo.create({ name: "DelOrg", slug: "delorg" });

    const inv = await invRepo.create({
      orgId: org.id,
      email: "del@test.com",
      role: "org_member",
      invitedBy: inviter.id,
      expiresAt: new Date(Date.now() + 86400_000).toISOString(),
    });

    const deleted = await invRepo.delete(inv.id);
    expect(deleted).toBe(true);

    const found = await invRepo.getById(inv.id);
    expect(found).toBeNull();
  });
});

describe("PgSessionRepo", () => {
  it("creates a session and retrieves by token hash", async () => {
    const db = getTestDb();
    const userRepo = new PgUserRepo(db.unscoped());
    const orgRepo = new PgOrgRepo(db.unscoped());
    const memberRepo = new PgMembershipRepo(db.unscoped());
    const sessionRepo = new PgSessionRepo(db.unscoped());

    const user = await userRepo.create({ email: "sess@test.com", name: "Sess" });
    const org = await orgRepo.create({ name: "SessOrg", slug: "sessorg" });
    await memberRepo.create({ orgId: org.id, userId: user.id, role: "org_owner" });

    const session = await sessionRepo.create({
      userId: user.id,
      orgId: org.id,
      role: "org_owner",
      tokenHash: "hash_abc123",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
    });

    expect(session.id).toBeTruthy();
    expect(session.userId).toBe(user.id);

    const byHash = await sessionRepo.getByTokenHash("hash_abc123");
    expect(byHash).not.toBeNull();
    expect(byHash!.id).toBe(session.id);
  });

  it("revokes (deletes) a session", async () => {
    const db = getTestDb();
    const userRepo = new PgUserRepo(db.unscoped());
    const orgRepo = new PgOrgRepo(db.unscoped());
    const sessionRepo = new PgSessionRepo(db.unscoped());

    const user = await userRepo.create({ email: "rev@test.com", name: "Rev" });
    const org = await orgRepo.create({ name: "RevOrg", slug: "revorg" });

    const session = await sessionRepo.create({
      userId: user.id,
      orgId: org.id,
      role: "org_member",
      tokenHash: "hash_revoke",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    });

    const deleted = await sessionRepo.delete(session.id);
    expect(deleted).toBe(true);

    const gone = await sessionRepo.getByTokenHash("hash_revoke");
    expect(gone).toBeNull();
  });

  it("lists active sessions for user in org", async () => {
    const db = getTestDb();
    const userRepo = new PgUserRepo(db.unscoped());
    const orgRepo = new PgOrgRepo(db.unscoped());
    const sessionRepo = new PgSessionRepo(db.unscoped());

    const user = await userRepo.create({ email: "list@test.com", name: "List" });
    const org = await orgRepo.create({ name: "ListOrg", slug: "listorg" });

    // Active session
    await sessionRepo.create({
      userId: user.id,
      orgId: org.id,
      role: "org_member",
      tokenHash: "hash_active",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    });

    // Expired session
    await sessionRepo.create({
      userId: user.id,
      orgId: org.id,
      role: "org_member",
      tokenHash: "hash_expired",
      expiresAt: new Date(Date.now() - 3600_000).toISOString(),
    });

    const active = await sessionRepo.listForUser(org.id, user.id);
    expect(active).toHaveLength(1);
    expect(active[0]!.expiresAt).toBeTruthy();
  });

  it("deletes expired sessions", async () => {
    const db = getTestDb();
    const userRepo = new PgUserRepo(db.unscoped());
    const orgRepo = new PgOrgRepo(db.unscoped());
    const sessionRepo = new PgSessionRepo(db.unscoped());

    const user = await userRepo.create({ email: "exp@test.com", name: "Exp" });
    const org = await orgRepo.create({ name: "ExpOrg", slug: "exporg" });

    await sessionRepo.create({
      userId: user.id,
      orgId: org.id,
      role: "org_member",
      tokenHash: "hash_exp1",
      expiresAt: new Date(Date.now() - 7200_000).toISOString(),
    });

    const count = await sessionRepo.deleteExpired();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

describe("PgProjectRepo (tenant-scoped)", () => {
  it("creates a project in a tenant context and retrieves it", async () => {
    const db = getTestDb();
    const orgRepo = new PgOrgRepo(db.unscoped());
    const org = await orgRepo.create({ name: "ProjOrg", slug: "projorg" });

    const tenantDb = db.forTenant(org.id);
    const projectRepo = new PgProjectRepo(tenantDb);

    // Repos now handle their own transactions for RLS context
    const project = await projectRepo.create({
      orgId: org.id,
      name: "My Project",
      slug: "my-project",
      description: "Test project",
    });

    expect(project.id).toBeTruthy();
    expect(project.name).toBe("My Project");
    expect(project.orgId).toBe(org.id);

    const found = await projectRepo.getById(project.id, org.id);
    expect(found!.slug).toBe("my-project");
  });

  it("lists and updates projects", async () => {
    const db = getTestDb();
    const orgRepo = new PgOrgRepo(db.unscoped());
    const org = await orgRepo.create({ name: "ListProjOrg", slug: "listprojorg" });

    const tenantDb = db.forTenant(org.id);
    const projectRepo = new PgProjectRepo(tenantDb);

    await projectRepo.create({ orgId: org.id, name: "P1", slug: "p1" });
    await projectRepo.create({ orgId: org.id, name: "P2", slug: "p2" });

    const projects = await projectRepo.listForOrg(org.id);
    expect(projects).toHaveLength(2);

    const updated = await projectRepo.update(projects[0]!.id, org.id, { name: "Updated P1" });
    expect(updated!.name).toBe("Updated P1");
  });

  it("deletes a project", async () => {
    const db = getTestDb();
    const orgRepo = new PgOrgRepo(db.unscoped());
    const org = await orgRepo.create({ name: "DelProjOrg", slug: "delprojorg" });

    const tenantDb = db.forTenant(org.id);
    const projectRepo = new PgProjectRepo(tenantDb);

    const project = await projectRepo.create({ orgId: org.id, name: "ToDelete", slug: "todelete" });

    const deleted = await projectRepo.delete(project.id, org.id);
    expect(deleted).toBe(true);

    const gone = await projectRepo.getById(project.id, org.id);
    expect(gone).toBeNull();
  });
});

describe("PgAuditRepo (tenant-scoped)", () => {
  it("emits and queries audit events", async () => {
    const db = getTestDb();
    const orgRepo = new PgOrgRepo(db.unscoped());
    const userRepo = new PgUserRepo(db.unscoped());
    const org = await orgRepo.create({ name: "AuditOrg", slug: "auditorg" });
    const user = await userRepo.create({ email: "auditor@test.com", name: "Auditor" });

    const tenantDb = db.forTenant(org.id);
    const auditRepo = new PgAuditRepo(tenantDb);

    // Repos now handle their own transactions for RLS context
    const event = await auditRepo.emit({
      orgId: org.id,
      actorId: user.id,
      actorType: "user",
      action: "org.created",
      resourceType: "organization",
      resourceId: org.id,
      metadata: { slug: "auditorg" },
    });

    expect(event.id).toBeTruthy();
    expect(event.action).toBe("org.created");

    const events = await auditRepo.query(org.id, { action: "org.created" });
    expect(events).toHaveLength(1);
    expect(events[0]!.metadata).toEqual({ slug: "auditorg" });
  });
});

describe("Transaction behavior", () => {
  it("commits transaction on success", async () => {
    const db = getTestDb();
    const userRepo = new PgUserRepo(db.unscoped());

    // Use users table (no RLS) to test transaction commit behavior
    await db.unscoped().transaction(async (tx) => {
      const txUserRepo = new PgUserRepo(tx);
      await txUserRepo.create({ email: "txcommit@test.com", name: "TxCommit" });
    });

    // Should be visible after commit
    const found = await userRepo.getByEmail("txcommit@test.com");
    expect(found).not.toBeNull();
    expect(found!.name).toBe("TxCommit");
  });

  it("rolls back transaction on error", async () => {
    const db = getTestDb();
    const userRepo = new PgUserRepo(db.unscoped());

    await expect(
      db.unscoped().transaction(async (tx) => {
        const txUserRepo = new PgUserRepo(tx);
        await txUserRepo.create({ email: "txroll@test.com", name: "TxRoll" });
        throw new Error("Intentional rollback");
      }),
    ).rejects.toThrow("Intentional rollback");

    // Should not be visible after rollback
    const found = await userRepo.getByEmail("txroll@test.com");
    expect(found).toBeNull();
  });

  it("handles nested transactions via savepoints", async () => {
    const db = getTestDb();
    const userRepo = new PgUserRepo(db.unscoped());
    const orgRepo = new PgOrgRepo(db.unscoped());

    await db.unscoped().transaction(async (tx) => {
      const txUserRepo = new PgUserRepo(tx);

      await txUserRepo.create({ email: "nested@test.com", name: "Nested" });

      // Nested transaction that fails should only rollback to savepoint
      try {
        await tx.transaction(async (innerTx) => {
          const innerOrgRepo = new PgOrgRepo(innerTx);
          await innerOrgRepo.create({ name: "InnerOrg", slug: "innerorg" });
          throw new Error("Inner rollback");
        });
      } catch {
        // Expected
      }

      // Outer transaction state should still be valid
      const found = await txUserRepo.getByEmail("nested@test.com");
      expect(found).not.toBeNull();
    });

    // User from outer tx should be committed
    const found = await userRepo.getByEmail("nested@test.com");
    expect(found).not.toBeNull();

    // Org from inner tx should not exist
    const org = await orgRepo.getBySlug("innerorg");
    expect(org).toBeNull();
  });

  it("membership repo handles RLS-aware transactions correctly", async () => {
    const db = getTestDb();
    const userRepo = new PgUserRepo(db.unscoped());
    const orgRepo = new PgOrgRepo(db.unscoped());
    const memberRepo = new PgMembershipRepo(db.unscoped());

    const user = await userRepo.create({ email: "txmem@test.com", name: "TxMem" });
    const org = await orgRepo.create({ name: "TxMemOrg", slug: "txmemorg" });

    // MembershipRepo.create internally uses transactionWithOrg for RLS
    await memberRepo.create({ orgId: org.id, userId: user.id, role: "org_owner" });

    const found = await memberRepo.getForUser(org.id, user.id);
    expect(found).not.toBeNull();
    expect(found!.role).toBe("org_owner");
  });
});

describe("Invite acceptance → membership flow", () => {
  it("full flow: invite → accept → create membership", async () => {
    const db = getTestDb();
    const userRepo = new PgUserRepo(db.unscoped());
    const orgRepo = new PgOrgRepo(db.unscoped());
    const invRepo = new PgInvitationRepo(db.unscoped());
    const memberRepo = new PgMembershipRepo(db.unscoped());

    const owner = await userRepo.create({ email: "owner@test.com", name: "Owner" });
    const org = await orgRepo.create({ name: "FlowOrg", slug: "floworg" });
    await memberRepo.create({ orgId: org.id, userId: owner.id, role: "org_owner" });

    // Owner invites someone
    const inv = await invRepo.create({
      orgId: org.id,
      email: "newmember@test.com",
      role: "org_member",
      invitedBy: owner.id,
      expiresAt: new Date(Date.now() + 86400_000).toISOString(),
    });

    // New user signs up and accepts
    const newUser = await userRepo.create({ email: "newmember@test.com", name: "New Member" });
    await invRepo.accept(inv.id);
    await memberRepo.create({
      orgId: org.id,
      userId: newUser.id,
      role: inv.role,
      invitedBy: owner.id,
      accepted: true,
    });

    // Verify membership
    const membership = await memberRepo.getForUser(org.id, newUser.id);
    expect(membership).not.toBeNull();
    expect(membership!.role).toBe("org_member");

    // Verify org appears in user's org list
    const orgs = await orgRepo.listForUser(newUser.id);
    expect(orgs).toHaveLength(1);
    expect(orgs[0]!.slug).toBe("floworg");
  });
});
