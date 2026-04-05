"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import { IconChevronRight, IconAgents } from "@/components/icons";

interface Agent {
  id: string;
  name: string;
  description?: string;
}

const AI_TEMPLATES: Record<string, { goals: string; instructions: string }> = {
  "customer-support": {
    goals: "Resolve customer inquiries within 2 minutes\nAchieve 95%+ customer satisfaction\nEscalate complex issues to human agents",
    instructions:
      "You are a professional customer support agent. Be empathetic, solution-oriented, and concise.\n\n1. Greet the customer warmly and acknowledge their issue.\n2. Gather necessary context by asking targeted questions.\n3. Provide clear, step-by-step solutions when possible.\n4. If the issue requires human intervention, explain why and initiate escalation.\n5. Always confirm the customer's issue is resolved before closing.\n6. Maintain a professional, friendly tone throughout.\n\nNever share internal system details or customer data from other accounts.",
  },
  "sales-outreach": {
    goals: "Generate 20+ qualified leads per week\nAchieve 30%+ email open rate\nBook 5+ discovery calls per week",
    instructions:
      "You are a sales development representative focused on outbound prospecting.\n\n1. Research prospects thoroughly before outreach using available data.\n2. Personalize every message based on the prospect's company, role, and recent activity.\n3. Lead with value — share relevant insights, not product pitches.\n4. Follow up strategically (3-touch sequence over 7 days).\n5. Track all interactions and update the CRM after each touchpoint.\n6. Qualify leads using BANT criteria (Budget, Authority, Need, Timeline).\n\nNever be pushy. Focus on building genuine relationships and understanding needs.",
  },
  "data-analyst": {
    goals: "Deliver accurate reports within 24 hours\nIdentify 3+ actionable insights per analysis\nMaintain 99%+ data accuracy",
    instructions:
      "You are a data analyst agent that queries databases, analyzes data, and generates insights.\n\n1. Clarify the analysis request and expected output format.\n2. Write efficient SQL queries to extract relevant data.\n3. Validate data quality before analysis (check for nulls, duplicates, outliers).\n4. Present findings with clear visualizations and summaries.\n5. Highlight key trends, anomalies, and actionable recommendations.\n6. Document your methodology for reproducibility.\n\nAlways sanitize queries to prevent injection. Never expose raw database credentials.",
  },
  "content-writer": {
    goals: "Produce publish-ready content on first draft\nMaintain consistent brand voice across all outputs\nOptimize content for SEO and engagement",
    instructions:
      "You are a content creation agent specializing in professional writing.\n\n1. Understand the target audience, tone, and purpose before writing.\n2. Research the topic using available tools to ensure accuracy.\n3. Structure content with clear headings, short paragraphs, and bullet points.\n4. Write in active voice with strong, specific language.\n5. Include relevant data points and examples to support claims.\n6. Proofread for grammar, clarity, and brand consistency.\n\nAdapt your writing style based on the channel (blog, email, social, docs).",
  },
  "devops-assistant": {
    goals: "Reduce mean time to resolution by 50%\nAutomate 80%+ of routine operations\nMaintain 99.9% uptime SLA",
    instructions:
      "You are a DevOps assistant that monitors systems, manages deployments, and automates operations.\n\n1. Monitor alerts and prioritize by severity and impact.\n2. For incidents, gather diagnostic data before attempting fixes.\n3. Follow runbooks for known issues; document new issues for future reference.\n4. Automate repetitive tasks with scripts and workflows.\n5. Review pull requests for infrastructure changes with security focus.\n6. Report daily on system health, deployment status, and incident metrics.\n\nNever make production changes without approval. Always maintain rollback plans.",
  },
};

export default function CreateVersionPage() {
  const { user, role, token, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const agentId = params.agentId as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [instructions, setInstructions] = useState("");
  const [goals, setGoals] = useState("");
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("gpt-4o");
  const [temperature, setTemperature] = useState("0.7");
  const [maxTokens, setMaxTokens] = useState("4096");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);

  const canEdit = role === "org_owner" || role === "org_admin";

  useEffect(() => {
    if (!isLoading && !user) router.push("/auth/sign-in");
    if (!isLoading && user && !canEdit) router.push(`/agents/${agentId}`);
  }, [isLoading, user, canEdit, agentId, router]);

  useEffect(() => {
    if (!token) return;
    apiFetch<Agent>(`/api/v1/agents/${agentId}`, { token }).then((r) => {
      if (r.ok) setAgent(r.data);
    });
  }, [token, agentId]);

  const applyTemplate = (key: string) => {
    const template = AI_TEMPLATES[key];
    if (!template) return;
    setGoals(template.goals);
    setInstructions(template.instructions);
  };

  const handleGenerate = async () => {
    if (!agent) return;
    setGenerating(true);
    // Generate based on agent name and description
    const agentName = agent.name.toLowerCase();
    // Pick the best matching template
    let bestKey = "customer-support";
    if (agentName.includes("sales") || agentName.includes("outreach") || agentName.includes("revenue")) bestKey = "sales-outreach";
    else if (agentName.includes("data") || agentName.includes("analyst") || agentName.includes("report")) bestKey = "data-analyst";
    else if (agentName.includes("content") || agentName.includes("write") || agentName.includes("blog")) bestKey = "content-writer";
    else if (agentName.includes("devops") || agentName.includes("deploy") || agentName.includes("infra")) bestKey = "devops-assistant";
    else if (agentName.includes("support") || agentName.includes("customer") || agentName.includes("service")) bestKey = "customer-support";

    // Simulate brief delay for UX
    await new Promise((r) => setTimeout(r, 600));
    applyTemplate(bestKey);
    setGenerating(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);

    const goalList = goals.split("\n").map((g) => g.trim()).filter((g) => g.length > 0);

    const result = await apiFetch<{ id: string }>(
      `/api/v1/agents/${agentId}/versions`,
      {
        method: "POST",
        token,
        body: JSON.stringify({
          instructions: instructions || undefined,
          goals: goalList.length > 0 ? goalList : undefined,
          modelConfig: {
            provider,
            model,
            temperature: parseFloat(temperature),
            maxTokens: parseInt(maxTokens, 10),
          },
        }),
      },
    );

    if (result.ok) {
      router.push(`/agents/${agentId}/versions/${result.data.id}`);
    } else {
      setError(result.error.message);
      setSubmitting(false);
    }
  };

  if (isLoading || !user) return null;

  if (!canEdit) {
    return (
      <AppShell>
        <div className="empty-state">
          <p className="empty-state-title">Permission Denied</p>
          <p className="empty-state-description">You do not have permission to create agent versions.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <nav className="breadcrumb">
          <Link href="/agents">Agents</Link>
          <IconChevronRight size={12} className="breadcrumb-separator" />
          <Link href={`/agents/${agentId}`}>{agent?.name ?? "Agent"}</Link>
          <IconChevronRight size={12} className="breadcrumb-separator" />
          <span className="text-[rgb(var(--color-text-primary))]">New Version</span>
        </nav>

        <div className="page-header">
          <h1 className="page-title">Create New Version</h1>
          <p className="page-description">
            Define your agent&apos;s behavior. New versions start as drafts — publish when ready.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-3 rounded-lg border border-[rgb(var(--color-error)/0.3)] bg-[rgb(var(--color-error-bg))] px-4 py-3 text-sm text-[rgb(var(--color-error))]">
            {error}
            <button onClick={() => setError(null)} className="ml-auto hover:opacity-70">&times;</button>
          </div>
        )}

        {/* AI Quick Start */}
        <div className="card max-w-2xl">
          <div className="section-header mb-4">
            <h2 className="section-title">Quick Start with AI</h2>
          </div>
          <p className="mb-3 text-xs text-[rgb(var(--color-text-tertiary))]">
            Auto-generate goals and instructions based on your agent&apos;s purpose, or pick a template.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[rgb(var(--color-brand))] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[rgb(var(--color-brand-dark))] disabled:opacity-50"
            >
              {generating ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Generating...
                </>
              ) : (
                <>
                  <IconAgents size={14} />
                  Auto-Generate from Agent Name
                </>
              )}
            </button>
            {Object.entries(AI_TEMPLATES).map(([key]) => (
              <button
                key={key}
                type="button"
                onClick={() => applyTemplate(key)}
                className="rounded-lg border border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-primary))] px-3 py-1.5 text-xs font-medium capitalize text-[rgb(var(--color-text-secondary))] transition-colors hover:bg-[rgb(var(--color-bg-secondary))]"
              >
                {key.replace(/-/g, " ")}
              </button>
            ))}
          </div>
        </div>

        <div className="card max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Goals */}
            <div className="space-y-1.5">
              <label htmlFor="goals" className="block text-sm font-medium text-[rgb(var(--color-text-primary))]">Goals</label>
              <p className="text-xs text-[rgb(var(--color-text-tertiary))]">One goal per line. Define measurable outcomes.</p>
              <textarea
                id="goals"
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                className="input min-h-[80px] resize-y font-mono text-sm"
                rows={3}
                placeholder="Resolve customer inquiries within 2 minutes&#10;Achieve 95%+ satisfaction&#10;Escalate complex issues"
              />
            </div>

            {/* Instructions */}
            <div className="space-y-1.5">
              <label htmlFor="instructions" className="block text-sm font-medium text-[rgb(var(--color-text-primary))]">
                Instructions <span className="text-[rgb(var(--color-error))]">*</span>
              </label>
              <p className="text-xs text-[rgb(var(--color-text-tertiary))]">
                Required for publishing. Define the agent&apos;s behavior and system prompt.
              </p>
              <textarea
                id="instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="input min-h-[160px] resize-y font-mono text-sm"
                rows={8}
                required
                placeholder="You are a helpful assistant that..."
              />
            </div>

            {/* Model Configuration */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-[rgb(var(--color-text-primary))]">Model Configuration</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="provider" className="block text-xs font-medium text-[rgb(var(--color-text-secondary))]">Provider</label>
                  <select id="provider" value={provider} onChange={(e) => setProvider(e.target.value)} className="input">
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="google">Google</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="model" className="block text-xs font-medium text-[rgb(var(--color-text-secondary))]">Model</label>
                  <select id="model" value={model} onChange={(e) => setModel(e.target.value)} className="input">
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="gpt-4o-mini">GPT-4o Mini</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                    <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
                    <option value="claude-haiku-4-5">Claude Haiku 4.5</option>
                    <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="temperature" className="block text-xs font-medium text-[rgb(var(--color-text-secondary))]">Temperature</label>
                  <input id="temperature" type="number" value={temperature} onChange={(e) => setTemperature(e.target.value)} className="input" min="0" max="2" step="0.1" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="maxTokens" className="block text-xs font-medium text-[rgb(var(--color-text-secondary))]">Max Tokens</label>
                  <input id="maxTokens" type="number" value={maxTokens} onChange={(e) => setMaxTokens(e.target.value)} className="input" min="1" />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 border-t border-[rgb(var(--color-border-primary))] pt-6">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-[rgb(var(--color-brand))] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-[rgb(var(--color-brand-dark))] disabled:opacity-50"
              >
                {submitting ? "Creating..." : "Create Draft Version"}
              </button>
              <Link
                href={`/agents/${agentId}`}
                className="rounded-lg border border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-primary))] px-5 py-2.5 text-sm font-medium text-[rgb(var(--color-text-secondary))] transition-colors hover:bg-[rgb(var(--color-bg-secondary))]"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
