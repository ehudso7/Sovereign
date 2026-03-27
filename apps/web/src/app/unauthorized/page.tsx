"use client";

import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[rgb(var(--color-bg-primary))]">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-[rgb(var(--color-error)/0.04)] blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-[rgb(var(--color-error)/0.03)] blur-3xl" />
      </div>

      <div className="relative z-10 text-center">
        {/* Lock icon */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[rgb(var(--color-error)/0.1)]">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgb(var(--color-error))"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </div>

        {/* Error code */}
        <h1 className="text-6xl font-bold text-[rgb(var(--color-text-primary))]">
          403
        </h1>

        {/* Message */}
        <h2 className="mt-3 text-lg font-semibold text-[rgb(var(--color-text-primary))]">
          Access Denied
        </h2>
        <p className="mt-2 max-w-sm text-sm text-[rgb(var(--color-text-tertiary))]">
          You do not have permission to access this resource. Please contact
          your organization administrator if you believe this is an error.
        </p>

        {/* Actions */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-lg bg-[rgb(var(--color-brand))] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[rgb(var(--color-brand-dark))]"
          >
            Back to Dashboard
          </Link>
          <Link
            href="/auth/sign-in"
            className="rounded-lg border border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-secondary))] px-5 py-2.5 text-sm font-medium text-[rgb(var(--color-text-secondary))] transition-colors hover:bg-[rgb(var(--color-bg-tertiary))]"
          >
            Sign In
          </Link>
        </div>
      </div>
    </main>
  );
}
