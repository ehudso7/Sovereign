"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import { IconChevronRight } from "@/components/icons";

export default function CreateProjectPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canCreate = role === "org_owner" || role === "org_admin";

  useEffect(() => {
    if (!isLoading && !user) router.push("/auth/sign-in");
    if (!isLoading && user && !canCreate) router.push("/projects");
  }, [isLoading, user, canCreate, router]);

  const handleNameChange = (value: string) => {
    setName(value);
    setSlug(
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, ""),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setSubmitting(true);
    setError(null);

    const result = await apiFetch<{ id: string }>("/api/v1/projects", {
      method: "POST",
      token,
      body: JSON.stringify({
        name,
        slug,
        description: description || undefined,
      }),
    });

    if (result.ok) {
      router.push(`/projects/${result.data.id}`);
    } else {
      setError(result.error.message);
      setSubmitting(false);
    }
  };

  if (isLoading || !user) return null;

  if (!canCreate) {
    return (
      <AppShell>
        <div className="empty-state">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgb(var(--color-error-bg))]">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgb(var(--color-error))"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
          <p className="empty-state-title">Permission Denied</p>
          <p className="empty-state-description">
            You do not have permission to create projects.
          </p>
          <Link
            href="/projects"
            className="mt-2 text-sm font-medium text-[rgb(var(--color-brand))] transition-colors hover:text-[rgb(var(--color-brand-dark))]"
          >
            Back to Projects
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="breadcrumb">
          <Link href="/projects">Projects</Link>
          <IconChevronRight size={12} className="breadcrumb-separator" />
          <span className="text-[rgb(var(--color-text-primary))]">
            Create Project
          </span>
        </nav>

        {/* Page Header */}
        <div className="page-header">
          <h1 className="page-title">Create Project</h1>
          <p className="page-description">
            Projects organize your agents, runs, and resources
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
            {/* Name */}
            <div className="space-y-1.5">
              <label
                htmlFor="name"
                className="block text-sm font-medium text-[rgb(var(--color-text-primary))]"
              >
                Project Name
              </label>
              <p className="text-xs text-[rgb(var(--color-text-tertiary))]">
                A human-readable name for this project
              </p>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="input"
                required
                maxLength={255}
                placeholder="e.g., Customer Support"
              />
            </div>

            {/* Slug */}
            <div className="space-y-1.5">
              <label
                htmlFor="slug"
                className="block text-sm font-medium text-[rgb(var(--color-text-primary))]"
              >
                Slug
              </label>
              <p className="text-xs text-[rgb(var(--color-text-tertiary))]">
                Lowercase letters, numbers, and hyphens only. Auto-generated
                from the name.
              </p>
              <input
                id="slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="input font-mono text-sm"
                required
                maxLength={63}
                pattern="[a-z0-9-]+"
                placeholder="customer-support"
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
                maxLength={2000}
                placeholder="Describe what this project is for..."
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 border-t border-[rgb(var(--color-border-primary))] pt-6">
              <button
                type="submit"
                disabled={submitting || !name || !slug}
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
                  "Create Project"
                )}
              </button>
              <Link
                href="/projects"
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
