"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { IconMemory, IconSearch, IconPlus } from "@/components/icons";
import Link from "next/link";

interface Memory {
  id: string;
  scopeType: string;
  scopeId: string;
  kind: string;
  status: string;
  title: string;
  summary: string;
  sourceRunId: string | null;
  sourceAgentId: string | null;
  createdAt: string;
  updatedAt: string;
}

const KIND_FILTERS = ["all", "semantic", "episodic", "procedural"] as const;
const STATUS_FILTERS = ["all", "active", "redacted", "expired", "deleted"] as const;
type KindFilter = (typeof KIND_FILTERS)[number];
type StatusFilter = (typeof STATUS_FILTERS)[number];

function kindBadgeClass(kind: string): string {
  const map: Record<string, string> = {
    semantic: "badge-info",
    episodic: "badge-neutral",
    procedural: "badge-success",
  };
  return map[kind] ?? "badge-neutral";
}

function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    active: "badge-success",
    redacted: "badge-error",
    expired: "badge-warning",
    deleted: "badge-neutral",
  };
  return map[status] ?? "badge-neutral";
}

function MemoriesContent() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [memories, setMemories] = useState<Memory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>(
    (searchParams.get("kind") as KindFilter) || "all",
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    (searchParams.get("status") as StatusFilter) || "active",
  );

  useEffect(() => {
    if (!isLoading && !user) router.push("/auth/sign-in");
  }, [isLoading, user, router]);

  const loadMemories = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (kindFilter !== "all") params.set("kind", kindFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    const query = params.toString() ? `?${params.toString()}` : "";

    const result = await apiFetch<Memory[]>(`/api/v1/memories${query}`, { token });
    if (result.ok) {
      setMemories(result.data);
    } else {
      setError(result.error.message);
    }
    setLoading(false);
  }, [token, kindFilter, statusFilter]);

  useEffect(() => {
    loadMemories();
  }, [loadMemories]);

  if (isLoading || !user) return null;

  const filtered = memories.filter((m) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.title.toLowerCase().includes(q) ||
      (m.summary && m.summary.toLowerCase().includes(q))
    );
  });

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page header */}
        <div className="page-header flex items-start justify-between">
          <div>
            <h1 className="page-title">Memories</h1>
            <p className="page-description">
              Agent memory store for semantic, episodic, and procedural knowledge
            </p>
          </div>
          <Link
            href="/memories/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-[rgb(var(--color-brand))] px-3.5 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
          >
            <IconPlus size={16} />
            Create Memory
          </Link>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <IconSearch
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-tertiary))]"
          />
          <input
            type="text"
            placeholder="Search memories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-8">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-[rgb(var(--color-text-tertiary))]">
              Kind
            </p>
            <div className="flex flex-wrap gap-1.5">
              {KIND_FILTERS.map((k) => (
                <button
                  key={k}
                  onClick={() => setKindFilter(k)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    kindFilter === k
                      ? "bg-[rgb(var(--color-brand))] text-white"
                      : "bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))]"
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-[rgb(var(--color-text-tertiary))]">
              Status
            </p>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    statusFilter === s
                      ? "bg-[rgb(var(--color-brand))] text-white"
                      : "bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))]"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="card border-[rgb(var(--color-error))] bg-[rgb(var(--color-error-bg,var(--color-bg-secondary)))]">
            <p className="text-sm text-[rgb(var(--color-error))]">{error}</p>
          </div>
        )}

        {/* Loading skeleton */}
        {loading ? (
          <div className="table-container">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left">Title</th>
                  <th className="px-4 py-3 text-left">Kind</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Summary</th>
                  <th className="px-4 py-3 text-left">Updated</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="table-row">
                    <td className="px-4 py-3"><div className="skeleton h-4 w-36" /></td>
                    <td className="px-4 py-3"><div className="skeleton h-5 w-16 rounded-full" /></td>
                    <td className="px-4 py-3"><div className="skeleton h-5 w-14 rounded-full" /></td>
                    <td className="px-4 py-3"><div className="skeleton h-4 w-48" /></td>
                    <td className="px-4 py-3"><div className="skeleton h-4 w-28" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <IconMemory className="empty-state-icon" size={48} />
            <p className="empty-state-title">
              {searchQuery ? "No memories match your search" : "No memories found"}
            </p>
            <p className="empty-state-description">
              {searchQuery
                ? "Try adjusting your search query or filters."
                : "Create one manually or run a memory-enabled agent to populate the memory store."}
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left">Title</th>
                  <th className="px-4 py-3 text-left">Kind</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Summary</th>
                  <th className="px-4 py-3 text-left">Updated</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} className="table-row">
                    <td className="px-4 py-3">
                      <Link
                        href={`/memories/${m.id}`}
                        className="group flex flex-col"
                      >
                        <span className="text-sm font-medium text-[rgb(var(--color-text-primary))] group-hover:text-[rgb(var(--color-brand))] transition-colors truncate max-w-[200px]">
                          {m.title}
                        </span>
                        <span className="text-xs text-[rgb(var(--color-text-tertiary))]">
                          {m.scopeType}:{m.scopeId.slice(0, 8)}...
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={kindBadgeClass(m.kind)}>{m.kind}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={statusBadgeClass(m.status)}>{m.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block max-w-[300px] truncate text-sm text-[rgb(var(--color-text-secondary))]">
                        {m.summary || "No summary"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-[rgb(var(--color-text-tertiary))]">
                        {new Date(m.updatedAt).toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function MemoriesPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="space-y-6">
            <div className="page-header">
              <div className="skeleton h-7 w-36" />
              <div className="skeleton mt-2 h-4 w-64" />
            </div>
            <div className="skeleton h-9 w-64 rounded-md" />
          </div>
        </AppShell>
      }
    >
      <MemoriesContent />
    </Suspense>
  );
}
