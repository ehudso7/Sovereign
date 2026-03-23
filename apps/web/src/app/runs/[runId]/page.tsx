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
  status: string;
  name?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

interface Run {
  id: string;
  agentId: string;
  agentName?: string;
  status: string;
  trigger: string;
  output?: unknown;
  error?: string;
  steps?: RunStep[];
  createdAt: string;
  updatedAt: string;
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

export default function RunDetailPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const runId = params.runId as string;

  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const canControl = role === "org_owner" || role === "org_admin";

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  const loadRun = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const result = await apiFetch<Run>(`/api/v1/runs/${runId}`, { token });

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

  // Poll for updates when run is active
  useEffect(() => {
    if (!run) return;
    const activeStatuses = ["queued", "starting", "running", "cancelling"];
    if (!activeStatuses.includes(run.status)) return;

    const interval = setInterval(loadRun, 3000);
    return () => clearInterval(interval);
  }, [run, loadRun]);

  const handleAction = async (action: "pause" | "resume" | "cancel") => {
    if (!token) return;
    setActionLoading(true);
    setError(null);

    const result = await apiFetch<Run>(`/api/v1/runs/${runId}/${action}`, {
      method: "POST",
      token,
      body: JSON.stringify({}),
    });

    if (result.ok) {
      setRun(result.data);
    } else {
      setError(result.error.message);
    }
    setActionLoading(false);
  };

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
          <Link href="/runs" className="mt-2 inline-block text-sm text-gray-600 underline">
            Back to Runs
          </Link>
        </div>
      </AppShell>
    );
  }

  const canPause = canControl && run.status === "running";
  const canResume = canControl && run.status === "paused";
  const canCancel = canControl && ["queued", "starting", "running", "paused"].includes(run.status);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Link href="/runs" className="text-sm text-gray-500 hover:text-gray-700">
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
            <h1 className="text-2xl font-bold">Run</h1>
            <p className="text-sm text-gray-500">{run.id}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={run.status} />
            {canPause && (
              <button
                onClick={() => handleAction("pause")}
                disabled={actionLoading}
                className="rounded bg-yellow-100 px-3 py-1 text-sm text-yellow-700 hover:bg-yellow-200 disabled:opacity-50"
              >
                {actionLoading ? "..." : "Pause"}
              </button>
            )}
            {canResume && (
              <button
                onClick={() => handleAction("resume")}
                disabled={actionLoading}
                className="rounded bg-blue-100 px-3 py-1 text-sm text-blue-700 hover:bg-blue-200 disabled:opacity-50"
              >
                {actionLoading ? "..." : "Resume"}
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => handleAction("cancel")}
                disabled={actionLoading}
                className="rounded bg-red-100 px-3 py-1 text-sm text-red-700 hover:bg-red-200 disabled:opacity-50"
              >
                {actionLoading ? "..." : "Cancel"}
              </button>
            )}
          </div>
        </div>

        {/* Run details */}
        <div className="rounded border border-gray-200 p-4">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="font-medium text-gray-500">Agent</dt>
              <dd>
                <Link
                  href={`/agents/${run.agentId}`}
                  className="text-blue-600 hover:underline"
                >
                  {run.agentName ?? run.agentId}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Trigger</dt>
              <dd>{run.trigger}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Created</dt>
              <dd>{new Date(run.createdAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Updated</dt>
              <dd>{new Date(run.updatedAt).toLocaleString()}</dd>
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

        {/* Output */}
        {run.status === "completed" && run.output != null && (
          <div className="rounded border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-medium text-green-700">Output</p>
            <pre className="mt-1 max-h-96 overflow-auto whitespace-pre-wrap text-sm text-green-800">
              {typeof run.output === "string" ? run.output : JSON.stringify(run.output, null, 2)}
            </pre>
          </div>
        )}

        {/* Steps */}
        <div>
          <h2 className="text-lg font-semibold">Steps</h2>
          {!run.steps || run.steps.length === 0 ? (
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
                        {index + 1}. {step.name ?? step.type}
                      </p>
                      {step.startedAt && (
                        <p className="text-xs text-gray-400">
                          {new Date(step.startedAt).toLocaleString()}
                          {step.completedAt && (
                            <> &rarr; {new Date(step.completedAt).toLocaleString()}</>
                          )}
                        </p>
                      )}
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
      </div>
    </AppShell>
  );
}
