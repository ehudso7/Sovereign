"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import {
  IconAgents,
  IconPlus,
  IconSearch,
  IconChevronRight,
} from "@/components/icons";

interface Agent {
  id: string;
  name: string;
  slug: string;
  description?: string;
  status: "draft" | "published" | "archived";
  projectId: string;
  createdAt: string;
}

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
] as const;

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

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="stat-card">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton mt-2 h-7 w-12" />
          </div>
        ))}
      </div>
      {/* Table skeleton */}
      <div className="table-container">
        <div className="table-header px-4 py-3">
          <div className="skeleton h-3 w-32" />
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="table-row px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="skeleton h-4 w-40" />
                <div className="skeleton h-3 w-64" />
              </div>
              <div className="skeleton h-5 w-16 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
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
    const query = statusFilter ? `?status=${statusFilter}` : "";
    apiFetch<Agent[]>(`/api/v1/agents${query}`, { token }).then((result) => {
      if (result.ok) {
        setAgents(result.data);
      } else {
        setError(result.error.message);
      }
      setLoading(false);
    });
  }, [token, statusFilter]);

  const filteredAgents = useMemo(() => {
    if (!searchQuery.trim()) return agents;
    const q = searchQuery.toLowerCase();
    return agents.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.slug.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q),
    );
  }, [agents, searchQuery]);

  if (isLoading || !user) return null;

  const canCreate = role === "org_owner" || role === "org_admin";

  const counts = {
    total: agents.length,
    published: agents.filter((a) => a.status === "published").length,
    draft: agents.filter((a) => a.status === "draft").length,
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="page-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title">Agents</h1>
            <p className="page-description">
              Manage and monitor your AI agents across all projects
            </p>
          </div>
          {canCreate && (
            <Link
              href="/agents/new"
              className="inline-flex items-center gap-2 rounded-lg bg-[rgb(var(--color-brand))] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-[rgb(var(--color-brand-dark))] hover:shadow-md"
            >
              <IconPlus size={16} />
              Create Agent
            </Link>
          )}
        </div>

        {/* Error Banner */}
        {error && (
          <div className="flex items-center gap-3 rounded-lg border border-[rgb(var(--color-error)/0.3)] bg-[rgb(var(--color-error-bg))] px-4 py-3 text-sm text-[rgb(var(--color-error))]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="stat-card">
                <span className="stat-label">Total Agents</span>
                <span className="stat-value">{counts.total}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Published</span>
                <div className="flex items-center gap-2">
                  <span className="stat-value">{counts.published}</span>
                  <span className="status-dot-success-pulse" />
                </div>
              </div>
              <div className="stat-card">
                <span className="stat-label">Draft</span>
                <span className="stat-value">{counts.draft}</span>
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
                  placeholder="Search agents..."
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

            {/* Agent Table or Empty State */}
            {filteredAgents.length === 0 ? (
              <div className="empty-state">
                <IconAgents size={48} className="empty-state-icon" />
                <p className="empty-state-title">
                  {searchQuery
                    ? "No agents match your search"
                    : "No agents yet"}
                </p>
                <p className="empty-state-description">
                  {searchQuery
                    ? "Try adjusting your search query or filters."
                    : "Create your first agent to get started with AI automation."}
                </p>
                {!searchQuery && canCreate && (
                  <Link
                    href="/agents/new"
                    className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[rgb(var(--color-brand))] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[rgb(var(--color-brand-dark))]"
                  >
                    <IconPlus size={16} />
                    Create Agent
                  </Link>
                )}
              </div>
            ) : (
              <div className="table-container">
                <table className="w-full">
                  <thead>
                    <tr className="table-header">
                      <th className="px-4 py-3 text-left">Agent</th>
                      <th className="hidden px-4 py-3 text-left md:table-cell">
                        Slug
                      </th>
                      <th className="hidden px-4 py-3 text-left sm:table-cell">
                        Status
                      </th>
                      <th className="hidden px-4 py-3 text-left lg:table-cell">
                        Created
                      </th>
                      <th className="px-4 py-3 text-right">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAgents.map((agent) => (
                      <tr
                        key={agent.id}
                        className="table-row cursor-pointer"
                        onClick={() => router.push(`/agents/${agent.id}`)}
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--color-bg-tertiary))]">
                              <IconAgents
                                size={18}
                                className="text-[rgb(var(--color-text-secondary))]"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-[rgb(var(--color-text-primary))]">
                                {agent.name}
                              </p>
                              {agent.description && (
                                <p className="truncate text-xs text-[rgb(var(--color-text-tertiary))]">
                                  {agent.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3.5 md:table-cell">
                          <code className="rounded bg-[rgb(var(--color-bg-tertiary))] px-1.5 py-0.5 text-xs text-[rgb(var(--color-text-secondary))]">
                            {agent.slug}
                          </code>
                        </td>
                        <td className="hidden px-4 py-3.5 sm:table-cell">
                          <span className={statusBadgeClass(agent.status)}>
                            <span className={statusDotClass(agent.status)} />
                            {agent.status}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3.5 text-xs text-[rgb(var(--color-text-tertiary))] lg:table-cell">
                          {new Date(agent.createdAt).toLocaleDateString(
                            undefined,
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            },
                          )}
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
