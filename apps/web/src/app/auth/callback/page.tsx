"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { parseAuthCallbackPayload } from "@/lib/auth-callback";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loadSessionFromToken } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { sessionToken, redirectTo, error: callbackError } = parseAuthCallbackPayload(
      searchParams,
      window.location.hash,
    );

    if (callbackError) {
      setError(callbackError);
      return;
    }

    loadSessionFromToken(sessionToken ?? "")
      .then((success) => {
        if (success) {
          router.replace(redirectTo);
        } else {
          setError("Failed to load session. Please try signing in again.");
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("NETWORK_ERROR") || msg.includes("Cannot reach") || msg.includes("Failed to fetch")) {
          setError("Cannot reach the authentication service. Please check your connection and try again.");
        } else {
          setError("An unexpected error occurred. Please try signing in again.");
        }
      });
  }, [searchParams, router, loadSessionFromToken]);

  if (error) {
    return (
      <div className="w-full max-w-md px-4 text-center">
        <div className="rounded-xl border border-[rgb(var(--color-error)/0.3)] bg-[rgb(var(--color-error)/0.08)] p-6">
          <p className="text-sm text-[rgb(var(--color-error))]">{error}</p>
          <button
            onClick={() => router.push("/auth/sign-in")}
            className="mt-4 rounded-lg bg-[rgb(var(--color-brand))] px-4 py-2 text-sm font-medium text-white"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <svg
        className="mx-auto h-8 w-8 animate-spin text-[rgb(var(--color-brand))]"
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
      <p className="mt-4 text-sm text-[rgb(var(--color-text-tertiary))]">
        Completing sign in...
      </p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[rgb(var(--color-bg-primary))]">
      <Suspense
        fallback={
          <div className="text-center">
            <p className="text-sm text-[rgb(var(--color-text-tertiary))]">Loading...</p>
          </div>
        }
      >
        <CallbackContent />
      </Suspense>
    </main>
  );
}
