"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function CreateMemoryPage() {
  const { user, org, token, isLoading } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [kind, setKind] = useState<"semantic" | "episodic" | "procedural">("semantic");
  const [scopeType, setScopeType] = useState<"org" | "project" | "agent" | "user">("org");
  const [scopeId, setScopeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.push("/auth/sign-in");
  }, [isLoading, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !title || !content) return;

    // Determine the effective scopeId - use org ID for org scope when not specified
    const effectiveScopeId = scopeId || (scopeType === "org" ? org?.id : undefined);
    if (!effectiveScopeId) {
      setError("Scope ID is required for non-organization scopes.");
      return;
    }
    if (!UUID_RE.test(effectiveScopeId)) {
      setError("Scope ID must be a valid UUID.");
      return;
    }
    if (!summary) {
      setError("Summary is required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (scopeId && !uuidRegex.test(scopeId)) {
      setError("Scope ID must be a valid UUID");
      setSubmitting(false);
      return;
    }

    const result = await apiFetch<{ id: string }>("/api/v1/memories", {
      method: "POST",
      token,
      body: JSON.stringify({ title, summary, content, kind, scopeType, scopeId: effectiveScopeId }),
    });

    if (result.ok) {
      router.push(`/memories/${result.data.id}`);
    } else {
      setError(result.error.message);
      setSubmitting(false);
    }
  };

  if (isLoading || !user) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Link href="/memories" className="text-sm text-gray-500 hover:text-gray-700">&larr; Back to Memories</Link>
        </div>
        <h1 className="text-2xl font-bold">Create Memory</h1>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
          <div>
            <label className="block text-sm font-medium text-gray-700">Kind</label>
            <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm">
              <option value="semantic">Semantic</option>
              <option value="episodic">Episodic</option>
              <option value="procedural">Procedural</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Scope Type</label>
            <select value={scopeType} onChange={(e) => setScopeType(e.target.value as typeof scopeType)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm">
              <option value="org">Organization</option>
              <option value="project">Project</option>
              <option value="agent">Agent</option>
              <option value="user">User</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Scope ID {scopeType === "org" ? "(auto-filled from your org)" : ""}
            </label>
            <input type="text" value={scopeId} onChange={(e) => setScopeId(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder={scopeType === "org" ? (org?.id ?? "Org ID") : "UUID of scope target (e.g., project or agent ID)"}
            />
            {scopeType === "org" && !scopeId && org?.id && (
              <p className="mt-1 text-xs text-gray-400">
                Will use your org ID: {org.id}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Summary</label>
            <input type="text" value={summary} onChange={(e) => setSummary(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Content</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} required rows={6}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <button type="submit" disabled={submitting || !title || !content}
            className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50">
            {submitting ? "Creating..." : "Create Memory"}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
