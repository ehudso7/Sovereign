"use client";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";

interface Diagnostics {
  orgId: string; generatedAt: string;
  platform: { agentCount: number; publishedAgentCount: number; runCount: number; failedRunCount: number; connectorCount: number; browserSessionCount: number; alertCount: number; openAlertCount: number };
  billing: { plan: string; status: string; billingEmail: string | null } | null;
  recentFailedRuns: { id: string; status: string; error: string | null; createdAt: string }[];
  recentAlerts: { id: string; severity: string; title: string; status: string }[];
  onboarding: { percentComplete: number; completedCount: number; totalCount: number };
}

export default function SupportPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const [diag, setDiag] = useState<Diagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (!isLoading && !user) router.push("/auth/sign-in"); }, [isLoading, user, router]);
  useEffect(() => { if (!token) return; apiFetch<Diagnostics>("/api/v1/support/diagnostics", { token }).then((r) => { if (r.ok) setDiag(r.data); else setError(r.error.message); setLoading(false); }); }, [token]);
  if (isLoading || !user) return null;
  const forbidden = role === "org_member" || role === "org_billing_admin";
  if (forbidden) return <AppShell><div className="rounded bg-yellow-100 p-4 text-yellow-800">You don&apos;t have permission to view support diagnostics.</div></AppShell>;

  return (
    <AppShell>
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold">Support Diagnostics</h1><p className="text-gray-500">Org-scoped platform health summary</p></div>
        {error && <div className="rounded bg-red-100 p-4 text-red-700">{error}</div>}
        {loading ? <div className="text-gray-500">Loading...</div> : diag ? (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded border p-3"><div className="text-2xl font-bold">{diag.platform.agentCount}</div><div className="text-xs text-gray-500">Agents ({diag.platform.publishedAgentCount} published)</div></div>
              <div className="rounded border p-3"><div className="text-2xl font-bold">{diag.platform.runCount}</div><div className="text-xs text-gray-500">Runs ({diag.platform.failedRunCount} failed)</div></div>
              <div className="rounded border p-3"><div className="text-2xl font-bold">{diag.platform.connectorCount}</div><div className="text-xs text-gray-500">Connectors installed</div></div>
              <div className="rounded border p-3"><div className="text-2xl font-bold">{diag.platform.openAlertCount}</div><div className="text-xs text-gray-500">Open alerts</div></div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded border p-4">
                <h2 className="mb-2 font-semibold">Billing</h2>
                {diag.billing ? (
                  <div className="space-y-1 text-sm">
                    <div>Plan: <span className="font-medium">{diag.billing.plan}</span></div>
                    <div>Status: <span className={`${diag.billing.status === "active" ? "text-green-600" : "text-red-600"}`}>{diag.billing.status}</span></div>
                  </div>
                ) : <div className="text-sm text-gray-500">No billing account</div>}
              </div>
              <div className="rounded border p-4">
                <h2 className="mb-2 font-semibold">Onboarding</h2>
                <div className="text-sm">{diag.onboarding.percentComplete}% complete ({diag.onboarding.completedCount}/{diag.onboarding.totalCount})</div>
                <div className="mt-1 h-2 rounded bg-gray-200"><div className="h-2 rounded bg-green-500" style={{ width: `${diag.onboarding.percentComplete}%` }} /></div>
              </div>
            </div>

            {diag.recentFailedRuns.length > 0 && (
              <div className="rounded border border-red-200 p-4">
                <h2 className="mb-2 font-semibold text-red-700">Recent Failed Runs</h2>
                {diag.recentFailedRuns.map(r => (
                  <div key={r.id} className="flex justify-between border-b border-red-100 py-1 text-sm last:border-0">
                    <span className="font-mono text-xs">{r.id.slice(0, 8)}</span>
                    <span className="text-red-600">{r.error ?? "Unknown error"}</span>
                  </div>
                ))}
              </div>
            )}

            {diag.recentAlerts.length > 0 && (
              <div className="rounded border border-yellow-200 p-4">
                <h2 className="mb-2 font-semibold text-yellow-700">Recent Alerts</h2>
                {diag.recentAlerts.map(a => (
                  <div key={a.id} className="flex justify-between border-b border-yellow-100 py-1 text-sm last:border-0">
                    <span>{a.title}</span>
                    <span className={`rounded px-2 py-0.5 text-xs ${a.severity === "critical" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>{a.severity}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="text-xs text-gray-400">Generated at: {new Date(diag.generatedAt).toLocaleString()} | Secrets and tokens are never included in diagnostics.</div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
