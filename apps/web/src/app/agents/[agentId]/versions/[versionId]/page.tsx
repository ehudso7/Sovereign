"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

interface AgentVersion {
  id: string;
  agentId: string;
  version: number;
  goals: string[];
  instructions: string;
  tools: { name: string; connectorId?: string; parameters?: Record<string, unknown> }[];
  budget: { maxTokens?: number; maxCostCents?: number; maxRunsPerDay?: number } | null;
  approvalRules: { action: string; requireApproval: boolean; approverRoles?: string[] }[];
  memoryConfig: { mode: string; lanes?: string[] } | null;
  schedule: { enabled: boolean; cron?: string; timezone?: string } | null;
  modelConfig: { provider: string; model: string; temperature?: number; maxTokens?: number };
  published: boolean;
  publishedAt?: string;
  createdBy: string;
  createdAt: string;
}

interface Agent {
  id: string;
  name: string;
  status: string;
}

export default function VersionDetailPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const agentId = params.agentId as string;
  const versionId = params.versionId as string;

  const [version, setVersion] = useState<AgentVersion | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editInstructions, setEditInstructions] = useState("");
  const [editGoals, setEditGoals] = useState("");
  const [editProvider, setEditProvider] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editTemperature, setEditTemperature] = useState("");
  const [editMaxTokens, setEditMaxTokens] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const canEdit = role === "org_owner" || role === "org_admin";
  const canPublish = role === "org_owner" || role === "org_admin";

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);

    const [vResult, aResult] = await Promise.all([
      apiFetch<AgentVersion>(`/api/v1/agents/${agentId}/versions/${versionId}`, {
        token,
        // GET on version detail — use the agentId/versions/:versionId route via PATCH path
      }),
      apiFetch<Agent>(`/api/v1/agents/${agentId}`, { token }),
    ]);

    if (vResult.ok) {
      setVersion(vResult.data);
      setEditInstructions(vResult.data.instructions);
      setEditGoals(vResult.data.goals.join("\n"));
      setEditProvider(vResult.data.modelConfig.provider);
      setEditModel(vResult.data.modelConfig.model);
      setEditTemperature(String(vResult.data.modelConfig.temperature ?? 0.7));
      setEditMaxTokens(String(vResult.data.modelConfig.maxTokens ?? 4096));
    } else {
      setError(vResult.error.message);
    }

    if (aResult.ok) {
      setAgent(aResult.data);
    }

    setLoading(false);
  }, [token, agentId, versionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    setError(null);

    const goalList = editGoals
      .split("\n")
      .map((g) => g.trim())
      .filter((g) => g.length > 0);

    const result = await apiFetch<AgentVersion>(
      `/api/v1/agents/${agentId}/versions/${versionId}`,
      {
        method: "PATCH",
        token,
        body: JSON.stringify({
          instructions: editInstructions,
          goals: goalList,
          modelConfig: {
            provider: editProvider,
            model: editModel,
            temperature: parseFloat(editTemperature),
            maxTokens: parseInt(editMaxTokens, 10),
          },
        }),
      },
    );

    if (result.ok) {
      setVersion(result.data);
      setEditing(false);
    } else {
      setError(result.error.message);
    }
    setSaving(false);
  };

  const handlePublish = async () => {
    if (!token) return;

    // Client-side pre-check
    if (!version?.instructions || version.instructions.trim().length === 0) {
      setError("Cannot publish: instructions are required. Click Edit to add instructions first.");
      return;
    }

    setPublishing(true);
    setError(null);

    const result = await apiFetch<AgentVersion>(
      `/api/v1/agents/${agentId}/versions/${versionId}/publish`,
      { method: "POST", token },
    );

    if (result.ok) {
      await loadData();
    } else {
      setError(result.error.message);
    }
    setPublishing(false);
  };

  if (isLoading || !user) return null;

  if (loading) {
    return (
      <AppShell>
        <p className="text-gray-400">Loading version...</p>
      </AppShell>
    );
  }

  if (!version) {
    return (
      <AppShell>
        <div className="rounded border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-medium text-red-700">Version not found</p>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </AppShell>
    );
  }

  const isDraft = !version.published;
  const isArchived = agent?.status === "archived";

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Link
            href={`/agents/${agentId}`}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            &larr; Back to Agent{agent ? `: ${agent.name}` : ""}
          </Link>
        </div>

        {error && (
          <div className="flex items-center gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">&times;</button>
          </div>
        )}

        {/* Version header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Version {version.version}</h1>
            <p className="text-sm text-gray-500">
              Created {new Date(version.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {version.published ? (
              <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                Published
                {version.publishedAt && (
                  <span className="ml-1">
                    ({new Date(version.publishedAt).toLocaleDateString()})
                  </span>
                )}
              </span>
            ) : (
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                Draft
              </span>
            )}

            {canEdit && isDraft && !isArchived && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="rounded bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
              >
                Edit
              </button>
            )}

            {canPublish && isDraft && !isArchived && (
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700 disabled:opacity-50"
              >
                {publishing ? "Publishing..." : "Publish"}
              </button>
            )}

            {version.published && (
              <span className="text-xs text-gray-400">Published versions are immutable</span>
            )}
          </div>
        </div>

        {/* Content */}
        {editing ? (
          <div className="max-w-2xl space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Goals</label>
              <textarea
                value={editGoals}
                onChange={(e) => setEditGoals(e.target.value)}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm"
                rows={3}
                placeholder="One goal per line"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Instructions</label>
              <textarea
                value={editInstructions}
                onChange={(e) => setEditInstructions(e.target.value)}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm"
                rows={10}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Provider</label>
                <input
                  type="text"
                  value={editProvider}
                  onChange={(e) => setEditProvider(e.target.value)}
                  className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Model</label>
                <input
                  type="text"
                  value={editModel}
                  onChange={(e) => setEditModel(e.target.value)}
                  className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Temperature</label>
                <input
                  type="number"
                  value={editTemperature}
                  onChange={(e) => setEditTemperature(e.target.value)}
                  className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
                  min="0"
                  max="2"
                  step="0.1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Max Tokens</label>
                <input
                  type="number"
                  value={editMaxTokens}
                  onChange={(e) => setEditMaxTokens(e.target.value)}
                  className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
                  min="1"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="rounded bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Goals */}
            {version.goals.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700">Goals</h3>
                <ul className="mt-1 list-inside list-disc text-sm text-gray-600">
                  {version.goals.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Instructions */}
            <div>
              <h3 className="text-sm font-medium text-gray-700">Instructions</h3>
              <pre className="mt-1 whitespace-pre-wrap rounded bg-gray-50 p-3 text-sm text-gray-700">
                {version.instructions || "(empty)"}
              </pre>
            </div>

            {/* Model Config */}
            <div>
              <h3 className="text-sm font-medium text-gray-700">Model Configuration</h3>
              <div className="mt-1 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded bg-gray-50 p-2">
                  <span className="text-gray-500">Provider:</span> {version.modelConfig.provider}
                </div>
                <div className="rounded bg-gray-50 p-2">
                  <span className="text-gray-500">Model:</span> {version.modelConfig.model}
                </div>
                <div className="rounded bg-gray-50 p-2">
                  <span className="text-gray-500">Temperature:</span>{" "}
                  {version.modelConfig.temperature ?? "default"}
                </div>
                <div className="rounded bg-gray-50 p-2">
                  <span className="text-gray-500">Max Tokens:</span>{" "}
                  {version.modelConfig.maxTokens ?? "default"}
                </div>
              </div>
            </div>

            {/* Budget */}
            {version.budget && (
              <div>
                <h3 className="text-sm font-medium text-gray-700">Budget</h3>
                <div className="mt-1 text-sm text-gray-600">
                  {version.budget.maxTokens && <p>Max tokens: {version.budget.maxTokens}</p>}
                  {version.budget.maxCostCents && (
                    <p>Max cost: ${(version.budget.maxCostCents / 100).toFixed(2)}</p>
                  )}
                  {version.budget.maxRunsPerDay && (
                    <p>Max runs/day: {version.budget.maxRunsPerDay}</p>
                  )}
                </div>
              </div>
            )}

            {/* Tools */}
            {version.tools.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700">
                  Tools ({version.tools.length})
                </h3>
                <div className="mt-1 space-y-1">
                  {version.tools.map((t, i) => (
                    <div key={i} className="rounded bg-gray-50 p-2 text-sm">
                      {t.name}
                      {t.connectorId && (
                        <span className="text-gray-400"> via {t.connectorId}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
