"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { IconApprovals, IconSearch } from "@/components/icons";

interface Approval {
  id: string;
  subjectType: string;
  subjectId: string;
  action: string;
  status: string;
  requestedBy: string;
  createdAt: string;
}

const STATUS_FILTERS = ["all", "pending", "approved", "denied", "expired"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const statusBadgeClass: Record<string, string> = {
  pending: "badge-warning",
  approved: "badge-success",
  denied: "badge-error",
  expired: "badge-neutral",
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
          <div className="skeleton h-4 w-24" />
          <div className="skeleton h-5 w-16 rounded-full" />
          <div className="skeleton h-4 w-28" />
          <div className="skeleton h-4 w-36" />
        </div>
      ))}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function ApprovalsListContent() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>(
    (searchParams.get("status") as StatusFilter) || "all",
  );

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  const loadApprovals = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const query = filter !== "all" ? `?status=${filter}` : "";
    const result = await apiFetch<Approval[]>(`/api/v1/approvals${query}`, { token });

    if (result.ok) {
      setApprovals(result.data);
    } else {
      setError(result.error.message);
    }
    setLoading(false);
  }, [token, filter]);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  const handleDecision = async (approvalId: string, decision: "approve" | "deny") => {
    if (!token) return;
    setActionLoading(`${approvalId}-${decision}`);
    setError(null);

    const result = await apiFetch<Approval>(
      `/api/v1/approvals/${approvalId}/${decision}`,
      { method: "POST", token, body: JSON.stringify({}) },
    );

    if (result.ok) {
      setApprovals((prev) =>
        prev.map((a) =>
          a.id === approvalId
            ? { ...a, status: decision === "approve" ? "approved" : "denied" }
            : a,
        ),
      );
    } else {
      setError(result.error.message);
    }
    setActionLoading(null);
  };

  const filteredApprovals = searchQuery.trim()
    ? approvals.filter(
        (a) =>
          a.subjectType.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.requestedBy.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : approvals;

  const counts = {
    total: approvals.length,
    pending: approvals.filter((a) => a.status === "pending").length,
    approved: approvals.filter((a) => a.status === "approved").length,
    denied: approvals.filter((a) => a.status === "denied").length,
  };

  if (isLoading || !user) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="page-header">
          <h1 className="page-title">Approvals</h1>
          <p className="page-description">
            Review and manage approval requests for sensitive agent actions.
          </p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="stat-card">
            <span className="stat-label">Total Requests</span>
            <span className="stat-value">{loading ? "-" : counts.total}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Pending</span>
            <div className="flex items-center gap-2">
              <span className="stat-value">{loading ? "-" : counts.pending}</span>
              {!loading && counts.pending > 0 && (
                <span className="badge-warning">{counts.pending} awaiting</span>
              )}
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-label">Approved</span>
            <span className="stat-value">{loading ? "-" : counts.approved}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Denied</span>
            <span className="stat-value">{loading ? "-" : counts.denied}</span>
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
                {s === "pending" && counts.pending > 0 && (
                  <span className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-white/20 px-1 text-[10px]">
                    {counts.pending}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="relative">
            <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-tertiary))]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search approvals..."
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
        ) : filteredApprovals.length === 0 ? (
          <div className="empty-state">
            <IconApprovals className="empty-state-icon" size={48} />
            <p className="empty-state-title">
              {searchQuery
                ? "No matching requests"
                : filter === "all"
                  ? "No approval requests"
                  : `No ${filter} requests`}
            </p>
            <p className="empty-state-description">
              {searchQuery
                ? `No approvals match "${searchQuery}".`
                : "Approval requests will appear here when agents need authorization."}
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left">Subject</th>
                  <th className="px-4 py-3 text-left">Action</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Requested By</th>
                  <th className="px-4 py-3 text-left">Time</th>
                  <th className="px-4 py-3 text-right">Decision</th>
                </tr>
              </thead>
              <tbody>
                {filteredApprovals.map((approval) => (
                  <tr key={approval.id} className="table-row">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[rgb(var(--color-text-primary))]">
                        {approval.subjectType}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-[rgb(var(--color-text-tertiary))]">
                        {approval.subjectId}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-[rgb(var(--color-bg-tertiary))] px-2 py-0.5 font-mono text-xs text-[rgb(var(--color-text-secondary))]">
                        {approval.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={statusBadgeClass[approval.status] ?? "badge-neutral"}>
                        {approval.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[rgb(var(--color-text-secondary))]">
                      {approval.requestedBy}
                    </td>
                    <td className="px-4 py-3 text-[rgb(var(--color-text-tertiary))]">
                      <span title={new Date(approval.createdAt).toLocaleString()}>
                        {timeAgo(approval.createdAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {approval.status === "pending" ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleDecision(approval.id, "approve")}
                            disabled={actionLoading !== null}
                            className="rounded-md bg-[rgb(var(--color-success))] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                          >
                            {actionLoading === `${approval.id}-approve` ? "..." : "Approve"}
                          </button>
                          <button
                            onClick={() => handleDecision(approval.id, "deny")}
                            disabled={actionLoading !== null}
                            className="rounded-md bg-[rgb(var(--color-error))] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                          >
                            {actionLoading === `${approval.id}-deny` ? "..." : "Deny"}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-[rgb(var(--color-text-tertiary))]">--</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-[rgb(var(--color-border-secondary))] bg-[rgb(var(--color-bg-secondary))] px-4 py-2">
              <p className="text-xs text-[rgb(var(--color-text-tertiary))]">
                Showing {filteredApprovals.length} of {approvals.length} requests
              </p>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function ApprovalsPage() {
  return (
    <Suspense>
      <ApprovalsListContent />
    </Suspense>
  );
}
