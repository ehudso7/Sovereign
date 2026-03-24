/**
 * Revenue Workspace — PostgreSQL integration tests (Phase 11).
 *
 * Tests real persistence of CRM accounts, contacts, deals, tasks,
 * notes, outreach drafts, sync logs, and tenant isolation via RLS.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { OrgId, UserId } from "@sovereign/core";
import {
  PgCrmAccountRepo,
  PgCrmContactRepo,
  PgCrmDealRepo,
  PgCrmTaskRepo,
  PgCrmNoteRepo,
  PgOutreachDraftRepo,
  PgCrmSyncLogRepo,
} from "../../repositories/pg-revenue.repo.js";
import { PgAuditRepo } from "../../repositories/pg-audit.repo.js";
import { PgUserRepo } from "../../repositories/pg-user.repo.js";
import { PgOrgRepo } from "../../repositories/pg-org.repo.js";
// PgMembershipRepo used for seeding membership rows
import { setupTestDb, teardownTestDb, getTestDb, truncateAllTables } from "./db-test-harness.js";

// Test data
let USER_A_ID: UserId;

describe("Revenue Workspace — PostgreSQL integration", () => {
  beforeAll(async () => {
    await setupTestDb();
  }, 30_000);

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await truncateAllTables();

    // Seed orgs and users
    const db = getTestDb();
    const unscopedDb = db.unscoped();
    const userRepo = new PgUserRepo(unscopedDb);
    const orgRepo = new PgOrgRepo(unscopedDb);
    const userA = await userRepo.create({ email: "usera@test.com", name: "User A" });
    const userB = await userRepo.create({ email: "userb@test.com", name: "User B" });
    USER_A_ID = userA.id;
    void userB;

    const orgA = await orgRepo.create({ name: "Org A", slug: "org-a" });
    const orgB = await orgRepo.create({ name: "Org B", slug: "org-b" });

    // Use the actual UUIDs from created orgs by overriding IDs
    // Since we need deterministic IDs, let's use the repo-generated ones
    // and store them
    await unscopedDb.transactionWithOrg(orgA.id, async (tx) => {
      await tx.execute(
        "INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, $3)",
        [orgA.id, userA.id, "org_owner"],
      );
    });
    await unscopedDb.transactionWithOrg(orgB.id, async (tx) => {
      await tx.execute(
        "INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, $3)",
        [orgB.id, userB.id, "org_owner"],
      );
    });

    // Store actual org IDs
    Object.assign(globalThis, { __orgAId: orgA.id, __orgBId: orgB.id });
  });

  function getOrgAId(): OrgId { return (globalThis as Record<string, unknown>).__orgAId as OrgId; }
  function getOrgBId(): OrgId { return (globalThis as Record<string, unknown>).__orgBId as OrgId; }

  // =========================================================================
  // Account CRUD
  // =========================================================================

  describe("Account CRUD", () => {
    it("creates and retrieves an account", async () => {
      const db = getTestDb();
      const orgId = getOrgAId();
      const repo = new PgCrmAccountRepo(db.forTenant(orgId));
      const account = await repo.create({ orgId, name: "Test Co", domain: "test.com", industry: "SaaS", createdBy: USER_A_ID });
      expect(account.name).toBe("Test Co");
      expect(account.domain).toBe("test.com");
      expect(account.status).toBe("active");

      const fetched = await repo.getById(account.id, orgId);
      expect(fetched).not.toBeNull();
      expect(fetched!.name).toBe("Test Co");
    });

    it("lists accounts for org", async () => {
      const db = getTestDb();
      const orgId = getOrgAId();
      const repo = new PgCrmAccountRepo(db.forTenant(orgId));
      await repo.create({ orgId, name: "A1", createdBy: USER_A_ID });
      await repo.create({ orgId, name: "A2", createdBy: USER_A_ID });
      const list = await repo.listForOrg(orgId);
      expect(list.length).toBe(2);
    });

    it("updates an account", async () => {
      const db = getTestDb();
      const orgId = getOrgAId();
      const repo = new PgCrmAccountRepo(db.forTenant(orgId));
      const account = await repo.create({ orgId, name: "OldName", createdBy: USER_A_ID });
      const updated = await repo.update(account.id, orgId, { name: "NewName", industry: "Finance", updatedBy: USER_A_ID });
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe("NewName");
      expect(updated!.industry).toBe("Finance");
    });

    it("deletes an account", async () => {
      const db = getTestDb();
      const orgId = getOrgAId();
      const repo = new PgCrmAccountRepo(db.forTenant(orgId));
      const account = await repo.create({ orgId, name: "ToDelete", createdBy: USER_A_ID });
      const deleted = await repo.delete(account.id, orgId);
      expect(deleted).toBe(true);
      const fetched = await repo.getById(account.id, orgId);
      expect(fetched).toBeNull();
    });
  });

  // =========================================================================
  // Contact CRUD
  // =========================================================================

  describe("Contact CRUD", () => {
    it("creates and retrieves a contact", async () => {
      const db = getTestDb();
      const orgId = getOrgAId();
      const repo = new PgCrmContactRepo(db.forTenant(orgId));
      const contact = await repo.create({ orgId, firstName: "Jane", lastName: "Doe", email: "jane@test.com", createdBy: USER_A_ID });
      expect(contact.firstName).toBe("Jane");
      const fetched = await repo.getById(contact.id, orgId);
      expect(fetched!.email).toBe("jane@test.com");
    });

    it("links contact to account", async () => {
      const db = getTestDb();
      const orgId = getOrgAId();
      const accountRepo = new PgCrmAccountRepo(db.forTenant(orgId));
      const contactRepo = new PgCrmContactRepo(db.forTenant(orgId));
      const account = await accountRepo.create({ orgId, name: "Parent Co", createdBy: USER_A_ID });
      const contact = await contactRepo.create({ orgId, firstName: "Linked", lastName: "Contact", accountId: account.id, createdBy: USER_A_ID });
      expect(contact.accountId).toBe(account.id);
    });
  });

  // =========================================================================
  // Deal CRUD
  // =========================================================================

  describe("Deal CRUD", () => {
    it("creates and retrieves a deal with value", async () => {
      const db = getTestDb();
      const orgId = getOrgAId();
      const repo = new PgCrmDealRepo(db.forTenant(orgId));
      const deal = await repo.create({ orgId, name: "Big Deal", stage: "proposal", valueCents: 500000, probability: 75, createdBy: USER_A_ID });
      expect(deal.valueCents).toBe(500000);
      expect(deal.probability).toBe(75);
      expect(deal.stage).toBe("proposal");
    });

    it("filters deals by stage", async () => {
      const db = getTestDb();
      const orgId = getOrgAId();
      const repo = new PgCrmDealRepo(db.forTenant(orgId));
      await repo.create({ orgId, name: "D1", stage: "discovery", createdBy: USER_A_ID });
      await repo.create({ orgId, name: "D2", stage: "proposal", createdBy: USER_A_ID });
      const filtered = await repo.listForOrg(orgId, { stage: "proposal" });
      expect(filtered.length).toBe(1);
      expect(filtered[0]!.name).toBe("D2");
    });
  });

  // =========================================================================
  // Task CRUD
  // =========================================================================

  describe("Task CRUD", () => {
    it("creates and retrieves a task", async () => {
      const db = getTestDb();
      const orgId = getOrgAId();
      const repo = new PgCrmTaskRepo(db.forTenant(orgId));
      const task = await repo.create({ orgId, title: "Follow up", priority: "high", createdBy: USER_A_ID });
      expect(task.title).toBe("Follow up");
      expect(task.priority).toBe("high");
      expect(task.status).toBe("open");
    });

    it("updates task status", async () => {
      const db = getTestDb();
      const orgId = getOrgAId();
      const repo = new PgCrmTaskRepo(db.forTenant(orgId));
      const task = await repo.create({ orgId, title: "Todo", createdBy: USER_A_ID });
      const updated = await repo.update(task.id, orgId, { status: "completed", updatedBy: USER_A_ID });
      expect(updated!.status).toBe("completed");
    });
  });

  // =========================================================================
  // Notes
  // =========================================================================

  describe("Notes", () => {
    it("creates notes linked to an account", async () => {
      const db = getTestDb();
      const orgId = getOrgAId();
      const accountRepo = new PgCrmAccountRepo(db.forTenant(orgId));
      const noteRepo = new PgCrmNoteRepo(db.forTenant(orgId));
      const account = await accountRepo.create({ orgId, name: "Noted Co", createdBy: USER_A_ID });
      await noteRepo.create({ orgId, linkedEntityType: "account", linkedEntityId: account.id, content: "Meeting notes", noteType: "meeting", createdBy: USER_A_ID });
      await noteRepo.create({ orgId, linkedEntityType: "account", linkedEntityId: account.id, content: "Call notes", noteType: "call", createdBy: USER_A_ID });
      const notes = await noteRepo.listForEntity(orgId, "account", account.id);
      expect(notes.length).toBe(2);
    });
  });

  // =========================================================================
  // Outreach Drafts
  // =========================================================================

  describe("Outreach Drafts", () => {
    it("creates and retrieves an outreach draft", async () => {
      const db = getTestDb();
      const orgId = getOrgAId();
      const repo = new PgOutreachDraftRepo(db.forTenant(orgId));
      const draft = await repo.create({ orgId, channel: "email", subject: "Follow up", body: "Hi there", generatedBy: "ai", createdBy: USER_A_ID });
      expect(draft.channel).toBe("email");
      expect(draft.approvalStatus).toBe("draft");
      const fetched = await repo.getById(draft.id, orgId);
      expect(fetched!.body).toBe("Hi there");
    });
  });

  // =========================================================================
  // Sync Log
  // =========================================================================

  describe("Sync Log", () => {
    it("creates and updates sync log", async () => {
      const db = getTestDb();
      const orgId = getOrgAId();
      const repo = new PgCrmSyncLogRepo(db.forTenant(orgId));
      const log = await repo.create({ orgId, direction: "push", entityType: "account", entityId: "00000000-0000-0000-0000-000000000001", createdBy: USER_A_ID });
      expect(log.status).toBe("pending");
      const updated = await repo.updateStatus(log.id, orgId, "completed", { externalCrmId: "ext-123", completedAt: new Date().toISOString() });
      expect(updated!.status).toBe("completed");
      expect(updated!.externalCrmId).toBe("ext-123");
    });
  });

  // =========================================================================
  // Tenant Isolation (RLS)
  // =========================================================================

  describe("Tenant Isolation", () => {
    it("cannot read accounts from other org", async () => {
      const db = getTestDb();
      const orgAId = getOrgAId();
      const orgBId = getOrgBId();
      const repoA = new PgCrmAccountRepo(db.forTenant(orgAId));
      const repoB = new PgCrmAccountRepo(db.forTenant(orgBId));
      const account = await repoA.create({ orgId: orgAId, name: "A-Secret", createdBy: USER_A_ID });
      const fromB = await repoB.getById(account.id, orgBId);
      expect(fromB).toBeNull();
    });

    it("cannot list contacts from other org", async () => {
      const db = getTestDb();
      const orgAId = getOrgAId();
      const orgBId = getOrgBId();
      const repoA = new PgCrmContactRepo(db.forTenant(orgAId));
      const repoB = new PgCrmContactRepo(db.forTenant(orgBId));
      await repoA.create({ orgId: orgAId, firstName: "A", lastName: "Only", createdBy: USER_A_ID });
      const fromB = await repoB.listForOrg(orgBId);
      expect(fromB.length).toBe(0);
    });

    it("cannot read deals from other org", async () => {
      const db = getTestDb();
      const orgAId = getOrgAId();
      const orgBId = getOrgBId();
      const repoA = new PgCrmDealRepo(db.forTenant(orgAId));
      const repoB = new PgCrmDealRepo(db.forTenant(orgBId));
      const deal = await repoA.create({ orgId: orgAId, name: "Secret Deal", createdBy: USER_A_ID });
      const fromB = await repoB.getById(deal.id, orgBId);
      expect(fromB).toBeNull();
    });

    it("cannot read tasks from other org", async () => {
      const db = getTestDb();
      const orgAId = getOrgAId();
      const orgBId = getOrgBId();
      const repoA = new PgCrmTaskRepo(db.forTenant(orgAId));
      const repoB = new PgCrmTaskRepo(db.forTenant(orgBId));
      await repoA.create({ orgId: orgAId, title: "Private Task", createdBy: USER_A_ID });
      const fromB = await repoB.listForOrg(orgBId);
      expect(fromB.length).toBe(0);
    });

    it("cannot read outreach drafts from other org", async () => {
      const db = getTestDb();
      const orgAId = getOrgAId();
      const orgBId = getOrgBId();
      const repoA = new PgOutreachDraftRepo(db.forTenant(orgAId));
      const repoB = new PgOutreachDraftRepo(db.forTenant(orgBId));
      const draft = await repoA.create({ orgId: orgAId, channel: "email", body: "Secret", createdBy: USER_A_ID });
      const fromB = await repoB.getById(draft.id, orgBId);
      expect(fromB).toBeNull();
    });

    it("cannot read sync logs from other org", async () => {
      const db = getTestDb();
      const orgAId = getOrgAId();
      const orgBId = getOrgBId();
      const repoA = new PgCrmSyncLogRepo(db.forTenant(orgAId));
      const repoB = new PgCrmSyncLogRepo(db.forTenant(orgBId));
      await repoA.create({ orgId: orgAId, direction: "push", entityType: "account", entityId: "00000000-0000-0000-0000-000000000002", createdBy: USER_A_ID });
      const fromB = await repoB.listForOrg(orgBId);
      expect(fromB.length).toBe(0);
    });
  });

  // =========================================================================
  // Audit Trail
  // =========================================================================

  describe("Audit Trail", () => {
    it("persists audit events for revenue actions", async () => {
      const db = getTestDb();
      const orgId = getOrgAId();
      const auditRepo = new PgAuditRepo(db.forTenant(orgId));
      await auditRepo.emit({
        orgId, actorId: USER_A_ID, actorType: "user",
        action: "revenue.account_created", resourceType: "crm_account",
        resourceId: "00000000-0000-0000-0000-000000000003", metadata: { name: "Test" },
      });
      const events = await auditRepo.query(orgId, { action: "revenue.account_created" as import("@sovereign/core").AuditAction });
      expect(events.length).toBe(1);
      expect(events[0]!.resourceType).toBe("crm_account");
    });
  });
});
