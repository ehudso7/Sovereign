"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { IconBilling } from "@/components/icons";
import Link from "next/link";

interface BillingAccount {
  plan: string;
  status: string;
  billingEmail: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  spendLimitCents: number | null;
  overageAllowed: boolean;
}

interface UsageSummary {
  periodStart: string;
  periodEnd: string;
  meters: Record<string, { used: number; included: number; overage: number; unit: string }>;
  totalOverageCents: number;
}

interface InvoicePreview {
  plan: { name: string };
  basePriceCents: number;
  lineItems: { description: string; totalCents: number }[];
  subtotalCents: number;
  overageCents: number;
  totalCents: number;
  isEstimate: boolean;
}

interface PlanDef {
  id: string;
  name: string;
  description: string;
  basePriceCents: number;
}

interface SpendAlert {
  id: string;
  thresholdCents: number;
  currentSpendCents: number;
  status: string;
  triggeredAt: string | null;
}

const alertStatusBadge: Record<string, string> = {
  triggered: "badge-error",
  acknowledged: "badge-neutral",
  active: "badge-success",
};

function SkeletonBilling() {
  return (
    <div className="space-y-6">
      <div className="card">
        <div className="skeleton h-5 w-32" />
        <div className="skeleton mt-3 h-10 w-24" />
        <div className="skeleton mt-2 h-4 w-64" />
      </div>
      <div className="card">
        <div className="skeleton h-5 w-40" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-8 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function BillingPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const [account, setAccount] = useState<BillingAccount | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [preview, setPreview] = useState<InvoicePreview | null>(null);
  const [plans, setPlans] = useState<PlanDef[]>([]);
  const [alerts, setAlerts] = useState<SpendAlert[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [changingPlan, setChangingPlan] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.push("/auth/sign-in");
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      apiFetch<BillingAccount>("/api/v1/billing/account", { token }),
      apiFetch<UsageSummary>("/api/v1/billing/usage", { token }),
      apiFetch<InvoicePreview>("/api/v1/billing/invoice-preview", { token }),
      apiFetch<PlanDef[]>("/api/v1/billing/plans", { token }),
      apiFetch<SpendAlert[]>("/api/v1/billing/alerts", { token }),
    ]).then(([accR, usageR, prevR, plansR, alertsR]) => {
      if (accR.ok) setAccount(accR.data);
      if (usageR.ok) setUsage(usageR.data);
      if (prevR.ok) setPreview(prevR.data);
      if (plansR.ok) setPlans(plansR.data);
      if (alertsR.ok) setAlerts(alertsR.data);
      if (!accR.ok) setError(accR.error.message);
      setLoading(false);
    });
  }, [token]);

  if (isLoading || !user) return null;
  const canManage = role === "org_owner" || role === "org_admin" || role === "org_billing_admin";

  const handleChangePlan = async (plan: string) => {
    if (!token) return;
    setChangingPlan(true);
    const result = await apiFetch<BillingAccount>("/api/v1/billing/account/change-plan", {
      method: "POST",
      token: token ?? undefined,
      body: JSON.stringify({ plan }),
    });
    setChangingPlan(false);
    if (result.ok) {
      setAccount(result.data);
      window.location.reload();
    } else {
      setError(result.error.message);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="page-header">
          <h1 className="page-title">Billing</h1>
          <p className="page-description">
            Manage your subscription plan, monitor usage, and review invoices.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="card border-[rgb(var(--color-error))] bg-[rgb(var(--color-error-bg))]">
            <p className="text-sm text-[rgb(var(--color-error))]">{error}</p>
          </div>
        )}

        {loading ? (
          <SkeletonBilling />
        ) : (
          <>
            {/* Current Plan */}
            {account && (
              <div className="card">
                <div className="section-header mb-4">
                  <h2 className="section-title">Current Plan</h2>
                  <span
                    className={
                      account.status === "active" ? "badge-success" : "badge-error"
                    }
                  >
                    <span
                      className={
                        account.status === "active"
                          ? "status-dot-success"
                          : "status-dot-error"
                      }
                    />
                    {account.status}
                  </span>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold text-[rgb(var(--color-text-primary))]">
                    {account.plan}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[rgb(var(--color-text-secondary))]">
                  <span>
                    Period:{" "}
                    <span className="font-medium text-[rgb(var(--color-text-primary))]">
                      {new Date(account.currentPeriodStart).toLocaleDateString()} &mdash;{" "}
                      {new Date(account.currentPeriodEnd).toLocaleDateString()}
                    </span>
                  </span>
                  {account.billingEmail && (
                    <span>
                      Email:{" "}
                      <span className="font-medium text-[rgb(var(--color-text-primary))]">
                        {account.billingEmail}
                      </span>
                    </span>
                  )}
                  {account.spendLimitCents != null && (
                    <span>
                      Spend limit:{" "}
                      <span className="font-medium text-[rgb(var(--color-text-primary))]">
                        ${(account.spendLimitCents / 100).toFixed(2)}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Available Plans */}
            {canManage && plans.length > 0 && (
              <div className="card">
                <div className="section-header mb-4">
                  <h2 className="section-title">Available Plans</h2>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {plans.map((p) => {
                    const isCurrent = account?.plan === p.id;
                    return (
                      <div
                        key={p.id}
                        className={`rounded-lg border-2 p-4 transition-colors ${
                          isCurrent
                            ? "border-[rgb(var(--color-brand))] bg-[rgb(var(--color-info-bg))]"
                            : "border-[rgb(var(--color-border-primary))] hover:border-[rgb(var(--color-brand))]"
                        }`}
                      >
                        <p className="text-lg font-bold text-[rgb(var(--color-text-primary))]">
                          {p.name}
                        </p>
                        <p className="mt-1 text-sm text-[rgb(var(--color-text-secondary))]">
                          {p.description}
                        </p>
                        <p className="mt-3 text-2xl font-bold text-[rgb(var(--color-text-primary))]">
                          ${(p.basePriceCents / 100).toFixed(0)}
                          <span className="text-sm font-normal text-[rgb(var(--color-text-tertiary))]">
                            /mo
                          </span>
                        </p>
                        {isCurrent ? (
                          <div className="mt-3">
                            <span className="badge-info">Current Plan</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleChangePlan(p.id)}
                            disabled={changingPlan}
                            className="mt-3 w-full rounded-lg border border-[rgb(var(--color-brand))] px-3 py-2 text-sm font-medium text-[rgb(var(--color-brand))] transition-colors hover:bg-[rgb(var(--color-brand))] hover:text-white disabled:opacity-50"
                          >
                            {changingPlan ? "Switching..." : "Switch to Plan"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Usage Meters */}
            {usage && (
              <div className="card">
                <div className="section-header mb-4">
                  <h2 className="section-title">Current Period Usage</h2>
                  {usage.totalOverageCents > 0 && (
                    <span className="badge-warning">
                      ${(usage.totalOverageCents / 100).toFixed(2)} overage
                    </span>
                  )}
                </div>
                <div className="space-y-4">
                  {Object.entries(usage.meters).map(([meter, data]) => {
                    const isUnlimited = data.included === -1;
                    const pct = isUnlimited
                      ? 0
                      : data.included > 0
                        ? Math.min(100, (data.used / data.included) * 100)
                        : 0;
                    const isOverage = data.overage > 0;

                    return (
                      <div key={meter}>
                        <div className="mb-1.5 flex items-center justify-between text-sm">
                          <span className="font-medium text-[rgb(var(--color-text-primary))]">
                            {meter}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-[rgb(var(--color-text-secondary))]">
                              {data.used.toLocaleString()} /{" "}
                              {isUnlimited
                                ? "unlimited"
                                : data.included.toLocaleString()}{" "}
                              {data.unit}
                            </span>
                            {isOverage && (
                              <span className="badge-warning">
                                +{data.overage} overage
                              </span>
                            )}
                          </div>
                        </div>
                        {!isUnlimited && (
                          <div className="h-2 overflow-hidden rounded-full bg-[rgb(var(--color-bg-tertiary))]">
                            <div
                              className={`h-2 rounded-full transition-all duration-500 ${
                                isOverage
                                  ? "bg-[rgb(var(--color-warning))]"
                                  : pct > 80
                                    ? "bg-[rgb(var(--color-warning))]"
                                    : "bg-[rgb(var(--color-success))]"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Invoice Preview */}
            {preview && (
              <div className="card">
                <div className="section-header mb-4">
                  <h2 className="section-title">Invoice Preview</h2>
                  {preview.isEstimate && (
                    <span className="badge-warning">Estimate</span>
                  )}
                </div>
                <div className="table-container">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="table-header">
                        <th className="px-4 py-3 text-left">Description</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.lineItems.map((li, i) => (
                        <tr key={i} className="table-row">
                          <td className="px-4 py-3 text-[rgb(var(--color-text-secondary))]">
                            {li.description}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-[rgb(var(--color-text-primary))]">
                            ${(li.totalCents / 100).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-[rgb(var(--color-border-primary))]">
                        <td className="px-4 py-3 font-semibold text-[rgb(var(--color-text-primary))]">
                          Total
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-lg font-bold text-[rgb(var(--color-text-primary))]">
                          ${(preview.totalCents / 100).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Invoice History */}
            <div className="card">
              <div className="section-header mb-4">
                <h2 className="section-title">Invoice History</h2>
                <Link
                  href="/billing/invoices"
                  className="text-sm font-medium text-[rgb(var(--color-brand))] transition-colors hover:text-[rgb(var(--color-brand-dark))]"
                >
                  View all invoices
                </Link>
              </div>
              <div className="empty-state py-10">
                <IconBilling className="empty-state-icon" size={40} />
                <p className="empty-state-title">No recent invoices</p>
                <p className="empty-state-description">
                  Past invoices will appear here after your billing period ends.
                </p>
              </div>
            </div>

            {/* Spend Alerts */}
            {alerts.length > 0 && (
              <div className="card">
                <div className="section-header mb-4">
                  <h2 className="section-title">Spend Alerts</h2>
                </div>
                <div className="space-y-3">
                  {alerts.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-lg border border-[rgb(var(--color-border-primary))] px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-[rgb(var(--color-text-primary))]">
                          Threshold: ${(a.thresholdCents / 100).toFixed(2)}
                        </p>
                        <p className="mt-0.5 text-xs text-[rgb(var(--color-text-tertiary))]">
                          Current spend: ${(a.currentSpendCents / 100).toFixed(2)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {a.triggeredAt && (
                          <span className="text-xs text-[rgb(var(--color-text-tertiary))]">
                            Triggered {new Date(a.triggeredAt).toLocaleDateString()}
                          </span>
                        )}
                        <span className={alertStatusBadge[a.status] ?? "badge-neutral"}>
                          {a.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
