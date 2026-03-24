"use client";
import { useAuth } from "@/lib/auth-context";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

interface Article { slug: string; title: string; summary: string; content: string; category: string; }

export default function DocDetailPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  const [article, setArticle] = useState<Article | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (!isLoading && !user) router.push("/auth/sign-in"); }, [isLoading, user, router]);
  useEffect(() => { if (!token) return; apiFetch<Article>(`/api/v1/docs/${slug}`, { token }).then((r) => { if (r.ok) setArticle(r.data); else setError(r.error.message); setLoading(false); }); }, [token, slug]);
  if (isLoading || !user) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        <p className="text-gray-500"><Link href="/docs" className="text-blue-600 hover:underline">Docs</Link> / {article?.category ?? "..."}</p>
        {error && <div className="rounded bg-red-100 p-4 text-red-700">{error}</div>}
        {loading ? <div className="text-gray-500">Loading...</div> : !article ? <div>Not found</div> : (
          <div>
            <h1 className="text-2xl font-bold">{article.title}</h1>
            <p className="mb-4 text-gray-500">{article.summary}</p>
            <div className="prose max-w-none"><pre className="whitespace-pre-wrap text-sm leading-relaxed">{article.content}</pre></div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
