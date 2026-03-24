"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";

interface Approval {
  id: string;
  subjectType: string;
  subjectId: string;
  action: string;
  status: string;
  requestedBy: string;
  createdAt: string;
}

const STATUS_FILTERS = ["all", "pending", "approved", "denied", "expired"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const approvalStatusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  denied: "bg-red-100 text-red-700",
  expired: "bg-gray-100 text-gray-500",
};

function ApprovalsListContent() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [approvals, setApprovals] = useState<Approval[]>([]);
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

  const loadApprovals = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const query = filter !== "all" ? `?status=${filter}` : "";
    const result = await apiFetch<Approval[]>(`/api/v1/approvals${query}`, { token });

    if (result.ok) {
      setApprovals(result.data);
    } else {
      setError(result.error.message);
    }
    setLoading(false);
  }, [token, filter]);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  const handleDecision = async (approvalId: string, decision: "approve" | "deny") => {
    if (!token) return;
    setActionLoading(`${approvalId}-${decision}`);
    setError(null);

    const result = await apiFetch<Approval>(
      `/api/v1/approvals/${approvalId}/${decision}`,
      { method: "POST", token, body: JSON.stringify({}) },
    );

    if (result.ok) {
      setApprovals((prev) =>
        prev.map((a) =>
          a.id === approvalId
            ? { ...a, status: decision === "approve" ? "approved" : "denied" }
            : a,
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
          <h1 className="text-2xl font-bold">Approvals</h1>
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
          <p className="text-gray-400">Loading approvals...</p>
        ) : approvals.length === 0 ? (
          <div className="rounded border border-gray-200 p-6 text-center text-gray-400">
            {filter === "all"
              ? "No approval requests."
              : `No approvals with status "${filter}".`}
          </div>
        ) : (
          <div className="overflow-hidden rounded border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Subject</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Action</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Requested By</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Created</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {approvals.map((approval) => (
                  <tr key={approval.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{approval.subjectType}</p>
                      <p className="text-xs text-gray-400">{approval.subjectId}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{approval.action}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${approvalStatusColors[approval.status] ?? "bg-gray-100 text-gray-700"}`}
                      >
                        {approval.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{approval.requestedBy}</td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(approval.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {approval.status === "pending" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDecision(approval.id, "approve")}
                            disabled={actionLoading !== null}
                            className="rounded bg-green-100 px-2 py-1 text-xs text-green-700 hover:bg-green-200 disabled:opacity-50"
                          >
                            {actionLoading === `${approval.id}-approve` ? "..." : "Approve"}
                          </button>
                          <button
                            onClick={() => handleDecision(approval.id, "deny")}
                            disabled={actionLoading !== null}
                            className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200 disabled:opacity-50"
                          >
                            {actionLoading === `${approval.id}-deny` ? "..." : "Deny"}
                          </button>
                        </div>
                      )}
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

export default function ApprovalsPage() {
  return (
    <Suspense fallback={<p className="text-gray-400">Loading approvals...</p>}>
      <ApprovalsListContent />
    </Suspense>
  );
}
