"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";

interface QuarantineEntry {
  id: string;
  subjectType: string;
  subjectId: string;
  reason: string;
  status: string;
  quarantinedBy: string;
  createdAt: string;
}

const STATUS_FILTERS = ["all", "active", "released"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const quarantineStatusColors: Record<string, string> = {
  active: "bg-red-100 text-red-700",
  released: "bg-green-100 text-green-700",
};

function QuarantineListContent() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [entries, setEntries] = useState<QuarantineEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [releaseLoading, setReleaseLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>(
    (searchParams.get("status") as StatusFilter) || "all",
  );

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  const loadEntries = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const query = filter !== "all" ? `?status=${filter}` : "";
    const result = await apiFetch<QuarantineEntry[]>(`/api/v1/quarantine${query}`, { token });

    if (result.ok) {
      setEntries(result.data);
    } else {
      setError(result.error.message);
    }
    setLoading(false);
  }, [token, filter]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handleRelease = async (entryId: string) => {
    if (!token) return;
    setReleaseLoading(entryId);
    setError(null);

    const result = await apiFetch<QuarantineEntry>(
      `/api/v1/quarantine/${entryId}/release`,
      { method: "POST", token, body: JSON.stringify({}) },
    );

    if (result.ok) {
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, status: "released" } : e)),
      );
    } else {
      setError(result.error.message);
    }
    setReleaseLoading(null);
  };

  if (isLoading || !user) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Quarantine</h1>
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
          <p className="text-gray-400">Loading quarantine entries...</p>
        ) : entries.length === 0 ? (
          <div className="rounded border border-gray-200 p-6 text-center text-gray-400">
            {filter === "all"
              ? "No quarantine entries."
              : `No entries with status "${filter}".`}
          </div>
        ) : (
          <div className="overflow-hidden rounded border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Subject</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Reason</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Quarantined By</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Created</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{entry.subjectType}</p>
                      <p className="text-xs text-gray-400">{entry.subjectId}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{entry.reason}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${quarantineStatusColors[entry.status] ?? "bg-gray-100 text-gray-700"}`}
                      >
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{entry.quarantinedBy}</td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {entry.status === "active" && (
                        <button
                          onClick={() => handleRelease(entry.id)}
                          disabled={releaseLoading === entry.id}
                          className="rounded bg-green-100 px-2 py-1 text-xs text-green-700 hover:bg-green-200 disabled:opacity-50"
                        >
                          {releaseLoading === entry.id ? "..." : "Release"}
                        </button>
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

export default function QuarantinePage() {
  return (
    <Suspense fallback={<p className="text-gray-400">Loading quarantine entries...</p>}>
      <QuarantineListContent />
    </Suspense>
  );
}
