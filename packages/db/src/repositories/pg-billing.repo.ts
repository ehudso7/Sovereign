import {
  toBillingAccountId, toUsageEventId, toInvoiceId, toSpendAlertId,
  toOrgId, toUserId, toISODateString,
} from "@sovereign/core";
import type {
  OrgId, UserId, BillingAccountId, InvoiceId, SpendAlertId,
  BillingAccount, UsageEvent, Invoice, SpendAlert,
  BillingAccountStatus, BillingPlan, UsageMeter,
  InvoiceStatus, InvoiceLineItem, SpendAlertStatus,
} from "@sovereign/core";
import type { TenantDb } from "../client.js";
import type { BillingAccountRepo, UsageEventRepo, InvoiceRepo, SpendAlertRepo } from "./types.js";

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

interface BillingAccountRow {
  id: string; org_id: string; plan: string; status: string;
  billing_email: string | null; payment_provider: string;
  provider_customer_id: string | null;
  current_period_start: string; current_period_end: string;
  trial_ends_at: string | null; spend_limit_cents: string | null;
  overage_allowed: boolean; metadata: Record<string, unknown> | string;
  created_by: string; updated_by: string; created_at: string; updated_at: string;
}

interface UsageEventRow {
  id: string; org_id: string; event_type: string; meter: string;
  quantity: string; unit: string; source_type: string | null;
  source_id: string | null; metadata: Record<string, unknown> | string;
  occurred_at: string; created_at: string;
}

interface InvoiceRow {
  id: string; org_id: string; billing_account_id: string;
  provider_invoice_id: string | null; status: string;
  subtotal_cents: string; overage_cents: string; total_cents: string;
  currency: string; period_start: string; period_end: string;
  due_at: string | null; line_items: unknown[] | string;
  metadata: Record<string, unknown> | string;
  created_at: string; updated_at: string;
}

interface SpendAlertRow {
  id: string; org_id: string; threshold_cents: string;
  current_spend_cents: string; status: string;
  triggered_at: string | null; acknowledged_by: string | null;
  acknowledged_at: string | null; metadata: Record<string, unknown> | string;
  created_by: string; created_at: string; updated_at: string;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function parseJsonb(v: unknown): Record<string, unknown> {
  if (typeof v === "string") return JSON.parse(v) as Record<string, unknown>;
  return (v ?? {}) as Record<string, unknown>;
}

function parseJsonArray(v: unknown): unknown[] {
  if (typeof v === "string") return JSON.parse(v) as unknown[];
  return (v ?? []) as unknown[];
}

function toBillingAccount(r: BillingAccountRow): BillingAccount {
  return {
    id: toBillingAccountId(r.id), orgId: toOrgId(r.org_id),
    plan: r.plan as BillingPlan, status: r.status as BillingAccountStatus,
    billingEmail: r.billing_email, paymentProvider: r.payment_provider,
    providerCustomerId: r.provider_customer_id,
    currentPeriodStart: toISODateString(r.current_period_start),
    currentPeriodEnd: toISODateString(r.current_period_end),
    trialEndsAt: r.trial_ends_at ? toISODateString(r.trial_ends_at) : null,
    spendLimitCents: r.spend_limit_cents ? parseInt(r.spend_limit_cents, 10) : null,
    overageAllowed: r.overage_allowed, metadata: parseJsonb(r.metadata),
    createdBy: toUserId(r.created_by), updatedBy: toUserId(r.updated_by),
    createdAt: toISODateString(r.created_at), updatedAt: toISODateString(r.updated_at),
  };
}

function toUsageEvent(r: UsageEventRow): UsageEvent {
  return {
    id: toUsageEventId(r.id), orgId: toOrgId(r.org_id),
    eventType: r.event_type, meter: r.meter as UsageMeter,
    quantity: parseFloat(r.quantity), unit: r.unit,
    sourceType: r.source_type, sourceId: r.source_id,
    metadata: parseJsonb(r.metadata),
    occurredAt: toISODateString(r.occurred_at),
    createdAt: toISODateString(r.created_at),
  };
}

function toInvoice(r: InvoiceRow): Invoice {
  return {
    id: toInvoiceId(r.id), orgId: toOrgId(r.org_id),
    billingAccountId: toBillingAccountId(r.billing_account_id),
    providerInvoiceId: r.provider_invoice_id,
    status: r.status as InvoiceStatus,
    subtotalCents: parseInt(r.subtotal_cents, 10),
    overageCents: parseInt(r.overage_cents, 10),
    totalCents: parseInt(r.total_cents, 10),
    currency: r.currency,
    periodStart: toISODateString(r.period_start),
    periodEnd: toISODateString(r.period_end),
    dueAt: r.due_at ? toISODateString(r.due_at) : null,
    lineItems: parseJsonArray(r.line_items) as InvoiceLineItem[],
    metadata: parseJsonb(r.metadata),
    createdAt: toISODateString(r.created_at),
    updatedAt: toISODateString(r.updated_at),
  };
}

function toSpendAlert(r: SpendAlertRow): SpendAlert {
  return {
    id: toSpendAlertId(r.id), orgId: toOrgId(r.org_id),
    thresholdCents: parseInt(r.threshold_cents, 10),
    currentSpendCents: parseInt(r.current_spend_cents, 10),
    status: r.status as SpendAlertStatus,
    triggeredAt: r.triggered_at ? toISODateString(r.triggered_at) : null,
    acknowledgedBy: r.acknowledged_by ? toUserId(r.acknowledged_by) : null,
    acknowledgedAt: r.acknowledged_at ? toISODateString(r.acknowledged_at) : null,
    metadata: parseJsonb(r.metadata),
    createdBy: toUserId(r.created_by),
    createdAt: toISODateString(r.created_at),
    updatedAt: toISODateString(r.updated_at),
  };
}

// ---------------------------------------------------------------------------
// PgBillingAccountRepo
// ---------------------------------------------------------------------------

export class PgBillingAccountRepo implements BillingAccountRepo {
  constructor(private readonly db: TenantDb) {}

  async create(input: {
    orgId: OrgId; plan?: string; status?: string; billingEmail?: string;
    paymentProvider?: string; providerCustomerId?: string;
    currentPeriodStart?: string; currentPeriodEnd?: string;
    trialEndsAt?: string; spendLimitCents?: number; overageAllowed?: boolean;
    metadata?: Record<string, unknown>; createdBy: UserId;
  }): Promise<BillingAccount> {
    return this.db.transaction(async (tx) => {
      const now = new Date();
      const periodStart = input.currentPeriodStart ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const periodEnd = input.currentPeriodEnd ?? new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
      const row = await tx.queryOne<BillingAccountRow>(
        `INSERT INTO billing_accounts (org_id, plan, status, billing_email, payment_provider, provider_customer_id, current_period_start, current_period_end, trial_ends_at, spend_limit_cents, overage_allowed, metadata, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
         RETURNING *`,
        [this.db.orgId, input.plan ?? "free", input.status ?? "active",
         input.billingEmail ?? null, input.paymentProvider ?? "local",
         input.providerCustomerId ?? null, periodStart, periodEnd,
         input.trialEndsAt ?? null, input.spendLimitCents ?? null,
         input.overageAllowed ?? false, JSON.stringify(input.metadata ?? {}),
         input.createdBy],
      );
      if (!row) throw new Error("Failed to create billing account");
      return toBillingAccount(row);
    });
  }

  async getByOrgId(_orgId: OrgId): Promise<BillingAccount | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<BillingAccountRow>(
        "SELECT * FROM billing_accounts WHERE org_id = $1", [this.db.orgId],
      );
      return row ? toBillingAccount(row) : null;
    });
  }

  async update(_orgId: OrgId, input: {
    plan?: string; status?: string; billingEmail?: string;
    paymentProvider?: string; providerCustomerId?: string;
    currentPeriodStart?: string; currentPeriodEnd?: string;
    trialEndsAt?: string; spendLimitCents?: number; overageAllowed?: boolean;
    metadata?: Record<string, unknown>; updatedBy: UserId;
  }): Promise<BillingAccount | null> {
    return this.db.transaction(async (tx) => {
      const sets: string[] = ["updated_at = now()", "updated_by = $1"];
      const params: unknown[] = [input.updatedBy];
      let idx = 2;
      if (input.plan !== undefined) { sets.push(`plan = $${idx}`); params.push(input.plan); idx++; }
      if (input.status !== undefined) { sets.push(`status = $${idx}`); params.push(input.status); idx++; }
      if (input.billingEmail !== undefined) { sets.push(`billing_email = $${idx}`); params.push(input.billingEmail); idx++; }
      if (input.paymentProvider !== undefined) { sets.push(`payment_provider = $${idx}`); params.push(input.paymentProvider); idx++; }
      if (input.providerCustomerId !== undefined) { sets.push(`provider_customer_id = $${idx}`); params.push(input.providerCustomerId); idx++; }
      if (input.currentPeriodStart !== undefined) { sets.push(`current_period_start = $${idx}`); params.push(input.currentPeriodStart); idx++; }
      if (input.currentPeriodEnd !== undefined) { sets.push(`current_period_end = $${idx}`); params.push(input.currentPeriodEnd); idx++; }
      if (input.trialEndsAt !== undefined) { sets.push(`trial_ends_at = $${idx}`); params.push(input.trialEndsAt); idx++; }
      if (input.spendLimitCents !== undefined) { sets.push(`spend_limit_cents = $${idx}`); params.push(input.spendLimitCents); idx++; }
      if (input.overageAllowed !== undefined) { sets.push(`overage_allowed = $${idx}`); params.push(input.overageAllowed); idx++; }
      if (input.metadata !== undefined) { sets.push(`metadata = $${idx}`); params.push(JSON.stringify(input.metadata)); idx++; }
      const row = await tx.queryOne<BillingAccountRow>(
        `UPDATE billing_accounts SET ${sets.join(", ")} WHERE org_id = '${this.db.orgId}' RETURNING *`,
        params,
      );
      return row ? toBillingAccount(row) : null;
    });
  }
}

// ---------------------------------------------------------------------------
// PgUsageEventRepo
// ---------------------------------------------------------------------------

export class PgUsageEventRepo implements UsageEventRepo {
  constructor(private readonly db: TenantDb) {}

  async create(input: {
    orgId: OrgId; eventType: string; meter: string; quantity: number;
    unit: string; sourceType?: string; sourceId?: string;
    metadata?: Record<string, unknown>; occurredAt?: string;
  }): Promise<UsageEvent> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<UsageEventRow>(
        `INSERT INTO usage_events (org_id, event_type, meter, quantity, unit, source_type, source_id, metadata, occurred_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [this.db.orgId, input.eventType, input.meter, input.quantity,
         input.unit, input.sourceType ?? null, input.sourceId ?? null,
         JSON.stringify(input.metadata ?? {}), input.occurredAt ?? new Date().toISOString()],
      );
      if (!row) throw new Error("Failed to create usage event");
      return toUsageEvent(row);
    });
  }

  async listForOrg(_orgId: OrgId, filters?: { meter?: string; since?: string; until?: string }): Promise<UsageEvent[]> {
    return this.db.transaction(async (tx) => {
      const conditions = ["org_id = $1"];
      const params: unknown[] = [this.db.orgId];
      let idx = 2;
      if (filters?.meter) { conditions.push(`meter = $${idx}`); params.push(filters.meter); idx++; }
      if (filters?.since) { conditions.push(`occurred_at >= $${idx}`); params.push(filters.since); idx++; }
      if (filters?.until) { conditions.push(`occurred_at < $${idx}`); params.push(filters.until); idx++; }
      const rows = await tx.query<UsageEventRow>(
        `SELECT * FROM usage_events WHERE ${conditions.join(" AND ")} ORDER BY occurred_at DESC`, params,
      );
      return rows.map(toUsageEvent);
    });
  }

  async aggregateByMeter(_orgId: OrgId, periodStart: string, periodEnd: string): Promise<Record<string, number>> {
    return this.db.transaction(async (tx) => {
      const rows = await tx.query<{ meter: string; total: string }>(
        `SELECT meter, SUM(quantity) as total FROM usage_events
         WHERE org_id = $1 AND occurred_at >= $2 AND occurred_at < $3
         GROUP BY meter`,
        [this.db.orgId, periodStart, periodEnd],
      );
      const result: Record<string, number> = {};
      for (const r of rows) result[r.meter] = parseFloat(r.total);
      return result;
    });
  }
}

// ---------------------------------------------------------------------------
// PgInvoiceRepo
// ---------------------------------------------------------------------------

export class PgInvoiceRepo implements InvoiceRepo {
  constructor(private readonly db: TenantDb) {}

  async create(input: {
    orgId: OrgId; billingAccountId: BillingAccountId;
    providerInvoiceId?: string; status?: string;
    subtotalCents: number; overageCents: number; totalCents: number;
    currency?: string; periodStart: string; periodEnd: string;
    dueAt?: string; lineItems?: unknown[];
    metadata?: Record<string, unknown>;
  }): Promise<Invoice> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<InvoiceRow>(
        `INSERT INTO invoices (org_id, billing_account_id, provider_invoice_id, status, subtotal_cents, overage_cents, total_cents, currency, period_start, period_end, due_at, line_items, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [this.db.orgId, input.billingAccountId, input.providerInvoiceId ?? null,
         input.status ?? "draft", input.subtotalCents, input.overageCents,
         input.totalCents, input.currency ?? "USD", input.periodStart,
         input.periodEnd, input.dueAt ?? null,
         JSON.stringify(input.lineItems ?? []), JSON.stringify(input.metadata ?? {})],
      );
      if (!row) throw new Error("Failed to create invoice");
      return toInvoice(row);
    });
  }

  async getById(id: InvoiceId, _orgId: OrgId): Promise<Invoice | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<InvoiceRow>(
        "SELECT * FROM invoices WHERE id = $1 AND org_id = $2", [id, this.db.orgId],
      );
      return row ? toInvoice(row) : null;
    });
  }

  async listForOrg(_orgId: OrgId, filters?: { status?: string }): Promise<Invoice[]> {
    return this.db.transaction(async (tx) => {
      const conditions = ["org_id = $1"];
      const params: unknown[] = [this.db.orgId];
      let idx = 2;
      if (filters?.status) { conditions.push(`status = $${idx}`); params.push(filters.status); idx++; }
      const rows = await tx.query<InvoiceRow>(
        `SELECT * FROM invoices WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`, params,
      );
      return rows.map(toInvoice);
    });
  }

  async update(id: InvoiceId, _orgId: OrgId, input: {
    status?: string; providerInvoiceId?: string; metadata?: Record<string, unknown>;
  }): Promise<Invoice | null> {
    return this.db.transaction(async (tx) => {
      const sets: string[] = ["updated_at = now()"];
      const params: unknown[] = [id];
      let idx = 2;
      if (input.status !== undefined) { sets.push(`status = $${idx}`); params.push(input.status); idx++; }
      if (input.providerInvoiceId !== undefined) { sets.push(`provider_invoice_id = $${idx}`); params.push(input.providerInvoiceId); idx++; }
      if (input.metadata !== undefined) { sets.push(`metadata = $${idx}`); params.push(JSON.stringify(input.metadata)); idx++; }
      const row = await tx.queryOne<InvoiceRow>(
        `UPDATE invoices SET ${sets.join(", ")} WHERE id = $1 AND org_id = '${this.db.orgId}' RETURNING *`, params,
      );
      return row ? toInvoice(row) : null;
    });
  }
}

// ---------------------------------------------------------------------------
// PgSpendAlertRepo
// ---------------------------------------------------------------------------

export class PgSpendAlertRepo implements SpendAlertRepo {
  constructor(private readonly db: TenantDb) {}

  async create(input: { orgId: OrgId; thresholdCents: number; createdBy: UserId }): Promise<SpendAlert> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<SpendAlertRow>(
        `INSERT INTO spend_alerts (org_id, threshold_cents, created_by)
         VALUES ($1, $2, $3) RETURNING *`,
        [this.db.orgId, input.thresholdCents, input.createdBy],
      );
      if (!row) throw new Error("Failed to create spend alert");
      return toSpendAlert(row);
    });
  }

  async listForOrg(_orgId: OrgId, filters?: { status?: string }): Promise<SpendAlert[]> {
    return this.db.transaction(async (tx) => {
      const conditions = ["org_id = $1"];
      const params: unknown[] = [this.db.orgId];
      let idx = 2;
      if (filters?.status) { conditions.push(`status = $${idx}`); params.push(filters.status); idx++; }
      const rows = await tx.query<SpendAlertRow>(
        `SELECT * FROM spend_alerts WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`, params,
      );
      return rows.map(toSpendAlert);
    });
  }

  async trigger(id: SpendAlertId, _orgId: OrgId, currentSpendCents: number): Promise<SpendAlert | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<SpendAlertRow>(
        `UPDATE spend_alerts SET status = 'triggered', current_spend_cents = $2, triggered_at = now(), updated_at = now()
         WHERE id = $1 AND org_id = '${this.db.orgId}' RETURNING *`,
        [id, currentSpendCents],
      );
      return row ? toSpendAlert(row) : null;
    });
  }

  async acknowledge(id: SpendAlertId, _orgId: OrgId, userId: UserId): Promise<SpendAlert | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<SpendAlertRow>(
        `UPDATE spend_alerts SET status = 'acknowledged', acknowledged_by = $2, acknowledged_at = now(), updated_at = now()
         WHERE id = $1 AND org_id = '${this.db.orgId}' AND status = 'triggered' RETURNING *`,
        [id, userId],
      );
      return row ? toSpendAlert(row) : null;
    });
  }
}
