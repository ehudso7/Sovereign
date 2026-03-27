"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import {
  IconAgents,
  IconChevronRight,
  IconPlus,
  IconClock,
  IconRuns,
} from "@/components/icons";

interface Agent {
  id: string;
  name: string;
  slug: string;
  description?: string;
  status: "draft" | "published" | "archived";
  projectId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface AgentVersion {
  id: string;
  version: number;
  instructions: string;
  published: boolean;
  publishedAt?: string;
  createdAt: string;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "published":
      return "badge-success";
    case "archived":
      return "badge-error";
    case "draft":
    default:
      return "badge-neutral";
  }
}

function statusDotClass(status: string): string {
  switch (status) {
    case "published":
      return "status-dot-success";
    case "archived":
      return "status-dot-error";
    case "draft":
    default:
      return "status-dot-neutral";
  }
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-2">
        <div className="skeleton h-4 w-14" />
        <div className="skeleton h-4 w-3" />
        <div className="skeleton h-4 w-24" />
      </div>
      {/* Header skeleton */}
      <div className="card">
        <div className="flex items-start justify-between">
          <div className="space-y-3">
            <div className="skeleton h-7 w-48" />
            <div className="skeleton h-4 w-32" />
            <div className="skeleton h-4 w-72" />
          </div>
          <div className="skeleton h-6 w-20 rounded-full" />
        </div>
      </div>
      {/* Stats skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="stat-card">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton mt-2 h-7 w-12" />
          </div>
        ))}
      </div>
      {/* Versions skeleton */}
      <div className="card space-y-4">
        <div className="skeleton h-5 w-20" />
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between rounded-lg border border-[rgb(var(--color-border-secondary))] p-4">
            <div className="space-y-2">
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-3 w-40" />
            </div>
            <div className="skeleton h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AgentDetailPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const agentId = params.agentId as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [versions, setVersions] = useState<AgentVersion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const canEdit = role === "org_owner" || role === "org_admin";
  const canPublish = role === "org_owner" || role === "org_admin";
  const canArchive = role === "org_owner" || role === "org_admin";
  const canRun =
    role === "org_owner" || role === "org_admin" || role === "org_member";

  const [startingRun, setStartingRun] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  const loadAgent = useCallback(async () => {
    if (!token) return;
    setLoading(true);

    const [agentResult, versionsResult] = await Promise.all([
      apiFetch<Agent>(`/api/v1/agents/${agentId}`, { token }),
      apiFetch<AgentVersion[]>(`/api/v1/agents/${agentId}/versions`, {
        token,
      }),
    ]);

    if (agentResult.ok) {
      setAgent(agentResult.data);
      setEditName(agentResult.data.name);
      setEditDescription(agentResult.data.description ?? "");
    } else {
      setError(agentResult.error.message);
    }

    if (versionsResult.ok) {
      setVersions(versionsResult.data);
    }

    setLoading(false);
  }, [token, agentId]);

  useEffect(() => {
    loadAgent();
  }, [loadAgent]);

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    const result = await apiFetch<Agent>(`/api/v1/agents/${agentId}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({
        name: editName,
        description: editDescription || undefined,
      }),
    });
    if (result.ok) {
      setAgent(result.data);
      setEditing(false);
    } else {
      setError(result.error.message);
    }
    setSaving(false);
  };

  const handleArchive = async () => {
    if (
      !token ||
      !confirm("Archive this agent? Published versions will be unpublished.")
    )
      return;
    const result = await apiFetch<Agent>(`/api/v1/agents/${agentId}`, {
      method: "DELETE",
      token,
    });
    if (result.ok) {
      setAgent(result.data);
      await loadAgent();
    } else {
      setError(result.error.message);
    }
  };

  const handleStartRun = async () => {
    if (!token) return;
    setStartingRun(true);
    const result = await apiFetch<{ id: string }>(
      `/api/v1/agents/${agentId}/runs`,
      {
        method: "POST",
        token,
        body: JSON.stringify({}),
      },
    );
    if (result.ok) {
      router.push(`/runs/${result.data.id}`);
    } else {
      setError(result.error.message);
      setStartingRun(false);
    }
  };

  const handleUnpublish = async () => {
    if (!token) return;
    const result = await apiFetch<Agent>(
      `/api/v1/agents/${agentId}/unpublish`,
      {
        method: "POST",
        token,
      },
    );
    if (result.ok) {
      await loadAgent();
    } else {
      setError(result.error.message);
    }
  };

  if (isLoading || !user) return null;

  if (loading) {
    return (
      <AppShell>
        <DetailSkeleton />
      </AppShell>
    );
  }

  if (!agent) {
    return (
      <AppShell>
        <div className="space-y-6">
          <nav className="breadcrumb">
            <Link href="/agents">Agents</Link>
            <IconChevronRight size={12} className="breadcrumb-separator" />
            <span className="text-[rgb(var(--color-text-primary))]">
              Not Found
            </span>
          </nav>
          <div className="empty-state">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgb(var(--color-error-bg))]">
              <IconAgents
                size={24}
                className="text-[rgb(var(--color-error))]"
              />
            </div>
            <p className="empty-state-title">Agent Not Found</p>
            <p className="empty-state-description">
              {error ??
                "The agent you are looking for does not exist or has been removed."}
            </p>
            <Link
              href="/agents"
              className="mt-2 text-sm font-medium text-[rgb(var(--color-brand))] transition-colors hover:text-[rgb(var(--color-brand-dark))]"
            >
              Back to Agents
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const publishedVersion = versions.find((v) => v.published);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="breadcrumb">
          <Link href="/agents">Agents</Link>
          <IconChevronRight size={12} className="breadcrumb-separator" />
          <span className="text-[rgb(var(--color-text-primary))]">
            {agent.name}
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
            <button
              onClick={() => setError(null)}
              className="ml-auto text-[rgb(var(--color-error))] hover:opacity-70"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* Agent Header Card */}
        <div className="card">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--color-bg-tertiary))]">
                <IconAgents
                  size={24}
                  className="text-[rgb(var(--color-text-secondary))]"
                />
              </div>
              <div className="min-w-0">
                {editing ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="input text-lg font-bold"
                    />
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="input min-h-[60px] resize-y"
                      rows={2}
                      placeholder="Description"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[rgb(var(--color-brand))] px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[rgb(var(--color-brand-dark))] disabled:opacity-50"
                      >
                        {saving ? (
                          <>
                            <svg
                              className="h-3.5 w-3.5 animate-spin"
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
                            Saving...
                          </>
                        ) : (
                          "Save Changes"
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setEditing(false);
                          setEditName(agent.name);
                          setEditDescription(agent.description ?? "");
                        }}
                        className="rounded-lg border border-[rgb(var(--color-border-primary))] px-3.5 py-1.5 text-sm font-medium text-[rgb(var(--color-text-secondary))] transition-colors hover:bg-[rgb(var(--color-bg-secondary))]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <h1 className="page-title">{agent.name}</h1>
                      <span className={statusBadgeClass(agent.status)}>
                        <span className={statusDotClass(agent.status)} />
                        {agent.status}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="rounded bg-[rgb(var(--color-bg-tertiary))] px-1.5 py-0.5 text-xs text-[rgb(var(--color-text-secondary))]">
                        {agent.slug}
                      </code>
                    </div>
                    {agent.description && (
                      <p className="mt-2 text-sm text-[rgb(var(--color-text-secondary))]">
                        {agent.description}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            {!editing && (
              <div className="flex flex-wrap items-center gap-2">
                {canRun && agent.status === "published" && (
                  <button
                    onClick={handleStartRun}
                    disabled={startingRun}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[rgb(var(--color-brand))] px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-[rgb(var(--color-brand-dark))] hover:shadow-md disabled:opacity-50"
                  >
                    <IconRuns size={16} />
                    {startingRun ? "Starting..." : "Run Agent"}
                  </button>
                )}
                {canEdit && agent.status !== "archived" && (
                  <button
                    onClick={() => setEditing(true)}
                    className="rounded-lg border border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-primary))] px-3.5 py-2 text-sm font-medium text-[rgb(var(--color-text-secondary))] transition-colors hover:bg-[rgb(var(--color-bg-secondary))] hover:text-[rgb(var(--color-text-primary))]"
                  >
                    Edit
                  </button>
                )}
                {canPublish && agent.status === "published" && (
                  <button
                    onClick={handleUnpublish}
                    className="rounded-lg border border-[rgb(var(--color-warning)/0.3)] bg-[rgb(var(--color-warning-bg))] px-3.5 py-2 text-sm font-medium text-[rgb(var(--color-warning))] transition-colors hover:opacity-80"
                  >
                    Unpublish
                  </button>
                )}
                {canArchive && agent.status !== "archived" && (
                  <button
                    onClick={handleArchive}
                    className="rounded-lg border border-[rgb(var(--color-error)/0.3)] bg-[rgb(var(--color-error-bg))] px-3.5 py-2 text-sm font-medium text-[rgb(var(--color-error))] transition-colors hover:opacity-80"
                  >
                    Archive
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="stat-card">
            <span className="stat-label">Versions</span>
            <span className="stat-value">{versions.length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Published Version</span>
            <span className="stat-value">
              {publishedVersion ? `v${publishedVersion.version}` : "--"}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Created</span>
            <span className="text-sm font-medium text-[rgb(var(--color-text-primary))]">
              {new Date(agent.createdAt).toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        {/* Published Version Banner */}
        {publishedVersion && (
          <div className="flex items-center gap-3 rounded-lg border border-[rgb(var(--color-success)/0.3)] bg-[rgb(var(--color-success-bg))] px-4 py-3">
            <span className="status-dot-success-pulse" />
            <div>
              <p className="text-sm font-medium text-[rgb(var(--color-success))]">
                Version {publishedVersion.version} is live
              </p>
              <p className="flex items-center gap-1 text-xs text-[rgb(var(--color-success))] opacity-80">
                <IconClock size={12} />
                Published{" "}
                {new Date(publishedVersion.publishedAt!).toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* Versions Section */}
        <div className="card">
          <div className="section-header mb-4">
            <div>
              <h2 className="section-title">Versions</h2>
              <p className="section-subtitle mt-0.5">
                Manage agent versions and deployments
              </p>
            </div>
            {canEdit && agent.status !== "archived" && (
              <Link
                href={`/agents/${agentId}/versions/new`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[rgb(var(--color-brand))] px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-[rgb(var(--color-brand-dark))]"
              >
                <IconPlus size={14} />
                New Version
              </Link>
            )}
          </div>

          {versions.length === 0 ? (
            <div className="empty-state">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgb(var(--color-bg-tertiary))]">
                <IconAgents
                  size={24}
                  className="text-[rgb(var(--color-text-tertiary))]"
                />
              </div>
              <p className="empty-state-title">No versions yet</p>
              <p className="empty-state-description">
                Create a draft version to define your agent&apos;s behavior and
                instructions.
              </p>
              {canEdit && agent.status !== "archived" && (
                <Link
                  href={`/agents/${agentId}/versions/new`}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[rgb(var(--color-brand))] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[rgb(var(--color-brand-dark))]"
                >
                  <IconPlus size={14} />
                  Create Version
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {versions.map((v) => (
                <Link
                  key={v.id}
                  href={`/agents/${agentId}/versions/${v.id}`}
                  className="group flex items-center justify-between rounded-lg border border-[rgb(var(--color-border-primary))] p-4 transition-all duration-150 hover:border-[rgb(var(--color-brand)/0.3)] hover:shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--color-bg-tertiary))] text-sm font-bold text-[rgb(var(--color-text-secondary))]">
                      v{v.version}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[rgb(var(--color-text-primary))]">
                        Version {v.version}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-[rgb(var(--color-text-tertiary))]">
                        <IconClock size={12} />
                        {new Date(v.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {v.published ? (
                      <span className="badge-success">
                        <span className="status-dot-success" />
                        Published
                      </span>
                    ) : (
                      <span className="badge-neutral">Draft</span>
                    )}
                    <IconChevronRight
                      size={16}
                      className="text-[rgb(var(--color-text-tertiary))] transition-transform group-hover:translate-x-0.5"
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Metadata Footer */}
        <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-[rgb(var(--color-border-primary))] pt-4 text-xs text-[rgb(var(--color-text-tertiary))]">
          <span>
            Agent ID:{" "}
            <code className="rounded bg-[rgb(var(--color-bg-tertiary))] px-1 py-0.5 font-mono">
              {agent.id}
            </code>
          </span>
          <span>
            Project:{" "}
            <code className="rounded bg-[rgb(var(--color-bg-tertiary))] px-1 py-0.5 font-mono">
              {agent.projectId}
            </code>
          </span>
          <span>
            Updated {new Date(agent.updatedAt).toLocaleString()}
          </span>
        </div>
      </div>
    </AppShell>
  );
}
