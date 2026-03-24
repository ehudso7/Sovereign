"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";

interface AuditEntry {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  actor: string;
  createdAt: string;
}

function AuditLogContent() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  const loadEntries = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const result = await apiFetch<AuditEntry[]>("/api/v1/audit?limit=100", { token });

    if (result.ok) {
      setEntries(result.data);
    } else {
      setError(result.error.message);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const filteredEntries =
    actionFilter.trim() === ""
      ? entries
      : entries.filter((e) =>
          e.action.toLowerCase().includes(actionFilter.toLowerCase()),
        );

  if (isLoading || !user) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <button
            onClick={loadEntries}
            className="rounded bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200"
          >
            Refresh
          </button>
        </div>

        {/* Action filter */}
        <div>
          <input
            type="text"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            placeholder="Filter by action type..."
            className="w-full max-w-xs rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-gray-400">Loading audit log...</p>
        ) : filteredEntries.length === 0 ? (
          <div className="rounded border border-gray-200 p-6 text-center text-gray-400">
            {actionFilter ? `No entries matching "${actionFilter}".` : "No audit entries."}
          </div>
        ) : (
          <div className="overflow-hidden rounded border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Action</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Resource</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Actor</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{entry.action}</td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700">{entry.resourceType}</p>
                      <p className="text-xs text-gray-400">{entry.resourceId}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{entry.actor}</td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-gray-200 px-4 py-2 text-xs text-gray-400">
              Showing {filteredEntries.length} of {entries.length} entries
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function AuditPage() {
  return (
    <Suspense fallback={<p className="text-gray-400">Loading audit log...</p>}>
      <AuditLogContent />
    </Suspense>
  );
}
