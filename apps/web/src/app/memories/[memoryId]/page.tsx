"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
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
  content: string;
  contentHash: string;
  metadata: Record<string, unknown>;
  sourceRunId: string | null;
  sourceAgentId: string | null;
  createdBy: string;
  updatedBy: string;
  expiresAt: string | null;
  redactedAt: string | null;
  lastAccessedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MemoryLink {
  id: string;
  linkedEntityType: string;
  linkedEntityId: string;
  linkType: string;
  createdAt: string;
}

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

export default function MemoryDetailPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const memoryId = params.memoryId as string;

  const [memory, setMemory] = useState<Memory | null>(null);
  const [links, setLinks] = useState<MemoryLink[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const canRedact = role === "org_owner" || role === "org_admin";
  const canDelete = role === "org_owner" || role === "org_admin";
  const canPromote = role === "org_owner" || role === "org_admin" || role === "org_member";

  useEffect(() => {
    if (!isLoading && !user) router.push("/auth/sign-in");
  }, [isLoading, user, router]);

  const loadMemory = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const [memResult, linkResult] = await Promise.all([
      apiFetch<Memory>(`/api/v1/memories/${memoryId}`, { token }),
      apiFetch<MemoryLink[]>(`/api/v1/memories/${memoryId}/links`, { token }),
    ]);

    if (memResult.ok) setMemory(memResult.data);
    else setError(memResult.error.message);

    if (linkResult.ok) setLinks(linkResult.data);

    setLoading(false);
  }, [token, memoryId]);

  useEffect(() => { loadMemory(); }, [loadMemory]);

  const handleAction = async (action: "redact" | "expire" | "delete" | "promote") => {
    if (!token) return;
    setActionLoading(true);
    setError(null);

    const result = await apiFetch<Memory>(`/api/v1/memories/${memoryId}/${action}`, {
      method: "POST", token, body: JSON.stringify({}),
    });

    if (result.ok) setMemory(result.data);
    else setError(result.error.message);
    setActionLoading(false);
  };

  if (isLoading || !user) return null;
  if (loading) return <AppShell><p className="text-gray-400">Loading memory...</p></AppShell>;

  if (!memory) {
    return (
      <AppShell>
        <div className="rounded border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-medium text-red-700">Memory not found</p>
          <p className="text-sm text-red-600">{error}</p>
          <Link href="/memories" className="mt-2 inline-block text-sm text-gray-600 underline">Back to Memories</Link>
        </div>
      </AppShell>
    );
  }

  const isActive = memory.status === "active";
  const isEpisodic = memory.kind === "episodic";

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Link href="/memories" className="text-sm text-gray-500 hover:text-gray-700">&larr; Back to Memories</Link>
        </div>

        {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{memory.title}</h1>
            <p className="text-sm text-gray-500 font-mono">{memory.id}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge label={memory.kind} colors={kindColors} />
            <Badge label={memory.status} colors={statusColors} />
            {isActive && isEpisodic && canPromote && (
              <button onClick={() => handleAction("promote")} disabled={actionLoading}
                className="rounded bg-green-100 px-3 py-1 text-sm text-green-700 hover:bg-green-200 disabled:opacity-50">
                {actionLoading ? "..." : "Promote to Procedural"}
              </button>
            )}
            {isActive && canRedact && (
              <button onClick={() => handleAction("redact")} disabled={actionLoading}
                className="rounded bg-red-100 px-3 py-1 text-sm text-red-700 hover:bg-red-200 disabled:opacity-50">
                {actionLoading ? "..." : "Redact"}
              </button>
            )}
            {isActive && canRedact && (
              <button onClick={() => handleAction("expire")} disabled={actionLoading}
                className="rounded bg-yellow-100 px-3 py-1 text-sm text-yellow-700 hover:bg-yellow-200 disabled:opacity-50">
                {actionLoading ? "..." : "Expire"}
              </button>
            )}
            {isActive && canDelete && (
              <button onClick={() => handleAction("delete")} disabled={actionLoading}
                className="rounded bg-gray-200 px-3 py-1 text-sm text-gray-700 hover:bg-gray-300 disabled:opacity-50">
                {actionLoading ? "..." : "Delete"}
              </button>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="rounded border border-gray-200 p-4">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="font-medium text-gray-500">Scope</dt>
              <dd>{memory.scopeType}: {memory.scopeId}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Content Hash</dt>
              <dd className="font-mono text-xs truncate">{memory.contentHash}</dd>
            </div>
            {memory.sourceRunId && (
              <div>
                <dt className="font-medium text-gray-500">Source Run</dt>
                <dd><Link href={`/runs/${memory.sourceRunId}`} className="text-blue-600 hover:underline font-mono text-xs">{memory.sourceRunId}</Link></dd>
              </div>
            )}
            {memory.sourceAgentId && (
              <div>
                <dt className="font-medium text-gray-500">Source Agent</dt>
                <dd><Link href={`/agents/${memory.sourceAgentId}`} className="text-blue-600 hover:underline font-mono text-xs">{memory.sourceAgentId}</Link></dd>
              </div>
            )}
            <div>
              <dt className="font-medium text-gray-500">Created</dt>
              <dd>{new Date(memory.createdAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Updated</dt>
              <dd>{new Date(memory.updatedAt).toLocaleString()}</dd>
            </div>
            {memory.expiresAt && (
              <div>
                <dt className="font-medium text-gray-500">Expires</dt>
                <dd>{new Date(memory.expiresAt).toLocaleString()}</dd>
              </div>
            )}
            {memory.redactedAt && (
              <div>
                <dt className="font-medium text-gray-500">Redacted</dt>
                <dd>{new Date(memory.redactedAt).toLocaleString()}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Summary */}
        {memory.summary && (
          <div className="rounded border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-500">Summary</p>
            <p className="mt-1 text-sm">{memory.summary}</p>
          </div>
        )}

        {/* Content */}
        <div className="rounded border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-500">Content</p>
          <pre className="mt-1 max-h-96 overflow-auto whitespace-pre-wrap text-sm">{memory.content}</pre>
        </div>

        {/* Links */}
        <div>
          <h2 className="text-lg font-semibold">Links</h2>
          {links.length === 0 ? (
            <div className="mt-4 rounded border border-gray-200 p-6 text-center text-gray-400">No links.</div>
          ) : (
            <div className="mt-4 space-y-2">
              {links.map((link) => (
                <div key={link.id} className="rounded border border-gray-200 p-3">
                  <p className="text-sm">
                    <span className="font-medium">{link.linkType}</span>: {link.linkedEntityType} {link.linkedEntityId.slice(0, 8)}...
                  </p>
                  <p className="text-xs text-gray-400">{new Date(link.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
