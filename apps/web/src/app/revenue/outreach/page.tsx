"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { IconConnectors, IconPlus } from "@/components/icons";

interface OutreachDraft {
  id: string;
  channel: string;
  subject: string | null;
  body: string;
  approvalStatus: string;
  linkedEntityType: string | null;
  createdAt: string;
}

function approvalBadgeClass(status: string): string {
  switch (status) {
    case "approved":
      return "badge-success";
    case "pending_approval":
      return "badge-warning";
    case "rejected":
      return "badge-error";
    case "draft":
      return "badge-neutral";
    default:
      return "badge-neutral";
  }
}

function channelBadgeClass(channel: string): string {
  switch (channel) {
    case "email":
      return "badge-info";
    case "linkedin":
      return "badge-neutral";
    default:
      return "badge-neutral";
  }
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="card">
        <div className="skeleton mb-3 h-5 w-32" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="skeleton h-10 w-full" />
          <div className="skeleton h-10 w-full" />
        </div>
        <div className="skeleton mt-3 h-16 w-full" />
        <div className="skeleton mt-3 h-10 w-32" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="card">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <div className="skeleton h-5 w-16 rounded-full" />
              <div className="skeleton h-5 w-24 rounded-full" />
            </div>
            <div className="skeleton h-4 w-32" />
          </div>
          <div className="skeleton mt-3 h-5 w-48" />
          <div className="skeleton mt-2 h-24 w-full" />
        </div>
      ))}
    </div>
  );
}

export default function OutreachPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const [drafts, setDrafts] = useState<OutreachDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [contactName, setContactName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [context, setContext] = useState("");
  const [channel, setChannel] = useState("email");

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!token) return;
    apiFetch<OutreachDraft[]>("/api/v1/revenue/outreach-drafts", {
      token,
    }).then((result) => {
      if (result.ok) {
        setDrafts(result.data);
      } else {
        setError(result.error.message);
      }
      setLoading(false);
    });
  }, [token]);

  if (isLoading || !user) return null;

  const canGenerate =
    role === "org_owner" || role === "org_admin" || role === "org_member";

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    const result = await apiFetch<OutreachDraft>(
      "/api/v1/revenue/outreach-drafts/generate",
      {
        method: "POST",
        token: token ?? undefined,
        body: JSON.stringify({
          channel,
          contactName: contactName || undefined,
          accountName: accountName || undefined,
          context: context || undefined,
        }),
      },
    );
    setGenerating(false);
    if (result.ok) {
      setDrafts([result.data, ...drafts]);
    } else {
      setError(result.error.message);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="page-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title">Outreach Drafts</h1>
            <p className="page-description">
              Generate and manage AI-powered outreach messages
            </p>
          </div>
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

        {/* Generate Draft Card */}
        {canGenerate && (
          <div className="card">
            <div className="section-header mb-5">
              <h2 className="section-title">Generate Draft</h2>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="contactName"
                    className="block text-sm font-medium text-[rgb(var(--color-text-primary))]"
                  >
                    Contact Name
                    <span className="ml-1 text-xs font-normal text-[rgb(var(--color-text-tertiary))]">
                      (optional)
                    </span>
                  </label>
                  <input
                    id="contactName"
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="input"
                    placeholder="Jane Doe"
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="accountName"
                    className="block text-sm font-medium text-[rgb(var(--color-text-primary))]"
                  >
                    Account Name
                    <span className="ml-1 text-xs font-normal text-[rgb(var(--color-text-tertiary))]">
                      (optional)
                    </span>
                  </label>
                  <input
                    id="accountName"
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    className="input"
                    placeholder="Acme Corp"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="context"
                  className="block text-sm font-medium text-[rgb(var(--color-text-primary))]"
                >
                  Context
                  <span className="ml-1 text-xs font-normal text-[rgb(var(--color-text-tertiary))]">
                    (optional)
                  </span>
                </label>
                <textarea
                  id="context"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  className="input min-h-[60px] resize-y"
                  rows={2}
                  placeholder="Additional context for AI generation..."
                />
              </div>
              <div className="flex flex-col gap-3 border-t border-[rgb(var(--color-border-primary))] pt-4 sm:flex-row sm:items-center">
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="input w-auto sm:w-36"
                >
                  <option value="email">Email</option>
                  <option value="linkedin">LinkedIn</option>
                </select>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="inline-flex items-center gap-2 rounded-lg bg-[rgb(var(--color-brand))] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-[rgb(var(--color-brand-dark))] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {generating ? (
                    <>
                      <svg
                        className="h-4 w-4 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Generating...
                    </>
                  ) : (
                    <>
                      <IconPlus size={16} />
                      Generate
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Drafts List */}
        {loading ? (
          <LoadingSkeleton />
        ) : drafts.length === 0 ? (
          <div className="empty-state">
            <IconConnectors size={48} className="empty-state-icon" />
            <p className="empty-state-title">No outreach drafts yet</p>
            <p className="empty-state-description">
              Use the form above to generate your first AI-powered outreach
              draft.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="section-header">
              <h2 className="section-title">Drafts</h2>
              <span className="text-sm text-[rgb(var(--color-text-tertiary))]">
                {drafts.length} draft{drafts.length !== 1 ? "s" : ""}
              </span>
            </div>
            {drafts.map((d) => (
              <div key={d.id} className="card-hover">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={channelBadgeClass(d.channel)}>
                      {d.channel}
                    </span>
                    <span
                      className={approvalBadgeClass(d.approvalStatus)}
                    >
                      {d.approvalStatus.replace("_", " ")}
                    </span>
                    {d.linkedEntityType && (
                      <span className="badge-neutral">
                        {d.linkedEntityType}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[rgb(var(--color-text-tertiary))]">
                    {new Date(d.createdAt).toLocaleString()}
                  </span>
                </div>
                {d.subject && (
                  <p className="mb-2 text-sm font-medium text-[rgb(var(--color-text-primary))]">
                    {d.subject}
                  </p>
                )}
                <pre className="whitespace-pre-wrap rounded-md bg-[rgb(var(--color-bg-secondary))] p-3 text-sm text-[rgb(var(--color-text-secondary))]">
                  {d.body}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
