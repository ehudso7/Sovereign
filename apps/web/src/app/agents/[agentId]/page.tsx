"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

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
  const canRun = role === "org_owner" || role === "org_admin" || role === "org_member";

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
      apiFetch<AgentVersion[]>(`/api/v1/agents/${agentId}/versions`, { token }),
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
      body: JSON.stringify({ name: editName, description: editDescription || undefined }),
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
    if (!token || !confirm("Archive this agent? Published versions will be unpublished.")) return;
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
    const result = await apiFetch<{ id: string }>(`/api/v1/agents/${agentId}/runs`, {
      method: "POST",
      token,
      body: JSON.stringify({}),
    });
    if (result.ok) {
      router.push(`/runs/${result.data.id}`);
    } else {
      setError(result.error.message);
      setStartingRun(false);
    }
  };

  const handleUnpublish = async () => {
    if (!token) return;
    const result = await apiFetch<Agent>(`/api/v1/agents/${agentId}/unpublish`, {
      method: "POST",
      token,
    });
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
        <p className="text-gray-400">Loading agent...</p>
      </AppShell>
    );
  }

  if (!agent) {
    return (
      <AppShell>
        <div className="rounded border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-medium text-red-700">Agent not found</p>
          <p className="text-sm text-red-600">{error}</p>
          <Link href="/agents" className="mt-2 inline-block text-sm text-gray-600 underline">
            Back to Agents
          </Link>
        </div>
      </AppShell>
    );
  }

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-gray-100 text-gray-700",
      published: "bg-green-100 text-green-700",
      archived: "bg-red-100 text-red-700",
    };
    return (
      <span className={`rounded px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-gray-100"}`}>
        {status}
      </span>
    );
  };

  const publishedVersion = versions.find((v) => v.published);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Link href="/agents" className="text-sm text-gray-500 hover:text-gray-700">
            &larr; Back to Agents
          </Link>
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Agent header */}
        <div className="flex items-start justify-between">
          <div>
            {editing ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="block rounded border border-gray-300 px-3 py-2 text-lg font-bold"
                />
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="block w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Description"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded bg-gray-900 px-3 py-1 text-sm text-white hover:bg-gray-700 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setEditName(agent.name);
                      setEditDescription(agent.description ?? "");
                    }}
                    className="rounded bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold">{agent.name}</h1>
                <p className="text-sm text-gray-500">{agent.slug}</p>
                {agent.description && <p className="mt-1 text-gray-600">{agent.description}</p>}
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            {statusBadge(agent.status)}
            {canRun && agent.status === "published" && (
              <button
                onClick={handleStartRun}
                disabled={startingRun}
                className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {startingRun ? "Starting..." : "Run"}
              </button>
            )}
            {canEdit && agent.status !== "archived" && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="rounded bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
              >
                Edit
              </button>
            )}
            {canPublish && agent.status === "published" && (
              <button
                onClick={handleUnpublish}
                className="rounded bg-yellow-100 px-3 py-1 text-sm text-yellow-700 hover:bg-yellow-200"
              >
                Unpublish
              </button>
            )}
            {canArchive && agent.status !== "archived" && (
              <button
                onClick={handleArchive}
                className="rounded bg-red-100 px-3 py-1 text-sm text-red-700 hover:bg-red-200"
              >
                Archive
              </button>
            )}
          </div>
        </div>

        {/* Published version summary */}
        {publishedVersion && (
          <div className="rounded border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-medium text-green-700">
              Published: Version {publishedVersion.version}
            </p>
            <p className="text-xs text-green-600">
              Published at {new Date(publishedVersion.publishedAt!).toLocaleString()}
            </p>
          </div>
        )}

        {/* Versions */}
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Versions</h2>
            {canEdit && agent.status !== "archived" && (
              <Link
                href={`/agents/${agentId}/versions/new`}
                className="rounded bg-gray-900 px-3 py-1 text-sm text-white hover:bg-gray-700"
              >
                New Version
              </Link>
            )}
          </div>

          {versions.length === 0 ? (
            <div className="mt-4 rounded border border-gray-200 p-6 text-center text-gray-400">
              No versions yet. Create a draft version to get started.
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {versions.map((v) => (
                <Link
                  key={v.id}
                  href={`/agents/${agentId}/versions/${v.id}`}
                  className="block rounded border border-gray-200 p-3 hover:border-gray-300 hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Version {v.version}</p>
                      <p className="text-xs text-gray-400">
                        Created {new Date(v.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {v.published ? (
                      <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Published
                      </span>
                    ) : (
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        Draft
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
