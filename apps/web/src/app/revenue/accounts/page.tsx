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

interface Account {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  status: string;
  ownerId: string | null;
  createdAt: string;
}

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const;

function statusBadgeClass(status: string): string {
  switch (status) {
    case "active":
      return "badge-success";
    case "inactive":
      return "badge-neutral";
    default:
      return "badge-neutral";
  }
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
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="table-row px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="skeleton h-4 w-40" />
                <div className="skeleton h-3 w-64" />
              </div>
              <div className="skeleton h-5 w-16 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AccountsPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
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
    apiFetch<Account[]>("/api/v1/revenue/accounts", { token }).then(
      (result) => {
        if (result.ok) {
          setAccounts(result.data);
        } else {
          setError(result.error.message);
        }
        setLoading(false);
      },
    );
  }, [token]);

  const filteredAccounts = useMemo(() => {
    let result = accounts;
    if (statusFilter) {
      result = result.filter((a) => a.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.domain?.toLowerCase().includes(q) ||
          a.industry?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [accounts, statusFilter, searchQuery]);

  if (isLoading || !user) return null;

  const canCreate =
    role === "org_owner" || role === "org_admin" || role === "org_member";

  const counts = {
    total: accounts.length,
    active: accounts.filter((a) => a.status === "active").length,
    inactive: accounts.filter((a) => a.status !== "active").length,
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="page-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title">Accounts</h1>
            <p className="page-description">
              Manage your customer accounts and organizations
            </p>
          </div>
          {canCreate && (
            <Link
              href="/revenue/accounts/new"
              className="inline-flex items-center gap-2 rounded-lg bg-[rgb(var(--color-brand))] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-[rgb(var(--color-brand-dark))] hover:shadow-md"
            >
              <IconPlus size={16} />
              New Account
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
                <span className="stat-label">Total Accounts</span>
                <span className="stat-value">{counts.total}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Active</span>
                <div className="flex items-center gap-2">
                  <span className="stat-value">{counts.active}</span>
                  <span className="status-dot-success-pulse" />
                </div>
              </div>
              <div className="stat-card">
                <span className="stat-label">Inactive</span>
                <span className="stat-value">{counts.inactive}</span>
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
                  placeholder="Search accounts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input pl-9"
                />
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-primary))] p-1">
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setStatusFilter(f.value)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      statusFilter === f.value
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
            {filteredAccounts.length === 0 ? (
              <div className="empty-state">
                <IconRevenue size={48} className="empty-state-icon" />
                <p className="empty-state-title">
                  {searchQuery || statusFilter
                    ? "No accounts match your search"
                    : "No accounts yet"}
                </p>
                <p className="empty-state-description">
                  {searchQuery || statusFilter
                    ? "Try adjusting your search query or filters."
                    : "Create your first account to start managing customer relationships."}
                </p>
                {!searchQuery && !statusFilter && canCreate && (
                  <Link
                    href="/revenue/accounts/new"
                    className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[rgb(var(--color-brand))] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[rgb(var(--color-brand-dark))]"
                  >
                    <IconPlus size={16} />
                    New Account
                  </Link>
                )}
              </div>
            ) : (
              <div className="table-container">
                <table className="w-full">
                  <thead>
                    <tr className="table-header">
                      <th className="px-4 py-3 text-left">Account</th>
                      <th className="hidden px-4 py-3 text-left md:table-cell">
                        Domain
                      </th>
                      <th className="hidden px-4 py-3 text-left sm:table-cell">
                        Industry
                      </th>
                      <th className="hidden px-4 py-3 text-left sm:table-cell">
                        Status
                      </th>
                      <th className="hidden px-4 py-3 text-left lg:table-cell">
                        Created
                      </th>
                      <th className="px-4 py-3 text-right">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAccounts.map((account) => (
                      <tr
                        key={account.id}
                        className="table-row cursor-pointer"
                        onClick={() =>
                          router.push(`/revenue/accounts/${account.id}`)
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
                            <p className="truncate text-sm font-medium text-[rgb(var(--color-text-primary))]">
                              {account.name}
                            </p>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3.5 text-sm text-[rgb(var(--color-text-secondary))] md:table-cell">
                          {account.domain || "\u2014"}
                        </td>
                        <td className="hidden px-4 py-3.5 text-sm text-[rgb(var(--color-text-secondary))] sm:table-cell">
                          {account.industry || "\u2014"}
                        </td>
                        <td className="hidden px-4 py-3.5 sm:table-cell">
                          <span className={statusBadgeClass(account.status)}>
                            <span
                              className={
                                account.status === "active"
                                  ? "status-dot-success"
                                  : "status-dot-neutral"
                              }
                            />
                            {account.status}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3.5 text-xs text-[rgb(var(--color-text-tertiary))] lg:table-cell">
                          {new Date(account.createdAt).toLocaleDateString(
                            undefined,
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
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
