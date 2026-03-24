// ---------------------------------------------------------------------------
// Temporal activities for run execution
// ---------------------------------------------------------------------------

import { initDb, PgRunRepo, PgRunStepRepo, PgAuditRepo, PgConnectorInstallRepo, PgConnectorCredentialRepo, PgMemoryRepo, PgMemoryLinkRepo, PgPolicyRepo, PgPolicyDecisionRepo, PgApprovalRepo, PgQuarantineRecordRepo } from "@sovereign/db";
import type { OrgId, UserId, ISODateString, MemoryConfig, Memory, PolicyDecisionResult, Policy } from "@sovereign/core";
import { toRunId, toISODateString, decryptSecret } from "@sovereign/core";
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
// Policy enforcement helper — evaluates policy at runtime boundaries
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: Record<string, number> = {
  quarantine: 4,
  deny: 3,
  require_approval: 2,
  allow: 1,
};

export interface PolicyEnforcementInput {
  orgId: string;
  subjectType: string;
  subjectId?: string;
  actionType: string;
  requestedBy?: string;
  context?: Record<string, unknown>;
}

export interface PolicyEnforcementResult {
  decision: PolicyDecisionResult;
  policyId: string | null;
  reason: string;
  policyDecisionId: string;
  approvalId?: string;
}

/**
 * Evaluate policy at a runtime boundary. This is the core enforcement gate
 * that blocks execution when policy dictates deny/quarantine/require_approval.
 */
export async function evaluatePolicyAtBoundary(
  input: PolicyEnforcementInput,
): Promise<PolicyEnforcementResult> {
  const db = getDb();
  const tenantDb = db.forTenant(input.orgId as OrgId);
  const policyRepo = new PgPolicyRepo(tenantDb);
  const decisionRepo = new PgPolicyDecisionRepo(tenantDb);
  const approvalRepo = new PgApprovalRepo(tenantDb);
  const quarantineRepo = new PgQuarantineRecordRepo(tenantDb);
  const auditRepo = new PgAuditRepo(tenantDb);

  // 1. Quarantine check — quarantined subjects are blocked regardless of policy
  if (input.subjectId) {
    const quarantine = await quarantineRepo.getActiveForSubject(
      input.orgId as OrgId,
      input.subjectType,
      input.subjectId,
    );
    if (quarantine) {
      const decision = await decisionRepo.create({
        orgId: input.orgId as OrgId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        actionType: input.actionType,
        result: "quarantined",
        reason: `Subject is quarantined: ${quarantine.reason}`,
        metadata: { quarantineId: quarantine.id, ...input.context },
        requestedBy: input.requestedBy,
      });
      await auditRepo.emit({
        orgId: input.orgId as OrgId,
        actorType: input.requestedBy ? "user" : "system",
        actorId: input.requestedBy as UserId | undefined,
        action: "policy.decision",
        resourceType: input.subjectType,
        resourceId: input.subjectId,
        metadata: { actionType: input.actionType, result: "quarantined", policyDecisionId: decision.id },
      });
      return {
        decision: "quarantined",
        policyId: null,
        reason: `Subject is quarantined: ${quarantine.reason}`,
        policyDecisionId: decision.id,
      };
    }
  }

  // 2. Fetch active policies matching scope + org-wide
  const scopedPolicies = await policyRepo.listForOrg(input.orgId as OrgId, {
    status: "active",
    scopeType: input.subjectType,
  });
  const orgPolicies = await policyRepo.listForOrg(input.orgId as OrgId, {
    status: "active",
    scopeType: "org",
  });
  const allPolicies = [...scopedPolicies, ...orgPolicies].sort(
    (a, b) => b.priority - a.priority,
  );

  // 3. Find the most restrictive matching policy
  let matchedPolicy: Policy | null = null;
  let matchedResult: PolicyDecisionResult = "allow";

  for (const policy of allPolicies) {
    if (policy.scopeId && policy.scopeId !== input.subjectId) continue;

    const rules = policy.rules as Array<{ actionPattern: string }>;
    const matches =
      rules.length === 0 ||
      rules.some((rule) => {
        if (rule.actionPattern === "*") return true;
        if (rule.actionPattern === input.actionType) return true;
        if (rule.actionPattern.endsWith(".*")) {
          const prefix = rule.actionPattern.slice(0, -2);
          return input.actionType.startsWith(prefix + ".");
        }
        return false;
      });

    if (matches) {
      const severity = SEVERITY_ORDER[policy.enforcementMode] ?? 0;
      const currentSeverity = SEVERITY_ORDER[matchedResult] ?? 0;
      if (severity > currentSeverity) {
        matchedResult = policy.enforcementMode as PolicyDecisionResult;
        matchedPolicy = policy;
      }
    }
  }

  // 4. Record decision
  const decision = await decisionRepo.create({
    orgId: input.orgId as OrgId,
    policyId: matchedPolicy?.id,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    actionType: input.actionType,
    result: matchedResult,
    reason: matchedPolicy
      ? `Matched policy "${matchedPolicy.name}" (${matchedPolicy.enforcementMode})`
      : "No matching policy — default allow",
    metadata: input.context ?? {},
    requestedBy: input.requestedBy,
  });

  await auditRepo.emit({
    orgId: input.orgId as OrgId,
    actorType: input.requestedBy ? "user" : "system",
    actorId: input.requestedBy as UserId | undefined,
    action: "policy.decision",
    resourceType: input.subjectType,
    resourceId: input.subjectId,
    metadata: {
      actionType: input.actionType,
      result: matchedResult,
      policyId: matchedPolicy?.id ?? null,
      policyDecisionId: decision.id,
    },
  });

  // 5. Create approval request if require_approval
  let approvalId: string | undefined;
  if (matchedResult === "require_approval" && input.requestedBy) {
    const approval = await approvalRepo.create({
      orgId: input.orgId as OrgId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      actionType: input.actionType,
      requestNote: `Policy "${matchedPolicy?.name}" requires approval for ${input.actionType}`,
      requestedBy: input.requestedBy as UserId,
      policyDecisionId: decision.id,
    });
    approvalId = approval.id;

    await auditRepo.emit({
      orgId: input.orgId as OrgId,
      actorId: input.requestedBy as UserId,
      actorType: "user",
      action: "approval.requested",
      resourceType: "approval",
      resourceId: approval.id,
      metadata: { subjectType: input.subjectType, subjectId: input.subjectId, actionType: input.actionType },
    });
  }

  return {
    decision: matchedResult,
    policyId: matchedPolicy?.id ?? null,
    reason: decision.reason,
    policyDecisionId: decision.id,
    approvalId,
  };
}

// ---------------------------------------------------------------------------
// Activity: Enforce policy before run execution
// ---------------------------------------------------------------------------

export interface EnforceRunPolicyParams {
  runId: string;
  orgId: string;
  agentId: string;
  triggeredBy?: string;
}

export async function enforceRunPolicy(
  params: EnforceRunPolicyParams,
): Promise<PolicyEnforcementResult> {
  return evaluatePolicyAtBoundary({
    orgId: params.orgId,
    subjectType: "run",
    subjectId: params.agentId,
    actionType: "run.execute",
    requestedBy: params.triggeredBy,
    context: { runId: params.runId, agentId: params.agentId },
  });
}

// ---------------------------------------------------------------------------
// Activity: Enforce policy before connector tool use
// ---------------------------------------------------------------------------

export interface EnforceToolPolicyParams {
  runId: string;
  orgId: string;
  connectorSlug: string;
  toolName: string;
  triggeredBy?: string;
}

export async function enforceToolPolicy(
  params: EnforceToolPolicyParams,
): Promise<PolicyEnforcementResult> {
  return evaluatePolicyAtBoundary({
    orgId: params.orgId,
    subjectType: "connector",
    subjectId: params.connectorSlug,
    actionType: "connector.use",
    requestedBy: params.triggeredBy,
    context: { runId: params.runId, toolName: params.toolName },
  });
}

// ---------------------------------------------------------------------------
// Activity: Enforce policy before memory operations
// ---------------------------------------------------------------------------

export interface EnforceMemoryPolicyParams {
  runId: string;
  orgId: string;
  actionType: string; // "memory.read" or "memory.write"
  triggeredBy?: string;
}

export async function enforceMemoryPolicy(
  params: EnforceMemoryPolicyParams,
): Promise<PolicyEnforcementResult> {
  return evaluatePolicyAtBoundary({
    orgId: params.orgId,
    subjectType: "memory",
    actionType: params.actionType,
    requestedBy: params.triggeredBy,
    context: { runId: params.runId },
  });
}

// ---------------------------------------------------------------------------
// Activity: Check approval status (for approval-gated actions)
// ---------------------------------------------------------------------------

export interface CheckApprovalParams {
  orgId: string;
  approvalId: string;
}

export interface CheckApprovalResult {
  status: string;
  decidedBy: string | null;
}

export async function checkApprovalStatus(
  params: CheckApprovalParams,
): Promise<CheckApprovalResult> {
  const db = getDb();
  const tenantDb = db.forTenant(params.orgId as OrgId);
  const approvalRepo = new PgApprovalRepo(tenantDb);

  const approval = await approvalRepo.getById(
    params.approvalId as import("@sovereign/core").ApprovalId,
    params.orgId as OrgId,
  );
  if (!approval) {
    return { status: "not_found", decidedBy: null };
  }

  // Check for expiry
  if (approval.status === "pending" && approval.expiresAt) {
    const expiresAtMs = new Date(approval.expiresAt).getTime();
    if (expiresAtMs < Date.now()) {
      return { status: "expired", decidedBy: null };
    }
  }

  return {
    status: approval.status,
    decidedBy: approval.decidedBy,
  };
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

  // --- Policy enforcement: check connector tool use is allowed ---
  const policyResult = await evaluatePolicyAtBoundary({
    orgId: params.orgId,
    subjectType: "connector",
    subjectId: params.connectorSlug,
    actionType: "connector.use",
    context: { runId: params.runId, toolName: params.toolName },
  });

  if (policyResult.decision === "deny" || policyResult.decision === "quarantined") {
    return {
      output: {},
      error: {
        code: "POLICY_DENIED",
        message: `Tool use blocked by policy: ${policyResult.reason}`,
      },
      latencyMs: 0,
    };
  }

  if (policyResult.decision === "require_approval") {
    return {
      output: {},
      error: {
        code: "APPROVAL_REQUIRED",
        message: `Tool use requires approval: ${policyResult.reason}`,
      },
      latencyMs: 0,
    };
  }

  // --- Credential resolution with audit ---
  const installRepo = new PgConnectorInstallRepo(tenantDb);
  const credentialRepo = new PgConnectorCredentialRepo(tenantDb);
  const auditRepo = new PgAuditRepo(tenantDb);

  let credentials: Record<string, unknown> | undefined;

  // Find the install for this connector
  const installs = await installRepo.listForOrg(params.orgId as OrgId);
  const install = installs.find((i) => i.connectorSlug === params.connectorSlug);

  if (install) {
    const cred = await credentialRepo.getByInstallId(install.id, params.orgId as OrgId);
    if (cred) {
      const decrypted = decryptSecret(cred.encryptedData);
      credentials = { apiKey: decrypted };

      // Audit the secret resolution (never log the actual value)
      await auditRepo.emit({
        orgId: params.orgId as OrgId,
        actorType: "system",
        action: "secret.resolved",
        resourceType: "secret",
        resourceId: install.id,
        metadata: {
          secretType: "connector_credential",
          resolvedFor: params.runId,
          connectorSlug: params.connectorSlug,
        },
      });
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
  const auditRepo = new PgAuditRepo(tenantDb);

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

    // Emit run.tool_used audit event for tool_call steps
    if (step.type === "tool_call") {
      await auditRepo.emit({
        orgId: params.orgId as OrgId,
        actorType: "system",
        action: "run.tool_used",
        resourceType: "run",
        resourceId: params.runId,
        metadata: {
          toolName: step.toolName ?? "unknown",
          connectorSlug: (step.providerMetadata as Record<string, unknown>)?.connectorSlug ?? "unknown",
          stepNumber: i + 1,
        },
      });
    }
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

// ---------------------------------------------------------------------------
// Activity: Retrieve memories for a run (Phase 8)
// ---------------------------------------------------------------------------

export interface RetrieveMemoriesParams {
  runId: string;
  orgId: string;
  agentId: string;
  memoryConfig: MemoryConfig | null;
}

export interface RetrieveMemoriesResult {
  memories: Array<{ id: string; kind: string; title: string; summary: string; content: string }>;
  count: number;
}

export async function retrieveMemories(params: RetrieveMemoriesParams): Promise<RetrieveMemoriesResult> {
  if (!params.memoryConfig || params.memoryConfig.mode === "none") {
    return { memories: [], count: 0 };
  }

  if (params.memoryConfig.readEnabled === false) {
    return { memories: [], count: 0 };
  }

  // --- Policy enforcement: check memory read is allowed ---
  const policyResult = await evaluatePolicyAtBoundary({
    orgId: params.orgId,
    subjectType: "memory",
    actionType: "memory.read",
    context: { runId: params.runId, agentId: params.agentId },
  });

  if (policyResult.decision === "deny" || policyResult.decision === "quarantined") {
    return { memories: [], count: 0 };
  }

  if (policyResult.decision === "require_approval") {
    // Memory read blocked pending approval — silently skip
    return { memories: [], count: 0 };
  }

  const db = getDb();
  const tenantDb = db.forTenant(params.orgId as OrgId);
  const memoryRepo = new PgMemoryRepo(tenantDb);
  const auditRepo = new PgAuditRepo(tenantDb);

  const maxResults = params.memoryConfig.maxRetrievalCount ?? 10;
  const scopeType = (params.memoryConfig.allowedScopes && params.memoryConfig.allowedScopes.length > 0)
    ? params.memoryConfig.allowedScopes[0]
    : "agent";

  const allMemories = await memoryRepo.listForOrg(params.orgId as OrgId, {
    scopeType,
    scopeId: params.agentId,
    status: "active",
  });

  // Filter by allowed kinds
  const allowedKinds = params.memoryConfig.allowedKinds ?? params.memoryConfig.lanes;
  let filtered: Memory[] = allMemories;
  if (allowedKinds && allowedKinds.length > 0) {
    const kindSet = new Set(allowedKinds);
    filtered = allMemories.filter((m) => kindSet.has(m.kind));
  }

  const result = filtered.slice(0, maxResults);

  if (result.length > 0) {
    await auditRepo.emit({
      orgId: params.orgId as OrgId,
      actorType: "system",
      action: "memory.retrieved_for_run",
      resourceType: "memory",
      resourceId: params.runId,
      metadata: { count: result.length, runId: params.runId, agentId: params.agentId },
    });
  }

  return {
    memories: result.map((m) => ({
      id: m.id,
      kind: m.kind,
      title: m.title,
      summary: m.summary,
      content: m.content,
    })),
    count: result.length,
  };
}

// ---------------------------------------------------------------------------
// Activity: Write episodic memory from run outcome (Phase 8)
// ---------------------------------------------------------------------------

export interface WriteEpisodicMemoryParams {
  runId: string;
  orgId: string;
  agentId: string;
  triggeredBy: string;
  memoryConfig: MemoryConfig | null;
  runOutput: Record<string, unknown>;
}

export async function writeEpisodicMemory(params: WriteEpisodicMemoryParams): Promise<void> {
  if (!params.memoryConfig || params.memoryConfig.mode === "none") return;
  if (params.memoryConfig.writeEnabled === false) return;
  if (params.memoryConfig.autoWriteEpisodic === false) return;

  // --- Policy enforcement: check memory write is allowed ---
  const policyResult = await evaluatePolicyAtBoundary({
    orgId: params.orgId,
    subjectType: "memory",
    actionType: "memory.write",
    context: { runId: params.runId, agentId: params.agentId },
  });

  if (policyResult.decision !== "allow") {
    // Memory write blocked by policy — silently skip (non-critical path)
    return;
  }

  const db = getDb();
  const tenantDb = db.forTenant(params.orgId as OrgId);
  const memoryRepo = new PgMemoryRepo(tenantDb);
  const memoryLinkRepo = new PgMemoryLinkRepo(tenantDb);
  const auditRepo = new PgAuditRepo(tenantDb);

  const summary = `Run completed for agent ${params.agentId.slice(0, 8)}`;
  const content = JSON.stringify(params.runOutput, null, 2).slice(0, 10000);

  try {
    const memory = await memoryRepo.create({
      orgId: params.orgId as OrgId,
      scopeType: "agent",
      scopeId: params.agentId,
      kind: "episodic",
      title: `Run ${params.runId.slice(0, 8)} episode`,
      summary,
      content,
      sourceRunId: params.runId,
      sourceAgentId: params.agentId,
      createdBy: params.triggeredBy as import("@sovereign/core").UserId,
    });

    await memoryLinkRepo.create({
      orgId: params.orgId as OrgId,
      memoryId: memory.id,
      linkedEntityType: "run",
      linkedEntityId: params.runId,
      linkType: "source_run",
      metadata: { agentId: params.agentId },
    });

    await auditRepo.emit({
      orgId: params.orgId as OrgId,
      actorType: "system",
      action: "memory.created",
      resourceType: "memory",
      resourceId: memory.id,
      metadata: { kind: "episodic", sourceRunId: params.runId },
    });
  } catch {
    // Memory write failure should not fail the run
  }
}
