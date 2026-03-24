"use client";
import { useAuth } from "@/lib/auth-context";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

interface LineItem { description: string; meter: string; quantity: number; unitPriceCents: number; totalCents: number; }
interface Invoice { id: string; status: string; subtotalCents: number; overageCents: number; totalCents: number; currency: string; periodStart: string; periodEnd: string; lineItems: LineItem[]; createdAt: string; }

export default function InvoiceDetailPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.invoiceId as string;
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (!isLoading && !user) router.push("/auth/sign-in"); }, [isLoading, user, router]);
  useEffect(() => { if (!token) return; apiFetch<Invoice>(`/api/v1/billing/invoices/${invoiceId}`, { token }).then((r) => { if (r.ok) setInvoice(r.data); else setError(r.error.message); setLoading(false); }); }, [token, invoiceId]);
  if (isLoading || !user) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        <p className="text-gray-500"><Link href="/billing/invoices" className="text-blue-600 hover:underline">Invoices</Link> / Detail</p>
        {error && <div className="rounded bg-red-100 p-4 text-red-700">{error}</div>}
        {loading ? <div className="text-gray-500">Loading...</div> : !invoice ? <div>Not found</div> : (
          <>
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Invoice</h1>
              <span className={`rounded px-2 py-1 text-xs ${invoice.status === "paid" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{invoice.status}</span>
            </div>
            <div className="text-sm text-gray-500">
              Period: {new Date(invoice.periodStart).toLocaleDateString()} — {new Date(invoice.periodEnd).toLocaleDateString()}
            </div>
            <div className="rounded border border-gray-200 p-4">
              <table className="w-full">
                <thead><tr>
                  <th className="pb-2 text-left text-sm font-medium text-gray-700">Description</th>
                  <th className="pb-2 text-right text-sm font-medium text-gray-700">Qty</th>
                  <th className="pb-2 text-right text-sm font-medium text-gray-700">Unit Price</th>
                  <th className="pb-2 text-right text-sm font-medium text-gray-700">Total</th>
                </tr></thead>
                <tbody>
                  {invoice.lineItems.map((li, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="py-2 text-sm">{li.description}</td>
                      <td className="py-2 text-right text-sm">{li.quantity}</td>
                      <td className="py-2 text-right text-sm">${(li.unitPriceCents / 100).toFixed(2)}</td>
                      <td className="py-2 text-right text-sm font-medium">${(li.totalCents / 100).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 border-t border-gray-200 pt-2 space-y-1">
                <div className="flex justify-between text-sm"><span>Subtotal</span><span>${(invoice.subtotalCents / 100).toFixed(2)}</span></div>
                {invoice.overageCents > 0 && <div className="flex justify-between text-sm text-orange-700"><span>Overage</span><span>${(invoice.overageCents / 100).toFixed(2)}</span></div>}
                <div className="flex justify-between font-bold"><span>Total</span><span>${(invoice.totalCents / 100).toFixed(2)}</span></div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
