"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

interface Alert {
  id: string;
  title: string;
  severity: string;
  conditionType: string;
  status: string;
  createdAt: string;
}

const STATUS_FILTERS = ["all", "open", "acknowledged", "resolved"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const severityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  warning: "bg-yellow-100 text-yellow-700",
  info: "bg-blue-100 text-blue-700",
};

const alertStatusColors: Record<string, string> = {
  open: "bg-red-100 text-red-700",
  acknowledged: "bg-yellow-100 text-yellow-700",
  resolved: "bg-green-100 text-green-700",
};

function AlertsListContent() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [ackLoading, setAckLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>(
    (searchParams.get("status") as StatusFilter) || "all",
  );

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  const loadAlerts = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const query = filter !== "all" ? `?status=${filter}` : "";
    const result = await apiFetch<Alert[]>(`/api/v1/mission-control/alerts${query}`, { token });

    if (result.ok) {
      setAlerts(result.data);
    } else {
      setError(result.error.message);
    }
    setLoading(false);
  }, [token, filter]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleAcknowledge = async (alertId: string) => {
    if (!token) return;
    setAckLoading(alertId);
    setError(null);

    const result = await apiFetch<Alert>(
      `/api/v1/mission-control/alerts/${alertId}/acknowledge`,
      { method: "POST", token, body: JSON.stringify({}) },
    );

    if (result.ok) {
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, status: "acknowledged" } : a)),
      );
    } else {
      setError(result.error.message);
    }
    setAckLoading(null);
  };

  if (isLoading || !user) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Link href="/mission-control" className="text-sm text-gray-500 hover:text-gray-700">
            &larr; Back to Mission Control
          </Link>
        </div>

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Alerts</h1>
        </div>

        {/* Status filter */}
        <div className="flex gap-2">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded px-3 py-1 text-sm capitalize ${
                filter === s
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-gray-400">Loading alerts...</p>
        ) : alerts.length === 0 ? (
          <div className="rounded border border-gray-200 p-6 text-center text-gray-400">
            {filter === "all"
              ? "No alerts."
              : `No alerts with status "${filter}".`}
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="rounded border border-gray-200 p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{alert.title}</p>
                    <p className="text-xs text-gray-400">
                      {alert.conditionType} &middot; {new Date(alert.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${severityColors[alert.severity] ?? "bg-gray-100 text-gray-700"}`}
                    >
                      {alert.severity}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${alertStatusColors[alert.status] ?? "bg-gray-100 text-gray-700"}`}
                    >
                      {alert.status}
                    </span>
                    {alert.status === "open" && (
                      <button
                        onClick={() => handleAcknowledge(alert.id)}
                        disabled={ackLoading === alert.id}
                        className="rounded bg-yellow-100 px-3 py-1 text-sm text-yellow-700 hover:bg-yellow-200 disabled:opacity-50"
                      >
                        {ackLoading === alert.id ? "..." : "Acknowledge"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function AlertsPage() {
  return (
    <Suspense fallback={<p className="text-gray-400">Loading alerts...</p>}>
      <AlertsListContent />
    </Suspense>
  );
}
