"use client";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

interface Step { key: string; label: string; description: string; completed: boolean; category: string; }
interface Progress { steps: Step[]; completedCount: number; totalCount: number; percentComplete: number; }

const STEP_LINKS: Record<string, string> = {
  project_created: "/dashboard", agent_created: "/agents/new",
  agent_published: "/agents", run_completed: "/runs",
  connector_installed: "/connectors", billing_setup: "/billing",
  policy_reviewed: "/policies",
};

export default function OnboardingPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (!isLoading && !user) router.push("/auth/sign-in"); }, [isLoading, user, router]);
  useEffect(() => { if (!token) return; apiFetch<Progress>("/api/v1/onboarding", { token }).then((r) => { if (r.ok) setProgress(r.data); else setError(r.error.message); setLoading(false); }); }, [token]);
  if (isLoading || !user) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Setup Checklist</h1>
          <p className="text-gray-500">Get your organization up and running</p>
        </div>
        {error && <div className="rounded bg-red-100 p-4 text-red-700">{error}</div>}
        {loading ? <div className="text-gray-500">Loading...</div> : progress ? (
          <>
            <div className="rounded border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg font-semibold">{progress.percentComplete}% Complete</span>
                <span className="text-sm text-gray-500">{progress.completedCount} / {progress.totalCount} steps</span>
              </div>
              <div className="h-3 rounded bg-gray-200"><div className="h-3 rounded bg-green-500 transition-all" style={{ width: `${progress.percentComplete}%` }} /></div>
            </div>
            <div className="space-y-3">
              {progress.steps.map((step) => (
                <div key={step.key} className={`flex items-center justify-between rounded border p-4 ${step.completed ? "border-green-200 bg-green-50" : "border-gray-200"}`}>
                  <div className="flex items-center gap-3">
                    <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${step.completed ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"}`}>
                      {step.completed ? "\u2713" : "\u2022"}
                    </div>
                    <div>
                      <div className="font-medium">{step.label}</div>
                      <div className="text-sm text-gray-500">{step.description}</div>
                    </div>
                  </div>
                  {!step.completed && STEP_LINKS[step.key] && (
                    <Link href={STEP_LINKS[step.key]!} className="rounded bg-gray-900 px-3 py-1 text-sm text-white hover:bg-gray-700">Go</Link>
                  )}
                </div>
              ))}
            </div>
            {progress.percentComplete === 100 && (
              <div className="rounded bg-green-100 p-4 text-green-800">All setup steps are complete. Your organization is ready to go.</div>
            )}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
