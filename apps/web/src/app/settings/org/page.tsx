"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { IconSettings } from "@/components/icons";

export default function OrgSettingsPage() {
  const { user, org, token, role, isLoading } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canEdit = role === "org_owner" || role === "org_admin";

  useEffect(() => {
    if (!isLoading && !user) router.push("/auth/sign-in");
  }, [isLoading, user, router]);

  useEffect(() => {
    if (org) setName(org.name);
  }, [org]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!org || !token) return;

    const result = await apiFetch(`/api/v1/orgs/${org.id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ name }),
    });

    if (result.ok) {
      setMessage("Organization updated.");
    } else {
      setError(result.error.message);
    }
  };

  if (isLoading || !user) {
    return (
      <AppShell>
        <div className="space-y-6">
          <div className="page-header">
            <div className="skeleton h-8 w-64" />
            <div className="skeleton mt-1 h-4 w-96" />
          </div>
          <div className="card space-y-4">
            <div className="skeleton h-4 w-32" />
            <div className="skeleton h-10 w-full max-w-md" />
            <div className="skeleton h-4 w-32" />
            <div className="skeleton h-4 w-48" />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page header */}
        <div className="page-header">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[rgb(var(--color-bg-secondary))] p-2 text-[rgb(var(--color-text-tertiary))]">
              <IconSettings size={22} />
            </div>
            <div>
              <h1 className="page-title">Organization Settings</h1>
              <p className="page-description">
                Manage your organization details and configuration
              </p>
            </div>
          </div>
        </div>

        {/* Feedback messages */}
        {message && (
          <div className="flex items-center gap-2 rounded-lg border border-[rgb(var(--color-success)/0.3)] bg-[rgb(var(--color-success)/0.08)] px-4 py-3 text-sm text-[rgb(var(--color-success))]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {message}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-[rgb(var(--color-error)/0.3)] bg-[rgb(var(--color-error)/0.08)] px-4 py-3 text-sm text-[rgb(var(--color-error))]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            {error}
          </div>
        )}

        {/* Organization details form */}
        <form onSubmit={handleSave} className="space-y-6">
          <div className="card">
            <div className="section-header">
              <h2 className="section-title">General</h2>
            </div>
            <div className="space-y-5 pt-4">
              <div>
                <label
                  htmlFor="org-name"
                  className="mb-1.5 block text-sm font-medium text-[rgb(var(--color-text-primary))]"
                >
                  Organization Name
                </label>
                <input
                  id="org-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!canEdit}
                  className="input w-full max-w-md"
                  placeholder="My Organization"
                />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="section-header">
              <h2 className="section-title">Identifiers</h2>
            </div>
            <div className="grid gap-5 pt-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[rgb(var(--color-text-primary))]">
                  Slug
                </label>
                <div className="flex h-10 items-center rounded-lg border border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-secondary))] px-3 text-sm text-[rgb(var(--color-text-secondary))]">
                  {org?.slug}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[rgb(var(--color-text-primary))]">
                  Plan
                </label>
                <div className="flex h-10 items-center gap-2 rounded-lg border border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-secondary))] px-3">
                  <span className="badge-info">{(org?.plan ?? "free").replace(/^\w/, (c: string) => c.toUpperCase())}</span>
                  <a href="/billing" className="text-xs font-medium text-[rgb(var(--color-brand))] hover:underline">Manage plan</a>
                </div>
              </div>
            </div>
          </div>

          {canEdit && (
            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="rounded-lg bg-[rgb(var(--color-brand))] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[rgb(var(--color-brand-dark))]"
              >
                Save Changes
              </button>
            </div>
          )}
        </form>
      </div>
    </AppShell>
  );
}
