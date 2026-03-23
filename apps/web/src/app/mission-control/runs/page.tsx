"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

interface MCRun {
  id: string;
  agentId: string;
  agentName?: string;
  status: string;
  createdAt: string;
  durationMs?: number;
}

const STATUS_FILTERS = ["all", "queued", "running", "completed", "failed", "cancelled", "paused"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const statusColors: Record<string, string> = {
  queued: "bg-gray-100 text-gray-700",
  starting: "bg-blue-100 text-blue-700",
  running: "bg-blue-100 text-blue-700",
  paused: "bg-yellow-100 text-yellow-700",
  cancelling: "bg-orange-100 text-orange-700",
  cancelled: "bg-red-100 text-red-700",
  failed: "bg-red-100 text-red-700",
  completed: "bg-green-100 text-green-700",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusColors[status] ?? "bg-gray-100 text-gray-700"}`}>
      {status}
    </span>
  );
}

function formatDuration(ms: number | undefined): string {
  if (ms == null) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function MCRunsListContent() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [runs, setRuns] = useState<MCRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>(
    (searchParams.get("status") as StatusFilter) || "all",
  );

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  const loadRuns = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const query = filter !== "all" ? `?status=${filter}` : "";
    const result = await apiFetch<MCRun[]>(`/api/v1/mission-control/runs${query}`, { token });

    if (result.ok) {
      setRuns(result.data);
    } else {
      setError(result.error.message);
    }
    setLoading(false);
  }, [token, filter]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  if (isLoading || !user) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Link href="/mission-control" className="text-sm text-gray-500 hover:text-gray-700">
            &larr; Back to Mission Control
          </Link>
        </div>

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Runs</h1>
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
          <p className="text-gray-400">Loading runs...</p>
        ) : runs.length === 0 ? (
          <div className="rounded border border-gray-200 p-6 text-center text-gray-400">
            {filter === "all"
              ? "No runs found."
              : `No runs with status "${filter}".`}
          </div>
        ) : (
          <div className="space-y-2">
            {runs.map((run) => (
              <Link
                key={run.id}
                href={`/mission-control/runs/${run.id}`}
                className="block rounded border border-gray-200 p-4 hover:border-gray-300 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {run.agentName ?? run.agentId}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(run.createdAt).toLocaleString()}
                      {run.durationMs != null && (
                        <> &middot; {formatDuration(run.durationMs)}</>
                      )}
                    </p>
                  </div>
                  <StatusBadge status={run.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function MCRunsListPage() {
  return (
    <Suspense fallback={<p className="text-gray-400">Loading runs...</p>}>
      <MCRunsListContent />
    </Suspense>
  );
}
