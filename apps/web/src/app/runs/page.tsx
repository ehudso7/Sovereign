"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { IconRuns, IconSearch, IconClock, IconChevronRight } from "@/components/icons";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Run {
  id: string;
  agentId: string;
  agentName?: string;
  status: string;
  trigger: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_FILTERS = ["all", "running", "completed", "failed", "queued", "cancelled", "paused"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: "All",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  queued: "Queued",
  cancelled: "Cancelled",
  paused: "Paused",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "completed":
      return "badge-success";
    case "failed":
      return "badge-error";
    case "running":
    case "starting":
      return "badge-info";
    case "paused":
    case "cancelling":
      return "badge-warning";
    case "queued":
    case "cancelled":
    default:
      return "badge-neutral";
  }
}

function getStatusDotClass(status: string): string {
  switch (status) {
    case "completed":
      return "status-dot-success";
    case "failed":
      return "status-dot-error";
    case "running":
      return "status-dot-success-pulse";
    case "starting":
      return "status-dot-info";
    case "paused":
    case "cancelling":
      return "status-dot-warning";
    case "queued":
    case "cancelled":
    default:
      return "status-dot-neutral";
  }
}

function formatDuration(start: string, end?: string): string {
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  const diffMs = endMs - startMs;

  if (diffMs < 1000) return "<1s";
  if (diffMs < 60_000) return `${Math.floor(diffMs / 1000)}s`;
  if (diffMs < 3_600_000) {
    const mins = Math.floor(diffMs / 60_000);
    const secs = Math.floor((diffMs % 60_000) / 1000);
    return `${mins}m ${secs}s`;
  }
  const hrs = Math.floor(diffMs / 3_600_000);
  const mins = Math.floor((diffMs % 3_600_000) / 60_000);
  return `${hrs}h ${mins}m`;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);

  if (diffSecs < 60) return "just now";
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
  if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
  if (diffSecs < 604800) return `${Math.floor(diffSecs / 86400)}d ago`;
  return date.toLocaleDateString();
}

function truncateId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}...`;
}

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={getStatusBadgeClass(status)}>
      <span className={getStatusDotClass(status)} />
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Stats Bar
// ---------------------------------------------------------------------------

function StatsBar({ runs, loading }: { runs: Run[]; loading: boolean }) {
  const stats = useMemo(() => {
    const total = runs.length;
    const running = runs.filter((r) => r.status === "running" || r.status === "starting").length;
    const failed = runs.filter((r) => r.status === "failed").length;
    const completed = runs.filter((r) => r.status === "completed").length;
    return { total, running, failed, completed };
  }, [runs]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="stat-card">
            <div className="skeleton h-3 w-16" />
            <div className="skeleton mt-1 h-7 w-10" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div className="stat-card">
        <span className="stat-label">Total Runs</span>
        <span className="stat-value">{stats.total}</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Running</span>
        <div className="flex items-center gap-2">
          <span className="stat-value">{stats.running}</span>
          {stats.running > 0 && <span className="status-dot-success-pulse" />}
        </div>
      </div>
      <div className="stat-card">
        <span className="stat-label">Completed</span>
        <span className="stat-value">{stats.completed}</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Failed</span>
        <div className="flex items-center gap-2">
          <span className="stat-value">{stats.failed}</span>
          {stats.failed > 0 && <span className="status-dot-error" />}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter Bar
// ---------------------------------------------------------------------------

function FilterBar({
  filter,
  onFilterChange,
  search,
  onSearchChange,
}: {
  filter: StatusFilter;
  onFilterChange: (f: StatusFilter) => void;
  search: string;
  onSearchChange: (s: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-1">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => onFilterChange(s)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
              filter === s
                ? "bg-[rgb(var(--color-brand))] text-white"
                : "bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-bg-inset))] hover:text-[rgb(var(--color-text-primary))]"
            }`}
          >
            {STATUS_FILTER_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative w-full sm:w-72">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <IconSearch size={16} className="text-[rgb(var(--color-text-tertiary))]" />
        </div>
        <input
          type="text"
          placeholder="Search by run ID or agent..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="input pl-9"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton table rows
// ---------------------------------------------------------------------------

function TableSkeleton() {
  return (
    <div className="table-container">
      <table className="w-full">
        <thead>
          <tr className="table-header">
            <th className="px-4 py-3 text-left">Run ID</th>
            <th className="px-4 py-3 text-left">Agent</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-left">Started</th>
            <th className="px-4 py-3 text-left">Duration</th>
            <th className="px-4 py-3 text-right" />
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }).map((_, i) => (
            <tr key={i} className="table-row">
              <td className="px-4 py-3"><div className="skeleton h-4 w-24" /></td>
              <td className="px-4 py-3"><div className="skeleton h-4 w-32" /></td>
              <td className="px-4 py-3"><div className="skeleton h-5 w-20 rounded-full" /></td>
              <td className="px-4 py-3"><div className="skeleton h-4 w-16" /></td>
              <td className="px-4 py-3"><div className="skeleton h-4 w-14" /></td>
              <td className="px-4 py-3"><div className="skeleton h-4 w-4" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Runs Table
// ---------------------------------------------------------------------------

function RunsTable({ runs }: { runs: Run[] }) {
  return (
    <div className="table-container">
      <table className="w-full">
        <thead>
          <tr className="table-header">
            <th className="px-4 py-3 text-left">Run ID</th>
            <th className="px-4 py-3 text-left">Agent</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-left">Started</th>
            <th className="px-4 py-3 text-left">Duration</th>
            <th className="px-4 py-3 text-right" />
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} className="table-row">
              <td className="px-4 py-3">
                <Link
                  href={`/runs/${run.id}`}
                  className="font-mono text-sm font-medium text-[rgb(var(--color-brand))] hover:underline"
                >
                  {truncateId(run.id)}
                </Link>
              </td>
              <td className="px-4 py-3">
                <span className="text-sm text-[rgb(var(--color-text-primary))]">
                  {run.agentName ?? run.agentId}
                </span>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={run.status} />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5 text-sm text-[rgb(var(--color-text-secondary))]">
                  <IconClock size={14} className="text-[rgb(var(--color-text-tertiary))]" />
                  <span title={new Date(run.createdAt).toLocaleString()}>
                    {formatRelativeTime(run.createdAt)}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3">
                <span className="text-sm text-[rgb(var(--color-text-secondary))]">
                  {run.startedAt
                    ? formatDuration(run.startedAt, run.completedAt)
                    : "--"}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/runs/${run.id}`}
                  className="inline-flex items-center text-[rgb(var(--color-text-tertiary))] transition-colors hover:text-[rgb(var(--color-text-primary))]"
                >
                  <IconChevronRight size={16} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Content
// ---------------------------------------------------------------------------

function RunsListContent() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [runs, setRuns] = useState<Run[]>([]);
  const [allRuns, setAllRuns] = useState<Run[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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

    const result = await apiFetch<Run[]>("/api/v1/runs", { token });

    if (result.ok) {
      setAllRuns(result.data);
    } else {
      setError(result.error.message);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  // Apply client-side filter and search
  useEffect(() => {
    let filtered = allRuns;

    if (filter !== "all") {
      filtered = filtered.filter((r) => r.status === filter);
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter(
        (r) =>
          r.id.toLowerCase().includes(q) ||
          (r.agentName ?? r.agentId).toLowerCase().includes(q),
      );
    }

    setRuns(filtered);
  }, [allRuns, filter, search]);

  if (isLoading || !user) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="page-header">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[rgb(var(--color-brand)/0.1)]">
              <IconRuns size={20} className="text-[rgb(var(--color-brand))]" />
            </div>
            <div>
              <h1 className="page-title">Runs</h1>
              <p className="page-description">Monitor and manage agent execution runs</p>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <StatsBar runs={allRuns} loading={loading} />

        {/* Error */}
        {error && (
          <div className="card border-[rgb(var(--color-error)/0.3)] bg-[rgb(var(--color-error-bg))]">
            <p className="text-sm text-[rgb(var(--color-error))]">{error}</p>
          </div>
        )}

        {/* Filter Bar */}
        <FilterBar
          filter={filter}
          onFilterChange={setFilter}
          search={search}
          onSearchChange={setSearch}
        />

        {/* Table */}
        {loading ? (
          <TableSkeleton />
        ) : runs.length === 0 ? (
          <div className="empty-state">
            <IconRuns size={48} className="empty-state-icon" />
            <p className="empty-state-title">
              {filter === "all" && !search.trim()
                ? "No runs yet"
                : "No matching runs"}
            </p>
            <p className="empty-state-description">
              {filter === "all" && !search.trim()
                ? "Start a run from an agent page to see execution history here."
                : `No runs found matching your current filters. Try adjusting your search or status filter.`}
            </p>
          </div>
        ) : (
          <RunsTable runs={runs} />
        )}
      </div>
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// Page Export
// ---------------------------------------------------------------------------

export default function RunsListPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="space-y-6">
            <div className="page-header">
              <div className="flex items-center gap-3">
                <div className="skeleton h-10 w-10 rounded-lg" />
                <div>
                  <div className="skeleton h-7 w-24" />
                  <div className="skeleton mt-1 h-4 w-56" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="stat-card">
                  <div className="skeleton h-3 w-16" />
                  <div className="skeleton mt-1 h-7 w-10" />
                </div>
              ))}
            </div>
          </div>
        </AppShell>
      }
    >
      <RunsListContent />
    </Suspense>
  );
}
