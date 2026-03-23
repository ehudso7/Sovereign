"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
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
  tools: Array<{ name: string; description: string; parameters: Record<string, unknown> }>;
  scopes: Array<{ id: string; name: string; description: string }>;
}

interface ConnectorInstall {
  id: string;
  connectorId: string;
  connectorSlug: string;
  enabled: boolean;
  config: Record<string, unknown>;
  grantedScopes: string[];
  createdAt: string;
}

export default function ConnectorDetailPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const connectorId = params.connectorId as string;

  const [connector, setConnector] = useState<Connector | null>(null);
  const [install, setInstall] = useState<ConnectorInstall | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  const loadConnector = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const result = await apiFetch<Connector>(`/api/v1/connectors/${connectorId}`, { token });
    if (result.ok) {
      setConnector(result.data);
    } else {
      setError(result.error.message);
      setLoading(false);
      return;
    }

    // Check if installed
    const installed = await apiFetch<ConnectorInstall[]>("/api/v1/connectors/installed", { token });
    if (installed.ok) {
      const found = installed.data.find((i) => i.connectorId === connectorId);
      setInstall(found ?? null);
    }

    setLoading(false);
  }, [token, connectorId]);

  useEffect(() => {
    loadConnector();
  }, [loadConnector]);

  const canManage = role === "org_owner" || role === "org_admin";

  const handleInstall = async () => {
    if (!token) return;
    setActionLoading(true);
    setError(null);
    const result = await apiFetch<ConnectorInstall>(`/api/v1/connectors/${connectorId}/install`, {
      token,
      method: "POST",
      body: JSON.stringify({}),
    });
    if (result.ok) {
      setInstall(result.data);
    } else {
      setError(result.error.message);
    }
    setActionLoading(false);
  };

  const handleConfigure = async () => {
    if (!token || !apiKey) return;
    setActionLoading(true);
    setError(null);
    const result = await apiFetch<ConnectorInstall>(`/api/v1/connectors/${connectorId}/configure`, {
      token,
      method: "PATCH",
      body: JSON.stringify({
        credentials: { type: "api_key", data: apiKey },
      }),
    });
    if (result.ok) {
      setInstall(result.data);
      setApiKey("");
    } else {
      setError(result.error.message);
    }
    setActionLoading(false);
  };

  const handleTest = async () => {
    if (!token) return;
    setActionLoading(true);
    setTestResult(null);
    setError(null);
    const result = await apiFetch<{ success: boolean; message: string }>(
      `/api/v1/connectors/${connectorId}/test`,
      { token, method: "POST", body: JSON.stringify({}) },
    );
    if (result.ok) {
      setTestResult(result.data);
    } else {
      setError(result.error.message);
    }
    setActionLoading(false);
  };

  const handleRevoke = async () => {
    if (!token) return;
    setActionLoading(true);
    setError(null);
    const result = await apiFetch<{ success: boolean }>(
      `/api/v1/connectors/${connectorId}/revoke`,
      { token, method: "POST", body: JSON.stringify({}) },
    );
    if (result.ok) {
      setInstall(null);
      setTestResult(null);
    } else {
      setError(result.error.message);
    }
    setActionLoading(false);
  };

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

  return (
    <AppShell>
      <div className="space-y-6">
        <Link href="/connectors" className="text-sm text-gray-500 hover:text-gray-700">
          &larr; Back to Connectors
        </Link>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-gray-400">Loading connector...</p>
        ) : !connector ? (
          <div className="rounded border border-gray-200 p-8 text-center text-gray-400">
            Connector not found.
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold">{connector.name}</h1>
                <p className="text-gray-500">{connector.slug}</p>
                <p className="mt-2 text-gray-600">{connector.description}</p>
                <div className="mt-2 flex gap-2">
                  {trustBadge(connector.trustTier)}
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {connector.category}
                  </span>
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {connector.authMode === "none" ? "No Auth" : connector.authMode === "api_key" ? "API Key" : connector.authMode}
                  </span>
                </div>
              </div>
              <div>
                {install ? (
                  <span className="rounded bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                    Installed
                  </span>
                ) : (
                  <span className="rounded bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600">
                    Not Installed
                  </span>
                )}
              </div>
            </div>

            {/* Tools */}
            <div>
              <h2 className="text-lg font-semibold">Tools</h2>
              <div className="mt-2 space-y-2">
                {connector.tools.map((tool) => (
                  <div key={tool.name} className="rounded border border-gray-200 p-3">
                    <p className="font-mono text-sm font-medium">{tool.name}</p>
                    <p className="text-sm text-gray-500">{tool.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Scopes */}
            {connector.scopes.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold">Scopes</h2>
                <div className="mt-2 space-y-1">
                  {connector.scopes.map((scope) => (
                    <div key={scope.id} className="flex items-center gap-2 text-sm">
                      <span className="font-mono text-gray-600">{scope.id}</span>
                      <span className="text-gray-400">-</span>
                      <span className="text-gray-500">{scope.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            {canManage && (
              <div className="space-y-4 border-t border-gray-200 pt-4">
                <h2 className="text-lg font-semibold">Actions</h2>

                {!install ? (
                  <button
                    onClick={handleInstall}
                    disabled={actionLoading}
                    className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-50"
                  >
                    {actionLoading ? "Installing..." : "Install Connector"}
                  </button>
                ) : (
                  <div className="space-y-4">
                    {/* Configure credentials for api_key connectors */}
                    {connector.authMode === "api_key" && (
                      <div className="rounded border border-gray-200 p-4">
                        <h3 className="text-sm font-medium">Configure API Key</h3>
                        <div className="mt-2 flex gap-2">
                          <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="Enter API key"
                            className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm"
                          />
                          <button
                            onClick={handleConfigure}
                            disabled={actionLoading || !apiKey}
                            className="rounded bg-gray-900 px-4 py-1.5 text-sm text-white hover:bg-gray-700 disabled:opacity-50"
                          >
                            {actionLoading ? "Saving..." : "Save"}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={handleTest}
                        disabled={actionLoading}
                        className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50"
                      >
                        {actionLoading ? "Testing..." : "Test Connector"}
                      </button>
                      <button
                        onClick={handleRevoke}
                        disabled={actionLoading}
                        className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-500 disabled:opacity-50"
                      >
                        {actionLoading ? "Revoking..." : "Revoke"}
                      </button>
                    </div>

                    {testResult && (
                      <div
                        className={`rounded border p-3 text-sm ${
                          testResult.success
                            ? "border-green-200 bg-green-50 text-green-700"
                            : "border-red-200 bg-red-50 text-red-700"
                        }`}
                      >
                        {testResult.message}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
