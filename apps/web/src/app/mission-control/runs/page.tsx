"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import {
  IconRuns,
  IconSearch,
  IconChevronRight,
  IconClock,
} from "@/components/icons";

interface MCRun {
  id: string;
  agentId: string;
  agentName?: string;
  status: string;
  createdAt: string;
  durationMs?: number;
}

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "queued", label: "Queued" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "paused", label: "Paused" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];

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

function formatDuration(ms: number | undefined): string {
  if (ms == null) return "--";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="stat-card">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton mt-2 h-7 w-12" />
          </div>
        ))}
      </div>
      <div className="table-container">
        <div className="table-header px-4 py-3">
          <div className="skeleton h-3 w-32" />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="table-row px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="skeleton h-4 w-44" />
                <div className="skeleton h-3 w-56" />
              </div>
              <div className="skeleton h-5 w-16 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MCRunsListContent() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [runs, setRuns] = useState<MCRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>(
    (searchParams.get("status") as StatusFilter) || "all",
  );

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  const loadRuns = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const query = filter !== "all" ? `?status=${filter}` : "";
    const result = await apiFetch<MCRun[]>(
      `/api/v1/mission-control/runs${query}`,
      { token },
    );

    if (result.ok) {
      setRuns(result.data);
    } else {
      setError(result.error.message);
    }
    setLoading(false);
  }, [token, filter]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  if (isLoading || !user) return null;

  const filteredRuns = searchQuery.trim()
    ? runs.filter((r) => {
        const q = searchQuery.toLowerCase();
        return (
          r.agentName?.toLowerCase().includes(q) ||
          r.agentId.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q)
        );
      })
    : runs;

  const counts = {
    total: runs.length,
    running: runs.filter((r) => r.status === "running").length,
    failed: runs.filter((r) => r.status === "failed").length,
  };

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
          <span className="text-[rgb(var(--color-text-primary))]">Runs</span>
        </nav>

        {/* Page Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Runs</h1>
            <p className="page-description">
              Monitor and inspect all agent execution runs
            </p>
          </div>
        </div>

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

        {loading ? (
          <LoadingSkeleton />
        ) : (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="stat-card">
                <span className="stat-label">Total Runs</span>
                <span className="stat-value">{counts.total}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Running</span>
                <div className="flex items-center gap-2">
                  <span className="stat-value">{counts.running}</span>
                  {counts.running > 0 && (
                    <span className="status-dot-info-pulse" />
                  )}
                </div>
              </div>
              <div className="stat-card">
                <span className="stat-label">Failed</span>
                <span className="stat-value">{counts.failed}</span>
              </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative max-w-sm flex-1">
                <IconSearch
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-tertiary))]"
                />
                <input
                  type="text"
                  placeholder="Search runs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input pl-9"
                />
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-primary))] p-1">
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFilter(f.value)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      filter === f.value
                        ? "bg-[rgb(var(--color-brand))] text-white shadow-sm"
                        : "text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-bg-tertiary))] hover:text-[rgb(var(--color-text-primary))]"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Runs Table or Empty State */}
            {filteredRuns.length === 0 ? (
              <div className="empty-state">
                <IconRuns size={48} className="empty-state-icon" />
                <p className="empty-state-title">
                  {searchQuery
                    ? "No runs match your search"
                    : filter !== "all"
                      ? `No runs with status "${filter}"`
                      : "No runs found"}
                </p>
                <p className="empty-state-description">
                  {searchQuery
                    ? "Try adjusting your search query or filters."
                    : "Agent runs will appear here once agents begin executing."}
                </p>
              </div>
            ) : (
              <div className="table-container">
                <table className="w-full">
                  <thead>
                    <tr className="table-header">
                      <th className="px-4 py-3 text-left">Agent</th>
                      <th className="hidden px-4 py-3 text-left sm:table-cell">
                        Status
                      </th>
                      <th className="hidden px-4 py-3 text-left md:table-cell">
                        Duration
                      </th>
                      <th className="hidden px-4 py-3 text-left lg:table-cell">
                        Started
                      </th>
                      <th className="px-4 py-3 text-right">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRuns.map((run) => (
                      <tr
                        key={run.id}
                        className="table-row cursor-pointer"
                        onClick={() =>
                          router.push(`/mission-control/runs/${run.id}`)
                        }
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--color-bg-tertiary))]">
                              <IconRuns
                                size={18}
                                className="text-[rgb(var(--color-text-secondary))]"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-[rgb(var(--color-text-primary))]">
                                {run.agentName ?? run.agentId}
                              </p>
                              <p className="truncate text-xs text-[rgb(var(--color-text-tertiary))]">
                                {run.id}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3.5 sm:table-cell">
                          <span className={statusBadgeClass(run.status)}>
                            <span className={statusDotClass(run.status)} />
                            {run.status}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3.5 md:table-cell">
                          <div className="flex items-center gap-1.5 text-xs text-[rgb(var(--color-text-secondary))]">
                            <IconClock size={12} />
                            {formatDuration(run.durationMs)}
                          </div>
                        </td>
                        <td className="hidden px-4 py-3.5 text-xs text-[rgb(var(--color-text-tertiary))] lg:table-cell">
                          {new Date(run.createdAt).toLocaleDateString(
                            undefined,
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <IconChevronRight
                            size={16}
                            className="inline-block text-[rgb(var(--color-text-tertiary))]"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

export default function MCRunsListPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <LoadingSkeleton />
        </AppShell>
      }
    >
      <MCRunsListContent />
    </Suspense>
  );
}
