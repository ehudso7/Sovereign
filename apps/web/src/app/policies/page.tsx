"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { IconPolicies, IconPlus, IconSearch } from "@/components/icons";
import Link from "next/link";

interface Policy {
  id: string;
  name: string;
  policyType: string;
  enforcementMode: string;
  scopeType: string;
  scopeId: string | null;
  status: string;
  priority: number;
}

const STATUS_FILTERS = ["all", "active", "disabled", "archived"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const statusBadgeClass: Record<string, string> = {
  active: "badge-success",
  disabled: "badge-neutral",
  archived: "badge-error",
};

const enforcementBadgeClass: Record<string, string> = {
  allow: "badge-success",
  deny: "badge-error",
  require_approval: "badge-warning",
  quarantine: "badge-info",
};

const statusDotClass: Record<string, string> = {
  active: "status-dot-success",
  disabled: "status-dot-neutral",
  archived: "status-dot-error",
};

function SkeletonTable() {
  return (
    <div className="table-container">
      <div className="table-header px-4 py-3">
        <div className="skeleton h-4 w-48" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="table-row flex items-center gap-4 px-4 py-3">
          <div className="skeleton h-4 w-40" />
          <div className="skeleton h-4 w-24" />
          <div className="skeleton h-5 w-16 rounded-full" />
          <div className="skeleton h-4 w-28" />
          <div className="skeleton h-5 w-16 rounded-full" />
          <div className="skeleton h-4 w-12" />
        </div>
      ))}
    </div>
  );
}

function PoliciesListContent() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [policies, setPolicies] = useState<Policy[]>([]);
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

  const loadPolicies = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const query = filter !== "all" ? `?status=${filter}` : "";
    const result = await apiFetch<Policy[]>(`/api/v1/policies${query}`, { token });

    if (result.ok) {
      setPolicies(result.data);
    } else {
      setError(result.error.message);
    }
    setLoading(false);
  }, [token, filter]);

  useEffect(() => {
    loadPolicies();
  }, [loadPolicies]);

  const handleSetStatus = async (policyId: string, action: "enable" | "disable") => {
    if (!token) return;
    setActionLoading(policyId);
    setError(null);

    const result = await apiFetch<Policy>(
      `/api/v1/policies/${policyId}/${action}`,
      { method: "POST", token, body: JSON.stringify({}) },
    );

    if (result.ok) {
      setPolicies((prev) =>
        prev.map((p) =>
          p.id === policyId
            ? { ...p, status: action === "enable" ? "active" : "disabled" }
            : p,
        ),
      );
    } else {
      setError(result.error.message);
    }
    setActionLoading(null);
  };

  const filteredPolicies = searchQuery.trim()
    ? policies.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.policyType.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : policies;

  const counts = {
    total: policies.length,
    active: policies.filter((p) => p.status === "active").length,
    enforce: policies.filter((p) => p.enforcementMode === "deny" || p.enforcementMode === "quarantine").length,
  };

  if (isLoading || !user) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="page-header flex items-start justify-between">
          <div>
            <h1 className="page-title">Policies</h1>
            <p className="page-description">
              Manage governance policies that control agent behavior and enforce compliance rules.
            </p>
          </div>
          <Link
            href="/policies/new"
            className="inline-flex items-center gap-2 rounded-lg bg-[rgb(var(--color-brand))] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[rgb(var(--color-brand-dark))]"
          >
            <IconPlus size={16} />
            Create Policy
          </Link>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="stat-card">
            <span className="stat-label">Total Policies</span>
            <span className="stat-value">{loading ? "-" : counts.total}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Active</span>
            <div className="flex items-center gap-2">
              <span className="stat-value">{loading ? "-" : counts.active}</span>
              {!loading && counts.active > 0 && <span className="status-dot-success-pulse" />}
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-label">Enforcing</span>
            <span className="stat-value">{loading ? "-" : counts.enforce}</span>
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
              placeholder="Search policies..."
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
        ) : filteredPolicies.length === 0 ? (
          <div className="empty-state">
            <IconPolicies className="empty-state-icon" size={48} />
            <p className="empty-state-title">
              {searchQuery
                ? "No matching policies"
                : filter === "all"
                  ? "No policies yet"
                  : `No ${filter} policies`}
            </p>
            <p className="empty-state-description">
              {searchQuery
                ? `No policies match "${searchQuery}".`
                : "Create your first policy to start governing agent behavior."}
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Mode</th>
                  <th className="px-4 py-3 text-left">Scope</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Priority</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPolicies.map((policy) => (
                  <tr key={policy.id} className="table-row">
                    <td className="px-4 py-3">
                      <Link
                        href={`/policies/${policy.id}`}
                        className="font-medium text-[rgb(var(--color-text-primary))] hover:text-[rgb(var(--color-brand))] transition-colors"
                      >
                        {policy.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[rgb(var(--color-text-secondary))]">
                      {policy.policyType}
                    </td>
                    <td className="px-4 py-3">
                      <span className={enforcementBadgeClass[policy.enforcementMode] ?? "badge-neutral"}>
                        {policy.enforcementMode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[rgb(var(--color-text-secondary))]">
                      {policy.scopeType}
                      {policy.scopeId ? `: ${policy.scopeId}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <span className={statusBadgeClass[policy.status] ?? "badge-neutral"}>
                        <span className={statusDotClass[policy.status] ?? "status-dot-neutral"} />
                        {policy.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[rgb(var(--color-text-secondary))]">
                      {policy.priority}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {policy.status !== "active" && (
                          <button
                            onClick={() => handleSetStatus(policy.id, "enable")}
                            disabled={actionLoading === policy.id}
                            className="rounded-md bg-[rgb(var(--color-success-bg))] px-2.5 py-1 text-xs font-medium text-[rgb(var(--color-success))] transition-colors hover:opacity-80 disabled:opacity-50"
                          >
                            {actionLoading === policy.id ? "..." : "Enable"}
                          </button>
                        )}
                        {policy.status === "active" && (
                          <button
                            onClick={() => handleSetStatus(policy.id, "disable")}
                            disabled={actionLoading === policy.id}
                            className="rounded-md bg-[rgb(var(--color-warning-bg))] px-2.5 py-1 text-xs font-medium text-[rgb(var(--color-warning))] transition-colors hover:opacity-80 disabled:opacity-50"
                          >
                            {actionLoading === policy.id ? "..." : "Disable"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-[rgb(var(--color-border-secondary))] bg-[rgb(var(--color-bg-secondary))] px-4 py-2">
              <p className="text-xs text-[rgb(var(--color-text-tertiary))]">
                Showing {filteredPolicies.length} of {policies.length} policies
              </p>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function PoliciesPage() {
  return (
    <Suspense>
      <PoliciesListContent />
    </Suspense>
  );
}
