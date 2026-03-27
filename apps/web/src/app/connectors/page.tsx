"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { IconConnectors, IconSearch, IconPlus } from "@/components/icons";
import Link from "next/link";

interface Connector {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  trustTier: string;
  authMode: string;
  status: string;
  tools: Array<{ name: string; description: string }>;
  scopes: Array<{ id: string; name: string; description: string }>;
}

const CATEGORIES = ["all", "utility", "data", "communication", "productivity"] as const;

function trustBadgeClass(tier: string): string {
  const map: Record<string, string> = {
    verified: "badge-success",
    internal: "badge-info",
    untrusted: "badge-warning",
  };
  return map[tier] ?? "badge-neutral";
}

function authBadgeLabel(mode: string): string {
  const map: Record<string, string> = {
    none: "No Auth",
    api_key: "API Key",
    oauth2: "OAuth 2.0",
  };
  return map[mode] ?? mode;
}

function statusDotClass(status: string): string {
  const map: Record<string, string> = {
    connected: "status-dot-success",
    disconnected: "status-dot-error",
    pending: "status-dot-warning",
  };
  return map[status] ?? "status-dot-neutral";
}

export default function ConnectorsPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
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
    const query = categoryFilter !== "all" ? `?category=${categoryFilter}` : "";
    apiFetch<Connector[]>(`/api/v1/connectors${query}`, { token }).then((result) => {
      if (result.ok) {
        setConnectors(result.data);
      } else {
        setError(result.error.message);
      }
      setLoading(false);
    });
  }, [token, categoryFilter]);

  if (isLoading || !user) return null;

  const filtered = connectors.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.slug.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q)
    );
  });

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page header */}
        <div className="page-header flex items-start justify-between">
          <div>
            <h1 className="page-title">Connectors</h1>
            <p className="page-description">
              Browse and install connectors to extend your agents
            </p>
          </div>
          <Link
            href="/connectors/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-[rgb(var(--color-brand))] px-3.5 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
          >
            <IconPlus size={16} />
            Add Connector
          </Link>
        </div>

        {/* Search + category filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <IconSearch
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-tertiary))]"
            />
            <input
              type="text"
              placeholder="Search connectors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  categoryFilter === c
                    ? "bg-[rgb(var(--color-brand))] text-white"
                    : "bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))]"
                }`}
              >
                {c}
              </button>
            ))}
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card space-y-3">
                <div className="flex items-center gap-3">
                  <div className="skeleton h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <div className="skeleton h-4 w-28" />
                    <div className="skeleton h-3 w-20" />
                  </div>
                </div>
                <div className="skeleton h-3 w-full" />
                <div className="skeleton h-3 w-3/4" />
                <div className="flex gap-2">
                  <div className="skeleton h-5 w-16 rounded-full" />
                  <div className="skeleton h-5 w-14 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          /* Empty state */
          <div className="empty-state">
            <IconConnectors className="empty-state-icon" size={48} />
            <p className="empty-state-title">
              {searchQuery ? "No connectors match your search" : "No connectors available"}
            </p>
            <p className="empty-state-description">
              {searchQuery
                ? "Try adjusting your search query or filters."
                : "Connectors will appear here once they are registered in the catalog."}
            </p>
          </div>
        ) : (
          /* Connector grid */
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((connector) => (
              <Link
                key={connector.id}
                href={`/connectors/${connector.id}`}
                className="card-hover group flex flex-col gap-3"
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--color-bg-tertiary))]">
                      <IconConnectors
                        size={20}
                        className="text-[rgb(var(--color-text-secondary))]"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[rgb(var(--color-text-primary))]">
                        {connector.name}
                      </p>
                      <p className="truncate text-xs text-[rgb(var(--color-text-tertiary))]">
                        {connector.slug}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={statusDotClass(connector.status)} />
                    <span className="text-xs text-[rgb(var(--color-text-tertiary))] capitalize">
                      {connector.status}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm leading-relaxed text-[rgb(var(--color-text-secondary))] line-clamp-2">
                  {connector.description}
                </p>

                {/* Footer: badges + tool count */}
                <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                  <div className="flex flex-wrap gap-1.5">
                    <span className={trustBadgeClass(connector.trustTier)}>
                      {connector.trustTier}
                    </span>
                    <span className="badge-neutral">
                      {authBadgeLabel(connector.authMode)}
                    </span>
                  </div>
                  <span className="text-xs text-[rgb(var(--color-text-tertiary))]">
                    {connector.tools.length} tool{connector.tools.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
