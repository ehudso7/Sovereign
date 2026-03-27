"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.push("/dashboard");
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[rgb(var(--color-bg-primary))]">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[rgb(var(--color-brand))] text-xl font-bold text-white">
            S
          </div>
          <div className="h-1 w-24 overflow-hidden rounded-full bg-[rgb(var(--color-bg-tertiary))]">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-[rgb(var(--color-brand))]" />
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[rgb(var(--color-sidebar-bg))]">
        {/* Background grid pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Glow effect */}
        <div className="pointer-events-none absolute top-1/3 left-1/2 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgb(var(--color-brand))] opacity-[0.06] blur-[120px]" />

        <div className="relative z-10 flex flex-col items-center gap-8">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgb(var(--color-brand))] text-2xl font-bold text-white shadow-lg">
              S
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 text-center">
            <h1 className="text-5xl font-bold tracking-widest text-white sm:text-6xl">
              SOVEREIGN
            </h1>
            <p className="max-w-md text-lg text-[rgb(var(--color-sidebar-text))]">
              The multi-tenant agent operating system.
              <br />
              Build, deploy, and govern AI agents at scale.
            </p>
          </div>

          <div className="flex items-center gap-4 pt-4">
            <a
              href="/auth/sign-in"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[rgb(var(--color-brand))] px-8 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:bg-[rgb(var(--color-brand-dark))] hover:shadow-xl"
            >
              Sign In
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </a>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-8">
            {[
              "Agent Studio",
              "Workflow Orchestration",
              "Policy Engine",
              "Audit Trail",
              "Multi-Tenant",
              "MCP Connectors",
            ].map((feature) => (
              <span
                key={feature}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[rgb(var(--color-sidebar-text))]"
              >
                {feature}
              </span>
            ))}
          </div>
        </div>
      </main>
    );
  }

  return null;
}
