"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { IconBrowser } from "@/components/icons";
import Link from "next/link";

interface BrowserSession {
  id: string;
  runId: string;
  agentId: string;
  status: string;
  browserType: string;
  currentUrl: string | null;
  humanTakeover: boolean;
  createdAt: string;
  lastActivityAt: string | null;
}

const STATUS_FILTERS = [
  "all",
  "provisioning",
  "ready",
  "active",
  "human_control",
  "closing",
  "closed",
  "failed",
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    active: "badge-success",
    ready: "badge-info",
    provisioning: "badge-neutral",
    human_control: "badge-warning",
    takeover_requested: "badge-warning",
    closing: "badge-warning",
    closed: "badge-neutral",
    failed: "badge-error",
  };
  return map[status] ?? "badge-neutral";
}

function statusDotClass(status: string): string {
  const map: Record<string, string> = {
    active: "status-dot-success-pulse",
    ready: "status-dot-info",
    provisioning: "status-dot-neutral",
    human_control: "status-dot-warning",
    closing: "status-dot-warning",
    closed: "status-dot-neutral",
    failed: "status-dot-error",
  };
  return map[status] ?? "status-dot-neutral";
}

function formatDuration(start: string, end: string | null): string {
  const ms = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ${secs % 60}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function BrowserSessionsContent() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sessions, setSessions] = useState<BrowserSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>(
    (searchParams.get("status") as StatusFilter) || "all",
  );

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  const loadSessions = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const query = filter !== "all" ? `?status=${filter}` : "";
    const result = await apiFetch<BrowserSession[]>(`/api/v1/browser-sessions${query}`, { token });

    if (result.ok) {
      setSessions(result.data);
    } else {
      setError(result.error.message);
    }
    setLoading(false);
  }, [token, filter]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  if (isLoading || !user) return null;

  const activeSessions = sessions.filter((s) => s.status === "active").length;
  const failedSessions = sessions.filter((s) => s.status === "failed").length;
  const humanControlSessions = sessions.filter((s) => s.humanTakeover).length;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page header */}
        <div className="page-header">
          <h1 className="page-title">Browser Sessions</h1>
          <p className="page-description">
            Monitor and manage browser automation sessions used by agents
          </p>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="stat-card">
            <span className="stat-label">Total Sessions</span>
            <span className="stat-value">{sessions.length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Active</span>
            <div className="flex items-center gap-2">
              <span className="stat-value">{activeSessions}</span>
              {activeSessions > 0 && <span className="status-dot-success-pulse" />}
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-label">Failed</span>
            <span className="stat-value">{failedSessions}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Human Control</span>
            <span className="stat-value">{humanControlSessions}</span>
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                filter === s
                  ? "bg-[rgb(var(--color-brand))] text-white"
                  : "bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))]"
              }`}
            >
              {s === "all" ? "All" : s.replace("_", " ")}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="card border-[rgb(var(--color-error))] bg-[rgb(var(--color-error-bg,var(--color-bg-secondary)))]">
            <p className="text-sm text-[rgb(var(--color-error))]">{error}</p>
          </div>
        )}

        {/* Loading skeleton */}
        {loading ? (
          <div className="table-container">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left">Session</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">URL</th>
                  <th className="px-4 py-3 text-left">Started</th>
                  <th className="px-4 py-3 text-left">Duration</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="table-row">
                    <td className="px-4 py-3"><div className="skeleton h-4 w-24" /></td>
                    <td className="px-4 py-3"><div className="skeleton h-5 w-16 rounded-full" /></td>
                    <td className="px-4 py-3"><div className="skeleton h-4 w-40" /></td>
                    <td className="px-4 py-3"><div className="skeleton h-4 w-28" /></td>
                    <td className="px-4 py-3"><div className="skeleton h-4 w-14" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : sessions.length === 0 ? (
          <div className="empty-state">
            <IconBrowser className="empty-state-icon" size={48} />
            <p className="empty-state-title">
              {filter === "all"
                ? "No browser sessions"
                : `No sessions with status "${filter.replace("_", " ")}"`}
            </p>
            <p className="empty-state-description">
              Browser sessions are created automatically when running browser-capable agents.
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left">Session</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">URL</th>
                  <th className="px-4 py-3 text-left">Started</th>
                  <th className="px-4 py-3 text-left">Duration</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id} className="table-row">
                    <td className="px-4 py-3">
                      <Link
                        href={`/browser-sessions/${session.id}`}
                        className="group flex flex-col"
                      >
                        <span className="font-mono text-sm font-medium text-[rgb(var(--color-text-primary))] group-hover:text-[rgb(var(--color-brand))] transition-colors">
                          {session.id.slice(0, 8)}...
                        </span>
                        <span className="text-xs text-[rgb(var(--color-text-tertiary))]">
                          Run: {session.runId.slice(0, 8)}...
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={statusDotClass(session.status)} />
                        <span className={statusBadgeClass(session.status)}>
                          {session.status.replace("_", " ")}
                        </span>
                        {session.humanTakeover && (
                          <span className="badge-warning">HUMAN</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="max-w-[240px] truncate block text-sm text-[rgb(var(--color-text-secondary))]">
                        {session.currentUrl ?? "--"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-[rgb(var(--color-text-secondary))]">
                        {new Date(session.createdAt).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-mono text-[rgb(var(--color-text-secondary))]">
                        {formatDuration(session.createdAt, session.lastActivityAt)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function BrowserSessionsPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="space-y-6">
            <div className="page-header">
              <div className="skeleton h-7 w-48" />
              <div className="skeleton mt-2 h-4 w-72" />
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="stat-card">
                  <div className="skeleton h-3 w-20" />
                  <div className="skeleton h-7 w-12" />
                </div>
              ))}
            </div>
          </div>
        </AppShell>
      }
    >
      <BrowserSessionsContent />
    </Suspense>
  );
}
