"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { IconSkills, IconSearch } from "@/components/icons";

interface Skill {
  id: string;
  slug: string;
  name: string;
  description: string;
  trustTier: string;
  connectorSlugs: string[];
}

interface SkillInstall {
  id: string;
  skillId: string;
  skillSlug: string;
  enabled: boolean;
  createdAt: string;
}

function trustBadgeClass(tier: string): string {
  const map: Record<string, string> = {
    verified: "badge-success",
    internal: "badge-info",
    untrusted: "badge-warning",
  };
  return map[tier] ?? "badge-neutral";
}

export default function SkillsPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [installed, setInstalled] = useState<SkillInstall[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const [catalogResult, installedResult] = await Promise.all([
      apiFetch<Skill[]>("/api/v1/skills", { token }),
      apiFetch<SkillInstall[]>("/api/v1/skills/installed", { token }),
    ]);

    if (catalogResult.ok) {
      setSkills(catalogResult.data);
    } else {
      setError(catalogResult.error.message);
    }

    if (installedResult.ok) {
      setInstalled(installedResult.data);
    }

    setLoading(false);
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const canManage = role === "org_owner" || role === "org_admin";

  const isInstalled = (skillId: string) => installed.some((i) => i.skillId === skillId);

  const handleInstall = async (skillId: string) => {
    if (!token) return;
    setActionLoading(skillId);
    setError(null);
    const result = await apiFetch<SkillInstall>(`/api/v1/skills/${skillId}/install`, {
      token,
      method: "POST",
      body: JSON.stringify({}),
    });
    if (result.ok) {
      setInstalled((prev) => [...prev, result.data]);
    } else {
      setError(result.error.message);
    }
    setActionLoading(null);
  };

  const handleUninstall = async (skillId: string) => {
    if (!token) return;
    setActionLoading(skillId);
    setError(null);
    const result = await apiFetch<{ success: boolean }>(`/api/v1/skills/${skillId}/uninstall`, {
      token,
      method: "POST",
      body: JSON.stringify({}),
    });
    if (result.ok) {
      setInstalled((prev) => prev.filter((i) => i.skillId !== skillId));
    } else {
      setError(result.error.message);
    }
    setActionLoading(null);
  };

  if (isLoading || !user) return null;

  const filtered = skills.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.slug.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q)
    );
  });

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page header */}
        <div className="page-header">
          <h1 className="page-title">Skills</h1>
          <p className="page-description">
            Skills bundle connectors into reusable agent capabilities
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <IconSearch
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-tertiary))]"
          />
          <input
            type="text"
            placeholder="Search skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9"
          />
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
                    <div className="skeleton h-4 w-32" />
                    <div className="skeleton h-3 w-20" />
                  </div>
                </div>
                <div className="skeleton h-3 w-full" />
                <div className="skeleton h-3 w-2/3" />
                <div className="flex gap-2">
                  <div className="skeleton h-5 w-16 rounded-full" />
                  <div className="skeleton h-5 w-12 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <IconSkills className="empty-state-icon" size={48} />
            <p className="empty-state-title">
              {searchQuery ? "No skills match your search" : "No skills available"}
            </p>
            <p className="empty-state-description">
              {searchQuery
                ? "Try adjusting your search query."
                : "Skills will appear here once they are registered in the catalog."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((skill) => {
              const skillInstalled = isInstalled(skill.id);
              return (
                <div key={skill.id} className="card-hover flex flex-col gap-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--color-bg-tertiary))]">
                        <IconSkills
                          size={20}
                          className="text-[rgb(var(--color-text-secondary))]"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[rgb(var(--color-text-primary))]">
                          {skill.name}
                        </p>
                        <p className="truncate text-xs text-[rgb(var(--color-text-tertiary))]">
                          {skill.slug}
                        </p>
                      </div>
                    </div>
                    {skillInstalled && (
                      <span className="badge-success shrink-0">Installed</span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-sm leading-relaxed text-[rgb(var(--color-text-secondary))] line-clamp-2">
                    {skill.description}
                  </p>

                  {/* Connector slugs + trust badge */}
                  <div className="flex flex-wrap gap-1.5">
                    <span className={trustBadgeClass(skill.trustTier)}>
                      {skill.trustTier}
                    </span>
                    {skill.connectorSlugs.map((slug) => (
                      <span key={slug} className="badge-neutral">
                        {slug}
                      </span>
                    ))}
                  </div>

                  {/* Action */}
                  {canManage && (
                    <div className="mt-auto border-t border-[rgb(var(--color-border-secondary))] pt-3">
                      {skillInstalled ? (
                        <button
                          onClick={() => handleUninstall(skill.id)}
                          disabled={actionLoading === skill.id}
                          className="w-full rounded-md border border-[rgb(var(--color-error))] px-3 py-1.5 text-sm font-medium text-[rgb(var(--color-error))] transition-colors hover:bg-[rgb(var(--color-error))] hover:text-white disabled:opacity-50"
                        >
                          {actionLoading === skill.id ? "Removing..." : "Uninstall"}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleInstall(skill.id)}
                          disabled={actionLoading === skill.id}
                          className="w-full rounded-md bg-[rgb(var(--color-brand))] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                        >
                          {actionLoading === skill.id ? "Installing..." : "Install"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
