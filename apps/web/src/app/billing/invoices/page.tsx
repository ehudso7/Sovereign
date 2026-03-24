"use client";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

interface Invoice { id: string; status: string; totalCents: number; currency: string; periodStart: string; periodEnd: string; createdAt: string; }

export default function InvoicesPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (!isLoading && !user) router.push("/auth/sign-in"); }, [isLoading, user, router]);
  useEffect(() => { if (!token) return; apiFetch<Invoice[]>("/api/v1/billing/invoices", { token }).then((r) => { if (r.ok) setInvoices(r.data); else setError(r.error.message); setLoading(false); }); }, [token]);
  if (isLoading || !user) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold">Invoices</h1><p className="text-gray-500"><Link href="/billing" className="text-blue-600 hover:underline">Billing</Link> / Invoices</p></div>
        {error && <div className="rounded bg-red-100 p-4 text-red-700">{error}</div>}
        {loading ? <div className="text-gray-500">Loading...</div> : invoices.length === 0 ? <div className="text-gray-500">No invoices yet</div> : (
          <div className="overflow-hidden rounded border border-gray-200">
            <table className="w-full"><thead className="border-b border-gray-200 bg-gray-50"><tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Period</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Total</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Created</th>
            </tr></thead><tbody>
              {invoices.map((inv) => (<tr key={inv.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-6 py-4"><Link href={`/billing/invoices/${inv.id}`} className="text-blue-600 hover:underline">{new Date(inv.periodStart).toLocaleDateString()} — {new Date(inv.periodEnd).toLocaleDateString()}</Link></td>
                <td className="px-6 py-4 text-sm font-medium">${(inv.totalCents / 100).toFixed(2)}</td>
                <td className="px-6 py-4 text-sm"><span className={`rounded px-2 py-1 text-xs ${inv.status === "paid" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{inv.status}</span></td>
                <td className="px-6 py-4 text-sm text-gray-600">{new Date(inv.createdAt).toLocaleDateString()}</td>
              </tr>))}
            </tbody></table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
