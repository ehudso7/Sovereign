"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

interface Policy {
  id: string;
  name: string;
  policyType: string;
  enforcementMode: string;
  scopeType: string;
  scopeId: string | null;
  status: string;
  priority: number;
}

const STATUS_FILTERS = ["all", "active", "disabled", "archived"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const policyStatusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  disabled: "bg-gray-100 text-gray-700",
  archived: "bg-red-100 text-red-700",
};

const enforcementModeColors: Record<string, string> = {
  enforce: "bg-red-100 text-red-700",
  warn: "bg-yellow-100 text-yellow-700",
  audit: "bg-blue-100 text-blue-700",
};

function PoliciesListContent() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [policies, setPolicies] = useState<Policy[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>(
    (searchParams.get("status") as StatusFilter) || "all",
  );

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  const loadPolicies = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const query = filter !== "all" ? `?status=${filter}` : "";
    const result = await apiFetch<Policy[]>(`/api/v1/policies${query}`, { token });

    if (result.ok) {
      setPolicies(result.data);
    } else {
      setError(result.error.message);
    }
    setLoading(false);
  }, [token, filter]);

  useEffect(() => {
    loadPolicies();
  }, [loadPolicies]);

  const handleSetStatus = async (policyId: string, action: "enable" | "disable") => {
    if (!token) return;
    setActionLoading(policyId);
    setError(null);

    const result = await apiFetch<Policy>(
      `/api/v1/policies/${policyId}/${action}`,
      { method: "POST", token, body: JSON.stringify({}) },
    );

    if (result.ok) {
      setPolicies((prev) =>
        prev.map((p) =>
          p.id === policyId
            ? { ...p, status: action === "enable" ? "active" : "disabled" }
            : p,
        ),
      );
    } else {
      setError(result.error.message);
    }
    setActionLoading(null);
  };

  if (isLoading || !user) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Policies</h1>
          <Link
            href="/policies/new"
            className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-800"
          >
            Create Policy
          </Link>
        </div>

        {/* Status filter */}
        <div className="flex gap-2">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded px-3 py-1 text-sm capitalize ${
                filter === s
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-gray-400">Loading policies...</p>
        ) : policies.length === 0 ? (
          <div className="rounded border border-gray-200 p-6 text-center text-gray-400">
            {filter === "all" ? "No policies." : `No policies with status "${filter}".`}
          </div>
        ) : (
          <div className="overflow-hidden rounded border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Name</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Type</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Mode</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Scope</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Priority</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {policies.map((policy) => (
                  <tr key={policy.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/policies/${policy.id}`}
                        className="font-medium text-gray-900 hover:underline"
                      >
                        {policy.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{policy.policyType}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${enforcementModeColors[policy.enforcementMode] ?? "bg-gray-100 text-gray-700"}`}
                      >
                        {policy.enforcementMode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {policy.scopeType}
                      {policy.scopeId ? `: ${policy.scopeId}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${policyStatusColors[policy.status] ?? "bg-gray-100 text-gray-700"}`}
                      >
                        {policy.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{policy.priority}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {policy.status !== "active" && (
                          <button
                            onClick={() => handleSetStatus(policy.id, "enable")}
                            disabled={actionLoading === policy.id}
                            className="rounded bg-green-100 px-2 py-1 text-xs text-green-700 hover:bg-green-200 disabled:opacity-50"
                          >
                            {actionLoading === policy.id ? "..." : "Enable"}
                          </button>
                        )}
                        {policy.status === "active" && (
                          <button
                            onClick={() => handleSetStatus(policy.id, "disable")}
                            disabled={actionLoading === policy.id}
                            className="rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-700 hover:bg-yellow-200 disabled:opacity-50"
                          >
                            {actionLoading === policy.id ? "..." : "Disable"}
                          </button>
                        )}
                      </div>
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

export default function PoliciesPage() {
  return (
    <Suspense fallback={<p className="text-gray-400">Loading policies...</p>}>
      <PoliciesListContent />
    </Suspense>
  );
}
