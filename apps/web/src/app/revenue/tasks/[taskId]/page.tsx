"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import { IconClock, IconChevronRight } from "@/components/icons";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueAt: string | null;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "completed":
      return "badge-success";
    case "in_progress":
      return "badge-info";
    case "open":
      return "badge-warning";
    default:
      return "badge-neutral";
  }
}

function priorityBadgeClass(priority: string): string {
  switch (priority) {
    case "urgent":
      return "badge-error";
    case "high":
      return "badge-warning";
    case "medium":
      return "badge-info";
    case "low":
      return "badge-neutral";
    default:
      return "badge-neutral";
  }
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-4 w-48" />
      <div className="flex items-center justify-between">
        <div className="skeleton h-8 w-64" />
        <div className="flex gap-2">
          <div className="skeleton h-6 w-20 rounded-full" />
          <div className="skeleton h-6 w-16 rounded-full" />
        </div>
      </div>
      <div className="card">
        <div className="skeleton h-16 w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[1, 2].map((i) => (
          <div key={i} className="card">
            <div className="skeleton mb-2 h-3 w-16" />
            <div className="skeleton h-5 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TaskDetailPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const taskId = params.taskId as string;
  const [task, setTask] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!token) return;
    apiFetch<Task>(`/api/v1/revenue/tasks/${taskId}`, { token }).then(
      (result) => {
        if (result.ok) {
          setTask(result.data);
        } else {
          setError(result.error.message);
        }
        setLoading(false);
      },
    );
  }, [token, taskId]);

  if (isLoading || !user) return null;

  const canEdit =
    role === "org_owner" || role === "org_admin" || role === "org_member";

  const updateStatus = async (status: string) => {
    const result = await apiFetch<Task>(`/api/v1/revenue/tasks/${taskId}`, {
      method: "PATCH",
      token: token ?? undefined,
      body: JSON.stringify({ status }),
    });
    if (result.ok) {
      setTask(result.data);
    } else {
      setError(result.error.message);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="breadcrumb">
          <Link href="/revenue">Revenue</Link>
          <IconChevronRight size={12} className="breadcrumb-separator" />
          <Link href="/revenue/tasks">Tasks</Link>
          <IconChevronRight size={12} className="breadcrumb-separator" />
          <span className="text-[rgb(var(--color-text-primary))]">
            {task?.title || "Detail"}
          </span>
        </nav>

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
        ) : !task ? (
          <div className="empty-state">
            <IconClock size={48} className="empty-state-icon" />
            <p className="empty-state-title">Task not found</p>
            <p className="empty-state-description">
              This task may have been deleted or you may not have access.
            </p>
            <Link
              href="/revenue/tasks"
              className="mt-2 text-sm font-medium text-[rgb(var(--color-brand))] transition-colors hover:text-[rgb(var(--color-brand-dark))]"
            >
              Back to Tasks
            </Link>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h1 className="page-title">{task.title}</h1>
              <div className="flex items-center gap-2">
                <span className={statusBadgeClass(task.status)}>
                  <span
                    className={
                      task.status === "completed"
                        ? "status-dot-success"
                        : task.status === "in_progress"
                          ? "status-dot-info"
                          : "status-dot-warning"
                    }
                  />
                  {task.status.replace("_", " ")}
                </span>
                <span className={priorityBadgeClass(task.priority)}>
                  {task.priority}
                </span>
              </div>
            </div>

            {/* Description */}
            {task.description && (
              <div className="card">
                <h3 className="mb-2 text-sm font-medium text-[rgb(var(--color-text-tertiary))]">
                  Description
                </h3>
                <p className="text-sm text-[rgb(var(--color-text-primary))]">
                  {task.description}
                </p>
              </div>
            )}

            {/* Details Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="card">
                <span className="stat-label">Due Date</span>
                <p className="mt-1 text-sm text-[rgb(var(--color-text-primary))]">
                  {task.dueAt
                    ? new Date(task.dueAt).toLocaleString()
                    : "\u2014"}
                </p>
              </div>
              {task.linkedEntityType && (
                <div className="card">
                  <span className="stat-label">Linked Entity</span>
                  <p className="mt-1 text-sm text-[rgb(var(--color-text-primary))]">
                    <span className="badge-neutral mr-1">
                      {task.linkedEntityType}
                    </span>
                    <code className="rounded bg-[rgb(var(--color-bg-tertiary))] px-1.5 py-0.5 text-xs text-[rgb(var(--color-text-secondary))]">
                      {task.linkedEntityId}
                    </code>
                  </p>
                </div>
              )}
            </div>

            {/* Status Actions */}
            {canEdit && task.status !== "completed" && (
              <div className="card">
                <h3 className="mb-3 text-sm font-medium text-[rgb(var(--color-text-tertiary))]">
                  Update Status
                </h3>
                <div className="flex flex-wrap gap-2">
                  {task.status === "open" && (
                    <button
                      onClick={() => updateStatus("in_progress")}
                      className="rounded-lg border border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-primary))] px-4 py-2 text-sm font-medium text-[rgb(var(--color-text-secondary))] transition-colors hover:bg-[rgb(var(--color-bg-secondary))] hover:text-[rgb(var(--color-text-primary))]"
                    >
                      Start Task
                    </button>
                  )}
                  <button
                    onClick={() => updateStatus("completed")}
                    className="inline-flex items-center gap-2 rounded-lg bg-[rgb(var(--color-success))] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
                  >
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
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Mark Complete
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
