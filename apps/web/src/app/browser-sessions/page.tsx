"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
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
  createdAt: string;
  lastActivityAt: string | null;
}

const STATUS_FILTERS = [
  "all",
  "provisioning",
  "ready",
  "active",
  "human_control",
  "closing",
  "closed",
  "failed",
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

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

function BrowserSessionsContent() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sessions, setSessions] = useState<BrowserSession[]>([]);
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

  const loadSessions = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const query = filter !== "all" ? `?status=${filter}` : "";
    const result = await apiFetch<BrowserSession[]>(`/api/v1/browser-sessions${query}`, { token });

    if (result.ok) {
      setSessions(result.data);
    } else {
      setError(result.error.message);
    }
    setLoading(false);
  }, [token, filter]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  if (isLoading || !user) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Browser Sessions</h1>
        </div>

        <div className="flex flex-wrap gap-2">
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
              {s === "all" ? "All" : s.replace("_", " ")}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-gray-400">Loading browser sessions...</p>
        ) : sessions.length === 0 ? (
          <div className="rounded border border-gray-200 p-6 text-center text-gray-400">
            {filter === "all"
              ? "No browser sessions. Browser sessions are created when running browser-capable agents."
              : `No sessions with status "${filter}".`}
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => (
              <Link
                key={session.id}
                href={`/browser-sessions/${session.id}`}
                className="block rounded border border-gray-200 p-4 hover:border-gray-300 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium font-mono text-sm">{session.id.slice(0, 8)}...</p>
                    <p className="text-xs text-gray-400">
                      Run: {session.runId.slice(0, 8)}... &middot; {session.browserType}
                      {session.currentUrl && <> &middot; {session.currentUrl}</>}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(session.createdAt).toLocaleString()}
                      {session.humanTakeover && <span className="ml-2 text-purple-600 font-medium">HUMAN CONTROL</span>}
                    </p>
                  </div>
                  <StatusBadge status={session.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function BrowserSessionsPage() {
  return (
    <Suspense fallback={<p className="text-gray-400">Loading browser sessions...</p>}>
      <BrowserSessionsContent />
    </Suspense>
  );
}
