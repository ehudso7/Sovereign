"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import {
  IconRevenue,
  IconPlus,
  IconSearch,
  IconChevronRight,
} from "@/components/icons";

interface Deal {
  id: string;
  name: string;
  stage: string;
  valueCents: number | null;
  currency: string;
  probability: number | null;
}

const STAGE_FILTERS = [
  { value: "", label: "All" },
  { value: "discovery", label: "Discovery" },
  { value: "qualification", label: "Qualification" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "closed_won", label: "Won" },
  { value: "closed_lost", label: "Lost" },
] as const;

function stageBadgeClass(stage: string): string {
  switch (stage) {
    case "closed_won":
      return "badge-success";
    case "closed_lost":
      return "badge-error";
    case "negotiation":
      return "badge-warning";
    case "proposal":
      return "badge-info";
    default:
      return "badge-neutral";
  }
}

function formatCurrency(cents: number | null): string {
  if (cents === null || cents === undefined) return "\u2014";
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="stat-card">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton mt-2 h-7 w-16" />
          </div>
        ))}
      </div>
      <div className="table-container">
        <div className="table-header px-4 py-3">
          <div className="skeleton h-3 w-32" />
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="table-row px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="skeleton h-4 w-40" />
                <div className="skeleton h-3 w-24" />
              </div>
              <div className="skeleton h-5 w-20 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DealsPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [stageFilter, setStageFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    apiFetch<Deal[]>("/api/v1/revenue/deals", { token }).then((result) => {
      if (result.ok) {
        setDeals(result.data);
      } else {
        setError(result.error.message);
      }
      setLoading(false);
    });
  }, [token]);

  const filteredDeals = useMemo(() => {
    let result = deals;
    if (stageFilter) {
      result = result.filter((d) => d.stage === stageFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((d) => d.name.toLowerCase().includes(q));
    }
    return result;
  }, [deals, stageFilter, searchQuery]);

  if (isLoading || !user) return null;

  const canCreate =
    role === "org_owner" || role === "org_admin" || role === "org_member";

  const totalPipeline = deals
    .filter((d) => d.stage !== "closed_won" && d.stage !== "closed_lost")
    .reduce((sum, d) => sum + (d.valueCents || 0), 0);

  const wonValue = deals
    .filter((d) => d.stage === "closed_won")
    .reduce((sum, d) => sum + (d.valueCents || 0), 0);

  const counts = {
    total: deals.length,
    open: deals.filter(
      (d) => d.stage !== "closed_won" && d.stage !== "closed_lost",
    ).length,
    won: deals.filter((d) => d.stage === "closed_won").length,
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="page-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title">Deals</h1>
            <p className="page-description">
              Track and manage your sales pipeline
            </p>
          </div>
          {canCreate && (
            <Link
              href="/revenue/deals/new"
              className="inline-flex items-center gap-2 rounded-lg bg-[rgb(var(--color-brand))] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-[rgb(var(--color-brand-dark))] hover:shadow-md"
            >
              <IconPlus size={16} />
              New Deal
            </Link>
          )}
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
                <span className="stat-label">Pipeline Value</span>
                <span className="stat-value">
                  {formatCurrency(totalPipeline)}
                </span>
                <span className="stat-change text-[rgb(var(--color-text-tertiary))]">
                  {counts.open} open deal{counts.open !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Closed Won</span>
                <div className="flex items-center gap-2">
                  <span className="stat-value">
                    {formatCurrency(wonValue)}
                  </span>
                  <span className="status-dot-success-pulse" />
                </div>
                <span className="stat-change text-[rgb(var(--color-success))]">
                  {counts.won} deal{counts.won !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Total Deals</span>
                <span className="stat-value">{counts.total}</span>
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
                  placeholder="Search deals..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input pl-9"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1 rounded-lg border border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-primary))] p-1">
                {STAGE_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setStageFilter(f.value)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      stageFilter === f.value
                        ? "bg-[rgb(var(--color-brand))] text-white shadow-sm"
                        : "text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-bg-tertiary))] hover:text-[rgb(var(--color-text-primary))]"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Table or Empty State */}
            {filteredDeals.length === 0 ? (
              <div className="empty-state">
                <IconRevenue size={48} className="empty-state-icon" />
                <p className="empty-state-title">
                  {searchQuery || stageFilter
                    ? "No deals match your filters"
                    : "No deals yet"}
                </p>
                <p className="empty-state-description">
                  {searchQuery || stageFilter
                    ? "Try adjusting your search query or stage filter."
                    : "Create your first deal to start tracking your pipeline."}
                </p>
                {!searchQuery && !stageFilter && canCreate && (
                  <Link
                    href="/revenue/deals/new"
                    className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[rgb(var(--color-brand))] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[rgb(var(--color-brand-dark))]"
                  >
                    <IconPlus size={16} />
                    New Deal
                  </Link>
                )}
              </div>
            ) : (
              <div className="table-container">
                <table className="w-full">
                  <thead>
                    <tr className="table-header">
                      <th className="px-4 py-3 text-left">Deal</th>
                      <th className="hidden px-4 py-3 text-left sm:table-cell">
                        Stage
                      </th>
                      <th className="hidden px-4 py-3 text-right md:table-cell">
                        Value
                      </th>
                      <th className="hidden px-4 py-3 text-right lg:table-cell">
                        Probability
                      </th>
                      <th className="px-4 py-3 text-right">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDeals.map((deal) => (
                      <tr
                        key={deal.id}
                        className="table-row cursor-pointer"
                        onClick={() =>
                          router.push(`/revenue/deals/${deal.id}`)
                        }
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--color-bg-tertiary))]">
                              <IconRevenue
                                size={18}
                                className="text-[rgb(var(--color-text-secondary))]"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-[rgb(var(--color-text-primary))]">
                                {deal.name}
                              </p>
                              <p className="text-xs text-[rgb(var(--color-text-tertiary))] sm:hidden">
                                {deal.stage.replace("_", " ")}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3.5 sm:table-cell">
                          <span className={stageBadgeClass(deal.stage)}>
                            {deal.stage.replace("_", " ")}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3.5 text-right text-sm font-medium text-[rgb(var(--color-text-primary))] md:table-cell">
                          {formatCurrency(deal.valueCents)}
                        </td>
                        <td className="hidden px-4 py-3.5 text-right text-sm text-[rgb(var(--color-text-secondary))] lg:table-cell">
                          {deal.probability !== null
                            ? `${deal.probability}%`
                            : "\u2014"}
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
