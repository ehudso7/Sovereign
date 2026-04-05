"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

export default function CreateVersionPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const agentId = params.agentId as string;

  const [instructions, setInstructions] = useState("");
  const [goals, setGoals] = useState("");
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("gpt-4o");
  const [temperature, setTemperature] = useState("0.7");
  const [maxTokens, setMaxTokens] = useState("4096");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canEdit = role === "org_owner" || role === "org_admin";

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
    if (!isLoading && user && !canEdit) {
      router.push(`/agents/${agentId}`);
    }
  }, [isLoading, user, canEdit, agentId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);

    const goalList = goals
      .split("\n")
      .map((g) => g.trim())
      .filter((g) => g.length > 0);

    const result = await apiFetch<{ id: string }>(
      `/api/v1/agents/${agentId}/versions`,
      {
        method: "POST",
        token,
        body: JSON.stringify({
          instructions: instructions || undefined,
          goals: goalList.length > 0 ? goalList : undefined,
          modelConfig: {
            provider,
            model,
            temperature: parseFloat(temperature),
            maxTokens: parseInt(maxTokens, 10),
          },
        }),
      },
    );

    if (result.ok) {
      router.push(`/agents/${agentId}/versions/${result.data.id}`);
    } else {
      setError(result.error.message);
      setSubmitting(false);
    }
  };

  if (isLoading || !user) return null;

  if (!canEdit) {
    return (
      <AppShell>
        <div className="rounded border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-medium text-red-700">Forbidden</p>
          <p className="text-sm text-red-600">You do not have permission to create agent versions.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Link
            href={`/agents/${agentId}`}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            &larr; Back to Agent
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Create New Version</h1>
          <p className="text-sm text-gray-500">
            New versions are created as drafts. Edit and publish when ready.
          </p>
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Goals</label>
            <textarea
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm"
              rows={3}
              placeholder="One goal per line"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Instructions <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-400">Required for publishing. Define the agent&apos;s behavior and system prompt.</p>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm"
              rows={8}
              required
              placeholder="You are a helpful assistant that..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Provider</label>
              <input
                type="text"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Model</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Temperature</label>
              <input
                type="number"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
                min="0"
                max="2"
                step="0.1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Max Tokens</label>
              <input
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(e.target.value)}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
                min="1"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Draft Version"}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
