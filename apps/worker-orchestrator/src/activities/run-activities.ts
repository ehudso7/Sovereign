// ---------------------------------------------------------------------------
// Temporal activities for run execution
// ---------------------------------------------------------------------------

import { initDb, PgRunRepo, PgRunStepRepo, PgAuditRepo, PgConnectorInstallRepo, PgConnectorCredentialRepo } from "@sovereign/db";
import type { OrgId, ISODateString } from "@sovereign/core";
import { toRunId, toISODateString } from "@sovereign/core";
import { executeTool, listToolsForConnector } from "@sovereign/gateway-mcp";

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
// Activity: Execute agent (with optional tool calls)
// ---------------------------------------------------------------------------

export interface ExecuteAgentParams {
  runId: string;
  orgId: string;
  instructions: string;
  modelConfig: { provider: string; model: string; temperature?: number; maxTokens?: number };
  input: Record<string, unknown>;
  goals: readonly string[];
  executionProvider: string;
  configSnapshot?: Record<string, unknown>;
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
    toolName?: string;
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

  const output: Record<string, unknown> = {
    response: `[Local/Dev] Executed agent with instructions: "${params.instructions.slice(0, 100)}..."`,
    goals: params.goals,
    inputReceived: params.input,
    provider: "local",
    model: params.modelConfig.model,
    timestamp: new Date().toISOString(),
  };

  const latencyMs = Date.now() - startTime + 50; // Minimum simulated latency

  const steps: ExecuteAgentResult["steps"] = [
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
  ];

  // If configSnapshot contains tools, simulate tool_call steps
  const tools = params.configSnapshot?.tools as Array<{ name: string; connectorId?: string }> | undefined;
  if (tools && tools.length > 0) {
    for (const tool of tools) {
      const connectorSlug = tool.connectorId ?? "unknown";
      const toolCallStart = Date.now();

      const toolResult = await executeTool(tool.name, { message: "test" }, {
        orgId: params.orgId,
        runId: params.runId,
        connectorSlug,
      });

      steps.push({
        type: "tool_call",
        toolName: tool.name,
        input: { toolName: tool.name, args: { message: "test" } },
        output: toolResult.output,
        tokenUsage: null,
        providerMetadata: { connectorSlug, toolError: toolResult.error ?? null },
        latencyMs: Date.now() - toolCallStart,
      });

      // Merge tool output into the final output
      output[`tool_${tool.name}`] = toolResult.output;
    }
  }

  const totalTokens = { inputTokens: 150, outputTokens: 75, totalTokens: 225 };

  return {
    output,
    tokenUsage: totalTokens,
    steps,
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

  // Build input for the Responses API
  const inputParts: string[] = [];
  if (params.goals.length > 0) {
    inputParts.push(`Goals:\n${params.goals.map((g, i) => `${i + 1}. ${g}`).join("\n")}`);
  }
  inputParts.push(JSON.stringify(params.input));

  // Build function tools from configSnapshot if present
  const configTools = params.configSnapshot?.tools as Array<{ name: string; connectorId?: string; parameters?: Record<string, unknown> }> | undefined;
  const functionTools: Array<Record<string, unknown>> = [];
  if (configTools && configTools.length > 0) {
    for (const tool of configTools) {
      const connectorSlug = tool.connectorId ?? "unknown";
      const registeredTools = listToolsForConnector(connectorSlug);
      const registered = registeredTools.find((t) => t.name === tool.name);
      if (registered) {
        functionTools.push({
          type: "function",
          name: tool.name,
          description: registered.description,
          parameters: tool.parameters ?? {
            type: "object",
            properties: Object.fromEntries(
              registered.parameters.map((p) => [p.name, { type: p.type, description: p.description }]),
            ),
            required: registered.parameters.filter((p) => p.required).map((p) => p.name),
          },
        });
      }
    }
  }

  const requestBody: Record<string, unknown> = {
    model: params.modelConfig.model ?? "gpt-4o",
    instructions: params.instructions,
    input: inputParts.join("\n\n"),
    temperature: params.modelConfig.temperature ?? 0.7,
    ...(params.modelConfig.maxTokens !== undefined && {
      max_output_tokens: params.modelConfig.maxTokens,
    }),
    ...(functionTools.length > 0 && { tools: functionTools }),
  };

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        output: {},
        tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        steps: [],
        error: { code: "PROVIDER_ERROR", message: `OpenAI Responses API error: ${response.status} ${errorBody}` },
      };
    }

    const data = await response.json() as {
      id: string;
      model: string;
      status: string;
      output: Array<{ type: string; content?: Array<{ type: string; text?: string }>; name?: string; arguments?: string; call_id?: string }>;
      usage?: { input_tokens: number; output_tokens: number; total_tokens: number };
    };

    // Extract text from Responses API output array
    let content = "";
    const toolCallSteps: ExecuteAgentResult["steps"] = [];

    for (const item of data.output) {
      if (item.type === "message" && item.content) {
        for (const part of item.content) {
          if (part.type === "output_text" && part.text) {
            content += part.text;
          }
        }
      }
      // Parse tool_use outputs from the Responses API
      if (item.type === "function_call" && item.name && item.arguments) {
        const toolArgs = JSON.parse(item.arguments) as Record<string, unknown>;
        toolCallSteps.push({
          type: "tool_call",
          toolName: item.name,
          input: { toolName: item.name, args: toolArgs, callId: item.call_id },
          output: { pending: true },
          tokenUsage: null,
          providerMetadata: { callId: item.call_id },
          latencyMs: 0,
        });
      }
    }

    const usage = data.usage ?? { input_tokens: 0, output_tokens: 0, total_tokens: 0 };

    const output = { response: content };
    const tokenUsage = {
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      totalTokens: usage.total_tokens,
    };

    const steps: ExecuteAgentResult["steps"] = [
      {
        type: "llm_call",
        input: { instructions: params.instructions, model: params.modelConfig.model ?? "gpt-4o" },
        output,
        tokenUsage,
        providerMetadata: {
          provider: "openai",
          api: "responses",
          model: data.model,
          responseId: data.id,
        },
        latencyMs,
      },
      ...toolCallSteps,
    ];

    return {
      output,
      tokenUsage,
      steps,
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
// Activity: Execute a tool call
// ---------------------------------------------------------------------------

export interface ExecuteToolCallParams {
  runId: string;
  orgId: string;
  toolName: string;
  args: Record<string, unknown>;
  connectorSlug: string;
}

export interface ExecuteToolCallResult {
  output: Record<string, unknown>;
  error?: { code: string; message: string };
  latencyMs: number;
}

export async function executeToolCall(params: ExecuteToolCallParams): Promise<ExecuteToolCallResult> {
  const db = getDb();
  const tenantDb = db.forTenant(params.orgId as OrgId);

  // Attempt to get credentials from DB
  const installRepo = new PgConnectorInstallRepo(tenantDb);
  const credentialRepo = new PgConnectorCredentialRepo(tenantDb);

  let credentials: Record<string, unknown> | undefined;

  // Find the install for this connector
  const installs = await installRepo.listForOrg(params.orgId as OrgId);
  const install = installs.find((i) => i.connectorSlug === params.connectorSlug);

  if (install) {
    const cred = await credentialRepo.getByInstallId(install.id, params.orgId as OrgId);
    if (cred) {
      const decrypted = Buffer.from(cred.encryptedData, "base64").toString("utf-8");
      credentials = { apiKey: decrypted };
    }
  }

  const result = await executeTool(params.toolName, params.args, {
    orgId: params.orgId,
    runId: params.runId,
    connectorSlug: params.connectorSlug,
    credentials,
  });

  return {
    output: result.output,
    error: result.error,
    latencyMs: result.latencyMs,
  };
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
      toolName: step.toolName,
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
