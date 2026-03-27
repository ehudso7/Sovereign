"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import {
  IconAdmin,
  IconMembers,
  IconPolicies,
  IconQuarantine,
  IconAudit,
  IconSupport,
  IconChevronRight,
  IconPlus,
} from "@/components/icons";
import Link from "next/link";

interface Overview {
  orgId: string;
  memberCount: number;
  agentCount: number;
  runCount: number;
  connectorCount: number;
  policyCount: number;
  billingPlan: string | null;
  billingStatus: string | null;
}

interface Member {
  userId: string;
  email: string;
  name: string;
  role: string;
}

interface Settings {
  plan: string;
  memberCount: number;
  projectCount: number;
  activePolicyCount: number;
  connectorInstallCount: number;
  billingEmail: string | null;
}

function formatRole(r: string): string {
  return r
    .replace("org_", "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function roleBadgeClass(r: string): string {
  switch (r) {
    case "org_owner":
      return "badge-error";
    case "org_admin":
      return "badge-info";
    default:
      return "badge-neutral";
  }
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card-hover flex flex-col">
      <span className="text-2xl font-bold text-[rgb(var(--color-text-primary))]">
        {value}
      </span>
      <span className="text-xs text-[rgb(var(--color-text-tertiary))]">
        {label}
      </span>
    </div>
  );
}

const QUICK_LINKS = [
  {
    href: "/policies",
    label: "Policies & Approvals",
    icon: IconPolicies,
    description: "Manage governance rules",
  },
  {
    href: "/quarantine",
    label: "Quarantine",
    icon: IconQuarantine,
    description: "Review flagged actions",
  },
  {
    href: "/audit",
    label: "Audit Log",
    icon: IconAudit,
    description: "View system activity",
  },
  {
    href: "/support",
    label: "Support Diagnostics",
    icon: IconSupport,
    description: "Platform health report",
  },
];

export default function AdminPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) router.push("/auth/sign-in");
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      apiFetch<Overview>("/api/v1/admin/overview", { token }),
      apiFetch<Member[]>("/api/v1/admin/memberships", { token }),
      apiFetch<Settings>("/api/v1/admin/settings-summary", { token }),
    ]).then(([oRes, mRes, sRes]) => {
      if (oRes.ok) setOverview(oRes.data);
      if (mRes.ok) setMembers(mRes.data);
      if (sRes.ok) setSettings(sRes.data);
      if (!oRes.ok) setError(oRes.error.message);
      setLoading(false);
    });
  }, [token]);

  if (isLoading || !user) return null;

  const forbidden = role === "org_member" || role === "org_billing_admin";
  if (forbidden) {
    return (
      <AppShell>
        <div className="empty-state">
          <IconAdmin size={40} />
          <h3 className="mt-3 text-sm font-medium text-[rgb(var(--color-text-primary))]">
            Access Restricted
          </h3>
          <p className="mt-1 text-sm text-[rgb(var(--color-text-tertiary))]">
            You don&apos;t have permission to view admin settings.
          </p>
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
              <IconAdmin size={22} />
            </div>
            <div>
              <h1 className="page-title">Admin</h1>
              <p className="page-description">
                System overview and management
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
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card space-y-2">
                  <div className="skeleton h-8 w-12" />
                  <div className="skeleton h-3 w-20" />
                </div>
              ))}
            </div>
            <div className="card space-y-3">
              <div className="skeleton h-5 w-32" />
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-3/4" />
            </div>
          </div>
        ) : (
          <>
            {/* Stats */}
            {overview && (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <StatCard label="Members" value={overview.memberCount} />
                <StatCard label="Agents" value={overview.agentCount} />
                <StatCard label="Runs" value={overview.runCount} />
                <StatCard label="Policies" value={overview.policyCount} />
              </div>
            )}

            {/* Settings summary */}
            {settings && (
              <div className="card">
                <div className="section-header">
                  <h2 className="section-title">Settings Summary</h2>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-3 text-sm md:grid-cols-3">
                  <div className="flex flex-col">
                    <span className="text-[rgb(var(--color-text-tertiary))]">
                      Plan
                    </span>
                    <span className="mt-0.5">
                      <span className="badge-info">{settings.plan}</span>
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[rgb(var(--color-text-tertiary))]">
                      Projects
                    </span>
                    <span className="mt-0.5 font-medium text-[rgb(var(--color-text-primary))]">
                      {settings.projectCount}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[rgb(var(--color-text-tertiary))]">
                      Active Policies
                    </span>
                    <span className="mt-0.5 font-medium text-[rgb(var(--color-text-primary))]">
                      {settings.activePolicyCount}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[rgb(var(--color-text-tertiary))]">
                      Connectors
                    </span>
                    <span className="mt-0.5 font-medium text-[rgb(var(--color-text-primary))]">
                      {settings.connectorInstallCount}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[rgb(var(--color-text-tertiary))]">
                      Billing Email
                    </span>
                    <span className="mt-0.5 font-medium text-[rgb(var(--color-text-primary))]">
                      {settings.billingEmail ?? "Not set"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Members */}
            <div className="card p-0">
              <div className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-2">
                  <IconMembers
                    size={18}
                    className="text-[rgb(var(--color-text-tertiary))]"
                  />
                  <h2 className="section-title">Members</h2>
                </div>
                <Link
                  href="/settings/invite"
                  className="flex items-center gap-1.5 text-sm font-medium text-[rgb(var(--color-brand))] transition-colors hover:text-[rgb(var(--color-brand-dark))]"
                >
                  <IconPlus size={14} />
                  Invite
                </Link>
              </div>
              {members.length === 0 ? (
                <div className="border-t border-[rgb(var(--color-border-primary))] px-6 py-8 text-center text-sm text-[rgb(var(--color-text-tertiary))]">
                  No members found
                </div>
              ) : (
                <div className="table-container border-0">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="table-header">
                        <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-[rgb(var(--color-text-tertiary))]">
                          Name
                        </th>
                        <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-[rgb(var(--color-text-tertiary))]">
                          Email
                        </th>
                        <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-[rgb(var(--color-text-tertiary))]">
                          Role
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) => (
                        <tr key={m.userId} className="table-row">
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgb(var(--color-brand)/0.1)] text-xs font-medium text-[rgb(var(--color-brand))]">
                                {(m.name || m.email).charAt(0).toUpperCase()}
                              </div>
                              <span className="font-medium text-[rgb(var(--color-text-primary))]">
                                {m.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-3 text-[rgb(var(--color-text-secondary))]">
                            {m.email}
                          </td>
                          <td className="px-6 py-3">
                            <span className={roleBadgeClass(m.role)}>
                              {formatRole(m.role)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Quick links */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {QUICK_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="card-hover group flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-[rgb(var(--color-bg-secondary))] p-2 text-[rgb(var(--color-text-tertiary))] transition-colors group-hover:bg-[rgb(var(--color-brand)/0.1)] group-hover:text-[rgb(var(--color-brand))]">
                      <link.icon size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-[rgb(var(--color-text-primary))]">
                        {link.label}
                      </div>
                      <div className="text-xs text-[rgb(var(--color-text-tertiary))]">
                        {link.description}
                      </div>
                    </div>
                  </div>
                  <IconChevronRight
                    size={16}
                    className="text-[rgb(var(--color-text-tertiary))] opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
