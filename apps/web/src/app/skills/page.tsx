"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";

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

export default function SkillsPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [installed, setInstalled] = useState<SkillInstall[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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

  const trustBadge = (tier: string) => {
    const colors: Record<string, string> = {
      verified: "bg-green-100 text-green-700",
      internal: "bg-blue-100 text-blue-700",
      untrusted: "bg-yellow-100 text-yellow-700",
    };
    return (
      <span className={`rounded px-2 py-0.5 text-xs font-medium ${colors[tier] ?? "bg-gray-100 text-gray-700"}`}>
        {tier}
      </span>
    );
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Skills</h1>
          <p className="text-gray-500">Skills bundle connectors into reusable agent capabilities</p>
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-gray-400">Loading skills...</p>
        ) : skills.length === 0 ? (
          <div className="rounded border border-gray-200 p-8 text-center text-gray-400">
            No skills available.
          </div>
        ) : (
          <div className="space-y-3">
            {skills.map((skill) => {
              const skillInstalled = isInstalled(skill.id);
              return (
                <div
                  key={skill.id}
                  className="rounded border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{skill.name}</p>
                        {trustBadge(skill.trustTier)}
                        {skillInstalled && (
                          <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            Installed
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{skill.slug}</p>
                      <p className="mt-1 text-sm text-gray-400">{skill.description}</p>
                      <div className="mt-2 flex gap-1">
                        {skill.connectorSlugs.map((slug) => (
                          <span
                            key={slug}
                            className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                          >
                            {slug}
                          </span>
                        ))}
                      </div>
                    </div>
                    {canManage && (
                      <div className="ml-4">
                        {skillInstalled ? (
                          <button
                            onClick={() => handleUninstall(skill.id)}
                            disabled={actionLoading === skill.id}
                            className="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-500 disabled:opacity-50"
                          >
                            {actionLoading === skill.id ? "..." : "Uninstall"}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleInstall(skill.id)}
                            disabled={actionLoading === skill.id}
                            className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-700 disabled:opacity-50"
                          >
                            {actionLoading === skill.id ? "..." : "Install"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
