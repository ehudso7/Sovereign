"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import {
  IconBilling,
  IconSearch,
  IconChevronRight,
} from "@/components/icons";

interface Invoice {
  id: string;
  status: string;
  totalCents: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
}

function invoiceStatusBadgeClass(status: string): string {
  switch (status) {
    case "paid":
      return "badge-success";
    case "open":
    case "pending":
      return "badge-warning";
    case "overdue":
    case "failed":
      return "badge-error";
    case "void":
      return "badge-neutral";
    default:
      return "badge-neutral";
  }
}

function invoiceStatusDotClass(status: string): string {
  switch (status) {
    case "paid":
      return "status-dot-success";
    case "open":
    case "pending":
      return "status-dot-warning";
    case "overdue":
    case "failed":
      return "status-dot-error";
    default:
      return "status-dot-neutral";
  }
}

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
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
                <div className="skeleton h-4 w-48" />
                <div className="skeleton h-3 w-32" />
              </div>
              <div className="skeleton h-5 w-16 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function InvoicesPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!token) return;
    apiFetch<Invoice[]>("/api/v1/billing/invoices", { token }).then((r) => {
      if (r.ok) setInvoices(r.data);
      else setError(r.error.message);
      setLoading(false);
    });
  }, [token]);

  if (isLoading || !user) return null;

  const filteredInvoices = searchQuery.trim()
    ? invoices.filter((inv) => {
        const q = searchQuery.toLowerCase();
        return (
          inv.id.toLowerCase().includes(q) ||
          inv.status.toLowerCase().includes(q) ||
          formatCurrency(inv.totalCents).includes(q)
        );
      })
    : invoices;

  const totalPaid = invoices
    .filter((inv) => inv.status === "paid")
    .reduce((sum, inv) => sum + inv.totalCents, 0);

  const counts = {
    total: invoices.length,
    paid: invoices.filter((inv) => inv.status === "paid").length,
    pending: invoices.filter(
      (inv) => inv.status !== "paid" && inv.status !== "void",
    ).length,
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="breadcrumb">
          <Link
            href="/billing"
            className="text-[rgb(var(--color-text-tertiary))] transition-colors hover:text-[rgb(var(--color-text-primary))]"
          >
            Billing
          </Link>
          <span className="breadcrumb-separator">/</span>
          <span className="text-[rgb(var(--color-text-primary))]">
            Invoices
          </span>
        </nav>

        {/* Page Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Invoices</h1>
            <p className="page-description">
              View and manage your billing invoices
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
                <span className="stat-label">Total Invoices</span>
                <span className="stat-value">{counts.total}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Paid</span>
                <span className="stat-value">{counts.paid}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Total Paid</span>
                <span className="stat-value">{formatCurrency(totalPaid)}</span>
              </div>
            </div>

            {/* Search Bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative max-w-sm flex-1">
                <IconSearch
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-tertiary))]"
                />
                <input
                  type="text"
                  placeholder="Search invoices..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input pl-9"
                />
              </div>
            </div>

            {/* Invoice Table or Empty State */}
            {filteredInvoices.length === 0 ? (
              <div className="empty-state">
                <IconBilling size={48} className="empty-state-icon" />
                <p className="empty-state-title">
                  {searchQuery
                    ? "No invoices match your search"
                    : "No invoices yet"}
                </p>
                <p className="empty-state-description">
                  {searchQuery
                    ? "Try adjusting your search query."
                    : "Invoices will appear here once your first billing period completes."}
                </p>
              </div>
            ) : (
              <div className="table-container">
                <table className="w-full">
                  <thead>
                    <tr className="table-header">
                      <th className="px-4 py-3 text-left">Period</th>
                      <th className="hidden px-4 py-3 text-left sm:table-cell">
                        Total
                      </th>
                      <th className="hidden px-4 py-3 text-left md:table-cell">
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
                    {filteredInvoices.map((inv) => (
                      <tr
                        key={inv.id}
                        className="table-row cursor-pointer"
                        onClick={() =>
                          router.push(`/billing/invoices/${inv.id}`)
                        }
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--color-bg-tertiary))]">
                              <IconBilling
                                size={18}
                                className="text-[rgb(var(--color-text-secondary))]"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-[rgb(var(--color-text-primary))]">
                                {new Date(
                                  inv.periodStart,
                                ).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                })}{" "}
                                &mdash;{" "}
                                {new Date(inv.periodEnd).toLocaleDateString(
                                  undefined,
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  },
                                )}
                              </p>
                              <p className="text-xs text-[rgb(var(--color-text-tertiary))] sm:hidden">
                                {formatCurrency(inv.totalCents)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3.5 sm:table-cell">
                          <span className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">
                            {formatCurrency(inv.totalCents)}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3.5 md:table-cell">
                          <span
                            className={invoiceStatusBadgeClass(inv.status)}
                          >
                            <span
                              className={invoiceStatusDotClass(inv.status)}
                            />
                            {inv.status}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3.5 text-xs text-[rgb(var(--color-text-tertiary))] lg:table-cell">
                          {new Date(inv.createdAt).toLocaleDateString(
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
