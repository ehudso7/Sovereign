"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

const POLICY_TYPES = [
  "access_control",
  "deny",
  "require_approval",
  "quarantine",
  "budget_cap",
  "content_filter",
] as const;

const ENFORCEMENT_MODES = ["allow", "deny", "require_approval", "quarantine"] as const;

const SCOPE_TYPES = ["org", "project", "agent", "connector", "browser", "memory", "run"] as const;

export default function NewPolicyPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [policyType, setPolicyType] = useState<string>(POLICY_TYPES[0]);
  const [enforcementMode, setEnforcementMode] = useState<string>(ENFORCEMENT_MODES[0]);
  const [scopeType, setScopeType] = useState<string>(SCOPE_TYPES[0]);
  const [scopeId, setScopeId] = useState("");
  const [priority, setPriority] = useState(0);
  const [rulesText, setRulesText] = useState('[{"actionPattern": "*"}]');
  const [rulesError, setRulesError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  const validateRules = (text: string): boolean => {
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        setRulesError("Rules must be a JSON array of objects with actionPattern.");
        return false;
      }
      setRulesError(null);
      return true;
    } catch {
      setRulesError("Rules must be valid JSON.");
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!validateRules(rulesText)) return;

    setSubmitting(true);
    setError(null);

    const result = await apiFetch<{ id: string }>("/api/v1/policies", {
      method: "POST",
      token,
      body: JSON.stringify({
        name,
        description: description || undefined,
        policyType,
        enforcementMode,
        scopeType,
        scopeId: scopeId || undefined,
        priority,
        rules: JSON.parse(rulesText),
      }),
    });

    if (result.ok) {
      router.push("/policies");
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
          <Link href="/policies" className="text-sm text-gray-500 hover:text-gray-700">
            &larr; Back to Policies
          </Link>
        </div>

        <h1 className="text-2xl font-bold">Create Policy</h1>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 rounded border border-gray-200 p-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
              placeholder="e.g. Block external tool access"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
              placeholder="Optional description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Policy Type <span className="text-red-500">*</span>
              </label>
              <select
                value={policyType}
                onChange={(e) => setPolicyType(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
              >
                {POLICY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Enforcement Mode <span className="text-red-500">*</span>
              </label>
              <select
                value={enforcementMode}
                onChange={(e) => setEnforcementMode(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
              >
                {ENFORCEMENT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Scope Type <span className="text-red-500">*</span>
              </label>
              <select
                value={scopeType}
                onChange={(e) => setScopeType(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
              >
                {SCOPE_TYPES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Scope ID <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                value={scopeId}
                onChange={(e) => setScopeId(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                placeholder="e.g. agent ID, connector ID"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Priority</label>
            <input
              type="number"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
              placeholder="0"
            />
            <p className="mt-1 text-xs text-gray-400">Higher numbers run first.</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Rules (JSON) <span className="text-red-500">*</span>
            </label>
            <textarea
              value={rulesText}
              onChange={(e) => {
                setRulesText(e.target.value);
                validateRules(e.target.value);
              }}
              rows={6}
              className={`w-full rounded border px-3 py-2 font-mono text-sm focus:outline-none ${rulesError ? "border-red-300 focus:border-red-500" : "border-gray-300 focus:border-gray-500"}`}
              placeholder='[{"actionPattern": "*"}]'
            />
            {rulesError && <p className="mt-1 text-xs text-red-600">{rulesError}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create Policy"}
            </button>
            <Link
              href="/policies"
              className="rounded bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
