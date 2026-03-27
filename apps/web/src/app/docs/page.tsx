"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { IconDocs, IconChevronRight } from "@/components/icons";
import Link from "next/link";

interface Article {
  slug: string;
  title: string;
  summary: string;
}

interface Category {
  slug: string;
  title: string;
  articles: Article[];
}

export default function DocsPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) router.push("/auth/sign-in");
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!token) return;
    apiFetch<Category[]>("/api/v1/docs", { token }).then((r) => {
      if (r.ok) setCategories(r.data);
      else setError(r.error.message);
      setLoading(false);
    });
  }, [token]);

  if (isLoading || !user) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="page-header">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[rgb(var(--color-bg-secondary))] p-2 text-[rgb(var(--color-text-tertiary))]">
              <IconDocs size={22} />
            </div>
            <div>
              <h1 className="page-title">Documentation</h1>
              <p className="page-description">
                Learn how to use SOVEREIGN
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

        {/* Loading */}
        {loading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card space-y-4">
                <div className="skeleton h-5 w-40" />
                <div className="space-y-3">
                  <div className="skeleton h-4 w-full" />
                  <div className="skeleton h-4 w-3/4" />
                  <div className="skeleton h-4 w-5/6" />
                </div>
              </div>
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="empty-state">
            <IconDocs size={40} />
            <h3 className="mt-3 text-sm font-medium text-[rgb(var(--color-text-primary))]">
              No documentation available
            </h3>
            <p className="mt-1 text-sm text-[rgb(var(--color-text-tertiary))]">
              Documentation articles will appear here once they are published.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {categories.map((cat) => (
              <div key={cat.slug} className="card">
                <div className="section-header">
                  <h2 className="section-title">{cat.title}</h2>
                  <span className="badge-neutral">
                    {cat.articles.length}{" "}
                    {cat.articles.length === 1 ? "article" : "articles"}
                  </span>
                </div>
                <div className="mt-3 space-y-1">
                  {cat.articles.map((article) => (
                    <Link
                      key={article.slug}
                      href={`/docs/${article.slug}`}
                      className="group flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-[rgb(var(--color-bg-secondary))]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-[rgb(var(--color-brand))] group-hover:text-[rgb(var(--color-brand-dark))]">
                          {article.title}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-[rgb(var(--color-text-tertiary))]">
                          {article.summary}
                        </div>
                      </div>
                      <IconChevronRight
                        size={14}
                        className="ml-2 shrink-0 text-[rgb(var(--color-text-tertiary))] opacity-0 transition-opacity group-hover:opacity-100"
                      />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
