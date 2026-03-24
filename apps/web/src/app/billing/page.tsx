"use client";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

interface BillingAccount { plan: string; status: string; billingEmail: string | null; currentPeriodStart: string; currentPeriodEnd: string; spendLimitCents: number | null; overageAllowed: boolean; }
interface UsageSummary { periodStart: string; periodEnd: string; meters: Record<string, { used: number; included: number; overage: number; unit: string }>; totalOverageCents: number; }
interface InvoicePreview { plan: { name: string }; basePriceCents: number; lineItems: { description: string; totalCents: number }[]; subtotalCents: number; overageCents: number; totalCents: number; isEstimate: boolean; }
interface PlanDef { id: string; name: string; description: string; basePriceCents: number; }
interface SpendAlert { id: string; thresholdCents: number; currentSpendCents: number; status: string; triggeredAt: string | null; }

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

  useEffect(() => { if (!isLoading && !user) router.push("/auth/sign-in"); }, [isLoading, user, router]);

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
      method: "POST", token: token ?? undefined, body: JSON.stringify({ plan }),
    });
    setChangingPlan(false);
    if (result.ok) { setAccount(result.data); window.location.reload(); }
    else setError(result.error.message);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Billing</h1>
        {error && <div className="rounded bg-red-100 p-4 text-red-700">{error}</div>}
        {loading ? <div className="text-gray-500">Loading...</div> : (
          <>
            {/* Account & Plan */}
            {account && (
              <div className="rounded border border-gray-200 p-4">
                <h2 className="text-lg font-semibold">Current Plan</h2>
                <div className="mt-2 flex items-center gap-4">
                  <span className="rounded bg-blue-100 px-3 py-1 text-lg font-bold text-blue-700">{account.plan}</span>
                  <span className={`rounded px-2 py-1 text-xs ${account.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{account.status}</span>
                </div>
                <div className="mt-2 text-sm text-gray-500">
                  Period: {new Date(account.currentPeriodStart).toLocaleDateString()} — {new Date(account.currentPeriodEnd).toLocaleDateString()}
                </div>
                {account.billingEmail && <div className="text-sm text-gray-500">Billing email: {account.billingEmail}</div>}
                {account.spendLimitCents && <div className="text-sm text-gray-500">Spend limit: ${(account.spendLimitCents / 100).toFixed(2)}</div>}
              </div>
            )}

            {/* Plan Selection */}
            {canManage && plans.length > 0 && (
              <div className="rounded border border-gray-200 p-4">
                <h2 className="text-lg font-semibold">Available Plans</h2>
                <div className="mt-2 grid grid-cols-3 gap-4">
                  {plans.map(p => (
                    <div key={p.id} className={`rounded border p-3 ${account?.plan === p.id ? "border-blue-500 bg-blue-50" : "border-gray-200"}`}>
                      <div className="font-bold">{p.name}</div>
                      <div className="text-sm text-gray-600">{p.description}</div>
                      <div className="mt-1 text-lg font-bold">${(p.basePriceCents / 100).toFixed(0)}/mo</div>
                      {account?.plan !== p.id && (
                        <button onClick={() => handleChangePlan(p.id)} disabled={changingPlan}
                          className="mt-2 rounded bg-gray-900 px-3 py-1 text-sm text-white hover:bg-gray-700 disabled:opacity-50">
                          {changingPlan ? "..." : "Switch"}
                        </button>
                      )}
                      {account?.plan === p.id && <div className="mt-2 text-sm text-blue-600 font-medium">Current</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Usage Summary */}
            {usage && (
              <div className="rounded border border-gray-200 p-4">
                <h2 className="text-lg font-semibold">Current Period Usage</h2>
                <div className="mt-2 space-y-2">
                  {Object.entries(usage.meters).map(([meter, data]) => (
                    <div key={meter} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{meter}</span>
                      <div className="flex items-center gap-2">
                        <span>{data.used.toLocaleString()} / {data.included === -1 ? "unlimited" : data.included.toLocaleString()} {data.unit}</span>
                        {data.overage > 0 && <span className="rounded bg-orange-100 px-2 py-0.5 text-xs text-orange-700">+{data.overage} overage</span>}
                        {data.included !== -1 && data.used <= data.included && (
                          <div className="h-2 w-24 rounded bg-gray-200"><div className="h-2 rounded bg-green-500" style={{ width: `${Math.min(100, (data.used / data.included) * 100)}%` }} /></div>
                        )}
                      </div>
                    </div>
                  ))}
                  {usage.totalOverageCents > 0 && (
                    <div className="mt-2 text-sm font-medium text-orange-700">Overage charges: ${(usage.totalOverageCents / 100).toFixed(2)}</div>
                  )}
                </div>
              </div>
            )}

            {/* Invoice Preview */}
            {preview && (
              <div className="rounded border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Invoice Preview</h2>
                  {preview.isEstimate && <span className="rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-700">Estimate</span>}
                </div>
                <div className="mt-2 space-y-1">
                  {preview.lineItems.map((li, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>{li.description}</span>
                      <span>${(li.totalCents / 100).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="mt-2 border-t border-gray-200 pt-2 flex justify-between font-bold">
                    <span>Total</span>
                    <span>${(preview.totalCents / 100).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Invoice History */}
            <div className="rounded border border-gray-200 p-4">
              <h2 className="text-lg font-semibold">Invoice History</h2>
              <Link href="/billing/invoices" className="text-sm text-blue-600 hover:underline">View all invoices</Link>
            </div>

            {/* Spend Alerts */}
            {alerts.length > 0 && (
              <div className="rounded border border-gray-200 p-4">
                <h2 className="text-lg font-semibold">Spend Alerts</h2>
                <div className="mt-2 space-y-2">
                  {alerts.map(a => (
                    <div key={a.id} className="flex items-center justify-between text-sm">
                      <span>Threshold: ${(a.thresholdCents / 100).toFixed(2)}</span>
                      <span className={`rounded px-2 py-1 text-xs ${a.status === "triggered" ? "bg-red-100 text-red-700" : a.status === "acknowledged" ? "bg-gray-100 text-gray-600" : "bg-green-100 text-green-700"}`}>{a.status}</span>
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
