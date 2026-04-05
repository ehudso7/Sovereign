"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import { IconChevronRight } from "@/components/icons";

interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export default function ProjectDetailPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canEdit = role === "org_owner" || role === "org_admin";

  useEffect(() => {
    if (!isLoading && !user) router.push("/auth/sign-in");
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!token || !projectId) return;
    apiFetch<Project>(`/api/v1/projects/${projectId}`, { token }).then((r) => {
      if (r.ok) {
        setProject(r.data);
        setEditName(r.data.name);
        setEditSlug(r.data.slug);
        setEditDescription(r.data.description ?? "");
      } else {
        setError(r.error.message);
      }
      setLoading(false);
    });
  }, [token, projectId]);

  const handleSave = async () => {
    if (!token || !project) return;
    setSaving(true);
    setError(null);

    const result = await apiFetch<Project>(`/api/v1/projects/${project.id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({
        name: editName,
        slug: editSlug,
        description: editDescription || undefined,
      }),
    });

    if (result.ok) {
      setProject(result.data);
      setEditing(false);
    } else {
      setError(result.error.message);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!token || !project) return;
    if (!window.confirm(`Delete project "${project.name}"? This cannot be undone.`)) return;

    setDeleting(true);
    const result = await apiFetch(`/api/v1/projects/${project.id}`, {
      method: "DELETE",
      token,
    });

    if (result.ok) {
      router.push("/projects");
    } else {
      setError(result.error.message);
      setDeleting(false);
    }
  };

  if (isLoading || !user) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="breadcrumb">
          <Link href="/projects">Projects</Link>
          <IconChevronRight size={12} className="breadcrumb-separator" />
          <span className="text-[rgb(var(--color-text-primary))]">
            {project?.name ?? "Project"}
          </span>
        </nav>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-[rgb(var(--color-error)/0.3)] bg-[rgb(var(--color-error)/0.08)] px-4 py-3 text-sm text-[rgb(var(--color-error))]">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            <div className="skeleton h-8 w-64" />
            <div className="skeleton h-4 w-32" />
            <div className="skeleton h-32 w-full rounded-lg" />
          </div>
        ) : !project ? (
          <div className="empty-state">
            <p className="empty-state-title">Project not found</p>
            <Link
              href="/projects"
              className="mt-2 text-sm font-medium text-[rgb(var(--color-brand))]"
            >
              Back to Projects
            </Link>
          </div>
        ) : !editing ? (
          <>
            {/* View mode */}
            <div className="page-header flex items-center justify-between">
              <div>
                <h1 className="page-title">{project.name}</h1>
                <p className="page-description font-mono text-xs">
                  {project.slug}
                </p>
              </div>
              {canEdit && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditing(true)}
                    className="rounded-lg border border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-primary))] px-4 py-2 text-sm font-medium text-[rgb(var(--color-text-secondary))] transition-colors hover:bg-[rgb(var(--color-bg-secondary))]"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="rounded-lg border border-[rgb(var(--color-error)/0.3)] px-4 py-2 text-sm font-medium text-[rgb(var(--color-error))] transition-colors hover:bg-[rgb(var(--color-error)/0.08)] disabled:opacity-50"
                  >
                    {deleting ? "Deleting..." : "Delete"}
                  </button>
                </div>
              )}
            </div>

            <div className="card max-w-2xl space-y-4">
              <div>
                <span className="text-xs font-medium uppercase tracking-wider text-[rgb(var(--color-text-tertiary))]">
                  Description
                </span>
                <p className="mt-1 text-sm text-[rgb(var(--color-text-secondary))]">
                  {project.description || "No description provided."}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-[rgb(var(--color-border-primary))] pt-4">
                <div>
                  <span className="text-xs font-medium uppercase tracking-wider text-[rgb(var(--color-text-tertiary))]">
                    Created
                  </span>
                  <p className="mt-1 text-sm text-[rgb(var(--color-text-secondary))]">
                    {new Date(project.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium uppercase tracking-wider text-[rgb(var(--color-text-tertiary))]">
                    Updated
                  </span>
                  <p className="mt-1 text-sm text-[rgb(var(--color-text-secondary))]">
                    {new Date(project.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Edit mode */}
            <div className="page-header">
              <h1 className="page-title">Edit Project</h1>
            </div>

            <div className="card max-w-2xl">
              <div className="space-y-6">
                <div className="space-y-1.5">
                  <label
                    htmlFor="edit-name"
                    className="block text-sm font-medium text-[rgb(var(--color-text-primary))]"
                  >
                    Name
                  </label>
                  <input
                    id="edit-name"
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="input"
                    required
                    maxLength={255}
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="edit-slug"
                    className="block text-sm font-medium text-[rgb(var(--color-text-primary))]"
                  >
                    Slug
                  </label>
                  <input
                    id="edit-slug"
                    type="text"
                    value={editSlug}
                    onChange={(e) => setEditSlug(e.target.value)}
                    className="input font-mono text-sm"
                    required
                    maxLength={63}
                    pattern="[a-z0-9-]+"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="edit-description"
                    className="block text-sm font-medium text-[rgb(var(--color-text-primary))]"
                  >
                    Description
                  </label>
                  <textarea
                    id="edit-description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="input min-h-[80px] resize-y"
                    rows={3}
                    maxLength={2000}
                  />
                </div>

                <div className="flex items-center gap-3 border-t border-[rgb(var(--color-border-primary))] pt-6">
                  <button
                    onClick={handleSave}
                    disabled={saving || !editName || !editSlug}
                    className="inline-flex items-center gap-2 rounded-lg bg-[rgb(var(--color-brand))] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-[rgb(var(--color-brand-dark))] disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setEditName(project.name);
                      setEditSlug(project.slug);
                      setEditDescription(project.description ?? "");
                    }}
                    className="rounded-lg border border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-primary))] px-5 py-2.5 text-sm font-medium text-[rgb(var(--color-text-secondary))] transition-colors hover:bg-[rgb(var(--color-bg-secondary))]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
