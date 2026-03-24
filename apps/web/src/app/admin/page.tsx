"use client";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

interface Overview { orgId: string; memberCount: number; agentCount: number; runCount: number; connectorCount: number; policyCount: number; billingPlan: string | null; billingStatus: string | null; }
interface Member { userId: string; email: string; name: string; role: string; }
interface Settings { plan: string; memberCount: number; projectCount: number; activePolicyCount: number; connectorInstallCount: number; billingEmail: string | null; }

export default function AdminPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (!isLoading && !user) router.push("/auth/sign-in"); }, [isLoading, user, router]);
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
  if (forbidden) return <AppShell><div className="rounded bg-yellow-100 p-4 text-yellow-800">You don&apos;t have permission to view admin settings.</div></AppShell>;

  return (
    <AppShell>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Admin</h1>
        {error && <div className="rounded bg-red-100 p-4 text-red-700">{error}</div>}
        {loading ? <div className="text-gray-500">Loading...</div> : (
          <>
            {overview && (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded border p-3"><div className="text-2xl font-bold">{overview.memberCount}</div><div className="text-xs text-gray-500">Members</div></div>
                <div className="rounded border p-3"><div className="text-2xl font-bold">{overview.agentCount}</div><div className="text-xs text-gray-500">Agents</div></div>
                <div className="rounded border p-3"><div className="text-2xl font-bold">{overview.runCount}</div><div className="text-xs text-gray-500">Runs</div></div>
                <div className="rounded border p-3"><div className="text-2xl font-bold">{overview.policyCount}</div><div className="text-xs text-gray-500">Policies</div></div>
              </div>
            )}

            {settings && (
              <div className="rounded border p-4">
                <h2 className="mb-2 text-lg font-semibold">Settings Summary</h2>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Plan: <span className="font-medium">{settings.plan}</span></div>
                  <div>Projects: <span className="font-medium">{settings.projectCount}</span></div>
                  <div>Active Policies: <span className="font-medium">{settings.activePolicyCount}</span></div>
                  <div>Connectors: <span className="font-medium">{settings.connectorInstallCount}</span></div>
                  <div>Billing Email: <span className="font-medium">{settings.billingEmail ?? "Not set"}</span></div>
                </div>
              </div>
            )}

            <div className="rounded border p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold">Members</h2>
                <Link href="/settings/invite" className="text-sm text-blue-600 hover:underline">Invite</Link>
              </div>
              {members.length === 0 ? <div className="text-sm text-gray-500">No members</div> : (
                <table className="w-full text-sm">
                  <thead><tr className="border-b"><th className="py-1 text-left">Name</th><th className="py-1 text-left">Email</th><th className="py-1 text-left">Role</th></tr></thead>
                  <tbody>{members.map(m => (<tr key={m.userId} className="border-b"><td className="py-1">{m.name}</td><td className="py-1 text-gray-500">{m.email}</td><td className="py-1"><span className="rounded bg-gray-100 px-2 py-0.5 text-xs">{m.role}</span></td></tr>))}</tbody>
                </table>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <Link href="/policies" className="rounded border p-3 hover:bg-gray-50">Policies and Approvals</Link>
              <Link href="/quarantine" className="rounded border p-3 hover:bg-gray-50">Quarantine</Link>
              <Link href="/audit" className="rounded border p-3 hover:bg-gray-50">Audit Log</Link>
              <Link href="/support" className="rounded border p-3 hover:bg-gray-50">Support Diagnostics</Link>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
