"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { IconMembers, IconPlus } from "@/components/icons";
import Link from "next/link";

interface MemberWithUser {
  id: string;
  userId: string;
  role: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

const ROLES = ["org_owner", "org_admin", "org_member", "org_billing_admin", "org_security_admin"];

function roleBadgeClass(r: string): string {
  switch (r) {
    case "org_owner":
      return "badge-error";
    case "org_admin":
      return "badge-info";
    case "org_security_admin":
      return "badge-neutral";
    case "org_billing_admin":
      return "badge-neutral";
    default:
      return "badge-success";
  }
}

function formatRole(r: string): string {
  return r
    .replace("org_", "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function MembersPage() {
  const { user, org, token, role, isLoading } = useAuth();
  const router = useRouter();
  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const canManage = role === "org_owner" || role === "org_admin";

  useEffect(() => {
    if (!isLoading && !user) router.push("/auth/sign-in");
  }, [isLoading, user, router]);

  const loadMembers = useCallback(async () => {
    if (!org || !token) return;
    setLoading(true);
    const result = await apiFetch<MemberWithUser[]>(
      `/api/v1/orgs/${org.id}/members`,
      { token },
    );
    if (result.ok) setMembers(result.data);
    setLoading(false);
  }, [org, token]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!org || !token) return;
    setError("");

    const result = await apiFetch(`/api/v1/orgs/${org.id}/members/${userId}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ role: newRole }),
    });

    if (result.ok) {
      loadMembers();
    } else {
      setError(result.error.message);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!org || !token) return;
    setError("");

    const result = await apiFetch(`/api/v1/orgs/${org.id}/members/${userId}`, {
      method: "DELETE",
      token,
    });

    if (result.ok) {
      loadMembers();
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
            <div className="skeleton mt-1 h-4 w-80" />
          </div>
          <div className="card p-0">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b border-[rgb(var(--color-border-primary))] px-6 py-4 last:border-0">
                <div className="skeleton h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-32" />
                  <div className="skeleton h-3 w-48" />
                </div>
                <div className="skeleton h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="page-header flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[rgb(var(--color-bg-secondary))] p-2 text-[rgb(var(--color-text-tertiary))]">
              <IconMembers size={22} />
            </div>
            <div>
              <h1 className="page-title">Members</h1>
              <p className="page-description">
                Manage who has access to your organization
              </p>
            </div>
          </div>
          {canManage && (
            <Link
              href="/settings/invite"
              className="flex items-center gap-2 rounded-lg bg-[rgb(var(--color-brand))] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[rgb(var(--color-brand-dark))]"
            >
              <IconPlus size={16} />
              Invite Member
            </Link>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-[rgb(var(--color-error)/0.3)] bg-[rgb(var(--color-error)/0.08)] px-4 py-3 text-sm text-[rgb(var(--color-error))]">
            {error}
          </div>
        )}

        {/* Members table */}
        {loading ? (
          <div className="card p-0">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b border-[rgb(var(--color-border-primary))] px-6 py-4 last:border-0">
                <div className="skeleton h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-32" />
                  <div className="skeleton h-3 w-48" />
                </div>
                <div className="skeleton h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="empty-state">
            <IconMembers size={40} />
            <h3 className="mt-3 text-sm font-medium text-[rgb(var(--color-text-primary))]">
              No members found
            </h3>
            <p className="mt-1 text-sm text-[rgb(var(--color-text-tertiary))]">
              Invite team members to get started.
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-[rgb(var(--color-text-tertiary))]">
                    Member
                  </th>
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-[rgb(var(--color-text-tertiary))]">
                    Email
                  </th>
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-[rgb(var(--color-text-tertiary))]">
                    Role
                  </th>
                  {canManage && (
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-[rgb(var(--color-text-tertiary))]">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} className="table-row">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgb(var(--color-brand)/0.1)] text-sm font-medium text-[rgb(var(--color-brand))]">
                          {(member.user.name || member.user.email)
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                        <span className="font-medium text-[rgb(var(--color-text-primary))]">
                          {member.user.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[rgb(var(--color-text-secondary))]">
                      {member.user.email}
                    </td>
                    <td className="px-6 py-4">
                      {canManage && member.userId !== user?.id ? (
                        <select
                          value={member.role}
                          onChange={(e) =>
                            handleRoleChange(member.userId, e.target.value)
                          }
                          className="input py-1 text-sm"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {formatRole(r)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={roleBadgeClass(member.role)}>
                          {formatRole(member.role)}
                        </span>
                      )}
                    </td>
                    {canManage && (
                      <td className="px-6 py-4 text-right">
                        {member.userId !== user?.id && (
                          <button
                            onClick={() => handleRemove(member.userId)}
                            className="text-sm text-[rgb(var(--color-error))] transition-colors hover:text-[rgb(var(--color-error)/0.7)]"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
