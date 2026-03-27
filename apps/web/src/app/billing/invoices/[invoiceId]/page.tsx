"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import { IconBilling } from "@/components/icons";

interface LineItem {
  description: string;
  meter: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

interface Invoice {
  id: string;
  status: string;
  subtotalCents: number;
  overageCents: number;
  totalCents: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  lineItems: LineItem[];
  createdAt: string;
}

function invoiceStatusBadgeClass(status: string): string {
  switch (status) {
    case "paid":
      return "badge-success";
    case "open":
    case "pending":
      return "badge-warning";
    case "overdue":
    case "failed":
      return "badge-error";
    case "void":
      return "badge-neutral";
    default:
      return "badge-neutral";
  }
}

function invoiceStatusDotClass(status: string): string {
  switch (status) {
    case "paid":
      return "status-dot-success";
    case "open":
    case "pending":
      return "status-dot-warning";
    case "overdue":
    case "failed":
      return "status-dot-error";
    default:
      return "status-dot-neutral";
  }
}

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-4 w-48" />
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="skeleton h-7 w-32" />
          <div className="skeleton h-3 w-56" />
        </div>
        <div className="skeleton h-6 w-16 rounded-full" />
      </div>
      <div className="card p-6">
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex justify-between">
              <div className="skeleton h-4 w-40" />
              <div className="skeleton h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function InvoiceDetailPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.invoiceId as string;
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!token) return;
    apiFetch<Invoice>(`/api/v1/billing/invoices/${invoiceId}`, { token }).then(
      (r) => {
        if (r.ok) setInvoice(r.data);
        else setError(r.error.message);
        setLoading(false);
      },
    );
  }, [token, invoiceId]);

  if (isLoading || !user) return null;

  if (loading) {
    return (
      <AppShell>
        <LoadingSkeleton />
      </AppShell>
    );
  }

  if (!invoice) {
    return (
      <AppShell>
        <div className="empty-state">
          <IconBilling size={48} className="empty-state-icon" />
          <p className="empty-state-title">Invoice not found</p>
          <p className="empty-state-description">
            {error ?? "The requested invoice could not be loaded."}
          </p>
          <Link
            href="/billing/invoices"
            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-[rgb(var(--color-brand))] transition-colors hover:text-[rgb(var(--color-brand-dark))]"
          >
            Back to Invoices
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="breadcrumb">
          <Link
            href="/billing"
            className="text-[rgb(var(--color-text-tertiary))] transition-colors hover:text-[rgb(var(--color-text-primary))]"
          >
            Billing
          </Link>
          <span className="breadcrumb-separator">/</span>
          <Link
            href="/billing/invoices"
            className="text-[rgb(var(--color-text-tertiary))] transition-colors hover:text-[rgb(var(--color-text-primary))]"
          >
            Invoices
          </Link>
          <span className="breadcrumb-separator">/</span>
          <span className="text-[rgb(var(--color-text-primary))]">Detail</span>
        </nav>

        {/* Error Banner */}
        {error && (
          <div className="flex items-center gap-3 rounded-lg border border-[rgb(var(--color-error)/0.3)] bg-[rgb(var(--color-error-bg))] px-4 py-3 text-sm text-[rgb(var(--color-error))]">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {/* Invoice Header */}
        <div className="page-header flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="page-title">Invoice</h1>
            <p className="page-description">
              {new Date(invoice.periodStart).toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
              })}{" "}
              &mdash;{" "}
              {new Date(invoice.periodEnd).toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          <span className={invoiceStatusBadgeClass(invoice.status)}>
            <span className={invoiceStatusDotClass(invoice.status)} />
            {invoice.status}
          </span>
        </div>

        {/* Invoice Summary Card */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="stat-card">
            <span className="stat-label">Subtotal</span>
            <span className="stat-value">
              {formatCurrency(invoice.subtotalCents)}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Overage</span>
            <span
              className={`stat-value ${invoice.overageCents > 0 ? "text-[rgb(var(--color-warning))]" : ""}`}
            >
              {formatCurrency(invoice.overageCents)}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Total</span>
            <span className="stat-value">
              {formatCurrency(invoice.totalCents)}
            </span>
          </div>
        </div>

        {/* Line Items Table */}
        <div>
          <div className="section-header mb-4">
            <h2 className="section-title">Line Items</h2>
          </div>
          {invoice.lineItems.length === 0 ? (
            <div className="empty-state">
              <IconBilling size={40} className="empty-state-icon" />
              <p className="empty-state-title">No line items</p>
              <p className="empty-state-description">
                This invoice has no itemized charges.
              </p>
            </div>
          ) : (
            <div className="table-container">
              <table className="w-full">
                <thead>
                  <tr className="table-header">
                    <th className="px-4 py-3 text-left">Description</th>
                    <th className="hidden px-4 py-3 text-right sm:table-cell">
                      Qty
                    </th>
                    <th className="hidden px-4 py-3 text-right md:table-cell">
                      Unit Price
                    </th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lineItems.map((li, i) => (
                    <tr key={i} className="table-row">
                      <td className="px-4 py-3.5">
                        <p className="text-sm font-medium text-[rgb(var(--color-text-primary))]">
                          {li.description}
                        </p>
                        <p className="text-xs text-[rgb(var(--color-text-tertiary))] sm:hidden">
                          {li.quantity} x {formatCurrency(li.unitPriceCents)}
                        </p>
                      </td>
                      <td className="hidden px-4 py-3.5 text-right text-sm text-[rgb(var(--color-text-secondary))] sm:table-cell">
                        {li.quantity.toLocaleString()}
                      </td>
                      <td className="hidden px-4 py-3.5 text-right text-sm text-[rgb(var(--color-text-secondary))] md:table-cell">
                        {formatCurrency(li.unitPriceCents)}
                      </td>
                      <td className="px-4 py-3.5 text-right text-sm font-semibold text-[rgb(var(--color-text-primary))]">
                        {formatCurrency(li.totalCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Totals Summary */}
        <div className="card p-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[rgb(var(--color-text-secondary))]">
                Subtotal
              </span>
              <span className="text-[rgb(var(--color-text-primary))]">
                {formatCurrency(invoice.subtotalCents)}
              </span>
            </div>
            {invoice.overageCents > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-[rgb(var(--color-warning))]">
                  Overage
                </span>
                <span className="font-medium text-[rgb(var(--color-warning))]">
                  {formatCurrency(invoice.overageCents)}
                </span>
              </div>
            )}
            <div className="border-t border-[rgb(var(--color-border-primary))] pt-3">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-[rgb(var(--color-text-primary))]">
                  Total
                </span>
                <span className="text-base font-bold text-[rgb(var(--color-text-primary))]">
                  {formatCurrency(invoice.totalCents)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
