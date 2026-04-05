"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import { IconRevenue, IconChevronRight } from "@/components/icons";

export default function NewDealPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [stage, setStage] = useState("discovery");
  const [valueCents, setValueCents] = useState("");
  const [probability, setProbability] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await apiFetch("/api/v1/revenue/deals", {
      method: "POST",
      token: token ?? undefined,
      body: JSON.stringify({
        name,
        stage,
        valueCents: valueCents ? Math.min(parseInt(valueCents, 10), Number.MAX_SAFE_INTEGER) : undefined,
        probability: probability ? parseInt(probability, 10) : undefined,
      }),
    });
    setSubmitting(false);
    if (result.ok) {
      router.push("/revenue/deals");
    } else {
      setError(result.error.message);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="breadcrumb">
          <Link href="/revenue">Revenue</Link>
          <IconChevronRight size={12} className="breadcrumb-separator" />
          <Link href="/revenue/deals">Deals</Link>
          <IconChevronRight size={12} className="breadcrumb-separator" />
          <span className="text-[rgb(var(--color-text-primary))]">New</span>
        </nav>

        {/* Page Header */}
        <div className="page-header">
          <h1 className="page-title">New Deal</h1>
          <p className="page-description">
            Create a new deal to track in your pipeline
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="flex items-center gap-3 rounded-lg border border-[rgb(var(--color-error)/0.3)] bg-[rgb(var(--color-error-bg))] px-4 py-3 text-sm text-[rgb(var(--color-error))]">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {/* Form Card */}
        <div className="card max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name */}
            <div className="space-y-1.5">
              <label
                htmlFor="name"
                className="block text-sm font-medium text-[rgb(var(--color-text-primary))]"
              >
                Deal Name
              </label>
              <p className="text-xs text-[rgb(var(--color-text-tertiary))]">
                A descriptive name for this opportunity
              </p>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="input"
                placeholder="e.g., Acme Corp - Enterprise License"
              />
            </div>

            {/* Stage */}
            <div className="space-y-1.5">
              <label
                htmlFor="stage"
                className="block text-sm font-medium text-[rgb(var(--color-text-primary))]"
              >
                Stage
              </label>
              <select
                id="stage"
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className="input"
              >
                <option value="discovery">Discovery</option>
                <option value="qualification">Qualification</option>
                <option value="proposal">Proposal</option>
                <option value="negotiation">Negotiation</option>
                <option value="closed_won">Closed Won</option>
                <option value="closed_lost">Closed Lost</option>
              </select>
            </div>

            {/* Value */}
            <div className="space-y-1.5">
              <label
                htmlFor="valueCents"
                className="block text-sm font-medium text-[rgb(var(--color-text-primary))]"
              >
                Value (cents)
                <span className="ml-1 text-xs font-normal text-[rgb(var(--color-text-tertiary))]">
                  (optional)
                </span>
              </label>
              <p className="text-xs text-[rgb(var(--color-text-tertiary))]">
                Deal value in cents (e.g., 100000 = $1,000)
              </p>
              <input
                id="valueCents"
                type="number"
                min="0"
                max="9007199254740991"
                value={valueCents}
                onChange={(e) => setValueCents(e.target.value)}
                className="input"
                placeholder="100000"
              />
            </div>

            {/* Probability */}
            <div className="space-y-1.5">
              <label
                htmlFor="probability"
                className="block text-sm font-medium text-[rgb(var(--color-text-primary))]"
              >
                Probability (%)
                <span className="ml-1 text-xs font-normal text-[rgb(var(--color-text-tertiary))]">
                  (optional)
                </span>
              </label>
              <input
                id="probability"
                type="number"
                min="0"
                max="100"
                value={probability}
                onChange={(e) => setProbability(e.target.value)}
                className="input"
                placeholder="50"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 border-t border-[rgb(var(--color-border-primary))] pt-6">
              <button
                type="submit"
                disabled={submitting || !name}
                className="inline-flex items-center gap-2 rounded-lg bg-[rgb(var(--color-brand))] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-[rgb(var(--color-brand-dark))] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <svg
                      className="h-4 w-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Creating...
                  </>
                ) : (
                  <>
                    <IconRevenue size={16} />
                    Create Deal
                  </>
                )}
              </button>
              <Link
                href="/revenue/deals"
                className="rounded-lg border border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-primary))] px-5 py-2.5 text-sm font-medium text-[rgb(var(--color-text-secondary))] transition-colors hover:bg-[rgb(var(--color-bg-secondary))] hover:text-[rgb(var(--color-text-primary))]"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
