"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter, useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

interface Policy {
  id: string;
  name: string;
  description: string | null;
  policyType: string;
  enforcementMode: string;
  scopeType: string;
  scopeId: string | null;
  status: string;
  priority: number;
  rules: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface PolicyDecision {
  id: string;
  action: string;
  result: string;
  reason: string | null;
  createdAt: string;
}

const policyStatusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  disabled: "bg-gray-100 text-gray-700",
  archived: "bg-red-100 text-red-700",
};

export default function PolicyDetailPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const policyId = params.policyId as string;

  const [policy, setPolicy] = useState<Policy | null>(null);
  const [decisions, setDecisions] = useState<PolicyDecision[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState(0);
  const [editRulesText, setEditRulesText] = useState("{}");
  const [editRulesError, setEditRulesError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  const loadPolicy = useCallback(async () => {
    if (!token || !policyId) return;
    setLoading(true);
    setError(null);

    const [policyResult, decisionsResult] = await Promise.all([
      apiFetch<Policy>(`/api/v1/policies/${policyId}`, { token }),
      apiFetch<PolicyDecision[]>(`/api/v1/policies/${policyId}/decisions?limit=10`, { token }),
    ]);

    if (policyResult.ok) {
      setPolicy(policyResult.data);
      setEditName(policyResult.data.name);
      setEditDescription(policyResult.data.description ?? "");
      setEditPriority(policyResult.data.priority);
      setEditRulesText(JSON.stringify(policyResult.data.rules, null, 2));
    } else {
      setError(policyResult.error.message);
    }

    if (decisionsResult.ok) {
      setDecisions(decisionsResult.data);
    }

    setLoading(false);
  }, [token, policyId]);

  useEffect(() => {
    loadPolicy();
  }, [loadPolicy]);

  const validateRules = (text: string): boolean => {
    try {
      JSON.parse(text);
      setEditRulesError(null);
      return true;
    } catch {
      setEditRulesError("Rules must be valid JSON.");
      return false;
    }
  };

  const handleSave = async () => {
    if (!token || !policy) return;
    if (!validateRules(editRulesText)) return;

    setSaving(true);
    setSaveError(null);

    const result = await apiFetch<Policy>(`/api/v1/policies/${policyId}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({
        name: editName,
        description: editDescription || undefined,
        priority: editPriority,
        rules: JSON.parse(editRulesText),
      }),
    });

    if (result.ok) {
      setPolicy(result.data);
      setEditing(false);
    } else {
      setSaveError(result.error.message);
    }
    setSaving(false);
  };

  const handleAction = async (action: "enable" | "disable" | "archive") => {
    if (!token || !policy) return;
    setActionLoading(action);
    setError(null);

    const result = await apiFetch<Policy>(`/api/v1/policies/${policyId}/${action}`, {
      method: "POST",
      token,
      body: JSON.stringify({}),
    });

    if (result.ok) {
      setPolicy(result.data);
    } else {
      setError(result.error.message);
    }
    setActionLoading(null);
  };

  if (isLoading || !user) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Link href="/policies" className="text-sm text-gray-500 hover:text-gray-700">
            &larr; Back to Policies
          </Link>
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-gray-400">Loading policy...</p>
        ) : !policy ? (
          <div className="rounded border border-gray-200 p-6 text-center text-gray-400">
            Policy not found.
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold">{policy.name}</h1>
                {policy.description && (
                  <p className="mt-1 text-sm text-gray-500">{policy.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${policyStatusColors[policy.status] ?? "bg-gray-100 text-gray-700"}`}
                >
                  {policy.status}
                </span>
                {!editing && (
                  <button
                    onClick={() => setEditing(true)}
                    className="rounded bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200"
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              {policy.status !== "active" && policy.status !== "archived" && (
                <button
                  onClick={() => handleAction("enable")}
                  disabled={actionLoading !== null}
                  className="rounded bg-green-100 px-3 py-1.5 text-sm text-green-700 hover:bg-green-200 disabled:opacity-50"
                >
                  {actionLoading === "enable" ? "..." : "Enable"}
                </button>
              )}
              {policy.status === "active" && (
                <button
                  onClick={() => handleAction("disable")}
                  disabled={actionLoading !== null}
                  className="rounded bg-yellow-100 px-3 py-1.5 text-sm text-yellow-700 hover:bg-yellow-200 disabled:opacity-50"
                >
                  {actionLoading === "disable" ? "..." : "Disable"}
                </button>
              )}
              {policy.status !== "archived" && (
                <button
                  onClick={() => handleAction("archive")}
                  disabled={actionLoading !== null}
                  className="rounded bg-red-100 px-3 py-1.5 text-sm text-red-700 hover:bg-red-200 disabled:opacity-50"
                >
                  {actionLoading === "archive" ? "..." : "Archive"}
                </button>
              )}
            </div>

            {/* Policy details */}
            {editing ? (
              <div className="space-y-4 rounded border border-gray-200 p-6">
                <h2 className="text-lg font-semibold">Edit Policy</h2>

                {saveError && (
                  <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {saveError}
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={2}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Priority</label>
                  <input
                    type="number"
                    value={editPriority}
                    onChange={(e) => setEditPriority(Number(e.target.value))}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Rules (JSON)
                  </label>
                  <textarea
                    value={editRulesText}
                    onChange={(e) => {
                      setEditRulesText(e.target.value);
                      validateRules(e.target.value);
                    }}
                    rows={8}
                    className={`w-full rounded border px-3 py-2 font-mono text-sm focus:outline-none ${editRulesError ? "border-red-300 focus:border-red-500" : "border-gray-300 focus:border-gray-500"}`}
                  />
                  {editRulesError && (
                    <p className="mt-1 text-xs text-red-600">{editRulesError}</p>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setSaveError(null);
                    }}
                    className="rounded bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded border border-gray-200 p-6">
                <h2 className="mb-4 text-lg font-semibold">Details</h2>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="font-medium text-gray-600">Type</dt>
                    <dd className="mt-1 text-gray-900">{policy.policyType}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-600">Enforcement Mode</dt>
                    <dd className="mt-1 text-gray-900">{policy.enforcementMode}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-600">Scope</dt>
                    <dd className="mt-1 text-gray-900">
                      {policy.scopeType}
                      {policy.scopeId ? `: ${policy.scopeId}` : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-600">Priority</dt>
                    <dd className="mt-1 text-gray-900">{policy.priority}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-600">Created</dt>
                    <dd className="mt-1 text-gray-900">
                      {new Date(policy.createdAt).toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-600">Updated</dt>
                    <dd className="mt-1 text-gray-900">
                      {new Date(policy.updatedAt).toLocaleString()}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4">
                  <dt className="text-sm font-medium text-gray-600">Rules</dt>
                  <pre className="mt-1 overflow-auto rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800">
                    {JSON.stringify(policy.rules, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Recent decisions */}
            <div>
              <h2 className="text-lg font-semibold">Recent Policy Decisions</h2>
              {decisions.length === 0 ? (
                <div className="mt-2 rounded border border-gray-200 p-6 text-center text-gray-400">
                  No recent decisions.
                </div>
              ) : (
                <div className="mt-2 overflow-hidden rounded border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-600">Action</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-600">Result</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-600">Reason</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-600">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {decisions.map((d) => (
                        <tr key={d.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-600">{d.action}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded px-2 py-0.5 text-xs font-medium ${d.result === "allow" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                            >
                              {d.result}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500">{d.reason ?? "-"}</td>
                          <td className="px-4 py-3 text-gray-400">
                            {new Date(d.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
