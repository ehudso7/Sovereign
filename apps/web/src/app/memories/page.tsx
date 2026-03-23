"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

interface Memory {
  id: string;
  scopeType: string;
  scopeId: string;
  kind: string;
  status: string;
  title: string;
  summary: string;
  sourceRunId: string | null;
  sourceAgentId: string | null;
  createdAt: string;
  updatedAt: string;
}

const KIND_FILTERS = ["all", "semantic", "episodic", "procedural"] as const;
const STATUS_FILTERS = ["all", "active", "redacted", "expired", "deleted"] as const;
type KindFilter = (typeof KIND_FILTERS)[number];
type StatusFilter = (typeof STATUS_FILTERS)[number];

const kindColors: Record<string, string> = {
  semantic: "bg-blue-100 text-blue-700",
  episodic: "bg-purple-100 text-purple-700",
  procedural: "bg-green-100 text-green-700",
};

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  redacted: "bg-red-100 text-red-700",
  expired: "bg-yellow-100 text-yellow-700",
  deleted: "bg-gray-100 text-gray-500",
};

function Badge({ label, colors }: { label: string; colors: Record<string, string> }) {
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${colors[label] ?? "bg-gray-100 text-gray-700"}`}>
      {label}
    </span>
  );
}

function MemoriesContent() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [memories, setMemories] = useState<Memory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState<KindFilter>(
    (searchParams.get("kind") as KindFilter) || "all",
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    (searchParams.get("status") as StatusFilter) || "active",
  );

  useEffect(() => {
    if (!isLoading && !user) router.push("/auth/sign-in");
  }, [isLoading, user, router]);

  const loadMemories = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (kindFilter !== "all") params.set("kind", kindFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    const query = params.toString() ? `?${params.toString()}` : "";

    const result = await apiFetch<Memory[]>(`/api/v1/memories${query}`, { token });
    if (result.ok) {
      setMemories(result.data);
    } else {
      setError(result.error.message);
    }
    setLoading(false);
  }, [token, kindFilter, statusFilter]);

  useEffect(() => { loadMemories(); }, [loadMemories]);

  if (isLoading || !user) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Memories</h1>
          <Link
            href="/memories/new"
            className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800"
          >
            Create Memory
          </Link>
        </div>

        {/* Kind filter */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase">Kind</p>
          <div className="flex gap-2">
            {KIND_FILTERS.map((k) => (
              <button
                key={k}
                onClick={() => setKindFilter(k)}
                className={`rounded px-3 py-1 text-sm capitalize ${
                  kindFilter === k ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        {/* Status filter */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase">Status</p>
          <div className="flex gap-2">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded px-3 py-1 text-sm capitalize ${
                  statusFilter === s ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {loading ? (
          <p className="text-gray-400">Loading memories...</p>
        ) : memories.length === 0 ? (
          <div className="rounded border border-gray-200 p-6 text-center text-gray-400">
            No memories found. Create one manually or run a memory-enabled agent.
          </div>
        ) : (
          <div className="space-y-2">
            {memories.map((m) => (
              <Link
                key={m.id}
                href={`/memories/${m.id}`}
                className="block rounded border border-gray-200 p-4 hover:border-gray-300 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{m.title}</p>
                      <Badge label={m.kind} colors={kindColors} />
                      <Badge label={m.status} colors={statusColors} />
                    </div>
                    <p className="text-sm text-gray-500 truncate mt-1">{m.summary || "No summary"}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {m.scopeType}:{m.scopeId.slice(0, 8)}... &middot; {new Date(m.updatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function MemoriesPage() {
  return (
    <Suspense fallback={<p className="text-gray-400">Loading memories...</p>}>
      <MemoriesContent />
    </Suspense>
  );
}
