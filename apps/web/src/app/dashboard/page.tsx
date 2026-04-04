"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import {
  IconAgents,
  IconRuns,
  IconConnectors,
  IconArrowUp,
  IconArrowDown,
  IconClock,
  IconChevronRight,
} from "@/components/icons";

interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

interface Agent {
  id: string;
  name: string;
  status: "draft" | "published" | "archived";
}

interface RunSummary {
  id: string;
  agentId: string;
  status: "queued" | "starting" | "running" | "paused" | "completed" | "failed" | "cancelled" | "cancelling";
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  error: { message: string } | null;
}

interface OverviewMetrics {
  runs: {
    total: number;
    completed: number;
    failed: number;
    running: number;
    queued: number;
    cancelled: number;
    paused: number;
  };
  avgDurationMs: number | null;
  openAlerts: number;
  recentFailures: RunSummary[];
}

interface ActivityFeedItem {
  text: string;
  time: string;
  type: "success" | "info" | "warning" | "error";
}

function StatCard({
  label,
  value,
  change,
  trend,
  icon: IconComp,
}: {
  label: string;
  value: string;
  change?: string;
  trend?: "up" | "down" | "neutral";
  icon: React.FC<{ size?: number }>;
}) {
  return (
    <div className="card-hover group flex items-start justify-between">
      <div className="flex flex-col gap-1">
        <span className="stat-label">{label}</span>
        <span className="stat-value">{value}</span>
        {change && (
          <span
            className={`stat-change flex items-center gap-0.5 ${
              trend === "up"
                ? "text-[rgb(var(--color-success))]"
                : trend === "down"
                  ? "text-[rgb(var(--color-error))]"
                  : "text-[rgb(var(--color-text-tertiary))]"
            }`}
          >
            {trend === "up" ? (
              <IconArrowUp size={12} />
            ) : trend === "down" ? (
              <IconArrowDown size={12} />
            ) : null}
            {change}
          </span>
        )}
      </div>
      <div className="rounded-lg bg-[rgb(var(--color-bg-secondary))] p-2.5 text-[rgb(var(--color-text-tertiary))] transition-colors group-hover:bg-[rgb(var(--color-brand)/0.1)] group-hover:text-[rgb(var(--color-brand))]">
        <IconComp size={20} />
      </div>
    </div>
  );
}

function RecentRunRow({
  name,
  status,
  agent,
  duration,
}: {
  name: string;
  status: "completed" | "running" | "failed" | "queued";
  agent: string;
  duration: string;
}) {
  const statusConfig = {
    completed: { dot: "status-dot-success", label: "Completed", badge: "badge-success" },
    running: { dot: "status-dot-success-pulse", label: "Running", badge: "badge-info" },
    failed: { dot: "status-dot-error", label: "Failed", badge: "badge-error" },
    queued: { dot: "status-dot-neutral", label: "Queued", badge: "badge-neutral" },
  };

  const config = statusConfig[status];

  return (
    <div className="table-row flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <span className={config.dot} />
        <div>
          <div className="text-sm font-medium text-[rgb(var(--color-text-primary))]">
            {name}
          </div>
          <div className="text-xs text-[rgb(var(--color-text-tertiary))]">
            {agent}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className={config.badge}>{config.label}</span>
        <span className="flex items-center gap-1 text-xs text-[rgb(var(--color-text-tertiary))]">
          <IconClock size={12} />
          {duration}
        </span>
      </div>
    </div>
  );
}

function ActivityItem({
  text,
  time,
  type,
}: {
  text: string;
  time: string;
  type: "success" | "info" | "warning" | "error";
}) {
  const dotClass = {
    success: "status-dot-success",
    info: "status-dot-info",
    warning: "status-dot-warning",
    error: "status-dot-error",
  };

  return (
    <div className="flex items-start gap-3 py-2">
      <span className={`${dotClass[type]} mt-1.5 shrink-0`} />
      <div className="flex-1">
        <p className="text-sm text-[rgb(var(--color-text-primary))]">{text}</p>
        <p className="text-xs text-[rgb(var(--color-text-tertiary))]">{time}</p>
      </div>
    </div>
  );
}

function formatCount(value?: number): string {
  return typeof value === "number" ? new Intl.NumberFormat("en-US").format(value) : "—";
}

function formatDuration(ms: number | null): string {
  if (ms === null || Number.isNaN(ms)) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;

  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function formatRunDuration(run: RunSummary): string {
  if (!run.startedAt) {
    return "Queued";
  }

  const end = run.completedAt ? new Date(run.completedAt).getTime() : Date.now();
  const start = new Date(run.startedAt).getTime();
  return formatDuration(Math.max(0, end - start));
}

function formatRelativeTime(value: string): string {
  const diffMs = new Date(value).getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60_000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, "hour");
  }

  return rtf.format(Math.round(diffHours / 24), "day");
}

function toDashboardRunStatus(run: RunSummary): "completed" | "running" | "failed" | "queued" {
  if (run.status === "completed") return "completed";
  if (run.status === "failed" || run.status === "cancelled") return "failed";
  if (run.status === "running" || run.status === "starting") return "running";
  return "queued";
}

export default function DashboardPage() {
  const { user, org, role, token, isLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [recentRuns, setRecentRuns] = useState<RunSummary[]>([]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (token) {
      void Promise.all([
        apiFetch<Project[]>("/api/v1/projects", { token }),
        apiFetch<Agent[]>("/api/v1/agents", { token }),
        apiFetch<OverviewMetrics>("/api/v1/mission-control/overview", { token }),
        apiFetch<RunSummary[]>("/api/v1/mission-control/runs?limit=5", { token }),
      ]).then(([projectsResult, agentsResult, overviewResult, runsResult]) => {
        if (projectsResult.ok) setProjects(projectsResult.data);
        if (agentsResult.ok) setAgents(agentsResult.data);
        if (overviewResult.ok) setOverview(overviewResult.data);
        if (runsResult.ok) setRecentRuns(runsResult.data.slice(0, 5));
      });
    }
  }, [token]);

  const agentNames = new Map(agents.map((agent) => [agent.id, agent.name]));
  const activeAgentCount = agents.filter((agent) => agent.status !== "archived").length;
  const successRate = overview && overview.runs.total > 0
    ? `${((overview.runs.completed / overview.runs.total) * 100).toFixed(1)}%`
    : "—";
  const activityItems = [
    overview?.runs.running
      ? {
          text: `${overview.runs.running} runs are currently active`,
          time: "Live",
          type: "info" as const,
        }
      : null,
    overview?.openAlerts
      ? {
          text: `${overview.openAlerts} open alerts require attention`,
          time: "Live",
          type: "warning" as const,
        }
      : null,
    recentRuns[0]
      ? {
          text: `Latest run ${recentRuns[0].status} for ${agentNames.get(recentRuns[0].agentId) ?? "an agent"}`,
          time: formatRelativeTime(recentRuns[0].createdAt),
          type: recentRuns[0].status === "failed" ? ("error" as const) : ("success" as const),
        }
      : null,
    projects[0]
      ? {
          text: `${projects.length} project${projects.length === 1 ? "" : "s"} available`,
          time: "Current workspace",
          type: "success" as const,
        }
      : null,
  ].filter((item): item is ActivityFeedItem => item !== null);

  if (isLoading || !user) {
    return (
      <AppShell>
        <div className="space-y-6">
          <div className="skeleton h-8 w-48" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-28 rounded-lg" />
            ))}
          </div>
          <div className="skeleton h-64 rounded-lg" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* ── Page Header ── */}
        <div className="page-header flex items-center justify-between">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-description">
              {org?.name ?? "Organization"}{" "}
              <span className="badge-neutral ml-1">{role}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/agents/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[rgb(var(--color-brand))] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[rgb(var(--color-brand-dark))]"
            >
              New Agent
            </Link>
          </div>
        </div>

        {/* ── Stats Grid ── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Active Agents"
            value={formatCount(activeAgentCount)}
            icon={IconAgents}
          />
          <StatCard
            label="Total Runs"
            value={formatCount(overview?.runs.total)}
            icon={IconRuns}
          />
          <StatCard
            label="Success Rate"
            value={successRate}
            icon={IconConnectors}
          />
          <StatCard
            label="Avg Duration"
            value={formatDuration(overview?.avgDurationMs ?? null)}
            icon={IconClock}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* ── Recent Runs ── */}
          <div className="lg:col-span-2">
            <div className="section-header mb-4">
              <h2 className="section-title">Recent Runs</h2>
              <Link
                href="/runs"
                className="flex items-center gap-1 text-sm text-[rgb(var(--color-brand))] transition-colors hover:text-[rgb(var(--color-brand-dark))]"
              >
                View all <IconChevronRight size={14} />
              </Link>
            </div>
            <div className="table-container">
              {recentRuns.length > 0 ? (
                recentRuns.map((run) => (
                  <RecentRunRow
                    key={run.id}
                    name={`Run ${run.id.slice(0, 8)}`}
                    status={toDashboardRunStatus(run)}
                    agent={agentNames.get(run.agentId) ?? run.agentId}
                    duration={formatRunDuration(run)}
                  />
                ))
              ) : (
                <div className="px-4 py-6 text-sm text-[rgb(var(--color-text-tertiary))]">
                  No runs have been recorded yet.
                </div>
              )}
            </div>
          </div>

          {/* ── Activity Feed ── */}
          <div>
            <div className="section-header mb-4">
              <h2 className="section-title">Activity</h2>
            </div>
            <div className="card divide-y divide-[rgb(var(--color-border-secondary))]">
              {activityItems.length > 0 ? (
                activityItems.map((item) => (
                  <ActivityItem
                    key={`${item.text}-${item.time}`}
                    text={item.text}
                    time={item.time}
                    type={item.type}
                  />
                ))
              ) : (
                <div className="px-4 py-6 text-sm text-[rgb(var(--color-text-tertiary))]">
                  No recent activity yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Projects ── */}
        {projects.length > 0 && (
          <div>
            <div className="section-header mb-4">
              <h2 className="section-title">Projects</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <div key={p.id} className="card-hover">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-[rgb(var(--color-text-primary))]">
                        {p.name}
                      </h3>
                      <p className="text-xs text-[rgb(var(--color-text-tertiary))]">
                        {p.slug}
                      </p>
                    </div>
                    <span className="status-dot-success" />
                  </div>
                  {p.description && (
                    <p className="mt-2 text-sm text-[rgb(var(--color-text-secondary))]">
                      {p.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
