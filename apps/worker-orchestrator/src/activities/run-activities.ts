// ---------------------------------------------------------------------------
// Temporal activities for run execution
// ---------------------------------------------------------------------------

import { initDb, PgRunRepo, PgRunStepRepo, PgAuditRepo } from "@sovereign/db";
import type { OrgId, ISODateString } from "@sovereign/core";
import { toRunId, toISODateString } from "@sovereign/core";

// ---------------------------------------------------------------------------
// Database client (initialized lazily)
// ---------------------------------------------------------------------------

let _db: ReturnType<typeof initDb> | null = null;

function getDb() {
  if (!_db) {
    _db = initDb({
      url: process.env.DATABASE_URL ?? "postgresql://sovereign:sovereign_dev@localhost:5432/sovereign",
      maxConnections: 5,
    });
  }
  return _db;
}

// ---------------------------------------------------------------------------
// Activity: Start run execution
// ---------------------------------------------------------------------------

export interface StartRunParams {
  runId: string;
  orgId: string;
}

export async function startRun(params: StartRunParams): Promise<void> {
  const db = getDb();
  const tenantDb = db.forTenant(params.orgId as OrgId);
  const runRepo = new PgRunRepo(tenantDb);

  await runRepo.updateStatus(
    toRunId(params.runId),
    params.orgId as OrgId,
    "starting",
    { startedAt: toISODateString(new Date()) as ISODateString },
  );
}

// ---------------------------------------------------------------------------
// Activity: Execute agent (tool-less LLM call)
// ---------------------------------------------------------------------------

export interface ExecuteAgentParams {
  runId: string;
  orgId: string;
  instructions: string;
  modelConfig: { provider: string; model: string; temperature?: number; maxTokens?: number };
  input: Record<string, unknown>;
  goals: readonly string[];
  executionProvider: string;
}

export interface ExecuteAgentResult {
  output: Record<string, unknown>;
  tokenUsage: { inputTokens: number; outputTokens: number; totalTokens: number };
  steps: Array<{
    type: string;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
    tokenUsage: { inputTokens: number; outputTokens: number; totalTokens: number } | null;
    providerMetadata: Record<string, unknown> | null;
    latencyMs: number;
  }>;
  error?: { code: string; message: string };
}

export async function executeAgent(params: ExecuteAgentParams): Promise<ExecuteAgentResult> {
  // Import provider dynamically to avoid workflow code importing non-deterministic modules
  if (params.executionProvider === "openai") {
    return executeWithOpenAI(params);
  }
  return executeWithLocal(params);
}

async function executeWithLocal(params: ExecuteAgentParams): Promise<ExecuteAgentResult> {
  const startTime = Date.now();

  const output = {
    response: `[Local/Dev] Executed agent with instructions: "${params.instructions.slice(0, 100)}..."`,
    goals: params.goals,
    inputReceived: params.input,
    provider: "local",
    model: params.modelConfig.model,
    timestamp: new Date().toISOString(),
  };

  const latencyMs = Date.now() - startTime + 50; // Minimum simulated latency

  return {
    output,
    tokenUsage: { inputTokens: 150, outputTokens: 75, totalTokens: 225 },
    steps: [
      {
        type: "llm_call",
        input: {
          system: params.instructions,
          user: JSON.stringify(params.input),
          model: params.modelConfig.model,
        },
        output,
        tokenUsage: { inputTokens: 150, outputTokens: 75, totalTokens: 225 },
        providerMetadata: { provider: "local", mode: "dev" },
        latencyMs,
      },
    ],
  };
}

async function executeWithOpenAI(params: ExecuteAgentParams): Promise<ExecuteAgentResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      output: {},
      tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      steps: [],
      error: { code: "PROVIDER_ERROR", message: "OPENAI_API_KEY not configured" },
    };
  }

  const startTime = Date.now();

  const messages = [
    { role: "system", content: params.instructions },
    ...(params.goals.length > 0
      ? [{ role: "system", content: `Goals:\n${params.goals.map((g, i) => `${i + 1}. ${g}`).join("\n")}` }]
      : []),
    { role: "user", content: JSON.stringify(params.input) },
  ];

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: params.modelConfig.model ?? "gpt-4o",
        messages,
        temperature: params.modelConfig.temperature ?? 0.7,
        max_tokens: params.modelConfig.maxTokens ?? 4096,
      }),
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        output: {},
        tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        steps: [],
        error: { code: "PROVIDER_ERROR", message: `OpenAI API error: ${response.status} ${errorBody}` },
      };
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    const content = data.choices?.[0]?.message?.content ?? "";
    const usage = data.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    const output = { response: content };
    const tokenUsage = {
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
    };

    return {
      output,
      tokenUsage,
      steps: [
        {
          type: "llm_call",
          input: { messages },
          output,
          tokenUsage,
          providerMetadata: {
            provider: "openai",
            model: params.modelConfig.model ?? "gpt-4o",
          },
          latencyMs,
        },
      ],
    };
  } catch (e) {
    return {
      output: {},
      tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      steps: [],
      error: {
        code: "PROVIDER_ERROR",
        message: e instanceof Error ? e.message : "Unknown OpenAI error",
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Activity: Record run steps to database
// ---------------------------------------------------------------------------

export interface RecordStepsParams {
  runId: string;
  orgId: string;
  steps: ExecuteAgentResult["steps"];
}

export async function recordRunSteps(params: RecordStepsParams): Promise<void> {
  const db = getDb();
  const tenantDb = db.forTenant(params.orgId as OrgId);
  const stepRepo = new PgRunStepRepo(tenantDb);

  for (let i = 0; i < params.steps.length; i++) {
    const step = params.steps[i]!;
    const created = await stepRepo.create({
      orgId: params.orgId as OrgId,
      runId: toRunId(params.runId),
      stepNumber: i + 1,
      type: step.type as "llm_call" | "tool_call" | "system" | "error",
      attempt: 1,
      input: step.input,
    });

    // Mark step as completed with output and metadata
    await stepRepo.updateStatus(created.id, params.orgId as OrgId, "completed", {
      output: step.output,
      tokenUsage: step.tokenUsage ?? undefined,
      providerMetadata: step.providerMetadata ?? undefined,
      latencyMs: step.latencyMs,
      startedAt: toISODateString(new Date()),
      completedAt: toISODateString(new Date()),
    });
  }
}

// ---------------------------------------------------------------------------
// Activity: Complete run (success)
// ---------------------------------------------------------------------------

export interface CompleteRunParams {
  runId: string;
  orgId: string;
  output: Record<string, unknown>;
  tokenUsage: { inputTokens: number; outputTokens: number; totalTokens: number };
}

export async function completeRun(params: CompleteRunParams): Promise<void> {
  const db = getDb();
  const tenantDb = db.forTenant(params.orgId as OrgId);
  const runRepo = new PgRunRepo(tenantDb);
  const auditRepo = new PgAuditRepo(tenantDb);

  const now = toISODateString(new Date());
  await runRepo.updateStatus(
    toRunId(params.runId),
    params.orgId as OrgId,
    "completed",
    {
      output: params.output,
      tokenUsage: params.tokenUsage,
      completedAt: now as ISODateString,
    },
  );

  await auditRepo.emit({
    orgId: params.orgId as OrgId,
    actorType: "system",
    action: "run.completed",
    resourceType: "run",
    resourceId: params.runId,
    metadata: { tokenUsage: params.tokenUsage },
  });
}

// ---------------------------------------------------------------------------
// Activity: Fail run
// ---------------------------------------------------------------------------

export interface FailRunParams {
  runId: string;
  orgId: string;
  error: { code: string; message: string };
}

export async function failRun(params: FailRunParams): Promise<void> {
  const db = getDb();
  const tenantDb = db.forTenant(params.orgId as OrgId);
  const runRepo = new PgRunRepo(tenantDb);
  const auditRepo = new PgAuditRepo(tenantDb);

  const now = toISODateString(new Date());
  await runRepo.updateStatus(
    toRunId(params.runId),
    params.orgId as OrgId,
    "failed",
    {
      error: params.error,
      completedAt: now as ISODateString,
    },
  );

  await auditRepo.emit({
    orgId: params.orgId as OrgId,
    actorType: "system",
    action: "run.failed",
    resourceType: "run",
    resourceId: params.runId,
    metadata: { error: params.error },
  });
}

// ---------------------------------------------------------------------------
// Activity: Update run to running
// ---------------------------------------------------------------------------

export async function markRunning(params: StartRunParams): Promise<void> {
  const db = getDb();
  const tenantDb = db.forTenant(params.orgId as OrgId);
  const runRepo = new PgRunRepo(tenantDb);

  await runRepo.updateStatus(
    toRunId(params.runId),
    params.orgId as OrgId,
    "running",
  );
}
