"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { IconMembers } from "@/components/icons";

const ROLES = ["org_member", "org_admin", "org_billing_admin", "org_security_admin"];

function formatRole(r: string): string {
  return r
    .replace("org_", "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function InvitePage() {
  const { user, org, token, isLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("org_member");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && !user) router.push("/auth/sign-in");
  }, [isLoading, user, router]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!org || !token) return;

    const result = await apiFetch(`/api/v1/orgs/${org.id}/invitations`, {
      method: "POST",
      token,
      body: JSON.stringify({ email, role }),
    });

    if (result.ok) {
      setMessage(`Invitation sent to ${email}`);
      setEmail("");
    } else {
      setError(result.error.message);
    }
  };

  if (isLoading || !user) {
    return (
      <AppShell>
        <div className="space-y-6">
          <div className="page-header">
            <div className="skeleton h-8 w-48" />
            <div className="skeleton mt-1 h-4 w-72" />
          </div>
          <div className="card space-y-4">
            <div className="skeleton h-4 w-20" />
            <div className="skeleton h-10 w-full max-w-md" />
            <div className="skeleton h-4 w-20" />
            <div className="skeleton h-10 w-full max-w-md" />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="page-header">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[rgb(var(--color-bg-secondary))] p-2 text-[rgb(var(--color-text-tertiary))]">
              <IconMembers size={22} />
            </div>
            <div>
              <h1 className="page-title">Invite Member</h1>
              <p className="page-description">
                Send an invitation to add a new team member
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
            {error}
          </div>
        )}

        {/* Invite form */}
        <div className="card">
          <div className="section-header">
            <h2 className="section-title">Invitation Details</h2>
          </div>
          <form onSubmit={handleInvite} className="space-y-5 pt-4">
            <div>
              <label
                htmlFor="invite-email"
                className="mb-1.5 block text-sm font-medium text-[rgb(var(--color-text-primary))]"
              >
                Email Address
              </label>
              <input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input w-full max-w-md"
                placeholder="colleague@company.com"
              />
            </div>
            <div>
              <label
                htmlFor="invite-role"
                className="mb-1.5 block text-sm font-medium text-[rgb(var(--color-text-primary))]"
              >
                Role
              </label>
              <select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="input w-full max-w-md"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {formatRole(r)}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-[rgb(var(--color-text-tertiary))]">
                Choose the level of access this member will have.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                className="rounded-lg bg-[rgb(var(--color-brand))] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[rgb(var(--color-brand-dark))]"
              >
                Send Invitation
              </button>
              <button
                type="button"
                onClick={() => router.push("/settings/members")}
                className="rounded-lg border border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-primary))] px-4 py-2 text-sm font-medium text-[rgb(var(--color-text-secondary))] transition-colors hover:bg-[rgb(var(--color-bg-secondary))]"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
