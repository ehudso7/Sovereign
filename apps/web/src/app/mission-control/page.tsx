"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

interface Overview {
  runCounts: Record<string, number>;
  avgQueueWaitMs: number;
  avgDurationMs: number;
  failureRate: number;
  tokenUsage: { prompt: number; completion: number; total: number };
  estimatedCostUsd: number;
  runsWithTools: number;
  runsWithBrowser: number;
  runsWithMemory: number;
  openAlerts: number;
  recentFailures: {
    id: string;
    agentName?: string;
    error?: string;
    failedAt: string;
  }[];
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-gray-200 p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

export default function MissionControlPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  const loadOverview = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const result = await apiFetch<Overview>("/api/v1/mission-control/overview", { token });

    if (result.ok) {
      setOverview(result.data);
    } else {
      setError(result.error.message);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  if (isLoading || !user) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Mission Control</h1>
          <div className="flex gap-3">
            <Link
              href="/mission-control/runs"
              className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-800"
            >
              All Runs
            </Link>
            <Link
              href="/mission-control/alerts"
              className="rounded bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200"
            >
              Alerts
            </Link>
          </div>
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-gray-400">Loading overview...</p>
        ) : !overview ? (
          <div className="rounded border border-gray-200 p-6 text-center text-gray-400">
            No overview data available.
          </div>
        ) : (
          <>
            {/* Run counts by status */}
            <div>
              <h2 className="text-lg font-semibold">Run Counts</h2>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {Object.entries(overview.runCounts).map(([status, count]) => (
                  <MetricCard key={status} label={status} value={count} />
                ))}
              </div>
            </div>

            {/* Performance metrics */}
            <div>
              <h2 className="text-lg font-semibold">Performance</h2>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                <MetricCard label="Avg Queue Wait" value={`${Math.round(overview.avgQueueWaitMs)}ms`} />
                <MetricCard label="Avg Duration" value={`${Math.round(overview.avgDurationMs)}ms`} />
                <MetricCard label="Failure Rate" value={`${(overview.failureRate * 100).toFixed(1)}%`} />
              </div>
            </div>

            {/* Token usage & cost */}
            <div>
              <h2 className="text-lg font-semibold">Token Usage</h2>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MetricCard label="Prompt Tokens" value={overview.tokenUsage.prompt.toLocaleString()} />
                <MetricCard label="Completion Tokens" value={overview.tokenUsage.completion.toLocaleString()} />
                <MetricCard label="Total Tokens" value={overview.tokenUsage.total.toLocaleString()} />
                <MetricCard label="Est. Cost" value={`$${overview.estimatedCostUsd.toFixed(2)}`} />
              </div>
            </div>

            {/* Feature usage */}
            <div>
              <h2 className="text-lg font-semibold">Feature Usage</h2>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <MetricCard label="Runs with Tools" value={overview.runsWithTools} />
                <MetricCard label="Runs with Browser" value={overview.runsWithBrowser} />
                <MetricCard label="Runs with Memory" value={overview.runsWithMemory} />
              </div>
            </div>

            {/* Alerts */}
            <div>
              <h2 className="text-lg font-semibold">Alerts</h2>
              <div className="mt-2">
                <MetricCard label="Open Alerts" value={overview.openAlerts} />
              </div>
            </div>

            {/* Recent failures */}
            <div>
              <h2 className="text-lg font-semibold">Recent Failures</h2>
              {overview.recentFailures.length === 0 ? (
                <div className="mt-2 rounded border border-gray-200 p-6 text-center text-gray-400">
                  No recent failures.
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  {overview.recentFailures.map((f) => (
                    <Link
                      key={f.id}
                      href={`/mission-control/runs/${f.id}`}
                      className="block rounded border border-red-200 bg-red-50 p-3 hover:border-red-300"
                    >
                      <p className="text-sm font-medium text-red-700">
                        {f.agentName ?? f.id}
                      </p>
                      {f.error && (
                        <p className="mt-1 truncate text-xs text-red-600">{f.error}</p>
                      )}
                      <p className="mt-1 text-xs text-red-400">
                        {new Date(f.failedAt).toLocaleString()}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
