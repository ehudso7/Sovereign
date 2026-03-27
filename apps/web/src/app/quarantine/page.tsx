"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { IconQuarantine, IconSearch } from "@/components/icons";

interface QuarantineEntry {
  id: string;
  subjectType: string;
  subjectId: string;
  reason: string;
  status: string;
  quarantinedBy: string;
  createdAt: string;
}

const STATUS_FILTERS = ["all", "active", "released"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const statusBadgeClass: Record<string, string> = {
  active: "badge-error",
  released: "badge-success",
};

function SkeletonTable() {
  return (
    <div className="table-container">
      <div className="table-header px-4 py-3">
        <div className="skeleton h-4 w-48" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="table-row flex items-center gap-4 px-4 py-3">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton h-4 w-48" />
          <div className="skeleton h-5 w-16 rounded-full" />
          <div className="skeleton h-4 w-28" />
          <div className="skeleton h-4 w-36" />
        </div>
      ))}
    </div>
  );
}

function QuarantineListContent() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [entries, setEntries] = useState<QuarantineEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [releaseLoading, setReleaseLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>(
    (searchParams.get("status") as StatusFilter) || "all",
  );

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  const loadEntries = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const query = filter !== "all" ? `?status=${filter}` : "";
    const result = await apiFetch<QuarantineEntry[]>(`/api/v1/quarantine${query}`, { token });

    if (result.ok) {
      setEntries(result.data);
    } else {
      setError(result.error.message);
    }
    setLoading(false);
  }, [token, filter]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handleRelease = async (entryId: string) => {
    if (!token) return;
    setReleaseLoading(entryId);
    setError(null);

    const result = await apiFetch<QuarantineEntry>(
      `/api/v1/quarantine/${entryId}/release`,
      { method: "POST", token, body: JSON.stringify({}) },
    );

    if (result.ok) {
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, status: "released" } : e)),
      );
    } else {
      setError(result.error.message);
    }
    setReleaseLoading(null);
  };

  const filteredEntries = searchQuery.trim()
    ? entries.filter(
        (e) =>
          e.subjectType.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.quarantinedBy.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : entries;

  const activeCount = entries.filter((e) => e.status === "active").length;

  if (isLoading || !user) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="page-header">
          <h1 className="page-title">Quarantine</h1>
          <p className="page-description">
            Review quarantined agent runs that were flagged for policy violations or anomalous behavior.
          </p>
        </div>

        {/* Warning Banner */}
        {!loading && activeCount > 0 && (
          <div className="card border-[rgb(var(--color-warning))] bg-[rgb(var(--color-warning-bg))]">
            <div className="flex items-center gap-3">
              <IconQuarantine size={20} className="shrink-0 text-[rgb(var(--color-warning))]" />
              <div>
                <p className="text-sm font-medium text-[rgb(var(--color-warning))]">
                  {activeCount} item{activeCount === 1 ? "" : "s"} in quarantine
                </p>
                <p className="mt-0.5 text-xs text-[rgb(var(--color-text-secondary))]">
                  These items require review before they can be released back into operation.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="stat-card">
            <span className="stat-label">Total Quarantined</span>
            <span className="stat-value">{loading ? "-" : entries.length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Active</span>
            <div className="flex items-center gap-2">
              <span className="stat-value">{loading ? "-" : activeCount}</span>
              {!loading && activeCount > 0 && <span className="status-dot-error" />}
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-label">Released</span>
            <span className="stat-value">
              {loading ? "-" : entries.filter((e) => e.status === "released").length}
            </span>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1.5">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  filter === s
                    ? "bg-[rgb(var(--color-brand))] text-white"
                    : "bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-bg-inset))]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="relative">
            <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-tertiary))]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search quarantine..."
              className="input pl-9 sm:w-64"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="card border-[rgb(var(--color-error))] bg-[rgb(var(--color-error-bg))]">
            <p className="text-sm text-[rgb(var(--color-error))]">{error}</p>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <SkeletonTable />
        ) : filteredEntries.length === 0 ? (
          <div className="empty-state">
            <IconQuarantine className="empty-state-icon" size={48} />
            <p className="empty-state-title">
              {searchQuery
                ? "No matching entries"
                : filter === "all"
                  ? "No quarantine entries"
                  : `No ${filter} entries`}
            </p>
            <p className="empty-state-description">
              {searchQuery
                ? `No entries match "${searchQuery}".`
                : "Items quarantined for policy violations will appear here."}
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left">Subject</th>
                  <th className="px-4 py-3 text-left">Reason</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Quarantined By</th>
                  <th className="px-4 py-3 text-left">Timestamp</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    className={`table-row ${
                      entry.status === "active"
                        ? "bg-[rgb(var(--color-warning-bg))]"
                        : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-[rgb(var(--color-text-primary))]">
                        {entry.subjectType}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-[rgb(var(--color-text-tertiary))]">
                        {entry.subjectId}
                      </p>
                    </td>
                    <td className="max-w-xs px-4 py-3">
                      <p className="truncate text-[rgb(var(--color-text-secondary))]" title={entry.reason}>
                        {entry.reason}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={statusBadgeClass[entry.status] ?? "badge-neutral"}>
                        {entry.status === "active" && <span className="status-dot-error" />}
                        {entry.status === "released" && <span className="status-dot-success" />}
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[rgb(var(--color-text-secondary))]">
                      {entry.quarantinedBy}
                    </td>
                    <td className="px-4 py-3 text-[rgb(var(--color-text-tertiary))]">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {entry.status === "active" ? (
                        <button
                          onClick={() => handleRelease(entry.id)}
                          disabled={releaseLoading === entry.id}
                          className="rounded-md bg-[rgb(var(--color-success))] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                        >
                          {releaseLoading === entry.id ? "Releasing..." : "Review & Release"}
                        </button>
                      ) : (
                        <span className="badge-success">Released</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-[rgb(var(--color-border-secondary))] bg-[rgb(var(--color-bg-secondary))] px-4 py-2">
              <p className="text-xs text-[rgb(var(--color-text-tertiary))]">
                Showing {filteredEntries.length} of {entries.length} entries
              </p>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function QuarantinePage() {
  return (
    <Suspense>
      <QuarantineListContent />
    </Suspense>
  );
}
