"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { IconOnboarding, IconChevronRight } from "@/components/icons";
import Link from "next/link";

interface Step {
  key: string;
  label: string;
  description: string;
  completed: boolean;
  category: string;
}

interface Progress {
  steps: Step[];
  completedCount: number;
  totalCount: number;
  percentComplete: number;
}

const STEP_LINKS: Record<string, string> = {
  project_created: "/projects/new",
  agent_created: "/agents/new",
  agent_published: "/agents",
  run_completed: "/runs",
  connector_installed: "/connectors",
  billing_setup: "/billing",
  policy_reviewed: "/policies",
};

const CATEGORY_ICONS: Record<string, string> = {
  setup: "1",
  agents: "2",
  integrations: "3",
  governance: "4",
};

export default function OnboardingPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) router.push("/auth/sign-in");
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!token) return;
    apiFetch<Progress>("/api/v1/onboarding", { token }).then((r) => {
      if (r.ok) setProgress(r.data);
      else setError(r.error.message);
      setLoading(false);
    });
  }, [token]);

  if (isLoading || !user) return null;

  // Group steps by category
  const stepsByCategory = progress?.steps.reduce(
    (acc, step) => {
      const cat = step.category || "general";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(step);
      return acc;
    },
    {} as Record<string, Step[]>,
  );

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="page-header">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[rgb(var(--color-brand)/0.1)] p-2 text-[rgb(var(--color-brand))]">
              <IconOnboarding size={22} />
            </div>
            <div>
              <h1 className="page-title">Setup Checklist</h1>
              <p className="page-description">
                Get your organization up and running
              </p>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-[rgb(var(--color-error)/0.3)] bg-[rgb(var(--color-error)/0.08)] px-4 py-3 text-sm text-[rgb(var(--color-error))]">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            <div className="card">
              <div className="skeleton h-6 w-48" />
              <div className="skeleton mt-3 h-3 w-full rounded-full" />
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card flex items-center gap-4">
                <div className="skeleton h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-40" />
                  <div className="skeleton h-3 w-64" />
                </div>
              </div>
            ))}
          </div>
        ) : progress ? (
          <>
            {/* Progress overview */}
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-2xl font-bold text-[rgb(var(--color-text-primary))]">
                    {progress.percentComplete}%
                  </span>
                  <span className="ml-2 text-sm text-[rgb(var(--color-text-tertiary))]">
                    complete
                  </span>
                </div>
                <span className="text-sm text-[rgb(var(--color-text-secondary))]">
                  {progress.completedCount} of {progress.totalCount} steps
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[rgb(var(--color-bg-tertiary))]">
                <div
                  className="h-full rounded-full bg-[rgb(var(--color-brand))] transition-all duration-500"
                  style={{ width: `${progress.percentComplete}%` }}
                />
              </div>
            </div>

            {/* Steps grouped by category */}
            {stepsByCategory &&
              Object.entries(stepsByCategory).map(([category, steps]) => (
                <div key={category} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[rgb(var(--color-bg-tertiary))] text-xs font-semibold text-[rgb(var(--color-text-tertiary))]">
                      {CATEGORY_ICONS[category] || "#"}
                    </span>
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-[rgb(var(--color-text-tertiary))]">
                      {category}
                    </h2>
                  </div>
                  <div className="space-y-1">
                    {steps.map((step) => (
                      <div
                        key={step.key}
                        className={`card-hover flex items-center justify-between ${
                          step.completed
                            ? "border-[rgb(var(--color-success)/0.2)]"
                            : ""
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                              step.completed
                                ? "bg-[rgb(var(--color-success)/0.15)] text-[rgb(var(--color-success))]"
                                : "bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-tertiary))]"
                            }`}
                          >
                            {step.completed ? (
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : (
                              <span className="h-2 w-2 rounded-full bg-[rgb(var(--color-text-tertiary)/0.5)]" />
                            )}
                          </div>
                          <div>
                            <div
                              className={`text-sm font-medium ${
                                step.completed
                                  ? "text-[rgb(var(--color-text-tertiary))] line-through"
                                  : "text-[rgb(var(--color-text-primary))]"
                              }`}
                            >
                              {step.label}
                            </div>
                            <div className="text-xs text-[rgb(var(--color-text-tertiary))]">
                              {step.description}
                            </div>
                          </div>
                        </div>
                        {!step.completed && STEP_LINKS[step.key] && (
                          <Link
                            href={STEP_LINKS[step.key]!}
                            className="flex items-center gap-1 rounded-lg bg-[rgb(var(--color-brand))] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[rgb(var(--color-brand-dark))]"
                          >
                            Start
                            <IconChevronRight size={12} />
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

            {/* Completion message */}
            {progress.percentComplete === 100 && (
              <div className="card border-[rgb(var(--color-success)/0.3)] bg-[rgb(var(--color-success)/0.05)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgb(var(--color-success)/0.15)] text-[rgb(var(--color-success))]">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[rgb(var(--color-success))]">
                      Setup Complete
                    </h3>
                    <p className="text-sm text-[rgb(var(--color-text-secondary))]">
                      All steps are done. Your organization is ready to go.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
