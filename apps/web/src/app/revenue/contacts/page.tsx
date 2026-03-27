"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import {
  IconMembers,
  IconPlus,
  IconSearch,
  IconChevronRight,
} from "@/components/icons";

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  title: string | null;
  status: string;
}

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const;

function statusBadgeClass(status: string): string {
  switch (status) {
    case "active":
      return "badge-success";
    case "inactive":
      return "badge-neutral";
    default:
      return "badge-neutral";
  }
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="stat-card">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton mt-2 h-7 w-12" />
          </div>
        ))}
      </div>
      <div className="table-container">
        <div className="table-header px-4 py-3">
          <div className="skeleton h-3 w-32" />
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="table-row px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="skeleton h-4 w-40" />
                <div className="skeleton h-3 w-56" />
              </div>
              <div className="skeleton h-5 w-16 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ContactsPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    apiFetch<Contact[]>("/api/v1/revenue/contacts", { token }).then(
      (result) => {
        if (result.ok) {
          setContacts(result.data);
        } else {
          setError(result.error.message);
        }
        setLoading(false);
      },
    );
  }, [token]);

  const filteredContacts = useMemo(() => {
    let result = contacts;
    if (statusFilter) {
      result = result.filter((c) => c.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.title?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [contacts, statusFilter, searchQuery]);

  if (isLoading || !user) return null;

  const canCreate =
    role === "org_owner" || role === "org_admin" || role === "org_member";

  const counts = {
    total: contacts.length,
    active: contacts.filter((c) => c.status === "active").length,
    inactive: contacts.filter((c) => c.status !== "active").length,
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="page-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title">Contacts</h1>
            <p className="page-description">
              Manage people associated with your accounts and deals
            </p>
          </div>
          {canCreate && (
            <Link
              href="/revenue/contacts/new"
              className="inline-flex items-center gap-2 rounded-lg bg-[rgb(var(--color-brand))] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-[rgb(var(--color-brand-dark))] hover:shadow-md"
            >
              <IconPlus size={16} />
              New Contact
            </Link>
          )}
        </div>

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
        ) : (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="stat-card">
                <span className="stat-label">Total Contacts</span>
                <span className="stat-value">{counts.total}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Active</span>
                <div className="flex items-center gap-2">
                  <span className="stat-value">{counts.active}</span>
                  <span className="status-dot-success-pulse" />
                </div>
              </div>
              <div className="stat-card">
                <span className="stat-label">Inactive</span>
                <span className="stat-value">{counts.inactive}</span>
              </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative max-w-sm flex-1">
                <IconSearch
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-tertiary))]"
                />
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input pl-9"
                />
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-primary))] p-1">
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setStatusFilter(f.value)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      statusFilter === f.value
                        ? "bg-[rgb(var(--color-brand))] text-white shadow-sm"
                        : "text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-bg-tertiary))] hover:text-[rgb(var(--color-text-primary))]"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Table or Empty State */}
            {filteredContacts.length === 0 ? (
              <div className="empty-state">
                <IconMembers size={48} className="empty-state-icon" />
                <p className="empty-state-title">
                  {searchQuery || statusFilter
                    ? "No contacts match your search"
                    : "No contacts yet"}
                </p>
                <p className="empty-state-description">
                  {searchQuery || statusFilter
                    ? "Try adjusting your search query or filters."
                    : "Create your first contact to start building relationships."}
                </p>
                {!searchQuery && !statusFilter && canCreate && (
                  <Link
                    href="/revenue/contacts/new"
                    className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[rgb(var(--color-brand))] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[rgb(var(--color-brand-dark))]"
                  >
                    <IconPlus size={16} />
                    New Contact
                  </Link>
                )}
              </div>
            ) : (
              <div className="table-container">
                <table className="w-full">
                  <thead>
                    <tr className="table-header">
                      <th className="px-4 py-3 text-left">Name</th>
                      <th className="hidden px-4 py-3 text-left md:table-cell">
                        Email
                      </th>
                      <th className="hidden px-4 py-3 text-left sm:table-cell">
                        Title
                      </th>
                      <th className="hidden px-4 py-3 text-left sm:table-cell">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContacts.map((contact) => (
                      <tr
                        key={contact.id}
                        className="table-row cursor-pointer"
                        onClick={() =>
                          router.push(`/revenue/contacts/${contact.id}`)
                        }
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--color-bg-tertiary))]">
                              <span className="text-xs font-medium text-[rgb(var(--color-text-secondary))]">
                                {contact.firstName.charAt(0)}
                                {contact.lastName.charAt(0)}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-[rgb(var(--color-text-primary))]">
                                {contact.firstName} {contact.lastName}
                              </p>
                              {contact.email && (
                                <p className="truncate text-xs text-[rgb(var(--color-text-tertiary))] md:hidden">
                                  {contact.email}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3.5 text-sm text-[rgb(var(--color-text-secondary))] md:table-cell">
                          {contact.email || "\u2014"}
                        </td>
                        <td className="hidden px-4 py-3.5 text-sm text-[rgb(var(--color-text-secondary))] sm:table-cell">
                          {contact.title || "\u2014"}
                        </td>
                        <td className="hidden px-4 py-3.5 sm:table-cell">
                          <span className={statusBadgeClass(contact.status)}>
                            <span
                              className={
                                contact.status === "active"
                                  ? "status-dot-success"
                                  : "status-dot-neutral"
                              }
                            />
                            {contact.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <IconChevronRight
                            size={16}
                            className="inline-block text-[rgb(var(--color-text-tertiary))]"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
