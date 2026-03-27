"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import { IconMembers, IconChevronRight } from "@/components/icons";

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  title: string | null;
  phone: string | null;
  status: string;
  externalCrmId: string | null;
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
        <div className="skeleton h-8 w-56" />
        <div className="skeleton h-6 w-20 rounded-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card">
            <div className="skeleton mb-2 h-3 w-16" />
            <div className="skeleton h-5 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ContactDetailPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const contactId = params.contactId as string;
  const [contact, setContact] = useState<Contact | null>(null);
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
      apiFetch<Contact>(`/api/v1/revenue/contacts/${contactId}`, { token }),
      apiFetch<Note[]>(
        `/api/v1/revenue/notes?linkedEntityType=contact&linkedEntityId=${contactId}`,
        { token },
      ),
    ]).then(([cRes, nRes]) => {
      if (cRes.ok) {
        setContact(cRes.data);
      } else {
        setError(cRes.error.message);
      }
      if (nRes.ok) {
        setNotes(nRes.data);
      }
      setLoading(false);
    });
  }, [token, contactId]);

  if (isLoading || !user) return null;

  const canEdit =
    role === "org_owner" || role === "org_admin" || role === "org_member";

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    const result = await apiFetch<Note>("/api/v1/revenue/notes", {
      method: "POST",
      token: token ?? undefined,
      body: JSON.stringify({
        linkedEntityType: "contact",
        linkedEntityId: contactId,
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
          <Link href="/revenue/contacts">Contacts</Link>
          <IconChevronRight size={12} className="breadcrumb-separator" />
          <span className="text-[rgb(var(--color-text-primary))]">
            {contact
              ? `${contact.firstName} ${contact.lastName}`
              : "Detail"}
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
        ) : !contact ? (
          <div className="empty-state">
            <IconMembers size={48} className="empty-state-icon" />
            <p className="empty-state-title">Contact not found</p>
            <p className="empty-state-description">
              This contact may have been deleted or you may not have access.
            </p>
            <Link
              href="/revenue/contacts"
              className="mt-2 text-sm font-medium text-[rgb(var(--color-brand))] transition-colors hover:text-[rgb(var(--color-brand-dark))]"
            >
              Back to Contacts
            </Link>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--color-bg-tertiary))]">
                  <span className="text-base font-semibold text-[rgb(var(--color-text-secondary))]">
                    {contact.firstName.charAt(0)}
                    {contact.lastName.charAt(0)}
                  </span>
                </div>
                <h1 className="page-title">
                  {contact.firstName} {contact.lastName}
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={
                    contact.status === "active"
                      ? "badge-success"
                      : "badge-neutral"
                  }
                >
                  <span
                    className={
                      contact.status === "active"
                        ? "status-dot-success"
                        : "status-dot-neutral"
                    }
                  />
                  {contact.status}
                </span>
                {contact.externalCrmId && (
                  <span className="badge-info">Synced</span>
                )}
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="card">
                <span className="stat-label">Email</span>
                <p className="mt-1 text-sm text-[rgb(var(--color-text-primary))]">
                  {contact.email || "\u2014"}
                </p>
              </div>
              <div className="card">
                <span className="stat-label">Title</span>
                <p className="mt-1 text-sm text-[rgb(var(--color-text-primary))]">
                  {contact.title || "\u2014"}
                </p>
              </div>
              <div className="card">
                <span className="stat-label">Phone</span>
                <p className="mt-1 text-sm text-[rgb(var(--color-text-primary))]">
                  {contact.phone || "\u2014"}
                </p>
              </div>
            </div>

            {/* Notes Section */}
            <div className="space-y-4">
              <div className="section-header">
                <h2 className="section-title">Notes</h2>
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
                    Add your first note to track interactions with this contact.
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
