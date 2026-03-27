"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import { IconRevenue, IconChevronRight } from "@/components/icons";

export default function NewAccountPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [industry, setIndustry] = useState("");
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
    const result = await apiFetch("/api/v1/revenue/accounts", {
      method: "POST",
      token: token ?? undefined,
      body: JSON.stringify({
        name,
        domain: domain || undefined,
        industry: industry || undefined,
      }),
    });
    setSubmitting(false);
    if (result.ok) {
      router.push("/revenue/accounts");
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
          <Link href="/revenue/accounts">Accounts</Link>
          <IconChevronRight size={12} className="breadcrumb-separator" />
          <span className="text-[rgb(var(--color-text-primary))]">New</span>
        </nav>

        {/* Page Header */}
        <div className="page-header">
          <h1 className="page-title">New Account</h1>
          <p className="page-description">
            Add a new customer account to your CRM
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
                Account Name
              </label>
              <p className="text-xs text-[rgb(var(--color-text-tertiary))]">
                The company or organization name
              </p>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="input"
                placeholder="e.g., Acme Corporation"
              />
            </div>

            {/* Domain */}
            <div className="space-y-1.5">
              <label
                htmlFor="domain"
                className="block text-sm font-medium text-[rgb(var(--color-text-primary))]"
              >
                Domain
                <span className="ml-1 text-xs font-normal text-[rgb(var(--color-text-tertiary))]">
                  (optional)
                </span>
              </label>
              <input
                id="domain"
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="input"
                placeholder="example.com"
              />
            </div>

            {/* Industry */}
            <div className="space-y-1.5">
              <label
                htmlFor="industry"
                className="block text-sm font-medium text-[rgb(var(--color-text-primary))]"
              >
                Industry
                <span className="ml-1 text-xs font-normal text-[rgb(var(--color-text-tertiary))]">
                  (optional)
                </span>
              </label>
              <input
                id="industry"
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="input"
                placeholder="e.g., SaaS, Healthcare, Finance"
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
                    Create Account
                  </>
                )}
              </button>
              <Link
                href="/revenue/accounts"
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
