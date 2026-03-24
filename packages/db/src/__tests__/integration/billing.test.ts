/**
 * Billing and Usage — PostgreSQL integration tests (Phase 12).
 *
 * Tests real persistence of billing accounts, usage events, invoices,
 * spend alerts, and tenant isolation via RLS.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { OrgId, UserId } from "@sovereign/core";
import {
  PgBillingAccountRepo,
  PgUsageEventRepo,
  PgInvoiceRepo,
  PgSpendAlertRepo,
} from "../../repositories/pg-billing.repo.js";
import { PgUserRepo } from "../../repositories/pg-user.repo.js";
import { PgOrgRepo } from "../../repositories/pg-org.repo.js";
import { setupTestDb, teardownTestDb, getTestDb, truncateAllTables } from "./db-test-harness.js";

let USER_A_ID: UserId;

describe("Billing — PostgreSQL integration", () => {
  beforeAll(async () => { await setupTestDb(); }, 30_000);
  afterAll(async () => { await teardownTestDb(); });

  beforeEach(async () => {
    await truncateAllTables();
    const db = getTestDb();
    const unscopedDb = db.unscoped();
    const userRepo = new PgUserRepo(unscopedDb);
    const orgRepo = new PgOrgRepo(unscopedDb);
    const userA = await userRepo.create({ email: "billing@test.com", name: "Billing User" });
    await userRepo.create({ email: "billingb@test.com", name: "Billing B" });
    USER_A_ID = userA.id;
    const orgA = await orgRepo.create({ name: "Billing Org A", slug: "bill-a" });
    const orgB = await orgRepo.create({ name: "Billing Org B", slug: "bill-b" });
    await unscopedDb.transactionWithOrg(orgA.id, async (tx) => {
      await tx.execute("INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, $3)", [orgA.id, userA.id, "org_owner"]);
    });
    await unscopedDb.transactionWithOrg(orgB.id, async (tx) => {
      await tx.execute("INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, $3)", [orgB.id, userA.id, "org_owner"]);
    });
    Object.assign(globalThis, { __billOrgAId: orgA.id, __billOrgBId: orgB.id });
  });

  function orgA(): OrgId { return (globalThis as Record<string, unknown>).__billOrgAId as OrgId; }
  function orgB(): OrgId { return (globalThis as Record<string, unknown>).__billOrgBId as OrgId; }

  describe("Billing Account CRUD", () => {
    it("creates and retrieves billing account", async () => {
      const db = getTestDb();
      const repo = new PgBillingAccountRepo(db.forTenant(orgA()));
      const account = await repo.create({ orgId: orgA(), plan: "team", billingEmail: "pay@acme.com", createdBy: USER_A_ID });
      expect(account.plan).toBe("team");
      expect(account.billingEmail).toBe("pay@acme.com");
      const fetched = await repo.getByOrgId(orgA());
      expect(fetched).not.toBeNull();
      expect(fetched!.plan).toBe("team");
    });

    it("updates billing account", async () => {
      const db = getTestDb();
      const repo = new PgBillingAccountRepo(db.forTenant(orgA()));
      await repo.create({ orgId: orgA(), createdBy: USER_A_ID });
      const updated = await repo.update(orgA(), { plan: "enterprise", spendLimitCents: 50000, updatedBy: USER_A_ID });
      expect(updated!.plan).toBe("enterprise");
      expect(updated!.spendLimitCents).toBe(50000);
    });
  });

  describe("Usage Events", () => {
    it("creates and aggregates usage events", async () => {
      const db = getTestDb();
      const repo = new PgUsageEventRepo(db.forTenant(orgA()));
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

      await repo.create({ orgId: orgA(), eventType: "run_completed", meter: "agent_runs", quantity: 5, unit: "runs" });
      await repo.create({ orgId: orgA(), eventType: "run_completed", meter: "agent_runs", quantity: 3, unit: "runs" });
      await repo.create({ orgId: orgA(), eventType: "token_used", meter: "llm_tokens", quantity: 10000, unit: "tokens" });

      const aggregated = await repo.aggregateByMeter(orgA(), periodStart, periodEnd);
      expect(aggregated["agent_runs"]).toBe(8);
      expect(aggregated["llm_tokens"]).toBe(10000);
    });

    it("lists usage events with filters", async () => {
      const db = getTestDb();
      const repo = new PgUsageEventRepo(db.forTenant(orgA()));
      await repo.create({ orgId: orgA(), eventType: "run", meter: "agent_runs", quantity: 1, unit: "runs" });
      await repo.create({ orgId: orgA(), eventType: "call", meter: "connector_calls", quantity: 1, unit: "calls" });

      const runs = await repo.listForOrg(orgA(), { meter: "agent_runs" });
      expect(runs.length).toBe(1);
    });
  });

  describe("Invoices", () => {
    it("creates and retrieves invoice", async () => {
      const db = getTestDb();
      const billingRepo = new PgBillingAccountRepo(db.forTenant(orgA()));
      const invoiceRepo = new PgInvoiceRepo(db.forTenant(orgA()));

      const account = await billingRepo.create({ orgId: orgA(), createdBy: USER_A_ID });
      const now = new Date();
      const invoice = await invoiceRepo.create({
        orgId: orgA(), billingAccountId: account.id,
        subtotalCents: 9900, overageCents: 500, totalCents: 10400,
        periodStart: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
        periodEnd: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
        lineItems: [{ description: "Team plan", meter: "base", quantity: 1, unitPriceCents: 9900, totalCents: 9900 }],
      });

      expect(invoice.totalCents).toBe(10400);
      const fetched = await invoiceRepo.getById(invoice.id, orgA());
      expect(fetched!.totalCents).toBe(10400);
      expect(fetched!.lineItems.length).toBe(1);
    });

    it("lists invoices", async () => {
      const db = getTestDb();
      const billingRepo = new PgBillingAccountRepo(db.forTenant(orgA()));
      const invoiceRepo = new PgInvoiceRepo(db.forTenant(orgA()));
      const account = await billingRepo.create({ orgId: orgA(), createdBy: USER_A_ID });
      const now = new Date();
      await invoiceRepo.create({ orgId: orgA(), billingAccountId: account.id, subtotalCents: 0, overageCents: 0, totalCents: 0, periodStart: now.toISOString(), periodEnd: now.toISOString() });
      const list = await invoiceRepo.listForOrg(orgA());
      expect(list.length).toBe(1);
    });
  });

  describe("Spend Alerts", () => {
    it("creates, triggers, and acknowledges alert", async () => {
      const db = getTestDb();
      const repo = new PgSpendAlertRepo(db.forTenant(orgA()));
      const alert = await repo.create({ orgId: orgA(), thresholdCents: 5000, createdBy: USER_A_ID });
      expect(alert.status).toBe("active");

      const triggered = await repo.trigger(alert.id, orgA(), 6000);
      expect(triggered!.status).toBe("triggered");
      expect(triggered!.currentSpendCents).toBe(6000);

      const acked = await repo.acknowledge(alert.id, orgA(), USER_A_ID);
      expect(acked!.status).toBe("acknowledged");
    });
  });

  describe("Tenant Isolation", () => {
    it("cannot read billing account from other org", async () => {
      const db = getTestDb();
      const repoA = new PgBillingAccountRepo(db.forTenant(orgA()));
      const repoB = new PgBillingAccountRepo(db.forTenant(orgB()));
      await repoA.create({ orgId: orgA(), createdBy: USER_A_ID });
      const fromB = await repoB.getByOrgId(orgA());
      expect(fromB).toBeNull();
    });

    it("cannot read usage events from other org", async () => {
      const db = getTestDb();
      const repoA = new PgUsageEventRepo(db.forTenant(orgA()));
      const repoB = new PgUsageEventRepo(db.forTenant(orgB()));
      await repoA.create({ orgId: orgA(), eventType: "run", meter: "agent_runs", quantity: 1, unit: "runs" });
      const fromB = await repoB.listForOrg(orgB());
      expect(fromB.length).toBe(0);
    });

    it("cannot read invoices from other org", async () => {
      const db = getTestDb();
      const billingRepo = new PgBillingAccountRepo(db.forTenant(orgA()));
      const invoiceRepoA = new PgInvoiceRepo(db.forTenant(orgA()));
      const invoiceRepoB = new PgInvoiceRepo(db.forTenant(orgB()));
      const account = await billingRepo.create({ orgId: orgA(), createdBy: USER_A_ID });
      const now = new Date();
      const invoice = await invoiceRepoA.create({ orgId: orgA(), billingAccountId: account.id, subtotalCents: 0, overageCents: 0, totalCents: 0, periodStart: now.toISOString(), periodEnd: now.toISOString() });
      const fromB = await invoiceRepoB.getById(invoice.id, orgB());
      expect(fromB).toBeNull();
    });

    it("cannot read spend alerts from other org", async () => {
      const db = getTestDb();
      const repoA = new PgSpendAlertRepo(db.forTenant(orgA()));
      const repoB = new PgSpendAlertRepo(db.forTenant(orgB()));
      await repoA.create({ orgId: orgA(), thresholdCents: 5000, createdBy: USER_A_ID });
      const fromB = await repoB.listForOrg(orgB());
      expect(fromB.length).toBe(0);
    });
  });
});
