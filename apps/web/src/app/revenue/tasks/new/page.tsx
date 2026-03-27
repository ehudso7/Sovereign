"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import { IconClock, IconChevronRight } from "@/components/icons";

export default function NewTaskPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueAt, setDueAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await apiFetch("/api/v1/revenue/tasks", {
      method: "POST",
      token: token ?? undefined,
      body: JSON.stringify({
        title,
        description: description || undefined,
        priority,
        dueAt: dueAt || undefined,
      }),
    });
    setSubmitting(false);
    if (result.ok) {
      router.push("/revenue/tasks");
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
          <span className="text-[rgb(var(--color-text-primary))]">New</span>
        </nav>

        {/* Page Header */}
        <div className="page-header">
          <h1 className="page-title">New Task</h1>
          <p className="page-description">
            Create a new task to track a follow-up or action item
          </p>
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

        {/* Form Card */}
        <div className="card max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div className="space-y-1.5">
              <label
                htmlFor="title"
                className="block text-sm font-medium text-[rgb(var(--color-text-primary))]"
              >
                Title
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="input"
                placeholder="e.g., Follow up with Acme Corp"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label
                htmlFor="description"
                className="block text-sm font-medium text-[rgb(var(--color-text-primary))]"
              >
                Description
                <span className="ml-1 text-xs font-normal text-[rgb(var(--color-text-tertiary))]">
                  (optional)
                </span>
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input min-h-[80px] resize-y"
                rows={3}
                placeholder="Additional details about this task..."
              />
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <label
                htmlFor="priority"
                className="block text-sm font-medium text-[rgb(var(--color-text-primary))]"
              >
                Priority
              </label>
              <select
                id="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="input"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            {/* Due Date */}
            <div className="space-y-1.5">
              <label
                htmlFor="dueAt"
                className="block text-sm font-medium text-[rgb(var(--color-text-primary))]"
              >
                Due Date
                <span className="ml-1 text-xs font-normal text-[rgb(var(--color-text-tertiary))]">
                  (optional)
                </span>
              </label>
              <input
                id="dueAt"
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="input"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 border-t border-[rgb(var(--color-border-primary))] pt-6">
              <button
                type="submit"
                disabled={submitting || !title}
                className="inline-flex items-center gap-2 rounded-lg bg-[rgb(var(--color-brand))] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-[rgb(var(--color-brand-dark))] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <svg
                      className="h-4 w-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Creating...
                  </>
                ) : (
                  <>
                    <IconClock size={16} />
                    Create Task
                  </>
                )}
              </button>
              <Link
                href="/revenue/tasks"
                className="rounded-lg border border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-primary))] px-5 py-2.5 text-sm font-medium text-[rgb(var(--color-text-secondary))] transition-colors hover:bg-[rgb(var(--color-bg-secondary))] hover:text-[rgb(var(--color-text-primary))]"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
