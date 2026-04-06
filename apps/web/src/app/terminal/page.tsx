"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TerminalSessionData {
  id: string;
  status: string;
  startedAt: string;
  lastActive: string;
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

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "bg-orange-600",
  openai: "bg-green-700",
  google: "bg-blue-600",
  deepseek: "bg-indigo-700",
};

// ---------------------------------------------------------------------------
// Mobile Terminal Page
// ---------------------------------------------------------------------------

export default function TerminalPage() {
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState<"terminal" | "ai">("terminal");
  const [sessions, setSessions] = useState<TerminalSessionData[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState("anthropic");
  const [selectedModel, setSelectedModel] = useState("claude-sonnet-4-6");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch terminal sessions
  useEffect(() => {
    if (!token) return;
    apiFetch<TerminalSessionData[]>("/api/v1/terminal-sessions", { token }).then((res) => {
      if (res.ok) setSessions(res.data);
    }).catch(() => {});
  }, [token]);

  // Fetch AI providers
  useEffect(() => {
    if (!token) return;
    apiFetch<ProviderInfo[]>("/api/v1/agent-providers", { token }).then((res) => {
      if (res.ok) setProviders(res.data);
    }).catch(() => {});
  }, [token]);

  // Create a new terminal session
  const createSession = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<TerminalSessionData>("/api/v1/terminal-sessions", {
        method: "POST",
        body: JSON.stringify({}),
        token: token ?? undefined,
      });
      if (res.ok) {
        setSessions((prev) => [res.data, ...prev]);
        setActiveSessionId(res.data.id);
      }
    } finally {
      setLoading(false);
    }
  }, []);

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
    setLoading(true);

    try {
      const res = await apiFetch<{ response: string; provider: string; model: string }>("/api/v1/agent-chat", {
        method: "POST",
        body: JSON.stringify({
          provider: selectedProvider,
          model: selectedModel,
          message: aiInput.trim(),
          terminalSessionId: activeSessionId ?? undefined,
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
      setLoading(false);
    }
  }, [aiInput, selectedProvider, selectedModel, activeSessionId]);

  // Quick command actions
  const quickActions = [
    { label: "Git Status", cmd: "git status" },
    { label: "Run Tests", cmd: "pnpm test" },
    { label: "Lint", cmd: "pnpm lint" },
    { label: "Build", cmd: "pnpm build" },
    { label: "Git Diff", cmd: "git diff --stat" },
    { label: "Git Pull", cmd: "git pull" },
  ];

  if (!user) {
    return (
      <AppShell>
        <div className="p-6 text-center text-gray-500">Please sign in to use the terminal.</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col h-[calc(100vh-64px)]">
        {/* Header — responsive */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Terminal</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              {sessions.filter((s) => s.status === "active").length} active
            </span>
          </div>
          <button
            type="button"
            onClick={createSession}
            disabled={loading}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50 touch-manipulation"
          >
            New Session
          </button>
        </div>

        {/* Tab switcher (mobile-friendly) */}
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
              {/* Terminal area */}
              <div className="flex-1 bg-black text-green-400 font-mono p-4 overflow-auto text-sm leading-relaxed">
                {activeSessionId ? (
                  <div>
                    <div className="text-gray-500 text-xs mb-2">
                      Session: {activeSessionId.slice(0, 8)}...
                    </div>
                    <div>
                      <span className="text-blue-400">sovereign</span>
                      <span className="text-gray-500">:</span>
                      <span className="text-green-400">~</span>
                      <span className="text-gray-500">$ </span>
                      <span className="animate-pulse">_</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <p className="text-lg mb-2">No active terminal session</p>
                    <p className="text-sm">Tap &quot;New Session&quot; to start</p>
                  </div>
                )}
              </div>

              {/* Quick actions bar (touch-optimized) */}
              <div className="bg-gray-900 border-t border-gray-700 p-2 shrink-0">
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                  {quickActions.map((action) => (
                    <button
                      key={action.cmd}
                      type="button"
                      className="px-2 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded font-medium transition-colors active:scale-95 touch-manipulation"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
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
                      Ask any coding question, request a fix, or get help with your project.
                      <br />
                      Switch providers above to compare responses.
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
                    placeholder="Ask AI agent..."
                    className="flex-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="submit"
                    disabled={!aiInput.trim() || loading}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors touch-manipulation"
                  >
                    {loading ? "..." : "Send"}
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
