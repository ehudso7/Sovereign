"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import { IconRevenue, IconChevronRight } from "@/components/icons";

interface Account {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  status: string;
  notes: string | null;
  externalCrmId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Note {
  id: string;
  title: string | null;
  content: string;
  noteType: string;
  createdAt: string;
}

function noteTypeBadge(type: string): string {
  switch (type) {
    case "meeting":
      return "badge-info";
    case "call":
      return "badge-warning";
    case "email":
      return "badge-neutral";
    default:
      return "badge-neutral";
  }
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-4 w-48" />
      <div className="flex items-center justify-between">
        <div className="skeleton h-8 w-64" />
        <div className="skeleton h-6 w-20 rounded-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[1, 2].map((i) => (
          <div key={i} className="card">
            <div className="skeleton mb-2 h-3 w-16" />
            <div className="skeleton h-5 w-32" />
          </div>
        ))}
      </div>
      <div className="card">
        <div className="skeleton mb-3 h-5 w-20" />
        <div className="skeleton h-16 w-full" />
      </div>
    </div>
  );
}

export default function AccountDetailPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const accountId = params.accountId as string;
  const [account, setAccount] = useState<Account | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDomain, setEditDomain] = useState("");
  const [editIndustry, setEditIndustry] = useState("");
  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState("general");

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      apiFetch<Account>(`/api/v1/revenue/accounts/${accountId}`, { token }),
      apiFetch<Note[]>(
        `/api/v1/revenue/notes?linkedEntityType=account&linkedEntityId=${accountId}`,
        { token },
      ),
    ]).then(([accRes, notesRes]) => {
      if (accRes.ok) {
        setAccount(accRes.data);
        setEditName(accRes.data.name);
        setEditDomain(accRes.data.domain || "");
        setEditIndustry(accRes.data.industry || "");
      } else {
        setError(accRes.error.message);
      }
      if (notesRes.ok) {
        setNotes(notesRes.data);
      }
      setLoading(false);
    });
  }, [token, accountId]);

  if (isLoading || !user) return null;

  const canEdit =
    role === "org_owner" || role === "org_admin" || role === "org_member";

  const handleSave = async () => {
    const result = await apiFetch<Account>(
      `/api/v1/revenue/accounts/${accountId}`,
      {
        method: "PATCH",
        token: token ?? undefined,
        body: JSON.stringify({
          name: editName,
          domain: editDomain || undefined,
          industry: editIndustry || undefined,
        }),
      },
    );
    if (result.ok) {
      setAccount(result.data);
      setEditing(false);
    } else {
      setError(result.error.message);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    const result = await apiFetch<Note>("/api/v1/revenue/notes", {
      method: "POST",
      token: token ?? undefined,
      body: JSON.stringify({
        linkedEntityType: "account",
        linkedEntityId: accountId,
        content: newNote,
        noteType,
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
          <Link href="/revenue/accounts">Accounts</Link>
          <IconChevronRight size={12} className="breadcrumb-separator" />
          <span className="text-[rgb(var(--color-text-primary))]">
            {account?.name || "Detail"}
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
        ) : !account ? (
          <div className="empty-state">
            <IconRevenue size={48} className="empty-state-icon" />
            <p className="empty-state-title">Account not found</p>
            <p className="empty-state-description">
              This account may have been deleted or you may not have access.
            </p>
            <Link
              href="/revenue/accounts"
              className="mt-2 text-sm font-medium text-[rgb(var(--color-brand))] transition-colors hover:text-[rgb(var(--color-brand-dark))]"
            >
              Back to Accounts
            </Link>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h1 className="page-title">{account.name}</h1>
              <div className="flex items-center gap-2">
                {canEdit && !editing && (
                  <button
                    onClick={() => setEditing(true)}
                    className="rounded-lg border border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-primary))] px-4 py-2 text-sm font-medium text-[rgb(var(--color-text-secondary))] transition-colors hover:bg-[rgb(var(--color-bg-secondary))] hover:text-[rgb(var(--color-text-primary))]"
                  >
                    Edit
                  </button>
                )}
                <span
                  className={
                    account.status === "active"
                      ? "badge-success"
                      : "badge-neutral"
                  }
                >
                  <span
                    className={
                      account.status === "active"
                        ? "status-dot-success"
                        : "status-dot-neutral"
                    }
                  />
                  {account.status}
                </span>
                {account.externalCrmId && (
                  <span className="badge-info">Synced</span>
                )}
              </div>
            </div>

            {/* Edit Form */}
            {editing ? (
              <div className="card max-w-2xl">
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="edit-name"
                      className="block text-sm font-medium text-[rgb(var(--color-text-primary))]"
                    >
                      Name
                    </label>
                    <input
                      id="edit-name"
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="input"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="edit-domain"
                      className="block text-sm font-medium text-[rgb(var(--color-text-primary))]"
                    >
                      Domain
                    </label>
                    <input
                      id="edit-domain"
                      type="text"
                      value={editDomain}
                      onChange={(e) => setEditDomain(e.target.value)}
                      className="input"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="edit-industry"
                      className="block text-sm font-medium text-[rgb(var(--color-text-primary))]"
                    >
                      Industry
                    </label>
                    <input
                      id="edit-industry"
                      type="text"
                      value={editIndustry}
                      onChange={(e) => setEditIndustry(e.target.value)}
                      className="input"
                    />
                  </div>
                  <div className="flex items-center gap-3 border-t border-[rgb(var(--color-border-primary))] pt-5">
                    <button
                      onClick={handleSave}
                      className="rounded-lg bg-[rgb(var(--color-brand))] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-[rgb(var(--color-brand-dark))] hover:shadow-md"
                    >
                      Save Changes
                    </button>
                    <button
                      onClick={() => setEditing(false)}
                      className="rounded-lg border border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-primary))] px-5 py-2.5 text-sm font-medium text-[rgb(var(--color-text-secondary))] transition-colors hover:bg-[rgb(var(--color-bg-secondary))] hover:text-[rgb(var(--color-text-primary))]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="card">
                  <span className="stat-label">Domain</span>
                  <p className="mt-1 text-sm text-[rgb(var(--color-text-primary))]">
                    {account.domain || "\u2014"}
                  </p>
                </div>
                <div className="card">
                  <span className="stat-label">Industry</span>
                  <p className="mt-1 text-sm text-[rgb(var(--color-text-primary))]">
                    {account.industry || "\u2014"}
                  </p>
                </div>
              </div>
            )}

            {/* Account Notes (static) */}
            {account.notes && (
              <div className="card">
                <h3 className="mb-2 text-sm font-medium text-[rgb(var(--color-text-tertiary))]">
                  Account Notes
                </h3>
                <p className="text-sm text-[rgb(var(--color-text-primary))]">
                  {account.notes}
                </p>
              </div>
            )}

            {/* Notes Section */}
            <div className="space-y-4">
              <div className="section-header">
                <h2 className="section-title">Activity Notes</h2>
              </div>

              {canEdit && (
                <div className="card">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <select
                      value={noteType}
                      onChange={(e) => setNoteType(e.target.value)}
                      className="input w-auto sm:w-32"
                    >
                      <option value="general">General</option>
                      <option value="meeting">Meeting</option>
                      <option value="call">Call</option>
                      <option value="email">Email</option>
                    </select>
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
                    Add your first note to track interactions with this account.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notes.map((n) => (
                    <div key={n.id} className="card">
                      <div className="mb-2 flex items-center gap-2">
                        <span className={noteTypeBadge(n.noteType)}>
                          {n.noteType}
                        </span>
                        <span className="text-xs text-[rgb(var(--color-text-tertiary))]">
                          {new Date(n.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {n.title && (
                        <p className="mb-1 text-sm font-medium text-[rgb(var(--color-text-primary))]">
                          {n.title}
                        </p>
                      )}
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
