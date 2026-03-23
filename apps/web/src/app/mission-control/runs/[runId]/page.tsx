"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

interface RunStep {
  id: string;
  type: string;
  toolName?: string;
  status: string;
  latencyMs?: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

interface BrowserSession {
  id: string;
  status: string;
  createdAt: string;
}

interface ToolUsageSummary {
  toolName: string;
  callCount: number;
  avgLatencyMs: number;
}

interface MemoryUsageSummary {
  retrievedCount: number;
  writtenCount: number;
}

interface MCRunDetail {
  id: string;
  agentId: string;
  agentName?: string;
  status: string;
  durationMs?: number;
  queueWaitMs?: number;
  tokenUsage?: { prompt: number; completion: number; total: number };
  estimatedCostUsd?: number;
  error?: string;
  steps: RunStep[];
  browserSessions: BrowserSession[];
  toolUsage: ToolUsageSummary[];
  memoryUsage: MemoryUsageSummary;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

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

function formatDuration(ms: number | undefined | null): string {
  if (ms == null) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function MCRunDetailPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const runId = params.runId as string;

  const [run, setRun] = useState<MCRunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  const loadRun = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const result = await apiFetch<MCRunDetail>(`/api/v1/mission-control/runs/${runId}`, { token });

    if (result.ok) {
      setRun(result.data);
    } else {
      setError(result.error.message);
    }
    setLoading(false);
  }, [token, runId]);

  useEffect(() => {
    loadRun();
  }, [loadRun]);

  if (isLoading || !user) return null;

  if (loading) {
    return (
      <AppShell>
        <p className="text-gray-400">Loading run...</p>
      </AppShell>
    );
  }

  if (!run) {
    return (
      <AppShell>
        <div className="rounded border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-medium text-red-700">Run not found</p>
          <p className="text-sm text-red-600">{error}</p>
          <Link href="/mission-control/runs" className="mt-2 inline-block text-sm text-gray-600 underline">
            Back to Runs
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Link href="/mission-control/runs" className="text-sm text-gray-500 hover:text-gray-700">
            &larr; Back to Runs
          </Link>
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Run header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Run Detail</h1>
            <p className="text-sm text-gray-500">{run.id}</p>
          </div>
          <StatusBadge status={run.status} />
        </div>

        {/* Run metadata */}
        <div className="rounded border border-gray-200 p-4">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="font-medium text-gray-500">Agent</dt>
              <dd>{run.agentName ?? run.agentId}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Status</dt>
              <dd>{run.status}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Duration</dt>
              <dd>{formatDuration(run.durationMs)}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Queue Wait</dt>
              <dd>{formatDuration(run.queueWaitMs)}</dd>
            </div>
            {run.tokenUsage && (
              <>
                <div>
                  <dt className="font-medium text-gray-500">Tokens (Prompt / Completion / Total)</dt>
                  <dd>
                    {run.tokenUsage.prompt.toLocaleString()} / {run.tokenUsage.completion.toLocaleString()} / {run.tokenUsage.total.toLocaleString()}
                  </dd>
                </div>
              </>
            )}
            {run.estimatedCostUsd != null && (
              <div>
                <dt className="font-medium text-gray-500">Est. Cost</dt>
                <dd>${run.estimatedCostUsd.toFixed(4)}</dd>
              </div>
            )}
            <div>
              <dt className="font-medium text-gray-500">Created</dt>
              <dd>{new Date(run.createdAt).toLocaleString()}</dd>
            </div>
            {run.startedAt && (
              <div>
                <dt className="font-medium text-gray-500">Started</dt>
                <dd>{new Date(run.startedAt).toLocaleString()}</dd>
              </div>
            )}
            {run.completedAt && (
              <div>
                <dt className="font-medium text-gray-500">Completed</dt>
                <dd>{new Date(run.completedAt).toLocaleString()}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Error */}
        {run.status === "failed" && run.error && (
          <div className="rounded border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-700">Error</p>
            <pre className="mt-1 whitespace-pre-wrap text-sm text-red-600">{run.error}</pre>
          </div>
        )}

        {/* Steps / Timeline */}
        <div>
          <h2 className="text-lg font-semibold">Timeline</h2>
          {run.steps.length === 0 ? (
            <div className="mt-4 rounded border border-gray-200 p-6 text-center text-gray-400">
              No steps recorded yet.
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {run.steps.map((step, index) => (
                <div
                  key={step.id}
                  className="rounded border border-gray-200 p-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {index + 1}. {step.toolName ?? step.type}
                      </p>
                      <p className="text-xs text-gray-400">
                        {step.type}
                        {step.latencyMs != null && <> &middot; {formatDuration(step.latencyMs)}</>}
                        {step.startedAt && (
                          <> &middot; {new Date(step.startedAt).toLocaleString()}</>
                        )}
                      </p>
                    </div>
                    <StatusBadge status={step.status} />
                  </div>
                  {step.error && (
                    <pre className="mt-2 whitespace-pre-wrap text-xs text-red-600">{step.error}</pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Browser sessions */}
        <div>
          <h2 className="text-lg font-semibold">Browser Sessions</h2>
          {run.browserSessions.length === 0 ? (
            <div className="mt-4 rounded border border-gray-200 p-6 text-center text-gray-400">
              No browser sessions.
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {run.browserSessions.map((session) => (
                <Link
                  key={session.id}
                  href={`/browser-sessions/${session.id}`}
                  className="block rounded border border-gray-200 p-3 hover:border-gray-300 hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{session.id}</p>
                    <StatusBadge status={session.status} />
                  </div>
                  <p className="text-xs text-gray-400">
                    {new Date(session.createdAt).toLocaleString()}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Tool usage summary */}
        <div>
          <h2 className="text-lg font-semibold">Tool Usage</h2>
          {run.toolUsage.length === 0 ? (
            <div className="mt-4 rounded border border-gray-200 p-6 text-center text-gray-400">
              No tools used.
            </div>
          ) : (
            <div className="mt-4 rounded border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Tool</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Calls</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Avg Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {run.toolUsage.map((tool) => (
                    <tr key={tool.toolName} className="border-b border-gray-100">
                      <td className="px-4 py-2">{tool.toolName}</td>
                      <td className="px-4 py-2 text-right">{tool.callCount}</td>
                      <td className="px-4 py-2 text-right">{formatDuration(tool.avgLatencyMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Memory usage summary */}
        <div>
          <h2 className="text-lg font-semibold">Memory Usage</h2>
          <div className="mt-4 rounded border border-gray-200 p-4">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="font-medium text-gray-500">Retrieved</dt>
                <dd>{run.memoryUsage.retrievedCount}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500">Written</dt>
                <dd>{run.memoryUsage.writtenCount}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
