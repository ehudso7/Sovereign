"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

interface BrowserSession {
  id: string;
  runId: string;
  agentId: string;
  status: string;
  browserType: string;
  currentUrl: string | null;
  humanTakeover: boolean;
  takeoverBy: string | null;
  artifactKeys: string[];
  metadata: Record<string, unknown>;
  createdBy: string;
  startedAt: string | null;
  lastActivityAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const statusColors: Record<string, string> = {
  provisioning: "bg-gray-100 text-gray-700",
  ready: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  takeover_requested: "bg-yellow-100 text-yellow-700",
  human_control: "bg-purple-100 text-purple-700",
  closing: "bg-orange-100 text-orange-700",
  closed: "bg-gray-100 text-gray-500",
  failed: "bg-red-100 text-red-700",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusColors[status] ?? "bg-gray-100 text-gray-700"}`}>
      {status}
    </span>
  );
}

export default function BrowserSessionDetailPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<BrowserSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const canControl = role === "org_owner" || role === "org_admin";
  const canTakeover = role === "org_owner" || role === "org_admin";

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  const loadSession = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const result = await apiFetch<BrowserSession>(`/api/v1/browser-sessions/${sessionId}`, { token });

    if (result.ok) {
      setSession(result.data);
    } else {
      setError(result.error.message);
    }
    setLoading(false);
  }, [token, sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Poll for active sessions
  useEffect(() => {
    if (!session) return;
    const activeStatuses = ["provisioning", "ready", "active", "takeover_requested", "human_control", "closing"];
    if (!activeStatuses.includes(session.status)) return;

    const interval = setInterval(loadSession, 3000);
    return () => clearInterval(interval);
  }, [session, loadSession]);

  const handleAction = async (action: "takeover" | "release" | "close") => {
    if (!token) return;
    setActionLoading(true);
    setError(null);

    const result = await apiFetch<BrowserSession>(
      `/api/v1/browser-sessions/${sessionId}/${action}`,
      { method: "POST", token, body: JSON.stringify({}) },
    );

    if (result.ok) {
      setSession(result.data);
    } else {
      setError(result.error.message);
    }
    setActionLoading(false);
  };

  if (isLoading || !user) return null;

  if (loading) {
    return (
      <AppShell>
        <p className="text-gray-400">Loading browser session...</p>
      </AppShell>
    );
  }

  if (!session) {
    return (
      <AppShell>
        <div className="rounded border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-medium text-red-700">Browser session not found</p>
          <p className="text-sm text-red-600">{error}</p>
          <Link href="/browser-sessions" className="mt-2 inline-block text-sm text-gray-600 underline">
            Back to Browser Sessions
          </Link>
        </div>
      </AppShell>
    );
  }

  const isActive = session.status === "active";
  const isHumanControl = session.status === "human_control" || session.status === "takeover_requested";
  const isTerminal = session.status === "closed" || session.status === "failed";

  const showTakeover = canTakeover && isActive;
  const showRelease = canTakeover && isHumanControl;
  const showClose = canControl && !isTerminal;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Link href="/browser-sessions" className="text-sm text-gray-500 hover:text-gray-700">
            &larr; Back to Browser Sessions
          </Link>
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Browser Session</h1>
            <p className="text-sm text-gray-500 font-mono">{session.id}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={session.status} />
            {showTakeover && (
              <button
                onClick={() => handleAction("takeover")}
                disabled={actionLoading}
                className="rounded bg-purple-100 px-3 py-1 text-sm text-purple-700 hover:bg-purple-200 disabled:opacity-50"
              >
                {actionLoading ? "..." : "Takeover"}
              </button>
            )}
            {showRelease && (
              <button
                onClick={() => handleAction("release")}
                disabled={actionLoading}
                className="rounded bg-blue-100 px-3 py-1 text-sm text-blue-700 hover:bg-blue-200 disabled:opacity-50"
              >
                {actionLoading ? "..." : "Release"}
              </button>
            )}
            {showClose && (
              <button
                onClick={() => handleAction("close")}
                disabled={actionLoading}
                className="rounded bg-red-100 px-3 py-1 text-sm text-red-700 hover:bg-red-200 disabled:opacity-50"
              >
                {actionLoading ? "..." : "Close"}
              </button>
            )}
          </div>
        </div>

        {/* Session details */}
        <div className="rounded border border-gray-200 p-4">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="font-medium text-gray-500">Run</dt>
              <dd>
                <Link href={`/runs/${session.runId}`} className="text-blue-600 hover:underline font-mono text-xs">
                  {session.runId}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Agent</dt>
              <dd>
                <Link href={`/agents/${session.agentId}`} className="text-blue-600 hover:underline font-mono text-xs">
                  {session.agentId}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Browser</dt>
              <dd>{session.browserType}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Human Takeover</dt>
              <dd>{session.humanTakeover ? "Active" : "No"}</dd>
            </div>
            {session.currentUrl && (
              <div className="col-span-2">
                <dt className="font-medium text-gray-500">Current URL</dt>
                <dd className="truncate font-mono text-xs">{session.currentUrl}</dd>
              </div>
            )}
            <div>
              <dt className="font-medium text-gray-500">Created</dt>
              <dd>{new Date(session.createdAt).toLocaleString()}</dd>
            </div>
            {session.startedAt && (
              <div>
                <dt className="font-medium text-gray-500">Started</dt>
                <dd>{new Date(session.startedAt).toLocaleString()}</dd>
              </div>
            )}
            {session.lastActivityAt && (
              <div>
                <dt className="font-medium text-gray-500">Last Activity</dt>
                <dd>{new Date(session.lastActivityAt).toLocaleString()}</dd>
              </div>
            )}
            {session.endedAt && (
              <div>
                <dt className="font-medium text-gray-500">Ended</dt>
                <dd>{new Date(session.endedAt).toLocaleString()}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Artifacts */}
        <div>
          <h2 className="text-lg font-semibold">Artifacts</h2>
          {session.artifactKeys.length === 0 ? (
            <div className="mt-4 rounded border border-gray-200 p-6 text-center text-gray-400">
              No artifacts captured yet.
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {session.artifactKeys.map((key, idx) => (
                <div key={key} className="rounded border border-gray-200 p-3">
                  <p className="text-sm font-mono">{idx + 1}. {key}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
