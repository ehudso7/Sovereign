"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { completeSessionToken } = useAuth();
  const [message, setMessage] = useState("Completing sign-in...");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const next = searchParams.get("next") ?? "/dashboard";
      const error = fragment.get("error");
      const sessionToken = fragment.get("session_token");
      const bootstrapToken = fragment.get("bootstrap_token");

      if (error) {
        router.replace(`/auth/sign-in?error=${encodeURIComponent(error)}`);
        return;
      }

      if (bootstrapToken) {
        const setupFragment = new URLSearchParams();
        setupFragment.set("bootstrap_token", bootstrapToken);

        const email = fragment.get("email");
        const name = fragment.get("name");
        if (email) setupFragment.set("email", email);
        if (name) setupFragment.set("name", name);

        window.location.replace(`/auth/setup#${setupFragment.toString()}`);
        return;
      }

      if (!sessionToken) {
        router.replace("/auth/sign-in?error=Missing%20session%20token");
        return;
      }

      const success = await completeSessionToken(sessionToken);
      if (cancelled) {
        return;
      }

      if (success) {
        router.replace(next);
      } else {
        router.replace("/auth/sign-in?error=Unable%20to%20load%20the%20authenticated%20session");
      }
    };

    run().catch(() => {
      if (!cancelled) {
        setMessage("Sign-in failed. Redirecting...");
        router.replace("/auth/sign-in?error=Sign-in%20callback%20failed");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [completeSessionToken, router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[rgb(var(--color-bg-primary))] px-4">
      <div className="rounded-xl border border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-secondary))] px-6 py-5 text-sm text-[rgb(var(--color-text-secondary))] shadow-lg shadow-black/5">
        {message}
      </div>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[rgb(var(--color-bg-primary))] px-4">
          <div className="rounded-xl border border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-secondary))] px-6 py-5 text-sm text-[rgb(var(--color-text-secondary))] shadow-lg shadow-black/5">
            Completing sign-in...
          </div>
        </main>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
