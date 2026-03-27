"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { IconRevenue, IconPlus } from "@/components/icons";
import Link from "next/link";

interface RevenueOverview {
  accountCount: number;
  contactCount: number;
  dealCount: number;
  taskCount: number;
  openDealValueCents: number;
  dealsByStage: Record<string, number>;
  openTaskCount: number;
  recentSyncCount: number;
}

const STAGE_COLORS: Record<string, string> = {
  lead: "bg-[rgb(var(--color-info))]",
  qualified: "bg-[rgb(var(--color-brand))]",
  proposal: "bg-[rgb(var(--color-warning))]",
  negotiation: "bg-[rgb(var(--color-brand-dark))]",
  closed_won: "bg-[rgb(var(--color-success))]",
  closed_lost: "bg-[rgb(var(--color-error))]",
};

function SkeletonCards() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="stat-card">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton mt-2 h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="card">
          <div className="skeleton h-5 w-32" />
          <div className="skeleton mt-4 h-10 w-48" />
          <div className="mt-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-4 w-full" />
            ))}
          </div>
        </div>
        <div className="card">
          <div className="skeleton h-5 w-32" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-10 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RevenueOverviewPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const [overview, setOverview] = useState<RevenueOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) router.push("/auth/sign-in");
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!token) return;
    apiFetch<RevenueOverview>("/api/v1/revenue/overview", { token }).then((r) => {
      if (r.ok) setOverview(r.data);
      else setError(r.error.message);
      setLoading(false);
    });
  }, [token]);

  if (isLoading || !user) return null;

  const canWrite = role === "org_owner" || role === "org_admin" || role === "org_member";

  const totalDeals = overview
    ? Object.values(overview.dealsByStage).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="page-header flex items-start justify-between">
          <div>
            <h1 className="page-title">Revenue Workspace</h1>
            <p className="page-description">
              Manage your sales pipeline, accounts, contacts, and deals.
            </p>
          </div>
          {canWrite && (
            <div className="flex items-center gap-2">
              <Link
                href="/revenue/accounts/new"
                className="inline-flex items-center gap-2 rounded-lg bg-[rgb(var(--color-brand))] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[rgb(var(--color-brand-dark))]"
              >
                <IconPlus size={16} />
                New Account
              </Link>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="card border-[rgb(var(--color-error))] bg-[rgb(var(--color-error-bg))]">
            <p className="text-sm text-[rgb(var(--color-error))]">{error}</p>
          </div>
        )}

        {loading ? (
          <SkeletonCards />
        ) : overview ? (
          <>
            {/* Metric Cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Link href="/revenue/accounts" className="card-hover group">
                <span className="stat-label">Accounts</span>
                <span className="stat-value">{overview.accountCount}</span>
                <span className="mt-1 text-xs text-[rgb(var(--color-brand))] opacity-0 transition-opacity group-hover:opacity-100">
                  View all
                </span>
              </Link>
              <Link href="/revenue/contacts" className="card-hover group">
                <span className="stat-label">Contacts</span>
                <span className="stat-value">{overview.contactCount}</span>
                <span className="mt-1 text-xs text-[rgb(var(--color-brand))] opacity-0 transition-opacity group-hover:opacity-100">
                  View all
                </span>
              </Link>
              <Link href="/revenue/deals" className="card-hover group">
                <span className="stat-label">Deals</span>
                <span className="stat-value">{overview.dealCount}</span>
                <span className="mt-1 text-xs text-[rgb(var(--color-brand))] opacity-0 transition-opacity group-hover:opacity-100">
                  View all
                </span>
              </Link>
              <Link href="/revenue/tasks" className="card-hover group">
                <span className="stat-label">Tasks</span>
                <div className="flex items-baseline gap-2">
                  <span className="stat-value">{overview.taskCount}</span>
                  {overview.openTaskCount > 0 && (
                    <span className="badge-warning">{overview.openTaskCount} open</span>
                  )}
                </div>
                <span className="mt-1 text-xs text-[rgb(var(--color-brand))] opacity-0 transition-opacity group-hover:opacity-100">
                  View all
                </span>
              </Link>
            </div>

            {/* Pipeline & Actions Row */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Pipeline Overview */}
              <div className="card">
                <div className="section-header mb-4">
                  <h2 className="section-title">Pipeline Value</h2>
                  <span className="badge-info">{totalDeals} deals</span>
                </div>
                <p className="text-3xl font-bold text-[rgb(var(--color-text-primary))]">
                  ${(overview.openDealValueCents / 100).toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-[rgb(var(--color-text-tertiary))]">
                  Total open pipeline value
                </p>

                {/* Stage Breakdown */}
                <div className="mt-5 space-y-3">
                  {Object.entries(overview.dealsByStage).map(([stage, count]) => {
                    const pct = totalDeals > 0 ? (count / totalDeals) * 100 : 0;
                    return (
                      <div key={stage}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="capitalize text-[rgb(var(--color-text-secondary))]">
                            {stage.replace(/_/g, " ")}
                          </span>
                          <span className="font-medium text-[rgb(var(--color-text-primary))]">
                            {count}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[rgb(var(--color-bg-tertiary))]">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${
                              STAGE_COLORS[stage] ?? "bg-[rgb(var(--color-brand))]"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="card">
                <div className="section-header mb-4">
                  <h2 className="section-title">Quick Actions</h2>
                </div>
                <div className="space-y-3">
                  {canWrite && (
                    <>
                      <Link
                        href="/revenue/accounts/new"
                        className="flex items-center gap-3 rounded-lg border border-[rgb(var(--color-border-primary))] px-4 py-3 text-sm font-medium text-[rgb(var(--color-text-primary))] transition-all hover:border-[rgb(var(--color-brand))] hover:bg-[rgb(var(--color-bg-secondary))]"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgb(var(--color-info-bg))]">
                          <IconPlus size={16} className="text-[rgb(var(--color-info))]" />
                        </div>
                        <div>
                          <p>New Account</p>
                          <p className="text-xs text-[rgb(var(--color-text-tertiary))]">
                            Add a customer or prospect
                          </p>
                        </div>
                      </Link>
                      <Link
                        href="/revenue/deals/new"
                        className="flex items-center gap-3 rounded-lg border border-[rgb(var(--color-border-primary))] px-4 py-3 text-sm font-medium text-[rgb(var(--color-text-primary))] transition-all hover:border-[rgb(var(--color-brand))] hover:bg-[rgb(var(--color-bg-secondary))]"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgb(var(--color-success-bg))]">
                          <IconRevenue size={16} className="text-[rgb(var(--color-success))]" />
                        </div>
                        <div>
                          <p>New Deal</p>
                          <p className="text-xs text-[rgb(var(--color-text-tertiary))]">
                            Create a new pipeline opportunity
                          </p>
                        </div>
                      </Link>
                      <Link
                        href="/revenue/outreach"
                        className="flex items-center gap-3 rounded-lg border border-[rgb(var(--color-border-primary))] px-4 py-3 text-sm font-medium text-[rgb(var(--color-text-primary))] transition-all hover:border-[rgb(var(--color-brand))] hover:bg-[rgb(var(--color-bg-secondary))]"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgb(var(--color-warning-bg))]">
                          <IconRevenue size={16} className="text-[rgb(var(--color-warning))]" />
                        </div>
                        <div>
                          <p>Generate Outreach</p>
                          <p className="text-xs text-[rgb(var(--color-text-tertiary))]">
                            AI-powered outreach generation
                          </p>
                        </div>
                      </Link>
                    </>
                  )}
                </div>
                <div className="mt-4 border-t border-[rgb(var(--color-border-secondary))] pt-3">
                  <p className="text-xs text-[rgb(var(--color-text-tertiary))]">
                    Recent sync operations: <span className="font-medium">{overview.recentSyncCount}</span>
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
