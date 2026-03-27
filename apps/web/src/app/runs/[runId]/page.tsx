"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import {
  IconRuns,
  IconChevronRight,
  IconClock,
  IconExternalLink,
  IconX,
} from "@/components/icons";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RunStep {
  id: string;
  type: string;
  status: string;
  name?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

interface Run {
  id: string;
  agentId: string;
  agentName?: string;
  status: string;
  trigger: string;
  input?: unknown;
  output?: unknown;
  error?: string;
  steps?: RunStep[];
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "completed":
      return "badge-success";
    case "failed":
      return "badge-error";
    case "running":
    case "starting":
      return "badge-info";
    case "paused":
    case "cancelling":
      return "badge-warning";
    case "queued":
    case "cancelled":
    default:
      return "badge-neutral";
  }
}

function getStatusDotClass(status: string): string {
  switch (status) {
    case "completed":
      return "status-dot-success";
    case "failed":
      return "status-dot-error";
    case "running":
      return "status-dot-success-pulse";
    case "starting":
      return "status-dot-info";
    case "paused":
    case "cancelling":
      return "status-dot-warning";
    case "queued":
    case "cancelled":
    default:
      return "status-dot-neutral";
  }
}

function formatDuration(start: string, end?: string): string {
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  const diffMs = endMs - startMs;

  if (diffMs < 1000) return "<1s";
  if (diffMs < 60_000) return `${Math.floor(diffMs / 1000)}s`;
  if (diffMs < 3_600_000) {
    const mins = Math.floor(diffMs / 60_000);
    const secs = Math.floor((diffMs % 60_000) / 1000);
    return `${mins}m ${secs}s`;
  }
  const hrs = Math.floor(diffMs / 3_600_000);
  const mins = Math.floor((diffMs % 3_600_000) / 60_000);
  return `${hrs}h ${mins}m`;
}

function formatTimestamp(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

function StatusBadge({ status, size = "sm" }: { status: string; size?: "sm" | "lg" }) {
  return (
    <span
      className={`${getStatusBadgeClass(status)} ${
        size === "lg" ? "px-3 py-1 text-sm" : ""
      }`}
    >
      <span className={getStatusDotClass(status)} />
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Breadcrumb
// ---------------------------------------------------------------------------

function Breadcrumb({ runId }: { runId: string }) {
  return (
    <nav className="breadcrumb">
      <Link href="/runs">Runs</Link>
      <IconChevronRight size={12} className="breadcrumb-separator" />
      <span className="font-medium text-[rgb(var(--color-text-primary))]">
        {runId.length > 16 ? `${runId.slice(0, 8)}...${runId.slice(-4)}` : runId}
      </span>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-4 w-40" />
      <div className="flex items-start justify-between">
        <div>
          <div className="skeleton h-8 w-48" />
          <div className="skeleton mt-2 h-4 w-64" />
        </div>
        <div className="skeleton h-8 w-24 rounded-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="skeleton mb-4 h-5 w-24" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="mb-3 flex items-center gap-3">
                <div className="skeleton h-8 w-8 rounded-full" />
                <div className="flex-1">
                  <div className="skeleton h-4 w-40" />
                  <div className="skeleton mt-1 h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="card">
            <div className="skeleton mb-3 h-4 w-20" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="mb-3">
                <div className="skeleton h-3 w-16" />
                <div className="skeleton mt-1 h-4 w-32" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timeline Step
// ---------------------------------------------------------------------------

function TimelineStep({
  step,
  index,
  isLast,
}: {
  step: RunStep;
  index: number;
  isLast: boolean;
}) {
  return (
    <div className="relative flex gap-4">
      {/* Vertical line + dot */}
      <div className="flex flex-col items-center">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold ${
            step.status === "completed"
              ? "border-[rgb(var(--color-success))] bg-[rgb(var(--color-success-bg))] text-[rgb(var(--color-success))]"
              : step.status === "failed"
                ? "border-[rgb(var(--color-error))] bg-[rgb(var(--color-error-bg))] text-[rgb(var(--color-error))]"
                : step.status === "running"
                  ? "border-[rgb(var(--color-info))] bg-[rgb(var(--color-info-bg))] text-[rgb(var(--color-info))]"
                  : "border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-secondary))] text-[rgb(var(--color-text-tertiary))]"
          }`}
        >
          {index + 1}
        </div>
        {!isLast && (
          <div className="w-0.5 flex-1 bg-[rgb(var(--color-border-primary))]" />
        )}
      </div>

      {/* Step content */}
      <div className={`flex-1 pb-6 ${isLast ? "pb-0" : ""}`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-[rgb(var(--color-text-primary))]">
              {step.name ?? step.type}
            </p>
            {step.startedAt && (
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[rgb(var(--color-text-tertiary))]">
                <IconClock size={12} />
                <span>{formatTimestamp(step.startedAt)}</span>
                {step.completedAt && (
                  <span className="text-[rgb(var(--color-text-secondary))]">
                    ({formatDuration(step.startedAt, step.completedAt)})
                  </span>
                )}
              </div>
            )}
          </div>
          <StatusBadge status={step.status} />
        </div>
        {step.error && (
          <div className="mt-2 rounded-md border border-[rgb(var(--color-error)/0.2)] bg-[rgb(var(--color-error-bg))] p-3">
            <pre className="whitespace-pre-wrap text-xs text-[rgb(var(--color-error))]">
              {step.error}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// JSON/Output Viewer
// ---------------------------------------------------------------------------

function DataBlock({
  label,
  data,
  variant = "default",
}: {
  label: string;
  data: unknown;
  variant?: "default" | "error" | "success";
}) {
  const borderColor =
    variant === "error"
      ? "border-[rgb(var(--color-error)/0.2)]"
      : variant === "success"
        ? "border-[rgb(var(--color-success)/0.2)]"
        : "border-[rgb(var(--color-border-primary))]";

  const bgColor =
    variant === "error"
      ? "bg-[rgb(var(--color-error-bg))]"
      : variant === "success"
        ? "bg-[rgb(var(--color-success-bg))]"
        : "bg-[rgb(var(--color-bg-secondary))]";

  const textColor =
    variant === "error"
      ? "text-[rgb(var(--color-error))]"
      : variant === "success"
        ? "text-[rgb(var(--color-success))]"
        : "text-[rgb(var(--color-text-primary))]";

  const content = typeof data === "string" ? data : JSON.stringify(data, null, 2);

  return (
    <div className="card">
      <div className="section-header mb-4">
        <h3 className="section-title">{label}</h3>
      </div>
      <div className={`rounded-md border ${borderColor} ${bgColor} p-4`}>
        <pre className={`max-h-96 overflow-auto whitespace-pre-wrap font-mono text-xs ${textColor}`}>
          {content}
        </pre>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action Buttons
// ---------------------------------------------------------------------------

function ActionButtons({
  run,
  canControl,
  actionLoading,
  onAction,
}: {
  run: Run;
  canControl: boolean;
  actionLoading: boolean;
  onAction: (action: "pause" | "resume" | "cancel") => void;
}) {
  const canPause = canControl && run.status === "running";
  const canResume = canControl && run.status === "paused";
  const canCancel =
    canControl && ["queued", "starting", "running", "paused"].includes(run.status);

  if (!canPause && !canResume && !canCancel) return null;

  return (
    <div className="flex items-center gap-2">
      {canPause && (
        <button
          onClick={() => onAction("pause")}
          disabled={actionLoading}
          className="badge-warning cursor-pointer px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          {actionLoading ? "..." : "Pause"}
        </button>
      )}
      {canResume && (
        <button
          onClick={() => onAction("resume")}
          disabled={actionLoading}
          className="badge-info cursor-pointer px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          {actionLoading ? "..." : "Resume"}
        </button>
      )}
      {canCancel && (
        <button
          onClick={() => onAction("cancel")}
          disabled={actionLoading}
          className="badge-error cursor-pointer px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          {actionLoading ? "..." : "Cancel"}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metadata Sidebar
// ---------------------------------------------------------------------------

function MetadataSidebar({ run }: { run: Run }) {
  return (
    <div className="space-y-4">
      {/* Details */}
      <div className="card">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--color-text-tertiary))]">
          Details
        </h3>
        <dl className="space-y-4">
          <div>
            <dt className="text-xs text-[rgb(var(--color-text-tertiary))]">Agent</dt>
            <dd className="mt-0.5">
              <Link
                href={`/agents/${run.agentId}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-[rgb(var(--color-brand))] hover:underline"
              >
                {run.agentName ?? run.agentId}
                <IconExternalLink size={12} />
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[rgb(var(--color-text-tertiary))]">Trigger</dt>
            <dd className="mt-0.5 text-sm text-[rgb(var(--color-text-primary))]">
              {run.trigger}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[rgb(var(--color-text-tertiary))]">Run ID</dt>
            <dd className="mt-0.5 break-all font-mono text-xs text-[rgb(var(--color-text-secondary))]">
              {run.id}
            </dd>
          </div>
        </dl>
      </div>

      {/* Timestamps */}
      <div className="card">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--color-text-tertiary))]">
          Timestamps
        </h3>
        <dl className="space-y-4">
          <div>
            <dt className="text-xs text-[rgb(var(--color-text-tertiary))]">Created</dt>
            <dd className="mt-0.5 text-sm text-[rgb(var(--color-text-primary))]">
              {formatTimestamp(run.createdAt)}
            </dd>
          </div>
          {run.startedAt && (
            <div>
              <dt className="text-xs text-[rgb(var(--color-text-tertiary))]">Started</dt>
              <dd className="mt-0.5 text-sm text-[rgb(var(--color-text-primary))]">
                {formatTimestamp(run.startedAt)}
              </dd>
            </div>
          )}
          {run.completedAt && (
            <div>
              <dt className="text-xs text-[rgb(var(--color-text-tertiary))]">Completed</dt>
              <dd className="mt-0.5 text-sm text-[rgb(var(--color-text-primary))]">
                {formatTimestamp(run.completedAt)}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-[rgb(var(--color-text-tertiary))]">Last Updated</dt>
            <dd className="mt-0.5 text-sm text-[rgb(var(--color-text-primary))]">
              {formatTimestamp(run.updatedAt)}
            </dd>
          </div>
          {run.startedAt && (
            <div>
              <dt className="text-xs text-[rgb(var(--color-text-tertiary))]">Duration</dt>
              <dd className="mt-0.5 text-sm font-medium text-[rgb(var(--color-text-primary))]">
                {formatDuration(run.startedAt, run.completedAt)}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function RunDetailPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const runId = params.runId as string;

  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const canControl = role === "org_owner" || role === "org_admin";

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  const loadRun = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const result = await apiFetch<Run>(`/api/v1/runs/${runId}`, { token });

    if (result.ok) {
      setRun(result.data);
    } else {
      setError(result.error.message);
    }
    setLoading(false);
  }, [token, runId]);

  useEffect(() => {
    loadRun();
  }, [loadRun]);

  // Poll for updates when run is active
  useEffect(() => {
    if (!run) return;
    const activeStatuses = ["queued", "starting", "running", "cancelling"];
    if (!activeStatuses.includes(run.status)) return;

    const interval = setInterval(loadRun, 3000);
    return () => clearInterval(interval);
  }, [run, loadRun]);

  const handleAction = async (action: "pause" | "resume" | "cancel") => {
    if (!token) return;
    setActionLoading(true);
    setError(null);

    const result = await apiFetch<Run>(`/api/v1/runs/${runId}/${action}`, {
      method: "POST",
      token,
      body: JSON.stringify({}),
    });

    if (result.ok) {
      setRun(result.data);
    } else {
      setError(result.error.message);
    }
    setActionLoading(false);
  };

  if (isLoading || !user) return null;

  // Loading state
  if (loading) {
    return (
      <AppShell>
        <DetailSkeleton />
      </AppShell>
    );
  }

  // Not found state
  if (!run) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Breadcrumb runId={runId} />
          <div className="empty-state">
            <IconX size={48} className="empty-state-icon" />
            <p className="empty-state-title">Run not found</p>
            <p className="empty-state-description">
              {error ?? "The requested run could not be loaded."}
            </p>
            <Link
              href="/runs"
              className="mt-2 text-sm font-medium text-[rgb(var(--color-brand))] hover:underline"
            >
              Back to Runs
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb runId={runId} />

        {/* Error banner */}
        {error && (
          <div className="card border-[rgb(var(--color-error)/0.3)] bg-[rgb(var(--color-error-bg))]">
            <p className="text-sm text-[rgb(var(--color-error))]">{error}</p>
          </div>
        )}

        {/* Run Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--color-brand)/0.1)]">
              <IconRuns size={24} className="text-[rgb(var(--color-brand))]" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="page-title">
                  {run.agentName ?? "Run"}
                </h1>
                <StatusBadge status={run.status} size="lg" />
              </div>
              <p className="mt-1 font-mono text-xs text-[rgb(var(--color-text-tertiary))]">
                {run.id}
              </p>
            </div>
          </div>
          <ActionButtons
            run={run}
            canControl={canControl}
            actionLoading={actionLoading}
            onAction={handleAction}
          />
        </div>

        {/* Main layout: content + sidebar */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left: Timeline + I/O */}
          <div className="space-y-6 lg:col-span-2">
            {/* Timeline / Steps */}
            <div className="card">
              <div className="section-header mb-4">
                <h3 className="section-title">Execution Timeline</h3>
                {run.steps && run.steps.length > 0 && (
                  <span className="badge-neutral">{run.steps.length} steps</span>
                )}
              </div>

              {!run.steps || run.steps.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <IconClock
                    size={32}
                    className="text-[rgb(var(--color-text-tertiary))]"
                  />
                  <p className="text-sm text-[rgb(var(--color-text-secondary))]">
                    No steps recorded yet.
                  </p>
                  {(run.status === "queued" || run.status === "starting") && (
                    <p className="text-xs text-[rgb(var(--color-text-tertiary))]">
                      Steps will appear once the run starts executing.
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-2">
                  {run.steps.map((step, index) => (
                    <TimelineStep
                      key={step.id}
                      step={step}
                      index={index}
                      isLast={index === (run.steps?.length ?? 1) - 1}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Error Output */}
            {run.status === "failed" && run.error && (
              <DataBlock label="Error" data={run.error} variant="error" />
            )}

            {/* Input */}
            {run.input != null && (
              <DataBlock label="Input" data={run.input} />
            )}

            {/* Output */}
            {run.status === "completed" && run.output != null && (
              <DataBlock label="Output" data={run.output} variant="success" />
            )}
          </div>

          {/* Right: Metadata sidebar */}
          <MetadataSidebar run={run} />
        </div>
      </div>
    </AppShell>
  );
}
