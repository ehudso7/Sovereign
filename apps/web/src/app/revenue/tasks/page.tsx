"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import {
  IconClock,
  IconPlus,
  IconSearch,
  IconChevronRight,
} from "@/components/icons";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueAt: string | null;
}

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
] as const;

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
                <div className="skeleton h-4 w-48" />
                <div className="skeleton h-3 w-24" />
              </div>
              <div className="skeleton h-5 w-16 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TasksPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
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
    apiFetch<Task[]>("/api/v1/revenue/tasks", { token }).then((result) => {
      if (result.ok) {
        setTasks(result.data);
      } else {
        setError(result.error.message);
      }
      setLoading(false);
    });
  }, [token]);

  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (statusFilter) {
      result = result.filter((t) => t.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t) => t.title.toLowerCase().includes(q));
    }
    return result;
  }, [tasks, statusFilter, searchQuery]);

  if (isLoading || !user) return null;

  const canCreate =
    role === "org_owner" || role === "org_admin" || role === "org_member";

  const counts = {
    total: tasks.length,
    open: tasks.filter((t) => t.status === "open").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="page-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title">Tasks</h1>
            <p className="page-description">
              Track follow-ups, to-dos, and action items
            </p>
          </div>
          {canCreate && (
            <Link
              href="/revenue/tasks/new"
              className="inline-flex items-center gap-2 rounded-lg bg-[rgb(var(--color-brand))] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-[rgb(var(--color-brand-dark))] hover:shadow-md"
            >
              <IconPlus size={16} />
              New Task
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
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="stat-card">
                <span className="stat-label">Total</span>
                <span className="stat-value">{counts.total}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Open</span>
                <span className="stat-value">{counts.open}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">In Progress</span>
                <div className="flex items-center gap-2">
                  <span className="stat-value">{counts.inProgress}</span>
                  {counts.inProgress > 0 && (
                    <span className="status-dot-info" />
                  )}
                </div>
              </div>
              <div className="stat-card">
                <span className="stat-label">Completed</span>
                <div className="flex items-center gap-2">
                  <span className="stat-value">{counts.completed}</span>
                  {counts.completed > 0 && (
                    <span className="status-dot-success" />
                  )}
                </div>
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
                  placeholder="Search tasks..."
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
            {filteredTasks.length === 0 ? (
              <div className="empty-state">
                <IconClock size={48} className="empty-state-icon" />
                <p className="empty-state-title">
                  {searchQuery || statusFilter
                    ? "No tasks match your filters"
                    : "No tasks yet"}
                </p>
                <p className="empty-state-description">
                  {searchQuery || statusFilter
                    ? "Try adjusting your search query or status filter."
                    : "Create your first task to start tracking your action items."}
                </p>
                {!searchQuery && !statusFilter && canCreate && (
                  <Link
                    href="/revenue/tasks/new"
                    className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[rgb(var(--color-brand))] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[rgb(var(--color-brand-dark))]"
                  >
                    <IconPlus size={16} />
                    New Task
                  </Link>
                )}
              </div>
            ) : (
              <div className="table-container">
                <table className="w-full">
                  <thead>
                    <tr className="table-header">
                      <th className="px-4 py-3 text-left">Task</th>
                      <th className="hidden px-4 py-3 text-left sm:table-cell">
                        Status
                      </th>
                      <th className="hidden px-4 py-3 text-left md:table-cell">
                        Priority
                      </th>
                      <th className="hidden px-4 py-3 text-left lg:table-cell">
                        Due
                      </th>
                      <th className="px-4 py-3 text-right">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map((task) => (
                      <tr
                        key={task.id}
                        className="table-row cursor-pointer"
                        onClick={() =>
                          router.push(`/revenue/tasks/${task.id}`)
                        }
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--color-bg-tertiary))]">
                              <IconClock
                                size={18}
                                className="text-[rgb(var(--color-text-secondary))]"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-[rgb(var(--color-text-primary))]">
                                {task.title}
                              </p>
                              <p className="text-xs text-[rgb(var(--color-text-tertiary))] sm:hidden">
                                {task.status.replace("_", " ")}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3.5 sm:table-cell">
                          <span className={statusBadgeClass(task.status)}>
                            {task.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3.5 md:table-cell">
                          <span className={priorityBadgeClass(task.priority)}>
                            {task.priority}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3.5 text-sm text-[rgb(var(--color-text-secondary))] lg:table-cell">
                          {task.dueAt
                            ? new Date(task.dueAt).toLocaleDateString(
                                undefined,
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )
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
