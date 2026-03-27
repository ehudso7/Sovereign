"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import { IconBell, IconSearch } from "@/components/icons";

interface Alert {
  id: string;
  title: string;
  severity: string;
  conditionType: string;
  status: string;
  createdAt: string;
}

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "resolved", label: "Resolved" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];

function severityBadgeClass(severity: string): string {
  switch (severity) {
    case "critical":
      return "badge-error";
    case "warning":
      return "badge-warning";
    case "info":
      return "badge-info";
    default:
      return "badge-neutral";
  }
}

function alertStatusBadgeClass(status: string): string {
  switch (status) {
    case "open":
      return "badge-error";
    case "acknowledged":
      return "badge-warning";
    case "resolved":
      return "badge-success";
    default:
      return "badge-neutral";
  }
}

function alertStatusDotClass(status: string): string {
  switch (status) {
    case "open":
      return "status-dot-error";
    case "acknowledged":
      return "status-dot-warning";
    case "resolved":
      return "status-dot-success";
    default:
      return "status-dot-neutral";
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
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="skeleton h-4 w-48" />
                <div className="skeleton h-3 w-36" />
              </div>
              <div className="flex gap-2">
                <div className="skeleton h-5 w-16 rounded-full" />
                <div className="skeleton h-5 w-16 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AlertsListContent() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [ackLoading, setAckLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>(
    (searchParams.get("status") as StatusFilter) || "all",
  );

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  const loadAlerts = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const query = filter !== "all" ? `?status=${filter}` : "";
    const result = await apiFetch<Alert[]>(
      `/api/v1/mission-control/alerts${query}`,
      { token },
    );

    if (result.ok) {
      setAlerts(result.data);
    } else {
      setError(result.error.message);
    }
    setLoading(false);
  }, [token, filter]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleAcknowledge = async (alertId: string) => {
    if (!token) return;
    setAckLoading(alertId);
    setError(null);

    const result = await apiFetch<Alert>(
      `/api/v1/mission-control/alerts/${alertId}/acknowledge`,
      { method: "POST", token, body: JSON.stringify({}) },
    );

    if (result.ok) {
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alertId ? { ...a, status: "acknowledged" } : a,
        ),
      );
    } else {
      setError(result.error.message);
    }
    setAckLoading(null);
  };

  if (isLoading || !user) return null;

  const filteredAlerts = searchQuery.trim()
    ? alerts.filter((a) => {
        const q = searchQuery.toLowerCase();
        return (
          a.title.toLowerCase().includes(q) ||
          a.conditionType.toLowerCase().includes(q) ||
          a.severity.toLowerCase().includes(q)
        );
      })
    : alerts;

  const counts = {
    total: alerts.length,
    open: alerts.filter((a) => a.status === "open").length,
    critical: alerts.filter((a) => a.severity === "critical").length,
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
          <span className="text-[rgb(var(--color-text-primary))]">Alerts</span>
        </nav>

        {/* Page Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Alerts</h1>
            <p className="page-description">
              Monitor and manage system alerts and notifications
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
                <span className="stat-label">Total Alerts</span>
                <span className="stat-value">{counts.total}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Open</span>
                <div className="flex items-center gap-2">
                  <span className="stat-value">{counts.open}</span>
                  {counts.open > 0 && (
                    <span className="status-dot-error-pulse" />
                  )}
                </div>
              </div>
              <div className="stat-card">
                <span className="stat-label">Critical</span>
                <span className="stat-value">{counts.critical}</span>
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
                  placeholder="Search alerts..."
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

            {/* Alert List or Empty State */}
            {filteredAlerts.length === 0 ? (
              <div className="empty-state">
                <IconBell size={48} className="empty-state-icon" />
                <p className="empty-state-title">
                  {searchQuery
                    ? "No alerts match your search"
                    : filter !== "all"
                      ? `No alerts with status "${filter}"`
                      : "No alerts"}
                </p>
                <p className="empty-state-description">
                  {searchQuery
                    ? "Try adjusting your search query or filters."
                    : "Alerts will appear here when triggered by your alert rules."}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredAlerts.map((alert) => (
                  <div key={alert.id} className="card card-hover p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--color-bg-tertiary))]">
                          <IconBell
                            size={18}
                            className="text-[rgb(var(--color-text-secondary))]"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[rgb(var(--color-text-primary))]">
                            {alert.title}
                          </p>
                          <p className="text-xs text-[rgb(var(--color-text-tertiary))]">
                            {alert.conditionType} &middot;{" "}
                            {new Date(alert.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pl-12 sm:pl-0">
                        <span className={severityBadgeClass(alert.severity)}>
                          {alert.severity}
                        </span>
                        <span className={alertStatusBadgeClass(alert.status)}>
                          <span
                            className={alertStatusDotClass(alert.status)}
                          />
                          {alert.status}
                        </span>
                        {alert.status === "open" && (
                          <button
                            onClick={() => handleAcknowledge(alert.id)}
                            disabled={ackLoading === alert.id}
                            className="rounded-lg border border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-primary))] px-3 py-1.5 text-xs font-medium text-[rgb(var(--color-text-secondary))] transition-colors hover:bg-[rgb(var(--color-bg-tertiary))] hover:text-[rgb(var(--color-text-primary))] disabled:opacity-50"
                          >
                            {ackLoading === alert.id
                              ? "..."
                              : "Acknowledge"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

export default function AlertsPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <LoadingSkeleton />
        </AppShell>
      }
    >
      <AlertsListContent />
    </Suspense>
  );
}
