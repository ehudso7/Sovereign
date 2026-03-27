"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { IconSupport } from "@/components/icons";

interface Diagnostics {
  orgId: string;
  generatedAt: string;
  platform: {
    agentCount: number;
    publishedAgentCount: number;
    runCount: number;
    failedRunCount: number;
    connectorCount: number;
    browserSessionCount: number;
    alertCount: number;
    openAlertCount: number;
  };
  billing: {
    plan: string;
    status: string;
    billingEmail: string | null;
  } | null;
  recentFailedRuns: {
    id: string;
    status: string;
    error: string | null;
    createdAt: string;
  }[];
  recentAlerts: {
    id: string;
    severity: string;
    title: string;
    status: string;
  }[];
  onboarding: {
    percentComplete: number;
    completedCount: number;
    totalCount: number;
  };
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="card-hover flex flex-col">
      <span className="text-2xl font-bold text-[rgb(var(--color-text-primary))]">
        {value}
      </span>
      <span className="text-xs text-[rgb(var(--color-text-tertiary))]">
        {label}
      </span>
      {sub && (
        <span className="mt-0.5 text-xs text-[rgb(var(--color-text-secondary))]">
          {sub}
        </span>
      )}
    </div>
  );
}

export default function SupportPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const [diag, setDiag] = useState<Diagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) router.push("/auth/sign-in");
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!token) return;
    apiFetch<Diagnostics>("/api/v1/support/diagnostics", { token }).then(
      (r) => {
        if (r.ok) setDiag(r.data);
        else setError(r.error.message);
        setLoading(false);
      },
    );
  }, [token]);

  if (isLoading || !user) return null;

  const forbidden = role === "org_member" || role === "org_billing_admin";
  if (forbidden) {
    return (
      <AppShell>
        <div className="empty-state">
          <IconSupport size={40} />
          <h3 className="mt-3 text-sm font-medium text-[rgb(var(--color-text-primary))]">
            Access Restricted
          </h3>
          <p className="mt-1 text-sm text-[rgb(var(--color-text-tertiary))]">
            You don&apos;t have permission to view support diagnostics.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="page-header">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[rgb(var(--color-bg-secondary))] p-2 text-[rgb(var(--color-text-tertiary))]">
              <IconSupport size={22} />
            </div>
            <div>
              <h1 className="page-title">Support Diagnostics</h1>
              <p className="page-description">
                Org-scoped platform health summary
              </p>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-[rgb(var(--color-error)/0.3)] bg-[rgb(var(--color-error)/0.08)] px-4 py-3 text-sm text-[rgb(var(--color-error))]">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card space-y-2">
                  <div className="skeleton h-8 w-12" />
                  <div className="skeleton h-3 w-24" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="card space-y-3">
                <div className="skeleton h-5 w-20" />
                <div className="skeleton h-4 w-full" />
                <div className="skeleton h-4 w-3/4" />
              </div>
              <div className="card space-y-3">
                <div className="skeleton h-5 w-24" />
                <div className="skeleton h-3 w-full rounded-full" />
              </div>
            </div>
          </div>
        ) : diag ? (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard
                label="Agents"
                value={diag.platform.agentCount}
                sub={`${diag.platform.publishedAgentCount} published`}
              />
              <StatCard
                label="Runs"
                value={diag.platform.runCount}
                sub={`${diag.platform.failedRunCount} failed`}
              />
              <StatCard
                label="Connectors"
                value={diag.platform.connectorCount}
              />
              <StatCard
                label="Open Alerts"
                value={diag.platform.openAlertCount}
              />
            </div>

            {/* Billing and Onboarding */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="card">
                <div className="section-header">
                  <h2 className="section-title">Billing</h2>
                </div>
                {diag.billing ? (
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-[rgb(var(--color-text-tertiary))]">
                        Plan
                      </span>
                      <span className="badge-info">{diag.billing.plan}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[rgb(var(--color-text-tertiary))]">
                        Status
                      </span>
                      <span
                        className={
                          diag.billing.status === "active"
                            ? "badge-success"
                            : "badge-error"
                        }
                      >
                        {diag.billing.status}
                      </span>
                    </div>
                    {diag.billing.billingEmail && (
                      <div className="flex items-center justify-between">
                        <span className="text-[rgb(var(--color-text-tertiary))]">
                          Email
                        </span>
                        <span className="text-[rgb(var(--color-text-secondary))]">
                          {diag.billing.billingEmail}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-[rgb(var(--color-text-tertiary))]">
                    No billing account configured.
                  </p>
                )}
              </div>
              <div className="card">
                <div className="section-header">
                  <h2 className="section-title">Onboarding</h2>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[rgb(var(--color-text-secondary))]">
                      {diag.onboarding.percentComplete}% complete
                    </span>
                    <span className="text-[rgb(var(--color-text-tertiary))]">
                      {diag.onboarding.completedCount}/
                      {diag.onboarding.totalCount}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[rgb(var(--color-bg-tertiary))]">
                    <div
                      className="h-full rounded-full bg-[rgb(var(--color-brand))] transition-all duration-300"
                      style={{
                        width: `${diag.onboarding.percentComplete}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Failed Runs */}
            {diag.recentFailedRuns.length > 0 && (
              <div className="card border-[rgb(var(--color-error)/0.2)]">
                <div className="section-header">
                  <h2 className="section-title text-[rgb(var(--color-error))]">
                    Recent Failed Runs
                  </h2>
                  <span className="badge-error">
                    {diag.recentFailedRuns.length}
                  </span>
                </div>
                <div className="mt-3 space-y-0">
                  {diag.recentFailedRuns.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between border-b border-[rgb(var(--color-border-primary))] py-2.5 text-sm last:border-0"
                    >
                      <span className="font-mono text-xs text-[rgb(var(--color-text-tertiary))]">
                        {r.id.slice(0, 8)}
                      </span>
                      <span className="text-[rgb(var(--color-error))]">
                        {r.error ?? "Unknown error"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Alerts */}
            {diag.recentAlerts.length > 0 && (
              <div className="card border-[rgb(var(--color-warning,234_179_8)/0.2)]">
                <div className="section-header">
                  <h2 className="section-title">Recent Alerts</h2>
                  <span className="badge-neutral">
                    {diag.recentAlerts.length}
                  </span>
                </div>
                <div className="mt-3 space-y-0">
                  {diag.recentAlerts.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between border-b border-[rgb(var(--color-border-primary))] py-2.5 text-sm last:border-0"
                    >
                      <span className="text-[rgb(var(--color-text-primary))]">
                        {a.title}
                      </span>
                      <span
                        className={
                          a.severity === "critical"
                            ? "badge-error"
                            : "badge-neutral"
                        }
                      >
                        {a.severity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <p className="text-xs text-[rgb(var(--color-text-tertiary))]">
              Generated at:{" "}
              {new Date(diag.generatedAt).toLocaleString()} | Secrets and
              tokens are never included in diagnostics.
            </p>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
