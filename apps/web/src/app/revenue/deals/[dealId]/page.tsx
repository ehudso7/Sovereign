"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import { IconRevenue, IconChevronRight } from "@/components/icons";

interface Deal {
  id: string;
  name: string;
  stage: string;
  valueCents: number | null;
  currency: string;
  closeDate: string | null;
  probability: number | null;
  notes: string | null;
  externalCrmId: string | null;
}

interface Note {
  id: string;
  content: string;
  noteType: string;
  createdAt: string;
}

function stageBadgeClass(stage: string): string {
  switch (stage) {
    case "closed_won":
      return "badge-success";
    case "closed_lost":
      return "badge-error";
    case "negotiation":
      return "badge-warning";
    case "proposal":
      return "badge-info";
    default:
      return "badge-neutral";
  }
}

function formatCurrency(cents: number | null): string {
  if (cents === null || cents === undefined) return "\u2014";
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-4 w-48" />
      <div className="flex items-center justify-between">
        <div className="skeleton h-8 w-64" />
        <div className="skeleton h-6 w-24 rounded-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card">
            <div className="skeleton mb-2 h-3 w-16" />
            <div className="skeleton h-7 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DealDetailPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const dealId = params.dealId as string;
  const [deal, setDeal] = useState<Deal | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      apiFetch<Deal>(`/api/v1/revenue/deals/${dealId}`, { token }),
      apiFetch<Note[]>(
        `/api/v1/revenue/notes?linkedEntityType=deal&linkedEntityId=${dealId}`,
        { token },
      ),
    ]).then(([dRes, nRes]) => {
      if (dRes.ok) {
        setDeal(dRes.data);
      } else {
        setError(dRes.error.message);
      }
      if (nRes.ok) {
        setNotes(nRes.data);
      }
      setLoading(false);
    });
  }, [token, dealId]);

  if (isLoading || !user) return null;

  const canEdit =
    role === "org_owner" || role === "org_admin" || role === "org_member";

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    const result = await apiFetch<Note>("/api/v1/revenue/notes", {
      method: "POST",
      token: token ?? undefined,
      body: JSON.stringify({
        linkedEntityType: "deal",
        linkedEntityId: dealId,
        content: newNote,
      }),
    });
    if (result.ok) {
      setNotes([result.data, ...notes]);
      setNewNote("");
    } else {
      setError(result.error.message);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="breadcrumb">
          <Link href="/revenue">Revenue</Link>
          <IconChevronRight size={12} className="breadcrumb-separator" />
          <Link href="/revenue/deals">Deals</Link>
          <IconChevronRight size={12} className="breadcrumb-separator" />
          <span className="text-[rgb(var(--color-text-primary))]">
            {deal?.name || "Detail"}
          </span>
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

        {loading ? (
          <LoadingSkeleton />
        ) : !deal ? (
          <div className="empty-state">
            <IconRevenue size={48} className="empty-state-icon" />
            <p className="empty-state-title">Deal not found</p>
            <p className="empty-state-description">
              This deal may have been deleted or you may not have access.
            </p>
            <Link
              href="/revenue/deals"
              className="mt-2 text-sm font-medium text-[rgb(var(--color-brand))] transition-colors hover:text-[rgb(var(--color-brand-dark))]"
            >
              Back to Deals
            </Link>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h1 className="page-title">{deal.name}</h1>
              <div className="flex items-center gap-2">
                <span className={stageBadgeClass(deal.stage)}>
                  {deal.stage.replace("_", " ")}
                </span>
                {deal.externalCrmId && (
                  <span className="badge-info">Synced</span>
                )}
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="stat-card">
                <span className="stat-label">Value</span>
                <span className="stat-value">
                  {formatCurrency(deal.valueCents)}
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Probability</span>
                <span className="stat-value">
                  {deal.probability !== null
                    ? `${deal.probability}%`
                    : "\u2014"}
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Close Date</span>
                <span className="stat-value text-lg">
                  {deal.closeDate
                    ? new Date(deal.closeDate).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "\u2014"}
                </span>
              </div>
            </div>

            {/* Deal Notes (static) */}
            {deal.notes && (
              <div className="card">
                <h3 className="mb-2 text-sm font-medium text-[rgb(var(--color-text-tertiary))]">
                  Deal Notes
                </h3>
                <p className="text-sm text-[rgb(var(--color-text-primary))]">
                  {deal.notes}
                </p>
              </div>
            )}

            {/* Activity Notes */}
            <div className="space-y-4">
              <div className="section-header">
                <h2 className="section-title">Activity Notes</h2>
              </div>

              {canEdit && (
                <div className="card">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      type="text"
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Add a note..."
                      className="input flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddNote();
                      }}
                    />
                    <button
                      onClick={handleAddNote}
                      className="rounded-lg bg-[rgb(var(--color-brand))] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[rgb(var(--color-brand-dark))]"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {notes.length === 0 ? (
                <div className="empty-state">
                  <p className="empty-state-title">No notes yet</p>
                  <p className="empty-state-description">
                    Add your first note to track progress on this deal.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notes.map((n) => (
                    <div key={n.id} className="card">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-xs text-[rgb(var(--color-text-tertiary))]">
                          {new Date(n.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-[rgb(var(--color-text-secondary))]">
                        {n.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
