"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { IconAudit, IconSearch } from "@/components/icons";

interface AuditEntry {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  actor: string;
  ipAddress?: string;
  createdAt: string;
}

const ACTION_CATEGORIES = [
  "all",
  "create",
  "update",
  "delete",
  "auth",
  "policy",
] as const;
type ActionCategory = (typeof ACTION_CATEGORIES)[number];

function actionToBadgeClass(action: string): string {
  const lower = action.toLowerCase();
  if (lower.includes("delete") || lower.includes("revoke") || lower.includes("deny"))
    return "badge-error";
  if (lower.includes("create") || lower.includes("approve") || lower.includes("enable"))
    return "badge-success";
  if (lower.includes("update") || lower.includes("change") || lower.includes("modify"))
    return "badge-info";
  if (lower.includes("auth") || lower.includes("login") || lower.includes("sign"))
    return "badge-warning";
  return "badge-neutral";
}

function SkeletonTable() {
  return (
    <div className="table-container">
      <div className="table-header px-4 py-3">
        <div className="skeleton h-4 w-48" />
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="table-row flex items-center gap-4 px-4 py-3">
          <div className="skeleton h-4 w-36" />
          <div className="skeleton h-4 w-28" />
          <div className="skeleton h-4 w-32" />
          <div className="skeleton h-4 w-24" />
          <div className="skeleton h-4 w-28" />
        </div>
      ))}
    </div>
  );
}

function AuditLogContent() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState<ActionCategory>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  const loadEntries = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const result = await apiFetch<AuditEntry[]>("/api/v1/audit?limit=100", { token });

    if (result.ok) {
      setEntries(result.data);
    } else {
      setError(result.error.message);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const filteredEntries = entries.filter((e) => {
    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matches =
        e.action.toLowerCase().includes(q) ||
        e.resourceType.toLowerCase().includes(q) ||
        e.actor.toLowerCase().includes(q) ||
        e.resourceId.toLowerCase().includes(q);
      if (!matches) return false;
    }

    // Category filter
    if (category !== "all") {
      const lower = e.action.toLowerCase();
      if (!lower.includes(category)) return false;
    }

    // Date range filter
    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      if (new Date(e.createdAt).getTime() < from) return false;
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86400000; // end of day
      if (new Date(e.createdAt).getTime() > to) return false;
    }

    return true;
  });

  if (isLoading || !user) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="page-header flex items-start justify-between">
          <div>
            <h1 className="page-title">Audit Log</h1>
            <p className="page-description">
              Comprehensive record of all actions performed across your organization.
            </p>
          </div>
          <button
            onClick={loadEntries}
            disabled={loading}
            className="rounded-lg border border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-primary))] px-4 py-2 text-sm font-medium text-[rgb(var(--color-text-secondary))] transition-colors hover:bg-[rgb(var(--color-bg-secondary))] disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="card space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            {/* Search */}
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--color-text-tertiary))]">
                Search
              </label>
              <div className="relative">
                <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-tertiary))]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by action, actor, resource..."
                  className="input pl-9"
                />
              </div>
            </div>

            {/* Date Range */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--color-text-tertiary))]">
                From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--color-text-tertiary))]">
                To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="input"
              />
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex gap-1.5">
            {ACTION_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  category === c
                    ? "bg-[rgb(var(--color-brand))] text-white"
                    : "bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-bg-inset))]"
                }`}
              >
                {c}
              </button>
            ))}
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
            <IconAudit className="empty-state-icon" size={48} />
            <p className="empty-state-title">
              {searchQuery || category !== "all" || dateFrom || dateTo
                ? "No matching entries"
                : "No audit entries"}
            </p>
            <p className="empty-state-description">
              {searchQuery
                ? `No entries match your current filters.`
                : "Audit events will be recorded as actions are performed."}
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left">Timestamp</th>
                  <th className="px-4 py-3 text-left">Actor</th>
                  <th className="px-4 py-3 text-left">Action</th>
                  <th className="px-4 py-3 text-left">Resource</th>
                  <th className="px-4 py-3 text-left">IP Address</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="table-row">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-[rgb(var(--color-text-tertiary))]">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-[rgb(var(--color-text-primary))]">
                        {entry.actor}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={actionToBadgeClass(entry.action)}>
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[rgb(var(--color-text-secondary))]">
                        {entry.resourceType}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-[rgb(var(--color-text-tertiary))]">
                        {entry.resourceId}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[rgb(var(--color-text-tertiary))]">
                      {entry.ipAddress ?? "--"}
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

export default function AuditPage() {
  return (
    <Suspense>
      <AuditLogContent />
    </Suspense>
  );
}
