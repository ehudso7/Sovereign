"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import { IconPlus, IconChevronRight } from "@/components/icons";

interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export default function ProjectsPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canCreate = role === "org_owner" || role === "org_admin";

  useEffect(() => {
    if (!isLoading && !user) router.push("/auth/sign-in");
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!token) return;
    apiFetch<Project[]>("/api/v1/projects", { token }).then((r) => {
      if (r.ok) setProjects(r.data);
      else setError(r.error.message);
      setLoading(false);
    });
  }, [token]);

  if (isLoading || !user) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="page-header flex items-center justify-between">
          <div>
            <h1 className="page-title">Projects</h1>
            <p className="page-description">
              Organize your agents and work into projects
            </p>
          </div>
          {canCreate && (
            <Link
              href="/projects/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[rgb(var(--color-brand))] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[rgb(var(--color-brand-dark))]"
            >
              <IconPlus size={16} />
              New Project
            </Link>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-[rgb(var(--color-error)/0.3)] bg-[rgb(var(--color-error)/0.08)] px-4 py-3 text-sm text-[rgb(var(--color-error))]">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-32 rounded-lg" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          /* Empty state */
          <div className="empty-state">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgb(var(--color-brand)/0.1)]">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgb(var(--color-brand))"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
            </div>
            <p className="empty-state-title">No projects yet</p>
            <p className="empty-state-description">
              Create a project to organize your agents and work.
            </p>
            {canCreate && (
              <Link
                href="/projects/new"
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[rgb(var(--color-brand))] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[rgb(var(--color-brand-dark))]"
              >
                <IconPlus size={16} />
                Create Project
              </Link>
            )}
          </div>
        ) : (
          /* Project list */
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="card-hover group"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-[rgb(var(--color-text-primary))] group-hover:text-[rgb(var(--color-brand))] transition-colors">
                      {project.name}
                    </h3>
                    <p className="mt-0.5 font-mono text-xs text-[rgb(var(--color-text-tertiary))]">
                      {project.slug}
                    </p>
                  </div>
                  <IconChevronRight
                    size={16}
                    className="mt-0.5 shrink-0 text-[rgb(var(--color-text-tertiary))] opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </div>
                {project.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-[rgb(var(--color-text-secondary))]">
                    {project.description}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
