"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TerminalSessionData {
  id: string;
  status: string;
  startedAt: string;
  lastActive: string;
  closedAt: string | null;
  metadata: Record<string, unknown>;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  provider?: string;
  model?: string;
  timestamp: string;
}

interface ProviderInfo {
  id: string;
  name: string;
  models: Array<{ id: string; name: string; context: number }>;
  capabilities: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const statusColors: Record<string, string> = {
  provisioning: "bg-gray-100 text-gray-700",
  active: "bg-green-100 text-green-700",
  idle: "bg-yellow-100 text-yellow-700",
  closed: "bg-gray-100 text-gray-500",
  failed: "bg-red-100 text-red-700",
};

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "bg-orange-600",
  openai: "bg-green-700",
  google: "bg-blue-600",
  deepseek: "bg-indigo-700",
};

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-medium ${statusColors[status] ?? "bg-gray-100 text-gray-700"}`}
    >
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Terminal Session Detail Page
// ---------------------------------------------------------------------------

export default function TerminalSessionDetailPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<TerminalSessionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // AI Agent tab state
  const [activeTab, setActiveTab] = useState<"terminal" | "ai">("terminal");
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState("anthropic");
  const [selectedModel, setSelectedModel] = useState("claude-sonnet-4-6");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/sign-in");
    }
  }, [isLoading, user, router]);

  // Load session detail
  const loadSession = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const result = await apiFetch<TerminalSessionData>(
      `/api/v1/terminal-sessions/${sessionId}`,
      { token },
    );

    if (result.ok) {
      setSession(result.data);
    } else {
      setError(result.error.message);
    }
    setLoading(false);
  }, [token, sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Poll for active sessions
  useEffect(() => {
    if (!session) return;
    if (session.status === "closed" || session.status === "failed") return;

    const interval = setInterval(loadSession, 5000);
    return () => clearInterval(interval);
  }, [session, loadSession]);

  // Fetch AI providers
  useEffect(() => {
    if (!token) return;
    apiFetch<ProviderInfo[]>("/api/v1/agent-providers", { token })
      .then((res) => {
        if (res.ok) setProviders(res.data);
      })
      .catch(() => {});
  }, [token]);

  // Close session
  const handleClose = async () => {
    if (!token) return;
    setActionLoading(true);
    setError(null);

    const result = await apiFetch<TerminalSessionData>(
      `/api/v1/terminal-sessions/${sessionId}/close`,
      { method: "POST", token, body: JSON.stringify({}) },
    );

    if (result.ok) {
      setSession(result.data);
    } else {
      setError(result.error.message);
    }
    setActionLoading(false);
  };

  // Send AI chat message
  const sendAiMessage = useCallback(async () => {
    if (!aiInput.trim()) return;
    const userMessage: ChatMessage = {
      role: "user",
      content: aiInput.trim(),
      timestamp: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, userMessage]);
    setAiInput("");
    setAiLoading(true);

    try {
      const res = await apiFetch<{
        response: string;
        provider: string;
        model: string;
      }>("/api/v1/agent-chat", {
        method: "POST",
        body: JSON.stringify({
          provider: selectedProvider,
          model: selectedModel,
          message: aiInput.trim(),
          terminalSessionId: sessionId,
        }),
        token: token ?? undefined,
      });

      if (res.ok) {
        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: res.data.response,
          provider: res.data.provider,
          model: res.data.model,
          timestamp: new Date().toISOString(),
        };
        setChatMessages((prev) => [...prev, assistantMessage]);
      }
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Failed to get response. Please try again.",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  }, [aiInput, selectedProvider, selectedModel, sessionId, token]);

  if (isLoading || !user) return null;

  if (loading) {
    return (
      <AppShell>
        <p className="text-gray-400">Loading terminal session...</p>
      </AppShell>
    );
  }

  if (!session) {
    return (
      <AppShell>
        <div className="rounded border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-medium text-red-700">Terminal session not found</p>
          <p className="text-sm text-red-600">{error}</p>
          <Link
            href="/terminal"
            className="mt-2 inline-block text-sm text-gray-600 underline"
          >
            Back to Terminal
          </Link>
        </div>
      </AppShell>
    );
  }

  const isTerminal = session.status === "closed" || session.status === "failed";
  const showClose = !isTerminal;

  return (
    <AppShell>
      <div className="flex flex-col h-[calc(100vh-64px)]">
        {/* Back nav + header */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0 space-y-2">
          <Link
            href="/terminal"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            &larr; Back to Terminal
          </Link>

          {error && (
            <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-semibold">Terminal Session</h1>
              <p className="text-xs text-gray-500 font-mono">{session.id}</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={session.status} />
              {showClose && (
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={actionLoading}
                  className="rounded bg-red-100 px-3 py-1 text-sm text-red-700 hover:bg-red-200 disabled:opacity-50 touch-manipulation"
                >
                  {actionLoading ? "..." : "Close Session"}
                </button>
              )}
            </div>
          </div>

          {/* Session metadata */}
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <dt className="font-medium text-gray-500">Started</dt>
              <dd>{new Date(session.startedAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Last Active</dt>
              <dd>{new Date(session.lastActive).toLocaleString()}</dd>
            </div>
            {session.closedAt && (
              <div>
                <dt className="font-medium text-gray-500">Closed</dt>
                <dd>{new Date(session.closedAt).toLocaleString()}</dd>
              </div>
            )}
            <div>
              <dt className="font-medium text-gray-500">Status</dt>
              <dd>{session.status}</dd>
            </div>
          </dl>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("terminal")}
            className={[
              "flex-1 py-3 text-sm font-medium text-center transition-colors touch-manipulation",
              activeTab === "terminal"
                ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                : "text-gray-500 hover:text-gray-700",
            ].join(" ")}
          >
            Terminal
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ai")}
            className={[
              "flex-1 py-3 text-sm font-medium text-center transition-colors touch-manipulation",
              activeTab === "ai"
                ? "border-b-2 border-purple-500 text-purple-600 dark:text-purple-400"
                : "text-gray-500 hover:text-gray-700",
            ].join(" ")}
          >
            AI Agent
          </button>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-hidden">
          {activeTab === "terminal" ? (
            <div className="flex flex-col h-full">
              {/* Terminal emulator area */}
              <div className="flex-1 bg-black text-green-400 font-mono p-4 overflow-auto text-sm leading-relaxed">
                <div className="text-gray-500 text-xs mb-2">
                  Session: {session.id.slice(0, 8)}...
                </div>
                {isTerminal ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <p className="text-lg mb-2">Session {session.status}</p>
                    <p className="text-sm">
                      This session ended at{" "}
                      {session.closedAt
                        ? new Date(session.closedAt).toLocaleString()
                        : "unknown"}
                    </p>
                  </div>
                ) : (
                  <div>
                    <span className="text-blue-400">sovereign</span>
                    <span className="text-gray-500">:</span>
                    <span className="text-green-400">~</span>
                    <span className="text-gray-500">$ </span>
                    <span className="animate-pulse">_</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Provider selector */}
              <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 shrink-0">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {providers.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedProvider(p.id);
                        const firstModel = p.models[0];
                        if (firstModel) setSelectedModel(firstModel.id);
                      }}
                      className={[
                        "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors touch-manipulation",
                        selectedProvider === p.id
                          ? `${PROVIDER_COLORS[p.id] ?? "bg-gray-600"} text-white`
                          : "bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
                      ].join(" ")}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
                {/* Model selector */}
                <div className="flex gap-1 mt-1 overflow-x-auto">
                  {providers
                    .find((p) => p.id === selectedProvider)
                    ?.models.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedModel(m.id)}
                        className={[
                          "px-2 py-0.5 rounded text-xs whitespace-nowrap transition-colors touch-manipulation",
                          selectedModel === m.id
                            ? "bg-gray-300 dark:bg-gray-600 text-black dark:text-white"
                            : "text-gray-500 hover:text-gray-700",
                        ].join(" ")}
                      >
                        {m.name}
                      </button>
                    ))}
                </div>
              </div>

              {/* Chat messages */}
              <div className="flex-1 overflow-auto p-4 space-y-3">
                {chatMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <p className="text-lg mb-2">AI Agent</p>
                    <p className="text-sm text-center">
                      Ask any coding question or get help with this terminal
                      session.
                      <br />
                      The AI agent has context from this session.
                    </p>
                  </div>
                ) : (
                  chatMessages.map((msg, i) => (
                    <div
                      key={`${msg.timestamp}-${i}`}
                      className={[
                        "max-w-[85%] px-3 py-2 rounded-lg text-sm",
                        msg.role === "user"
                          ? "ml-auto bg-blue-600 text-white"
                          : "mr-auto bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100",
                      ].join(" ")}
                    >
                      {msg.role === "assistant" && msg.provider && (
                        <div className="text-xs text-gray-500 mb-1">
                          {msg.provider} / {msg.model}
                        </div>
                      )}
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  ))
                )}
              </div>

              {/* AI input */}
              <div className="p-3 border-t border-gray-200 dark:border-gray-700 shrink-0">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendAiMessage();
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    placeholder="Ask AI agent about this session..."
                    className="flex-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="submit"
                    disabled={!aiInput.trim() || aiLoading}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors touch-manipulation"
                  >
                    {aiLoading ? "..." : "Send"}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
