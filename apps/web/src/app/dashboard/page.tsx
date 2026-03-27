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

export default function DashboardPage() {
  const { user, org, role, token, isLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (token) {
      apiFetch<Project[]>("/api/v1/projects", { token }).then((result) => {
        if (result.ok) setProjects(result.data);
      });
    }
  }, [token]);

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
            value={String(projects.length || 3)}
            change="+2 this week"
            trend="up"
            icon={IconAgents}
          />
          <StatCard
            label="Total Runs"
            value="1,247"
            change="+18% vs last week"
            trend="up"
            icon={IconRuns}
          />
          <StatCard
            label="Success Rate"
            value="98.2%"
            change="+0.5%"
            trend="up"
            icon={IconConnectors}
          />
          <StatCard
            label="Avg Duration"
            value="4.2s"
            change="-12% faster"
            trend="up"
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
              <RecentRunRow
                name="Customer Onboarding Flow"
                status="completed"
                agent="Onboarding Agent"
                duration="3.2s"
              />
              <RecentRunRow
                name="Invoice Processing"
                status="running"
                agent="Billing Agent"
                duration="1.4s"
              />
              <RecentRunRow
                name="Lead Qualification"
                status="completed"
                agent="Revenue Agent"
                duration="5.1s"
              />
              <RecentRunRow
                name="Security Scan #847"
                status="failed"
                agent="Security Agent"
                duration="12.3s"
              />
              <RecentRunRow
                name="Data Migration Batch"
                status="queued"
                agent="ETL Agent"
                duration="—"
              />
            </div>
          </div>

          {/* ── Activity Feed ── */}
          <div>
            <div className="section-header mb-4">
              <h2 className="section-title">Activity</h2>
            </div>
            <div className="card divide-y divide-[rgb(var(--color-border-secondary))]">
              <ActivityItem
                text="Onboarding Agent deployed v2.1"
                time="2 minutes ago"
                type="success"
              />
              <ActivityItem
                text="New connector GitHub installed"
                time="15 minutes ago"
                type="info"
              />
              <ActivityItem
                text="Policy violation: rate limit exceeded"
                time="1 hour ago"
                type="warning"
              />
              <ActivityItem
                text="Security Agent run failed — timeout"
                time="2 hours ago"
                type="error"
              />
              <ActivityItem
                text="Billing: invoice #1042 sent"
                time="3 hours ago"
                type="success"
              />
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
