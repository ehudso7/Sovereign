"use client";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

interface Article { slug: string; title: string; summary: string; }
interface Category { slug: string; title: string; articles: Article[]; }

export default function DocsPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (!isLoading && !user) router.push("/auth/sign-in"); }, [isLoading, user, router]);
  useEffect(() => { if (!token) return; apiFetch<Category[]>("/api/v1/docs", { token }).then((r) => { if (r.ok) setCategories(r.data); else setError(r.error.message); setLoading(false); }); }, [token]);
  if (isLoading || !user) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold">Documentation</h1><p className="text-gray-500">Learn how to use SOVEREIGN</p></div>
        {error && <div className="rounded bg-red-100 p-4 text-red-700">{error}</div>}
        {loading ? <div className="text-gray-500">Loading...</div> : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {categories.map((cat) => (
              <div key={cat.slug} className="rounded border border-gray-200 p-4">
                <h2 className="mb-2 text-lg font-semibold">{cat.title}</h2>
                <div className="space-y-2">
                  {cat.articles.map((a) => (
                    <Link key={a.slug} href={`/docs/${a.slug}`} className="block rounded p-2 hover:bg-gray-50">
                      <div className="font-medium text-blue-600">{a.title}</div>
                      <div className="text-sm text-gray-500">{a.summary}</div>
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
