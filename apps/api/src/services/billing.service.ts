// ---------------------------------------------------------------------------
// Billing and Usage Service — Phase 12
// ---------------------------------------------------------------------------

import { ok, err, AppError } from "@sovereign/core";
import type {
  OrgId, UserId, Result, InvoiceId, SpendAlertId,
  BillingAccount, UsageEvent, Invoice, SpendAlert,
  BillingPlan, UsageMeter, InvoiceLineItem, PlanDefinition,
  AuditEmitter,
} from "@sovereign/core";
import type {
  BillingAccountRepo, UsageEventRepo, InvoiceRepo, SpendAlertRepo,
} from "@sovereign/db";

// ---------------------------------------------------------------------------
// Plan Catalog (static, in-memory)
// ---------------------------------------------------------------------------

const PLAN_CATALOG: readonly PlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    description: "Get started with basic agent capabilities",
    basePriceCents: 0,
    interval: "monthly",
    allowances: [
      { meter: "agent_runs", included: 50, overageUnitPriceCents: 0 },
      { meter: "llm_tokens", included: 100000, overageUnitPriceCents: 0 },
      { meter: "connector_calls", included: 100, overageUnitPriceCents: 0 },
      { meter: "browser_sessions", included: 10, overageUnitPriceCents: 0 },
      { meter: "storage_bytes", included: 104857600, overageUnitPriceCents: 0 }, // 100 MB
    ],
    overageAllowed: false,
    isPublic: true,
  },
  {
    id: "team",
    name: "Team",
    description: "For growing teams with production workloads",
    basePriceCents: 9900, // $99/mo
    interval: "monthly",
    allowances: [
      { meter: "agent_runs", included: 1000, overageUnitPriceCents: 10 },
      { meter: "llm_tokens", included: 5000000, overageUnitPriceCents: 1 }, // per 1000 tokens
      { meter: "connector_calls", included: 5000, overageUnitPriceCents: 2 },
      { meter: "browser_sessions", included: 200, overageUnitPriceCents: 50 },
      { meter: "storage_bytes", included: 10737418240, overageUnitPriceCents: 1 }, // 10 GB
    ],
    overageAllowed: true,
    isPublic: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "Unlimited usage with dedicated support",
    basePriceCents: 49900, // $499/mo
    interval: "monthly",
    allowances: [
      { meter: "agent_runs", included: -1, overageUnitPriceCents: 0 }, // unlimited
      { meter: "llm_tokens", included: -1, overageUnitPriceCents: 0 },
      { meter: "connector_calls", included: -1, overageUnitPriceCents: 0 },
      { meter: "browser_sessions", included: -1, overageUnitPriceCents: 0 },
      { meter: "storage_bytes", included: -1, overageUnitPriceCents: 0 },
    ],
    overageAllowed: true,
    isPublic: true,
  },
] as const;

export function getPlanCatalog(): readonly PlanDefinition[] {
  return PLAN_CATALOG;
}

export function getPlanById(planId: BillingPlan): PlanDefinition | undefined {
  return PLAN_CATALOG.find(p => p.id === planId);
}

// ---------------------------------------------------------------------------
// Payment provider abstraction
// ---------------------------------------------------------------------------

export interface BillingProvider {
  createCustomer(orgId: OrgId, email: string): Promise<{ customerId: string }>;
  syncInvoice(invoiceId: string): Promise<{ providerInvoiceId: string; status: string }>;
}

export class LocalBillingProvider implements BillingProvider {
  async createCustomer(orgId: OrgId, _email: string): Promise<{ customerId: string }> {
    return { customerId: `local-cust-${orgId.slice(0, 8)}` };
  }
  async syncInvoice(invoiceId: string): Promise<{ providerInvoiceId: string; status: string }> {
    return { providerInvoiceId: `local-inv-${invoiceId.slice(0, 8)}`, status: "open" };
  }
}

// ---------------------------------------------------------------------------
// Usage summary and invoice preview types
// ---------------------------------------------------------------------------

export interface UsageSummary {
  periodStart: string;
  periodEnd: string;
  meters: Record<string, { used: number; included: number; overage: number; unit: string }>;
  totalOverageCents: number;
}

export interface InvoicePreview {
  plan: PlanDefinition;
  periodStart: string;
  periodEnd: string;
  basePriceCents: number;
  lineItems: InvoiceLineItem[];
  subtotalCents: number;
  overageCents: number;
  totalCents: number;
  currency: string;
  isEstimate: boolean;
}

// ---------------------------------------------------------------------------
// Entitlement check result
// ---------------------------------------------------------------------------

export interface EntitlementResult {
  allowed: boolean;
  meter: UsageMeter;
  used: number;
  limit: number;
  remaining: number;
  reason?: string;
}

// ---------------------------------------------------------------------------
// PgBillingService
// ---------------------------------------------------------------------------

export class PgBillingService {
  constructor(
    private readonly billingAccountRepo: BillingAccountRepo,
    private readonly usageEventRepo: UsageEventRepo,
    private readonly invoiceRepo: InvoiceRepo,
    private readonly spendAlertRepo: SpendAlertRepo,
    private readonly auditEmitter: AuditEmitter,
    private readonly provider: BillingProvider = new LocalBillingProvider(),
  ) {}

  // =========================================================================
  // Billing Account
  // =========================================================================

  async getOrCreateAccount(orgId: OrgId, userId: UserId): Promise<Result<BillingAccount>> {
    try {
      let account = await this.billingAccountRepo.getByOrgId(orgId);
      if (!account) {
        account = await this.billingAccountRepo.create({ orgId, createdBy: userId });
        await this.auditEmitter.emit({
          orgId, actorId: userId, actorType: "user",
          action: "billing.account_created", resourceType: "billing_account",
          resourceId: account.id, metadata: { plan: account.plan },
        });
      }
      return ok(account);
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  async getAccount(orgId: OrgId): Promise<Result<BillingAccount>> {
    try {
      const account = await this.billingAccountRepo.getByOrgId(orgId);
      if (!account) return err(AppError.notFound("BillingAccount"));
      return ok(account);
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  async updateAccount(orgId: OrgId, userId: UserId, input: {
    billingEmail?: string; spendLimitCents?: number;
  }): Promise<Result<BillingAccount>> {
    try {
      const account = await this.billingAccountRepo.update(orgId, { ...input, updatedBy: userId });
      if (!account) return err(AppError.notFound("BillingAccount"));
      await this.auditEmitter.emit({
        orgId, actorId: userId, actorType: "user",
        action: "billing.account_updated", resourceType: "billing_account",
        resourceId: account.id, metadata: { billingEmail: input.billingEmail },
      });
      return ok(account);
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  // =========================================================================
  // Plan Management
  // =========================================================================

  async listPlans(): Promise<Result<readonly PlanDefinition[]>> {
    return ok(PLAN_CATALOG.filter(p => p.isPublic));
  }

  async changePlan(orgId: OrgId, userId: UserId, newPlan: BillingPlan): Promise<Result<BillingAccount>> {
    try {
      const plan = getPlanById(newPlan);
      if (!plan) return err(AppError.badRequest(`Unknown plan: ${newPlan}`));

      const account = await this.billingAccountRepo.update(orgId, {
        plan: newPlan, updatedBy: userId,
      });
      if (!account) return err(AppError.notFound("BillingAccount"));

      await this.auditEmitter.emit({
        orgId, actorId: userId, actorType: "user",
        action: "billing.plan_changed", resourceType: "billing_account",
        resourceId: account.id, metadata: { newPlan, planName: plan.name },
      });
      return ok(account);
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  // =========================================================================
  // Usage Metering
  // =========================================================================

  async recordUsage(orgId: OrgId, input: {
    eventType: string; meter: UsageMeter; quantity: number; unit: string;
    sourceType?: string; sourceId?: string; metadata?: Record<string, unknown>;
  }): Promise<Result<UsageEvent>> {
    try {
      const event = await this.usageEventRepo.create({ orgId, ...input });
      return ok(event);
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  async getUsageSummary(orgId: OrgId): Promise<Result<UsageSummary>> {
    try {
      const account = await this.billingAccountRepo.getByOrgId(orgId);
      if (!account) return err(AppError.notFound("BillingAccount"));

      const plan = getPlanById(account.plan);
      if (!plan) return err(AppError.internal(`Unknown plan: ${account.plan}`));

      const aggregated = await this.usageEventRepo.aggregateByMeter(
        orgId, account.currentPeriodStart, account.currentPeriodEnd,
      );

      const METER_UNITS: Record<string, string> = {
        agent_runs: "runs", llm_tokens: "tokens", connector_calls: "calls",
        browser_sessions: "sessions", storage_bytes: "bytes",
      };

      const meters: Record<string, { used: number; included: number; overage: number; unit: string }> = {};
      let totalOverageCents = 0;

      for (const allowance of plan.allowances) {
        const used = aggregated[allowance.meter] ?? 0;
        const included = allowance.included === -1 ? Infinity : allowance.included;
        const overage = Math.max(0, used - (included === Infinity ? used : included));
        const overageCost = overage * allowance.overageUnitPriceCents;
        totalOverageCents += overageCost;
        meters[allowance.meter] = {
          used, included: allowance.included, overage,
          unit: METER_UNITS[allowance.meter] ?? "units",
        };
      }

      return ok({
        periodStart: account.currentPeriodStart,
        periodEnd: account.currentPeriodEnd,
        meters,
        totalOverageCents,
      });
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  // =========================================================================
  // Invoice Preview
  // =========================================================================

  async getInvoicePreview(orgId: OrgId): Promise<Result<InvoicePreview>> {
    try {
      const account = await this.billingAccountRepo.getByOrgId(orgId);
      if (!account) return err(AppError.notFound("BillingAccount"));

      const plan = getPlanById(account.plan);
      if (!plan) return err(AppError.internal(`Unknown plan: ${account.plan}`));

      const aggregated = await this.usageEventRepo.aggregateByMeter(
        orgId, account.currentPeriodStart, account.currentPeriodEnd,
      );

      const lineItems: InvoiceLineItem[] = [];
      let overageCents = 0;

      // Base plan line item
      lineItems.push({
        description: `${plan.name} plan — base`,
        meter: "base",
        quantity: 1,
        unitPriceCents: plan.basePriceCents,
        totalCents: plan.basePriceCents,
      });

      // Usage line items for overage
      for (const allowance of plan.allowances) {
        const used = aggregated[allowance.meter] ?? 0;
        const included = allowance.included === -1 ? Infinity : allowance.included;
        const overage = Math.max(0, used - (included === Infinity ? used : included));

        if (overage > 0 && allowance.overageUnitPriceCents > 0) {
          const cost = overage * allowance.overageUnitPriceCents;
          overageCents += cost;
          lineItems.push({
            description: `${allowance.meter} overage (${overage} over ${allowance.included} included)`,
            meter: allowance.meter,
            quantity: overage,
            unitPriceCents: allowance.overageUnitPriceCents,
            totalCents: cost,
          });
        }
      }

      const subtotalCents = plan.basePriceCents;
      const totalCents = subtotalCents + overageCents;

      return ok({
        plan,
        periodStart: account.currentPeriodStart,
        periodEnd: account.currentPeriodEnd,
        basePriceCents: plan.basePriceCents,
        lineItems,
        subtotalCents,
        overageCents,
        totalCents,
        currency: "USD",
        isEstimate: true,
      });
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  // =========================================================================
  // Invoices
  // =========================================================================

  async listInvoices(orgId: OrgId, filters?: { status?: string }): Promise<Result<Invoice[]>> {
    try {
      const invoices = await this.invoiceRepo.listForOrg(orgId, filters);
      return ok(invoices);
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  async getInvoice(orgId: OrgId, id: InvoiceId): Promise<Result<Invoice>> {
    try {
      const invoice = await this.invoiceRepo.getById(id, orgId);
      if (!invoice) return err(AppError.notFound("Invoice", id));
      return ok(invoice);
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  async generateInvoice(orgId: OrgId, userId: UserId): Promise<Result<Invoice>> {
    try {
      const previewResult = await this.getInvoicePreview(orgId);
      if (!previewResult.ok) return err(previewResult.error);
      const preview = previewResult.value;

      const account = await this.billingAccountRepo.getByOrgId(orgId);
      if (!account) return err(AppError.notFound("BillingAccount"));

      const invoice = await this.invoiceRepo.create({
        orgId, billingAccountId: account.id,
        subtotalCents: preview.subtotalCents,
        overageCents: preview.overageCents,
        totalCents: preview.totalCents,
        currency: preview.currency,
        periodStart: preview.periodStart,
        periodEnd: preview.periodEnd,
        lineItems: preview.lineItems as unknown[],
      });

      await this.auditEmitter.emit({
        orgId, actorId: userId, actorType: "user",
        action: "billing.invoice_generated", resourceType: "invoice",
        resourceId: invoice.id, metadata: { totalCents: invoice.totalCents },
      });

      return ok(invoice);
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  // =========================================================================
  // Plan Enforcement
  // =========================================================================

  async checkEntitlement(orgId: OrgId, meter: UsageMeter): Promise<Result<EntitlementResult>> {
    try {
      const account = await this.billingAccountRepo.getByOrgId(orgId);
      if (!account) return err(AppError.notFound("BillingAccount"));

      const plan = getPlanById(account.plan);
      if (!plan) return err(AppError.internal(`Unknown plan: ${account.plan}`));

      const allowance = plan.allowances.find(a => a.meter === meter);
      if (!allowance) {
        return ok({ allowed: true, meter, used: 0, limit: -1, remaining: -1 });
      }

      const aggregated = await this.usageEventRepo.aggregateByMeter(
        orgId, account.currentPeriodStart, account.currentPeriodEnd,
      );

      const used = aggregated[meter] ?? 0;
      const limit = allowance.included;

      // Unlimited
      if (limit === -1) {
        return ok({ allowed: true, meter, used, limit: -1, remaining: -1 });
      }

      const remaining = limit - used;

      // Over limit — check overage policy
      if (remaining <= 0) {
        if (plan.overageAllowed) {
          return ok({ allowed: true, meter, used, limit, remaining: 0, reason: "Overage charges apply" });
        }
        return ok({
          allowed: false, meter, used, limit, remaining: 0,
          reason: `${meter} limit of ${limit} reached on ${plan.name} plan`,
        });
      }

      return ok({ allowed: true, meter, used, limit, remaining });
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  async enforceEntitlement(orgId: OrgId, userId: UserId, meter: UsageMeter): Promise<Result<EntitlementResult>> {
    const result = await this.checkEntitlement(orgId, meter);
    if (!result.ok) return result;

    if (!result.value.allowed) {
      await this.auditEmitter.emit({
        orgId, actorId: userId, actorType: "user",
        action: "billing.enforcement_blocked", resourceType: "billing_account",
        metadata: { meter, used: result.value.used, limit: result.value.limit, reason: result.value.reason },
      });
    }

    return result;
  }

  // =========================================================================
  // Spend Alerts
  // =========================================================================

  async createSpendAlert(orgId: OrgId, userId: UserId, thresholdCents: number): Promise<Result<SpendAlert>> {
    try {
      const alert = await this.spendAlertRepo.create({ orgId, thresholdCents, createdBy: userId });
      return ok(alert);
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  async listSpendAlerts(orgId: OrgId, filters?: { status?: string }): Promise<Result<SpendAlert[]>> {
    try {
      const alerts = await this.spendAlertRepo.listForOrg(orgId, filters);
      return ok(alerts);
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  async acknowledgeSpendAlert(orgId: OrgId, userId: UserId, alertId: SpendAlertId): Promise<Result<SpendAlert>> {
    try {
      const alert = await this.spendAlertRepo.acknowledge(alertId, orgId, userId);
      if (!alert) return err(AppError.notFound("SpendAlert", alertId));
      await this.auditEmitter.emit({
        orgId, actorId: userId, actorType: "user",
        action: "billing.alert_acknowledged", resourceType: "spend_alert",
        resourceId: alert.id, metadata: { thresholdCents: alert.thresholdCents },
      });
      return ok(alert);
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  async checkAndTriggerAlerts(orgId: OrgId): Promise<void> {
    try {
      const summaryResult = await this.getUsageSummary(orgId);
      if (!summaryResult.ok) return;

      const previewResult = await this.getInvoicePreview(orgId);
      if (!previewResult.ok) return;

      const currentSpendCents = previewResult.value.totalCents;
      const alerts = await this.spendAlertRepo.listForOrg(orgId, { status: "active" });

      for (const alert of alerts) {
        if (currentSpendCents >= alert.thresholdCents) {
          await this.spendAlertRepo.trigger(alert.id, orgId, currentSpendCents);
          await this.auditEmitter.emit({
            orgId, actorType: "system",
            action: "billing.alert_triggered", resourceType: "spend_alert",
            resourceId: alert.id,
            metadata: { thresholdCents: alert.thresholdCents, currentSpendCents },
          });
        }
      }
    } catch {
      // Non-fatal — alert check failure should not break metering
    }
  }

  // =========================================================================
  // Provider Sync
  // =========================================================================

  async syncWithProvider(orgId: OrgId, userId: UserId): Promise<Result<{ customerId: string }>> {
    try {
      const account = await this.billingAccountRepo.getByOrgId(orgId);
      if (!account) return err(AppError.notFound("BillingAccount"));

      await this.auditEmitter.emit({
        orgId, actorId: userId, actorType: "user",
        action: "billing.sync_requested", resourceType: "billing_account",
        resourceId: account.id,
      });

      const result = await this.provider.createCustomer(orgId, account.billingEmail ?? "");

      await this.billingAccountRepo.update(orgId, {
        providerCustomerId: result.customerId, updatedBy: userId,
      });

      await this.auditEmitter.emit({
        orgId, actorId: userId, actorType: "user",
        action: "billing.sync_completed", resourceType: "billing_account",
        resourceId: account.id, metadata: { providerCustomerId: result.customerId },
      });

      return ok(result);
    } catch (e) {
      await this.auditEmitter.emit({
        orgId, actorId: userId, actorType: "user",
        action: "billing.sync_failed", resourceType: "billing_account",
        metadata: { error: (e as Error).message },
      }).catch(() => {});
      return err(AppError.internal((e as Error).message));
    }
  }
}
