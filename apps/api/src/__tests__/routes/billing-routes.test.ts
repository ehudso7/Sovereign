/**
 * Billing and Usage (service-level contract) — Phase 12 tests.
 *
 * Tests the billing service using in-memory repos.
 * Validates billing account, plan management, usage metering, invoice preview,
 * plan enforcement, spend alerts, provider sync, audit evidence, and tenant isolation.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { toOrgId, toUserId } from "@sovereign/core";
import { PgBillingService } from "../../services/billing.service.js";
import { PgAuditEmitter } from "../../services/audit.service.js";
import {
  createTestRepos,
  type TestRepos,
} from "../helpers/test-repos.js";

const ORG_A = toOrgId("00000000-0000-0000-0000-aaaaaaaaaaaa");
const ORG_B = toOrgId("00000000-0000-0000-0000-bbbbbbbbbbbb");
const USER_ID = toUserId("00000000-0000-0000-0000-cccccccccccc");

describe("Billing and Usage (service-level contract)", () => {
  let repos: TestRepos;
  let svc: PgBillingService;

  beforeEach(() => {
    repos = createTestRepos();
    const auditEmitter = new PgAuditEmitter(repos.audit);
    svc = new PgBillingService(
      repos.billingAccounts,
      repos.usageEvents,
      repos.invoices,
      repos.spendAlerts,
      auditEmitter,
    );
  });

  // =========================================================================
  // Billing Account
  // =========================================================================

  describe("Billing Account", () => {
    it("auto-creates account on first access", async () => {
      const result = await svc.getOrCreateAccount(ORG_A, USER_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.plan).toBe("free");
      expect(result.value.status).toBe("active");
      expect(result.value.orgId).toBe(ORG_A);
    });

    it("returns existing account on subsequent access", async () => {
      await svc.getOrCreateAccount(ORG_A, USER_ID);
      const result = await svc.getOrCreateAccount(ORG_A, USER_ID);
      expect(result.ok).toBe(true);
    });

    it("updates billing email", async () => {
      await svc.getOrCreateAccount(ORG_A, USER_ID);
      const result = await svc.updateAccount(ORG_A, USER_ID, { billingEmail: "billing@acme.com" });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.billingEmail).toBe("billing@acme.com");
    });

    it("emits audit event on account creation", async () => {
      await svc.getOrCreateAccount(ORG_A, USER_ID);
      const events = await repos.audit.query(ORG_A, { action: "billing.account_created" as import("@sovereign/core").AuditAction });
      expect(events.length).toBe(1);
    });

    it("tenant isolation — accounts are org-scoped", async () => {
      await svc.getOrCreateAccount(ORG_A, USER_ID);
      const result = await svc.getAccount(ORG_B);
      expect(result.ok).toBe(false);
    });
  });

  // =========================================================================
  // Plans
  // =========================================================================

  describe("Plans", () => {
    it("lists available plans", async () => {
      const result = await svc.listPlans();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.length).toBe(3);
      expect(result.value.map(p => p.id)).toEqual(["free", "team", "enterprise"]);
    });

    it("changes plan", async () => {
      await svc.getOrCreateAccount(ORG_A, USER_ID);
      const result = await svc.changePlan(ORG_A, USER_ID, "team");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.plan).toBe("team");
    });

    it("rejects invalid plan", async () => {
      await svc.getOrCreateAccount(ORG_A, USER_ID);
      const result = await svc.changePlan(ORG_A, USER_ID, "nonexistent" as import("@sovereign/core").BillingPlan);
      expect(result.ok).toBe(false);
    });

    it("emits audit event on plan change", async () => {
      await svc.getOrCreateAccount(ORG_A, USER_ID);
      await svc.changePlan(ORG_A, USER_ID, "enterprise");
      const events = await repos.audit.query(ORG_A, { action: "billing.plan_changed" as import("@sovereign/core").AuditAction });
      expect(events.length).toBe(1);
      expect((events[0]!.metadata as Record<string, unknown>).newPlan).toBe("enterprise");
    });
  });

  // =========================================================================
  // Usage Metering
  // =========================================================================

  describe("Usage Metering", () => {
    it("records usage events", async () => {
      const result = await svc.recordUsage(ORG_A, {
        eventType: "run_completed", meter: "agent_runs", quantity: 1, unit: "runs",
        sourceType: "run", sourceId: "some-run-id",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.meter).toBe("agent_runs");
      expect(result.value.quantity).toBe(1);
    });

    it("aggregates usage by meter", async () => {
      await svc.getOrCreateAccount(ORG_A, USER_ID);
      // Record multiple usage events
      await svc.recordUsage(ORG_A, { eventType: "run_completed", meter: "agent_runs", quantity: 5, unit: "runs" });
      await svc.recordUsage(ORG_A, { eventType: "run_completed", meter: "agent_runs", quantity: 3, unit: "runs" });
      await svc.recordUsage(ORG_A, { eventType: "token_used", meter: "llm_tokens", quantity: 10000, unit: "tokens" });

      const result = await svc.getUsageSummary(ORG_A);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.meters["agent_runs"]?.used).toBe(8);
      expect(result.value.meters["llm_tokens"]?.used).toBe(10000);
    });

    it("calculates overage correctly", async () => {
      await svc.getOrCreateAccount(ORG_A, USER_ID);
      // Free plan has 50 agent_runs included
      await svc.recordUsage(ORG_A, { eventType: "run_completed", meter: "agent_runs", quantity: 60, unit: "runs" });

      const result = await svc.getUsageSummary(ORG_A);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.meters["agent_runs"]?.used).toBe(60);
      expect(result.value.meters["agent_runs"]?.included).toBe(50);
      expect(result.value.meters["agent_runs"]?.overage).toBe(10);
    });
  });

  // =========================================================================
  // Invoice Preview
  // =========================================================================

  describe("Invoice Preview", () => {
    it("generates invoice preview with base price", async () => {
      await svc.getOrCreateAccount(ORG_A, USER_ID);
      const result = await svc.getInvoicePreview(ORG_A);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.isEstimate).toBe(true);
      expect(result.value.basePriceCents).toBe(0); // free plan
      expect(result.value.totalCents).toBe(0);
    });

    it("includes overage charges in preview for team plan", async () => {
      await svc.getOrCreateAccount(ORG_A, USER_ID);
      await svc.changePlan(ORG_A, USER_ID, "team");
      // Team plan: 1000 runs included, 10c per overage run
      await svc.recordUsage(ORG_A, { eventType: "run_completed", meter: "agent_runs", quantity: 1100, unit: "runs" });

      const result = await svc.getInvoicePreview(ORG_A);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.basePriceCents).toBe(9900);
      expect(result.value.overageCents).toBe(1000); // 100 overage * 10c
      expect(result.value.totalCents).toBe(10900); // base + overage
      expect(result.value.lineItems.length).toBeGreaterThanOrEqual(2); // base + overage line
    });

    it("generates and persists invoice", async () => {
      await svc.getOrCreateAccount(ORG_A, USER_ID);
      const result = await svc.generateInvoice(ORG_A, USER_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.status).toBe("draft");

      // Verify persisted
      const list = await svc.listInvoices(ORG_A);
      expect(list.ok).toBe(true);
      if (!list.ok) return;
      expect(list.value.length).toBe(1);
    });

    it("emits audit event on invoice generation", async () => {
      await svc.getOrCreateAccount(ORG_A, USER_ID);
      await svc.generateInvoice(ORG_A, USER_ID);
      const events = await repos.audit.query(ORG_A, { action: "billing.invoice_generated" as import("@sovereign/core").AuditAction });
      expect(events.length).toBe(1);
    });
  });

  // =========================================================================
  // Plan Enforcement
  // =========================================================================

  describe("Plan Enforcement", () => {
    it("allows usage within limits", async () => {
      await svc.getOrCreateAccount(ORG_A, USER_ID);
      await svc.recordUsage(ORG_A, { eventType: "run_completed", meter: "agent_runs", quantity: 10, unit: "runs" });

      const result = await svc.checkEntitlement(ORG_A, "agent_runs");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.allowed).toBe(true);
      expect(result.value.used).toBe(10);
      expect(result.value.limit).toBe(50);
      expect(result.value.remaining).toBe(40);
    });

    it("blocks usage when free plan limit reached", async () => {
      await svc.getOrCreateAccount(ORG_A, USER_ID);
      // Exceed free plan agent_runs limit of 50
      await svc.recordUsage(ORG_A, { eventType: "run_completed", meter: "agent_runs", quantity: 51, unit: "runs" });

      const result = await svc.checkEntitlement(ORG_A, "agent_runs");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.allowed).toBe(false);
      expect(result.value.reason).toContain("limit");
      expect(result.value.reason).toContain("50");
    });

    it("allows overage on team plan", async () => {
      await svc.getOrCreateAccount(ORG_A, USER_ID);
      await svc.changePlan(ORG_A, USER_ID, "team");
      await svc.recordUsage(ORG_A, { eventType: "run_completed", meter: "agent_runs", quantity: 1100, unit: "runs" });

      const result = await svc.checkEntitlement(ORG_A, "agent_runs");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.allowed).toBe(true);
      expect(result.value.reason).toContain("Overage");
    });

    it("enterprise plan has unlimited", async () => {
      await svc.getOrCreateAccount(ORG_A, USER_ID);
      await svc.changePlan(ORG_A, USER_ID, "enterprise");
      await svc.recordUsage(ORG_A, { eventType: "run_completed", meter: "agent_runs", quantity: 100000, unit: "runs" });

      const result = await svc.checkEntitlement(ORG_A, "agent_runs");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.allowed).toBe(true);
      expect(result.value.limit).toBe(-1);
    });

    it("enforceEntitlement emits audit when blocked", async () => {
      await svc.getOrCreateAccount(ORG_A, USER_ID);
      await svc.recordUsage(ORG_A, { eventType: "run_completed", meter: "agent_runs", quantity: 51, unit: "runs" });

      const result = await svc.enforceEntitlement(ORG_A, USER_ID, "agent_runs");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.allowed).toBe(false);

      const events = await repos.audit.query(ORG_A, { action: "billing.enforcement_blocked" as import("@sovereign/core").AuditAction });
      expect(events.length).toBe(1);
      expect((events[0]!.metadata as Record<string, unknown>).meter).toBe("agent_runs");
    });

    it("enforceEntitlement does not emit audit when allowed", async () => {
      await svc.getOrCreateAccount(ORG_A, USER_ID);
      await svc.recordUsage(ORG_A, { eventType: "run_completed", meter: "agent_runs", quantity: 5, unit: "runs" });

      const result = await svc.enforceEntitlement(ORG_A, USER_ID, "agent_runs");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.allowed).toBe(true);

      const events = await repos.audit.query(ORG_A, { action: "billing.enforcement_blocked" as import("@sovereign/core").AuditAction });
      expect(events.length).toBe(0);
    });
  });

  // =========================================================================
  // Spend Alerts
  // =========================================================================

  describe("Spend Alerts", () => {
    it("creates a spend alert", async () => {
      const result = await svc.createSpendAlert(ORG_A, USER_ID, 5000); // $50
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.thresholdCents).toBe(5000);
      expect(result.value.status).toBe("active");
    });

    it("lists spend alerts", async () => {
      await svc.createSpendAlert(ORG_A, USER_ID, 5000);
      await svc.createSpendAlert(ORG_A, USER_ID, 10000);

      const result = await svc.listSpendAlerts(ORG_A);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.length).toBe(2);
    });

    it("triggers alert when spend exceeds threshold", async () => {
      await svc.getOrCreateAccount(ORG_A, USER_ID);
      await svc.changePlan(ORG_A, USER_ID, "team");
      await svc.createSpendAlert(ORG_A, USER_ID, 9900); // $99 = base price

      // Record enough usage for base price
      await svc.recordUsage(ORG_A, { eventType: "run_completed", meter: "agent_runs", quantity: 10, unit: "runs" });

      await svc.checkAndTriggerAlerts(ORG_A);

      const alerts = await svc.listSpendAlerts(ORG_A);
      expect(alerts.ok).toBe(true);
      if (!alerts.ok) return;
      expect(alerts.value[0]?.status).toBe("triggered");
    });

    it("acknowledges a triggered alert", async () => {
      await svc.getOrCreateAccount(ORG_A, USER_ID);
      await svc.changePlan(ORG_A, USER_ID, "team");
      const alertResult = await svc.createSpendAlert(ORG_A, USER_ID, 9900);
      if (!alertResult.ok) return;

      await svc.checkAndTriggerAlerts(ORG_A);

      const ackResult = await svc.acknowledgeSpendAlert(ORG_A, USER_ID, alertResult.value.id);
      expect(ackResult.ok).toBe(true);
      if (!ackResult.ok) return;
      expect(ackResult.value.status).toBe("acknowledged");
    });

    it("emits audit events for alert lifecycle", async () => {
      await svc.getOrCreateAccount(ORG_A, USER_ID);
      await svc.changePlan(ORG_A, USER_ID, "team");
      const alertResult = await svc.createSpendAlert(ORG_A, USER_ID, 9900);
      if (!alertResult.ok) return;

      await svc.checkAndTriggerAlerts(ORG_A);
      await svc.acknowledgeSpendAlert(ORG_A, USER_ID, alertResult.value.id);

      const triggered = await repos.audit.query(ORG_A, { action: "billing.alert_triggered" as import("@sovereign/core").AuditAction });
      const acknowledged = await repos.audit.query(ORG_A, { action: "billing.alert_acknowledged" as import("@sovereign/core").AuditAction });
      expect(triggered.length).toBe(1);
      expect(acknowledged.length).toBe(1);
    });
  });

  // =========================================================================
  // Provider Sync
  // =========================================================================

  describe("Provider Sync", () => {
    it("syncs with provider and stores customer ID", async () => {
      await svc.getOrCreateAccount(ORG_A, USER_ID);
      const result = await svc.syncWithProvider(ORG_A, USER_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.customerId).toBeDefined();

      // Verify stored
      const account = await svc.getAccount(ORG_A);
      expect(account.ok).toBe(true);
      if (!account.ok) return;
      expect(account.value.providerCustomerId).toBeDefined();
    });

    it("emits audit events for provider sync", async () => {
      await svc.getOrCreateAccount(ORG_A, USER_ID);
      await svc.syncWithProvider(ORG_A, USER_ID);

      const requested = await repos.audit.query(ORG_A, { action: "billing.sync_requested" as import("@sovereign/core").AuditAction });
      const completed = await repos.audit.query(ORG_A, { action: "billing.sync_completed" as import("@sovereign/core").AuditAction });
      expect(requested.length).toBe(1);
      expect(completed.length).toBe(1);
    });
  });

  // =========================================================================
  // Tenant Isolation
  // =========================================================================

  describe("Tenant Isolation", () => {
    it("cannot see other org billing account", async () => {
      await svc.getOrCreateAccount(ORG_A, USER_ID);
      const result = await svc.getAccount(ORG_B);
      expect(result.ok).toBe(false);
    });

    it("usage events are org-scoped", async () => {
      await svc.getOrCreateAccount(ORG_A, USER_ID);
      await svc.getOrCreateAccount(ORG_B, USER_ID);
      await svc.recordUsage(ORG_A, { eventType: "run", meter: "agent_runs", quantity: 10, unit: "runs" });

      const summaryA = await svc.getUsageSummary(ORG_A);
      const summaryB = await svc.getUsageSummary(ORG_B);
      expect(summaryA.ok).toBe(true);
      expect(summaryB.ok).toBe(true);
      if (!summaryA.ok || !summaryB.ok) return;
      expect(summaryA.value.meters["agent_runs"]?.used).toBe(10);
      expect(summaryB.value.meters["agent_runs"]?.used).toBe(0);
    });

    it("invoices are org-scoped", async () => {
      await svc.getOrCreateAccount(ORG_A, USER_ID);
      await svc.generateInvoice(ORG_A, USER_ID);

      const listA = await svc.listInvoices(ORG_A);
      const listB = await svc.listInvoices(ORG_B);
      expect(listA.ok).toBe(true);
      if (!listA.ok) return;
      expect(listA.value.length).toBe(1);
      expect(listB.ok).toBe(true);
      if (!listB.ok) return;
      expect(listB.value.length).toBe(0);
    });
  });
});
