"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

/* ── Enums matching API validation in apps/api/src/routes/policies.ts ── */

const POLICY_TYPES = [
  "access_control",
  "deny",
  "require_approval",
  "quarantine",
  "budget_cap",
  "content_filter",
] as const;

const POLICY_TYPE_LABELS: Record<string, string> = {
  access_control: "Access Control",
  deny: "Deny",
  require_approval: "Require Approval",
  quarantine: "Quarantine",
  budget_cap: "Budget Cap",
  content_filter: "Content Filter",
};

const ENFORCEMENT_MODES = ["allow", "deny", "require_approval", "quarantine"] as const;

const ENFORCEMENT_MODE_LABELS: Record<string, string> = {
  allow: "Allow",
  deny: "Deny",
  require_approval: "Require Approval",
  quarantine: "Quarantine",
};

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
          <Link href="/policies" className="text-sm text-[rgb(var(--color-text-tertiary))] hover:text-[rgb(var(--color-text-primary))] transition-colors">
            &larr; Back to Policies
          </Link>
        </div>

        <h1 className="page-title">Create Policy</h1>

        {error && (
          <div className="rounded-lg border border-[rgb(var(--color-error)/0.3)] bg-[rgb(var(--color-error-bg))] px-4 py-3 text-sm text-[rgb(var(--color-error))]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="card space-y-5 p-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[rgb(var(--color-text-primary))]">
              Name <span className="text-[rgb(var(--color-error))]">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="input w-full"
              placeholder="e.g. Block external tool access"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[rgb(var(--color-text-primary))]">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="input w-full"
              placeholder="Optional description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[rgb(var(--color-text-primary))]">
                Policy Type <span className="text-[rgb(var(--color-error))]">*</span>
              </label>
              <select
                value={policyType}
                onChange={(e) => setPolicyType(e.target.value)}
                className="input w-full"
              >
                {POLICY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {POLICY_TYPE_LABELS[t] ?? t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[rgb(var(--color-text-primary))]">
                Enforcement Mode <span className="text-[rgb(var(--color-error))]">*</span>
              </label>
              <select
                value={enforcementMode}
                onChange={(e) => setEnforcementMode(e.target.value)}
                className="input w-full"
              >
                {ENFORCEMENT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {ENFORCEMENT_MODE_LABELS[m] ?? m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[rgb(var(--color-text-primary))]">
                Scope Type <span className="text-[rgb(var(--color-error))]">*</span>
              </label>
              <select
                value={scopeType}
                onChange={(e) => setScopeType(e.target.value)}
                className="input w-full"
              >
                {SCOPE_TYPES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[rgb(var(--color-text-primary))]">
                Scope ID <span className="text-[rgb(var(--color-text-tertiary))]">(optional)</span>
              </label>
              <input
                type="text"
                value={scopeId}
                onChange={(e) => setScopeId(e.target.value)}
                className="input w-full"
                placeholder="e.g. agent ID, connector ID"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[rgb(var(--color-text-primary))]">Priority</label>
            <input
              type="number"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="input w-full"
              placeholder="0"
              min={0}
              max={1000}
            />
            <p className="mt-1 text-xs text-[rgb(var(--color-text-tertiary))]">Higher numbers run first (0-1000).</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[rgb(var(--color-text-primary))]">
              Rules (JSON Array) <span className="text-[rgb(var(--color-text-tertiary))]">(optional)</span>
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
            {rulesError && <p className="mt-1 text-xs text-[rgb(var(--color-error))]">{rulesError}</p>}
            <p className="mt-1 text-xs text-[rgb(var(--color-text-tertiary))]">
              Array of rule objects. Each rule needs an &quot;actionPattern&quot; (string) and optional &quot;conditions&quot; (object).
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting || !name}
              className="rounded-md bg-[rgb(var(--color-brand))] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create Policy"}
            </button>
            <Link
              href="/policies"
              className="rounded-md border border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-primary))] px-4 py-2 text-sm font-medium text-[rgb(var(--color-text-secondary))] transition-colors hover:bg-[rgb(var(--color-bg-secondary))]"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
