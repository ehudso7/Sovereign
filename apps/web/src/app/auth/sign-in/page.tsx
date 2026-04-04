"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter, useSearchParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";
const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE ?? "local";

export default function SignInPage() {
  const { signIn, bootstrap } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isBootstrap, setIsBootstrap] = useState(false);
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");

  // Show error from WorkOS callback if present
  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }
  }, [searchParams]);

  const isWorkOS = AUTH_MODE === "workos";

  const handleWorkOSSignIn = () => {
    setIsLoading(true);
    // Redirect to API authorize endpoint which redirects to WorkOS
    window.location.href = `${API_BASE}/api/v1/auth/authorize`;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const success = await signIn(email);
    if (success) {
      router.push("/dashboard");
    } else {
      setError("Sign in failed. If this is a new installation, use the bootstrap form.");
    }
    setIsLoading(false);
  };

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const success = await bootstrap({ email, name, orgName, orgSlug });
    if (success) {
      router.push("/dashboard");
    } else {
      setError("Bootstrap failed. Check the API server logs.");
    }
    setIsLoading(false);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[rgb(var(--color-bg-primary))]">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-[rgb(var(--color-brand)/0.06)] blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-[rgb(var(--color-brand)/0.04)] blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Brand logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[rgb(var(--color-brand))]">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[rgb(var(--color-text-primary))]">
            SOVEREIGN
          </h1>
          <p className="mt-1 text-sm text-[rgb(var(--color-text-tertiary))]">
            Agent Operating System
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-secondary))] p-8 shadow-lg shadow-black/5">
          <h2 className="mb-6 text-lg font-semibold text-[rgb(var(--color-text-primary))]">
            {isWorkOS ? "Sign In" : isBootstrap ? "Bootstrap Account" : "Sign In"}
          </h2>

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-lg border border-[rgb(var(--color-error)/0.3)] bg-[rgb(var(--color-error)/0.08)] px-4 py-3 text-sm text-[rgb(var(--color-error))]">
              {error}
            </div>
          )}

          {/* ─── WorkOS auth mode: single SSO button ─── */}
          {isWorkOS ? (
            <div className="space-y-4">
              <p className="text-sm text-[rgb(var(--color-text-secondary))]">
                Sign in with your organization&apos;s identity provider.
              </p>
              <button
                type="button"
                onClick={handleWorkOSSignIn}
                disabled={isLoading}
                className="w-full rounded-lg bg-[rgb(var(--color-brand))] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[rgb(var(--color-brand-dark))] disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="h-4 w-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="3"
                        className="opacity-25"
                      />
                      <path
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        fill="currentColor"
                        className="opacity-75"
                      />
                    </svg>
                    Redirecting...
                  </span>
                ) : (
                  "Continue with SSO"
                )}
              </button>
            </div>

          /* ─── Local auth mode: email + optional bootstrap ─── */
          ) : !isBootstrap ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm font-medium text-[rgb(var(--color-text-primary))]"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="input w-full"
                  placeholder="you@company.com"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-lg bg-[rgb(var(--color-brand))] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[rgb(var(--color-brand-dark))] disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="h-4 w-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="3"
                        className="opacity-25"
                      />
                      <path
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        fill="currentColor"
                        className="opacity-75"
                      />
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  "Sign In"
                )}
              </button>
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[rgb(var(--color-border-primary))]" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-[rgb(var(--color-bg-secondary))] px-2 text-[rgb(var(--color-text-tertiary))]">
                    or
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBootstrap(true)}
                className="w-full rounded-lg border border-[rgb(var(--color-border-primary))] bg-transparent px-4 py-2.5 text-sm font-medium text-[rgb(var(--color-text-secondary))] transition-colors hover:bg-[rgb(var(--color-bg-tertiary))]"
              >
                New installation? Bootstrap first account
              </button>
            </form>
          ) : (
            <form onSubmit={handleBootstrap} className="space-y-4">
              <div>
                <label
                  htmlFor="b-email"
                  className="mb-1.5 block text-sm font-medium text-[rgb(var(--color-text-primary))]"
                >
                  Email
                </label>
                <input
                  id="b-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="input w-full"
                  placeholder="admin@company.com"
                />
              </div>
              <div>
                <label
                  htmlFor="b-name"
                  className="mb-1.5 block text-sm font-medium text-[rgb(var(--color-text-primary))]"
                >
                  Name
                </label>
                <input
                  id="b-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="input w-full"
                  placeholder="Your full name"
                />
              </div>
              <div>
                <label
                  htmlFor="b-orgName"
                  className="mb-1.5 block text-sm font-medium text-[rgb(var(--color-text-primary))]"
                >
                  Organization Name
                </label>
                <input
                  id="b-orgName"
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required
                  className="input w-full"
                  placeholder="Acme Corp"
                />
              </div>
              <div>
                <label
                  htmlFor="b-orgSlug"
                  className="mb-1.5 block text-sm font-medium text-[rgb(var(--color-text-primary))]"
                >
                  Organization Slug
                </label>
                <input
                  id="b-orgSlug"
                  type="text"
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value)}
                  required
                  pattern="[a-z0-9-]+"
                  className="input w-full"
                  placeholder="acme-corp"
                />
                <p className="mt-1 text-xs text-[rgb(var(--color-text-tertiary))]">
                  Lowercase letters, numbers, and hyphens only
                </p>
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-lg bg-[rgb(var(--color-brand))] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[rgb(var(--color-brand-dark))] disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="h-4 w-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="3"
                        className="opacity-25"
                      />
                      <path
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        fill="currentColor"
                        className="opacity-75"
                      />
                    </svg>
                    Creating...
                  </span>
                ) : (
                  "Bootstrap Account"
                )}
              </button>
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[rgb(var(--color-border-primary))]" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-[rgb(var(--color-bg-secondary))] px-2 text-[rgb(var(--color-text-tertiary))]">
                    or
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBootstrap(false)}
                className="w-full rounded-lg border border-[rgb(var(--color-border-primary))] bg-transparent px-4 py-2.5 text-sm font-medium text-[rgb(var(--color-text-secondary))] transition-colors hover:bg-[rgb(var(--color-bg-tertiary))]"
              >
                Already have an account? Sign in
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-[rgb(var(--color-text-tertiary))]">
          Secured by SOVEREIGN Agent OS
        </p>
      </div>
    </main>
  );
}
