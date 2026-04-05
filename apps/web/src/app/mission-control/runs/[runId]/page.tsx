"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import {
  IconRuns,
  IconBrowser,
  IconMemory,
  IconClock,
  IconChevronRight,
} from "@/components/icons";

/* ── Types matching the API response from mission-control.service.ts ── */

interface RunStep {
  id: string;
  type: string;
  toolName?: string;
  status: string;
  latencyMs?: number;
  stepNumber: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

interface BrowserSession {
  id: string;
  status: string;
  browserType: string;
  currentUrl: string | null;
  humanTakeover: boolean;
  createdAt: string;
  endedAt: string | null;
}

interface ToolUsageItem {
  toolName: string;
  count: number;
  totalLatencyMs: number;
}

interface MemoryUsageSummary {
  memoriesRetrieved: number;
  memoriesWritten: number;
}

interface RunDetailResponse {
  run: {
    id: string;
    agentId: string;
    status: string;
    tokenUsage?: { inputTokens: number; outputTokens: number; totalTokens: number };
    costCents?: number;
    error?: { message: string; code?: string };
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
  };
  steps: RunStep[];
  browserSessions: BrowserSession[];
  toolUsage: ToolUsageItem[];
  memoryUsage: MemoryUsageSummary;
  timeline: RunStep[];
  queueWaitMs: number | null;
  durationMs: number | null;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "completed":
      return "badge-success";
    case "running":
    case "starting":
      return "badge-info";
    case "queued":
      return "badge-neutral";
    case "paused":
      return "badge-warning";
    case "failed":
    case "cancelled":
    case "cancelling":
      return "badge-error";
    default:
      return "badge-neutral";
  }
}

function statusDotClass(status: string): string {
  switch (status) {
    case "completed":
      return "status-dot-success";
    case "running":
    case "starting":
      return "status-dot-info";
    case "paused":
      return "status-dot-warning";
    case "failed":
    case "cancelled":
    case "cancelling":
      return "status-dot-error";
    default:
      return "status-dot-neutral";
  }
}

function formatDuration(ms: number | undefined | null): string {
  if (ms == null) return "--";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-4 w-48" />
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="skeleton h-7 w-40" />
          <div className="skeleton h-3 w-64" />
        </div>
        <div className="skeleton h-6 w-20 rounded-full" />
      </div>
      <div className="card space-y-4 p-6">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="space-y-2">
              <div className="skeleton h-3 w-20" />
              <div className="skeleton h-4 w-28" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <div className="skeleton h-5 w-24" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="skeleton h-4 w-36" />
                <div className="skeleton h-3 w-48" />
              </div>
              <div className="skeleton h-5 w-16 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MCRunDetailPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const runId = params.runId as string;

  const [detail, setDetail] = useState<RunDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  const loadRun = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const result = await apiFetch<RunDetailResponse>(
      `/api/v1/mission-control/runs/${runId}`,
      { token },
    );

    if (result.ok) {
      setDetail(result.data);
    } else {
      setError(result.error.message);
    }
    setLoading(false);
  }, [token, runId]);

  useEffect(() => {
    loadRun();
  }, [loadRun]);

  if (isLoading || !user) return null;

  if (loading) {
    return (
      <AppShell>
        <LoadingSkeleton />
      </AppShell>
    );
  }

  if (!detail) {
    return (
      <AppShell>
        <div className="empty-state">
          <IconRuns size={48} className="empty-state-icon" />
          <p className="empty-state-title">Run not found</p>
          <p className="empty-state-description">
            {error ?? "The requested run could not be loaded."}
          </p>
          <Link
            href="/mission-control/runs"
            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-[rgb(var(--color-brand))] transition-colors hover:text-[rgb(var(--color-brand-dark))]"
          >
            Back to Runs
          </Link>
        </div>
      </AppShell>
    );
  }

  const run = detail.run;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="breadcrumb">
          <Link
            href="/mission-control"
            className="text-[rgb(var(--color-text-tertiary))] transition-colors hover:text-[rgb(var(--color-text-primary))]"
          >
            Mission Control
          </Link>
          <span className="breadcrumb-separator">/</span>
          <Link
            href="/mission-control/runs"
            className="text-[rgb(var(--color-text-tertiary))] transition-colors hover:text-[rgb(var(--color-text-primary))]"
          >
            Runs
          </Link>
          <span className="breadcrumb-separator">/</span>
          <span className="text-[rgb(var(--color-text-primary))]">Detail</span>
        </nav>

        {/* Error Banner */}
        {error && (
          <div className="flex items-center gap-3 rounded-lg border border-[rgb(var(--color-error)/0.3)] bg-[rgb(var(--color-error-bg))] px-4 py-3 text-sm text-[rgb(var(--color-error))]">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {/* Run Header */}
        <div className="page-header flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="page-title">
              Run {run.id.slice(0, 8)}
            </h1>
            <p className="page-description">
              <code className="rounded bg-[rgb(var(--color-bg-tertiary))] px-1.5 py-0.5 text-xs text-[rgb(var(--color-text-secondary))]">
                {run.id}
              </code>
            </p>
          </div>
          <span className={statusBadgeClass(run.status)}>
            <span className={statusDotClass(run.status)} />
            {run.status}
          </span>
        </div>

        {/* Run Metadata Card */}
        <div className="card p-6">
          <div className="section-header mb-4">
            <h2 className="section-title">Run Information</h2>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-[rgb(var(--color-text-tertiary))]">
                Agent
              </dt>
              <dd className="mt-1 text-[rgb(var(--color-text-primary))]">
                {run.agentId}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-[rgb(var(--color-text-tertiary))]">
                Duration
              </dt>
              <dd className="mt-1 flex items-center gap-1.5 text-[rgb(var(--color-text-primary))]">
                <IconClock size={12} className="text-[rgb(var(--color-text-tertiary))]" />
                {formatDuration(detail.durationMs)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-[rgb(var(--color-text-tertiary))]">
                Queue Wait
              </dt>
              <dd className="mt-1 text-[rgb(var(--color-text-primary))]">
                {formatDuration(detail.queueWaitMs)}
              </dd>
            </div>
            {run.tokenUsage && (
              <div className="col-span-2 sm:col-span-1">
                <dt className="text-xs font-medium uppercase tracking-wider text-[rgb(var(--color-text-tertiary))]">
                  Tokens (In / Out / Total)
                </dt>
                <dd className="mt-1 text-[rgb(var(--color-text-primary))]">
                  {run.tokenUsage.inputTokens.toLocaleString()} /{" "}
                  {run.tokenUsage.outputTokens.toLocaleString()} /{" "}
                  {run.tokenUsage.totalTokens.toLocaleString()}
                </dd>
              </div>
            )}
            {run.costCents != null && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-[rgb(var(--color-text-tertiary))]">
                  Est. Cost
                </dt>
                <dd className="mt-1 font-medium text-[rgb(var(--color-text-primary))]">
                  ${(run.costCents / 100).toFixed(4)}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-[rgb(var(--color-text-tertiary))]">
                Created
              </dt>
              <dd className="mt-1 text-[rgb(var(--color-text-primary))]">
                {new Date(run.createdAt).toLocaleString()}
              </dd>
            </div>
            {run.startedAt && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-[rgb(var(--color-text-tertiary))]">
                  Started
                </dt>
                <dd className="mt-1 text-[rgb(var(--color-text-primary))]">
                  {new Date(run.startedAt).toLocaleString()}
                </dd>
              </div>
            )}
            {run.completedAt && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-[rgb(var(--color-text-tertiary))]">
                  Completed
                </dt>
                <dd className="mt-1 text-[rgb(var(--color-text-primary))]">
                  {new Date(run.completedAt).toLocaleString()}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Error Detail */}
        {run.status === "failed" && run.error && (
          <div className="rounded-lg border border-[rgb(var(--color-error)/0.3)] bg-[rgb(var(--color-error-bg))] p-4">
            <p className="text-sm font-medium text-[rgb(var(--color-error))]">
              Error
            </p>
            <pre className="mt-2 whitespace-pre-wrap text-sm text-[rgb(var(--color-error)/0.8)]">
              {typeof run.error === "string" ? run.error : run.error.message}
            </pre>
          </div>
        )}

        {/* Timeline / Steps */}
        <div>
          <div className="section-header mb-4">
            <h2 className="section-title">Timeline</h2>
          </div>
          {detail.steps.length === 0 ? (
            <div className="empty-state">
              <IconRuns size={40} className="empty-state-icon" />
              <p className="empty-state-title">No steps recorded</p>
              <p className="empty-state-description">
                Steps will appear here as the run progresses.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {detail.steps.map((step, index) => (
                <div key={step.id} className="card card-hover p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--color-bg-tertiary))] text-xs font-medium text-[rgb(var(--color-text-secondary))]">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[rgb(var(--color-text-primary))]">
                          {step.toolName ?? step.type}
                        </p>
                        <p className="text-xs text-[rgb(var(--color-text-tertiary))]">
                          {step.type}
                          {step.latencyMs != null && (
                            <> &middot; {formatDuration(step.latencyMs)}</>
                          )}
                          {step.startedAt && (
                            <>
                              {" "}
                              &middot;{" "}
                              {new Date(step.startedAt).toLocaleTimeString()}
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    <span className={statusBadgeClass(step.status)}>
                      <span className={statusDotClass(step.status)} />
                      {step.status}
                    </span>
                  </div>
                  {step.error && (
                    <pre className="mt-3 rounded-md bg-[rgb(var(--color-error-bg))] p-3 text-xs text-[rgb(var(--color-error))]">
                      {step.error}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Browser Sessions */}
        <div>
          <div className="section-header mb-4">
            <h2 className="section-title">Browser Sessions</h2>
          </div>
          {detail.browserSessions.length === 0 ? (
            <div className="empty-state">
              <IconBrowser size={40} className="empty-state-icon" />
              <p className="empty-state-title">No browser sessions</p>
              <p className="empty-state-description">
                This run did not use browser automation.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {detail.browserSessions.map((session) => (
                <Link
                  key={session.id}
                  href={`/browser-sessions/${session.id}`}
                  className="card card-hover flex items-center justify-between p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--color-bg-tertiary))]">
                      <IconBrowser
                        size={18}
                        className="text-[rgb(var(--color-text-secondary))]"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[rgb(var(--color-text-primary))]">
                        {session.id}
                      </p>
                      <p className="text-xs text-[rgb(var(--color-text-tertiary))]">
                        {session.browserType} &middot; {new Date(session.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={statusBadgeClass(session.status)}>
                      <span className={statusDotClass(session.status)} />
                      {session.status}
                    </span>
                    <IconChevronRight
                      size={16}
                      className="text-[rgb(var(--color-text-tertiary))]"
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Tool Usage */}
        <div>
          <div className="section-header mb-4">
            <h2 className="section-title">Tool Usage</h2>
          </div>
          {detail.toolUsage.length === 0 ? (
            <div className="empty-state">
              <IconRuns size={40} className="empty-state-icon" />
              <p className="empty-state-title">No tools used</p>
              <p className="empty-state-description">
                This run did not invoke any tools.
              </p>
            </div>
          ) : (
            <div className="table-container">
              <table className="w-full">
                <thead>
                  <tr className="table-header">
                    <th className="px-4 py-3 text-left">Tool</th>
                    <th className="px-4 py-3 text-right">Calls</th>
                    <th className="px-4 py-3 text-right">Avg Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.toolUsage.map((tool) => (
                    <tr key={tool.toolName} className="table-row">
                      <td className="px-4 py-3 text-sm font-medium text-[rgb(var(--color-text-primary))]">
                        {tool.toolName}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-[rgb(var(--color-text-secondary))]">
                        {tool.count}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-[rgb(var(--color-text-secondary))]">
                        {formatDuration(tool.count > 0 ? Math.round(tool.totalLatencyMs / tool.count) : 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Memory Usage */}
        <div>
          <div className="section-header mb-4">
            <h2 className="section-title">Memory Usage</h2>
          </div>
          <div className="card p-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--color-bg-tertiary))]">
                  <IconMemory
                    size={20}
                    className="text-[rgb(var(--color-text-secondary))]"
                  />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-[rgb(var(--color-text-tertiary))]">
                    Retrieved
                  </p>
                  <p className="text-lg font-semibold text-[rgb(var(--color-text-primary))]">
                    {detail.memoryUsage.memoriesRetrieved}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--color-bg-tertiary))]">
                  <IconMemory
                    size={20}
                    className="text-[rgb(var(--color-text-secondary))]"
                  />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-[rgb(var(--color-text-tertiary))]">
                    Written
                  </p>
                  <p className="text-lg font-semibold text-[rgb(var(--color-text-primary))]">
                    {detail.memoryUsage.memoriesWritten}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
