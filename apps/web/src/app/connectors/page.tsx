"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

interface Connector {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  trustTier: string;
  authMode: string;
  status: string;
  tools: Array<{ name: string; description: string }>;
  scopes: Array<{ id: string; name: string; description: string }>;
}

const CATEGORIES = ["all", "utility", "data", "communication", "productivity"] as const;

export default function ConnectorsPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
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
    const query = categoryFilter !== "all" ? `?category=${categoryFilter}` : "";
    apiFetch<Connector[]>(`/api/v1/connectors${query}`, { token }).then((result) => {
      if (result.ok) {
        setConnectors(result.data);
      } else {
        setError(result.error.message);
      }
      setLoading(false);
    });
  }, [token, categoryFilter]);

  if (isLoading || !user) return null;

  const trustBadge = (tier: string) => {
    const colors: Record<string, string> = {
      verified: "bg-green-100 text-green-700",
      internal: "bg-blue-100 text-blue-700",
      untrusted: "bg-yellow-100 text-yellow-700",
    };
    return (
      <span className={`rounded px-2 py-0.5 text-xs font-medium ${colors[tier] ?? "bg-gray-100 text-gray-700"}`}>
        {tier}
      </span>
    );
  };

  const authBadge = (mode: string) => {
    const colors: Record<string, string> = {
      none: "bg-gray-100 text-gray-600",
      api_key: "bg-purple-100 text-purple-700",
      oauth2: "bg-indigo-100 text-indigo-700",
    };
    return (
      <span className={`rounded px-2 py-0.5 text-xs font-medium ${colors[mode] ?? "bg-gray-100 text-gray-700"}`}>
        {mode === "none" ? "No Auth" : mode === "api_key" ? "API Key" : mode}
      </span>
    );
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Connectors</h1>
          <p className="text-gray-500">Browse and install connectors to extend your agents</p>
        </div>

        <div className="flex gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`rounded px-3 py-1 text-sm capitalize ${
                categoryFilter === c
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-gray-400">Loading connectors...</p>
        ) : connectors.length === 0 ? (
          <div className="rounded border border-gray-200 p-8 text-center text-gray-400">
            No connectors available.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {connectors.map((connector) => (
              <Link
                key={connector.id}
                href={`/connectors/${connector.id}`}
                className="block rounded border border-gray-200 p-4 hover:border-gray-300 hover:bg-gray-50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{connector.name}</p>
                    <p className="text-sm text-gray-500">{connector.slug}</p>
                    <p className="mt-1 text-sm text-gray-400 line-clamp-2">
                      {connector.description}
                    </p>
                    <p className="mt-2 text-xs text-gray-400">
                      {connector.tools.length} tool{connector.tools.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="ml-4 flex flex-col items-end gap-1">
                    {trustBadge(connector.trustTier)}
                    {authBadge(connector.authMode)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
