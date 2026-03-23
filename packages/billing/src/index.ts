/**
 * @sovereign/billing
 *
 * Billing domain types for subscription management, usage tracking,
 * invoicing, and payment processing in the Sovereign platform.
 */

import type {
  OrgId,
  TenantContext,
  Result,
  AuditFields,
  ISODateString,
} from "@sovereign/core";

// ---------------------------------------------------------------------------
// Branded billing IDs
// ---------------------------------------------------------------------------

declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

export type SubscriptionId = Brand<string, "SubscriptionId">;
export type InvoiceId = Brand<string, "InvoiceId">;
export type PaymentMethodId = Brand<string, "PaymentMethodId">;
export type PlanId = Brand<string, "PlanId">;
export type CouponId = Brand<string, "CouponId">;

export const toSubscriptionId = (id: string): SubscriptionId => id as SubscriptionId;
export const toInvoiceId = (id: string): InvoiceId => id as InvoiceId;
export const toPaymentMethodId = (id: string): PaymentMethodId => id as PaymentMethodId;
export const toPlanId = (id: string): PlanId => id as PlanId;
export const toCouponId = (id: string): CouponId => id as CouponId;

// ---------------------------------------------------------------------------
// Currency / money
// ---------------------------------------------------------------------------

/** ISO-4217 currency code, e.g. "USD", "EUR". */
export type CurrencyCode = string & { readonly __currency: unique symbol };
export const toCurrencyCode = (code: string): CurrencyCode => code as CurrencyCode;

/** Monetary amount represented as integer minor units (e.g. cents). */
export interface Money {
  readonly amount: number;
  readonly currency: CurrencyCode;
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export type BillingInterval = "monthly" | "annual" | "one_time";
export type PlanTier = "free" | "starter" | "growth" | "enterprise" | "custom";

export interface PlanFeature {
  readonly key: string;
  readonly label: string;
  /** Numeric limit; null means unlimited. */
  readonly limit: number | null;
}

export interface Plan {
  readonly id: PlanId;
  readonly name: string;
  readonly tier: PlanTier;
  readonly description: string;
  readonly price: Money;
  readonly interval: BillingInterval;
  readonly features: readonly PlanFeature[];
  readonly isPublic: boolean;
  readonly createdAt: ISODateString;
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "paused";

export interface Subscription extends AuditFields {
  readonly id: SubscriptionId;
  readonly orgId: OrgId;
  readonly planId: PlanId;
  readonly status: SubscriptionStatus;
  readonly currentPeriodStart: ISODateString;
  readonly currentPeriodEnd: ISODateString;
  readonly trialEnd?: ISODateString;
  readonly cancelAt?: ISODateString;
  readonly canceledAt?: ISODateString;
  readonly couponId?: CouponId;
  /** External provider subscription ID (e.g. Stripe sub_*). */
  readonly externalId?: string;
}

// ---------------------------------------------------------------------------
// Usage metering
// ---------------------------------------------------------------------------

export type UsageMetric =
  | "agent_runs"
  | "llm_input_tokens"
  | "llm_output_tokens"
  | "connector_syncs"
  | "api_calls"
  | "storage_bytes"
  | "seats";

export interface UsageRecord {
  readonly orgId: OrgId;
  readonly metric: UsageMetric;
  readonly quantity: number;
  readonly recordedAt: ISODateString;
  readonly metadata?: Record<string, unknown>;
}

export interface UsageSummary {
  readonly orgId: OrgId;
  readonly periodStart: ISODateString;
  readonly periodEnd: ISODateString;
  readonly metrics: Record<UsageMetric, number>;
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export type InvoiceStatus = "draft" | "open" | "paid" | "void" | "uncollectible";

export interface InvoiceLineItem {
  readonly description: string;
  readonly quantity: number;
  readonly unitAmount: Money;
  readonly totalAmount: Money;
  readonly metric?: UsageMetric;
}

export interface Invoice extends AuditFields {
  readonly id: InvoiceId;
  readonly orgId: OrgId;
  readonly subscriptionId: SubscriptionId;
  readonly status: InvoiceStatus;
  readonly lineItems: readonly InvoiceLineItem[];
  readonly subtotal: Money;
  readonly tax: Money;
  readonly total: Money;
  readonly dueDate: ISODateString;
  readonly paidAt?: ISODateString;
  readonly externalId?: string;
}

// ---------------------------------------------------------------------------
// Payment methods
// ---------------------------------------------------------------------------

export type PaymentMethodType = "card" | "bank_account" | "sepa_debit" | "paypal";

export interface PaymentMethod extends AuditFields {
  readonly id: PaymentMethodId;
  readonly orgId: OrgId;
  readonly type: PaymentMethodType;
  readonly isDefault: boolean;
  readonly last4?: string;
  readonly expiryMonth?: number;
  readonly expiryYear?: number;
  readonly brand?: string;
  readonly billingEmail: string;
  readonly externalId?: string;
}

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

export type DiscountType = "percent" | "fixed";

export interface Coupon {
  readonly id: CouponId;
  readonly code: string;
  readonly discountType: DiscountType;
  readonly discountValue: number;
  readonly maxRedemptions?: number;
  readonly timesRedeemed: number;
  readonly expiresAt?: ISODateString;
  readonly appliesTo?: readonly PlanId[];
}

// ---------------------------------------------------------------------------
// Billing service interface
// ---------------------------------------------------------------------------

export interface BillingService {
  // Plans
  getPlan(id: PlanId): Promise<Result<Plan>>;
  listPlans(): Promise<Result<readonly Plan[]>>;

  // Subscriptions
  getSubscription(ctx: TenantContext): Promise<Result<Subscription>>;
  createSubscription(ctx: TenantContext, input: CreateSubscriptionInput): Promise<Result<Subscription>>;
  cancelSubscription(ctx: TenantContext, options?: CancelSubscriptionOptions): Promise<Result<Subscription>>;
  changePlan(ctx: TenantContext, newPlanId: PlanId): Promise<Result<Subscription>>;

  // Usage
  recordUsage(ctx: TenantContext, record: Omit<UsageRecord, "orgId">): Promise<Result<void>>;
  getUsageSummary(ctx: TenantContext, periodStart: ISODateString, periodEnd: ISODateString): Promise<Result<UsageSummary>>;

  // Invoices
  listInvoices(ctx: TenantContext): Promise<Result<readonly Invoice[]>>;
  getInvoice(ctx: TenantContext, id: InvoiceId): Promise<Result<Invoice>>;

  // Payment methods
  listPaymentMethods(ctx: TenantContext): Promise<Result<readonly PaymentMethod[]>>;
  addPaymentMethod(ctx: TenantContext, input: AddPaymentMethodInput): Promise<Result<PaymentMethod>>;
  removePaymentMethod(ctx: TenantContext, id: PaymentMethodId): Promise<Result<void>>;
  setDefaultPaymentMethod(ctx: TenantContext, id: PaymentMethodId): Promise<Result<void>>;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateSubscriptionInput {
  readonly planId: PlanId;
  readonly paymentMethodId?: PaymentMethodId;
  readonly couponCode?: string;
  readonly trialDays?: number;
}

export interface CancelSubscriptionOptions {
  /** If true, cancel at the end of the current billing period. */
  readonly atPeriodEnd?: boolean;
  readonly reason?: string;
}

export interface AddPaymentMethodInput {
  readonly type: PaymentMethodType;
  /** Provider-specific token (e.g. Stripe PaymentMethod ID). */
  readonly providerToken: string;
  readonly billingEmail: string;
  readonly setAsDefault?: boolean;
}

// ---------------------------------------------------------------------------
// Webhook event types (for incoming provider webhooks)
// ---------------------------------------------------------------------------

export type BillingEventType =
  | "subscription.created"
  | "subscription.updated"
  | "subscription.canceled"
  | "invoice.created"
  | "invoice.paid"
  | "invoice.payment_failed"
  | "payment_method.attached"
  | "payment_method.detached";

export interface BillingWebhookEvent {
  readonly id: string;
  readonly type: BillingEventType;
  readonly livemode: boolean;
  readonly createdAt: ISODateString;
  readonly data: unknown;
}

// ---------------------------------------------------------------------------
// Entitlement check helper
// ---------------------------------------------------------------------------

export interface EntitlementCheck {
  readonly allowed: boolean;
  readonly limit: number | null;
  readonly current: number;
  readonly remaining: number | null;
  readonly reason?: string;
}

export function checkEntitlement(
  summary: UsageSummary,
  plan: Plan,
  metric: UsageMetric
): EntitlementCheck {
  const featureKey = metric as string;
  const feature = plan.features.find((f) => f.key === featureKey);
  const current = summary.metrics[metric] ?? 0;

  if (!feature) {
    return { allowed: true, limit: null, current, remaining: null };
  }

  if (feature.limit === null) {
    return { allowed: true, limit: null, current, remaining: null };
  }

  const remaining = feature.limit - current;
  return {
    allowed: remaining > 0,
    limit: feature.limit,
    current,
    remaining,
    reason: remaining <= 0 ? `${metric} limit of ${feature.limit} reached` : undefined,
  };
}
