"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import {
  IconMissionControl,
  IconBell,
  IconRuns,
  IconClock,
  IconArrowUp,
  IconArrowDown,
} from "@/components/icons";
import Link from "next/link";

interface RunCounts {
  total: number;
  completed: number;
  failed: number;
  running: number;
  queued: number;
  cancelled: number;
  paused: number;
}

interface Overview {
  runs: RunCounts;
  avgQueueWaitMs: number | null;
  avgDurationMs: number | null;
  failureRate: number | null;
  tokenUsage: { inputTokens: number; outputTokens: number; totalTokens: number };
  estimatedCostCents: number;
  runsWithTools: number;
  runsWithBrowser: number;
  runsWithMemory: number;
  openAlerts: number;
  recentFailures: Array<{
    id: string;
    agentId: string;
    status: string;
    error?: { message: string; code?: string };
    createdAt: string;
    completedAt?: string;
  }>;
}

function formatMs(ms: number | null | undefined): string {
  if (ms == null) return "--";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function statusForRunStatus(status: string): string {
  const map: Record<string, string> = {
    running: "status-dot-success-pulse",
    queued: "status-dot-info",
    completed: "status-dot-success",
    failed: "status-dot-error",
    cancelled: "status-dot-neutral",
    pending_approval: "status-dot-warning",
    paused: "status-dot-warning",
  };
  return map[status] ?? "status-dot-neutral";
}

export default function MissionControlPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  const loadOverview = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const result = await apiFetch<Overview>("/api/v1/mission-control/overview", { token });

    if (result.ok) {
      setOverview(result.data);
    } else {
      setError(result.error.message);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(loadOverview, 30000);
    return () => clearInterval(interval);
  }, [token, loadOverview]);

  if (isLoading || !user) return null;

  const totalRuns = overview ? overview.runs.total : 0;
  const activeRuns = overview
    ? (overview.runs.running ?? 0) + (overview.runs.queued ?? 0)
    : 0;
  const failureRate = overview?.failureRate ?? 0;

  return (
    <AppShell>
      <div className="space-y-8">
        {/* Page header */}
        <div className="page-header flex items-start justify-between">
          <div>
            <h1 className="page-title">Mission Control</h1>
            <p className="page-description">
              Real-time observability for your agent fleet
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/mission-control/runs"
              className="inline-flex items-center gap-1.5 rounded-md bg-[rgb(var(--color-brand))] px-3.5 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
            >
              <IconRuns size={16} />
              All Runs
            </Link>
            <Link
              href="/mission-control/alerts"
              className="inline-flex items-center gap-1.5 rounded-md border border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-primary))] px-3.5 py-2 text-sm font-medium text-[rgb(var(--color-text-secondary))] transition-colors hover:bg-[rgb(var(--color-bg-secondary))]"
            >
              <IconBell size={16} />
              Alerts
              {overview && overview.openAlerts > 0 && (
                <span className="ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[rgb(var(--color-error))] px-1.5 text-xs font-bold text-white">
                  {overview.openAlerts}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="card border-[rgb(var(--color-error))] bg-[rgb(var(--color-error-bg,var(--color-bg-secondary)))]">
            <p className="text-sm text-[rgb(var(--color-error))]">{error}</p>
          </div>
        )}

        {/* Loading skeleton */}
        {loading ? (
          <div className="space-y-8">
            {/* Stats skeleton */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="stat-card">
                  <div className="skeleton h-3 w-20" />
                  <div className="skeleton h-8 w-16" />
                  <div className="skeleton h-3 w-24" />
                </div>
              ))}
            </div>
            {/* Run counts skeleton */}
            <div className="card space-y-4">
              <div className="skeleton h-5 w-32" />
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-2 rounded-lg bg-[rgb(var(--color-bg-secondary))] p-3">
                    <div className="skeleton h-3 w-14" />
                    <div className="skeleton h-6 w-10" />
                  </div>
                ))}
              </div>
            </div>
            {/* Bottom sections skeleton */}
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="card space-y-3">
                <div className="skeleton h-5 w-40" />
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="skeleton h-16 w-full rounded-lg" />
                ))}
              </div>
              <div className="card space-y-3">
                <div className="skeleton h-5 w-32" />
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="skeleton h-12 w-full rounded-lg" />
                ))}
              </div>
            </div>
          </div>
        ) : !overview ? (
          <div className="empty-state">
            <IconMissionControl className="empty-state-icon" size={48} />
            <p className="empty-state-title">No observability data available</p>
            <p className="empty-state-description">
              Run some agents to start seeing metrics here.
            </p>
          </div>
        ) : (
          <>
            {/* ── Primary Stats Row ── */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="stat-card">
                <span className="stat-label">Total Runs</span>
                <span className="stat-value">{totalRuns.toLocaleString()}</span>
                <span className="text-xs text-[rgb(var(--color-text-tertiary))]">
                  across all statuses
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Active Now</span>
                <div className="flex items-center gap-2">
                  <span className="stat-value">{activeRuns}</span>
                  {activeRuns > 0 && <span className="status-dot-success-pulse" />}
                </div>
                <span className="text-xs text-[rgb(var(--color-text-tertiary))]">
                  running + queued
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Error Rate</span>
                <div className="flex items-center gap-2">
                  <span className="stat-value">
                    {failureRate.toFixed(1)}%
                  </span>
                  {failureRate > 5 ? (
                    <IconArrowUp size={14} className="text-[rgb(var(--color-error))]" />
                  ) : (
                    <IconArrowDown size={14} className="text-[rgb(var(--color-success))]" />
                  )}
                </div>
                <span className="text-xs text-[rgb(var(--color-text-tertiary))]">
                  {failureRate > 5 ? "above threshold" : "healthy"}
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Avg Latency</span>
                <span className="stat-value">{overview.avgDurationMs != null ? formatMs(overview.avgDurationMs) : "--"}</span>
                <span className="text-xs text-[rgb(var(--color-text-tertiary))]">
                  queue: {overview.avgQueueWaitMs != null ? formatMs(overview.avgQueueWaitMs) : "--"}
                </span>
              </div>
            </div>

            {/* ── Run Counts by Status ── */}
            <div className="card">
              <div className="section-header mb-4">
                <h2 className="section-title">Run Status Breakdown</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
                {(["running", "queued", "completed", "failed", "cancelled", "paused"] as const).map((status) => (
                  <div
                    key={status}
                    className="flex flex-col gap-1.5 rounded-lg bg-[rgb(var(--color-bg-secondary))] p-3"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={statusForRunStatus(status)} />
                      <span className="text-xs font-medium capitalize text-[rgb(var(--color-text-secondary))]">
                        {status.replace("_", " ")}
                      </span>
                    </div>
                    <span className="text-xl font-semibold text-[rgb(var(--color-text-primary))]">
                      {(overview.runs[status] ?? 0).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Token Usage + Feature Usage ── */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Token Usage */}
              <div className="card">
                <div className="section-header mb-4">
                  <h2 className="section-title">Token Usage</h2>
                  <span className="text-sm font-semibold text-[rgb(var(--color-brand))]">
                    ${(overview.estimatedCostCents / 100).toFixed(2)}
                  </span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg bg-[rgb(var(--color-bg-secondary))] p-3">
                    <span className="text-sm text-[rgb(var(--color-text-secondary))]">Input</span>
                    <span className="font-mono text-sm font-medium text-[rgb(var(--color-text-primary))]">
                      {overview.tokenUsage.inputTokens.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-[rgb(var(--color-bg-secondary))] p-3">
                    <span className="text-sm text-[rgb(var(--color-text-secondary))]">Output</span>
                    <span className="font-mono text-sm font-medium text-[rgb(var(--color-text-primary))]">
                      {overview.tokenUsage.outputTokens.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-[rgb(var(--color-border-secondary))] p-3">
                    <span className="text-sm font-medium text-[rgb(var(--color-text-primary))]">Total</span>
                    <span className="font-mono text-sm font-bold text-[rgb(var(--color-text-primary))]">
                      {overview.tokenUsage.totalTokens.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Feature Usage */}
              <div className="card">
                <div className="section-header mb-4">
                  <h2 className="section-title">Feature Usage</h2>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg bg-[rgb(var(--color-bg-secondary))] p-3">
                    <div className="flex items-center gap-2">
                      <span className="status-dot-info" />
                      <span className="text-sm text-[rgb(var(--color-text-secondary))]">Runs with Tools</span>
                    </div>
                    <span className="font-mono text-sm font-medium text-[rgb(var(--color-text-primary))]">
                      {overview.runsWithTools.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-[rgb(var(--color-bg-secondary))] p-3">
                    <div className="flex items-center gap-2">
                      <span className="status-dot-success" />
                      <span className="text-sm text-[rgb(var(--color-text-secondary))]">Runs with Browser</span>
                    </div>
                    <span className="font-mono text-sm font-medium text-[rgb(var(--color-text-primary))]">
                      {overview.runsWithBrowser.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-[rgb(var(--color-bg-secondary))] p-3">
                    <div className="flex items-center gap-2">
                      <span className="status-dot-warning" />
                      <span className="text-sm text-[rgb(var(--color-text-secondary))]">Runs with Memory</span>
                    </div>
                    <span className="font-mono text-sm font-medium text-[rgb(var(--color-text-primary))]">
                      {overview.runsWithMemory.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── System Health + Recent Failures ── */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* System Health Cards */}
              <div className="card">
                <div className="section-header mb-4">
                  <h2 className="section-title">System Health</h2>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg bg-[rgb(var(--color-bg-secondary))] p-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          failureRate < 5
                            ? "status-dot-success-pulse"
                            : failureRate < 15
                              ? "status-dot-warning"
                              : "status-dot-error"
                        }
                      />
                      <span className="text-sm font-medium text-[rgb(var(--color-text-primary))]">
                        Agent Runtime
                      </span>
                    </div>
                    <span
                      className={
                        failureRate < 5
                          ? "badge-success"
                          : failureRate < 15
                            ? "badge-warning"
                            : "badge-error"
                      }
                    >
                      {failureRate < 5
                        ? "Healthy"
                        : failureRate < 15
                          ? "Degraded"
                          : "Unhealthy"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-[rgb(var(--color-bg-secondary))] p-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          (overview.avgQueueWaitMs ?? 0) < 5000
                            ? "status-dot-success-pulse"
                            : "status-dot-warning"
                        }
                      />
                      <span className="text-sm font-medium text-[rgb(var(--color-text-primary))]">
                        Queue Latency
                      </span>
                    </div>
                    <span
                      className={
                        (overview.avgQueueWaitMs ?? 0) < 5000 ? "badge-success" : "badge-warning"
                      }
                    >
                      {overview.avgQueueWaitMs != null ? formatMs(overview.avgQueueWaitMs) : "--"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-[rgb(var(--color-bg-secondary))] p-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          overview.openAlerts === 0
                            ? "status-dot-success-pulse"
                            : "status-dot-error"
                        }
                      />
                      <span className="text-sm font-medium text-[rgb(var(--color-text-primary))]">
                        Open Alerts
                      </span>
                    </div>
                    <span
                      className={
                        overview.openAlerts === 0 ? "badge-success" : "badge-error"
                      }
                    >
                      {overview.openAlerts === 0
                        ? "Clear"
                        : `${overview.openAlerts} alert${overview.openAlerts !== 1 ? "s" : ""}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Recent Failures */}
              <div className="card">
                <div className="section-header mb-4">
                  <h2 className="section-title">Recent Failures</h2>
                  <Link
                    href="/mission-control/alerts"
                    className="text-xs font-medium text-[rgb(var(--color-brand))] hover:underline"
                  >
                    View all
                  </Link>
                </div>
                {overview.recentFailures.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[rgb(var(--color-border-primary))] py-10 text-center">
                    <IconMissionControl
                      size={32}
                      className="text-[rgb(var(--color-text-tertiary))]"
                    />
                    <p className="text-sm text-[rgb(var(--color-text-secondary))]">
                      No recent failures
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {overview.recentFailures.slice(0, 5).map((f) => (
                      <Link
                        key={f.id}
                        href={`/mission-control/runs/${f.id}`}
                        className="group flex items-start gap-3 rounded-lg border border-[rgb(var(--color-border-secondary))] p-3 transition-colors hover:border-[rgb(var(--color-error))] hover:bg-[rgb(var(--color-bg-secondary))]"
                      >
                        <span className="status-dot-error mt-1.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[rgb(var(--color-text-primary))] group-hover:text-[rgb(var(--color-error))] transition-colors">
                            {f.agentId ? f.agentId.slice(0, 12) + "..." : f.id.slice(0, 12) + "..."}
                          </p>
                          {f.error?.message && (
                            <p className="mt-0.5 truncate text-xs text-[rgb(var(--color-text-tertiary))]">
                              {f.error.message}
                            </p>
                          )}
                          <div className="mt-1 flex items-center gap-1 text-xs text-[rgb(var(--color-text-tertiary))]">
                            <IconClock size={12} />
                            {new Date(f.completedAt ?? f.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
