/**
 * @sovereign/agents
 *
 * Agent definition types, execution context, and lifecycle interfaces
 * for the Sovereign agentic platform.
 */

import type {
  AgentId,
  OrgId,
  UserId,
  ProjectId,
  RunId,
  TenantContext,
  Result,
  AuditFields,
  ISODateString,
} from "@sovereign/core";

// ---------------------------------------------------------------------------
// Re-export core primitives used across agent consumers
// ---------------------------------------------------------------------------

export type {
  AgentId,
  RunId,
} from "@sovereign/core";

// ---------------------------------------------------------------------------
// Agent status / lifecycle
// ---------------------------------------------------------------------------

export type AgentStatus =
  | "draft"
  | "active"
  | "paused"
  | "archived"
  | "error";

export type RunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "timed_out";

// ---------------------------------------------------------------------------
// Tool / capability definitions
// ---------------------------------------------------------------------------

export type ToolParameterType =
  | "string"
  | "number"
  | "boolean"
  | "object"
  | "array";

export interface ToolParameter {
  readonly name: string;
  readonly type: ToolParameterType;
  readonly description: string;
  readonly required: boolean;
  readonly enum?: readonly string[];
}

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: readonly ToolParameter[];
}

export interface ToolCall {
  readonly id: string;
  readonly toolName: string;
  readonly arguments: Record<string, unknown>;
}

export interface ToolResult {
  readonly toolCallId: string;
  readonly ok: boolean;
  readonly output: unknown;
  readonly error?: string;
}

// ---------------------------------------------------------------------------
// Agent model / entity
// ---------------------------------------------------------------------------

export type ModelProvider = "openai" | "anthropic" | "google" | "mistral" | "custom";

export interface ModelConfig {
  readonly provider: ModelProvider;
  /** Provider-specific model identifier, e.g. "gpt-4o", "claude-3-5-sonnet-latest". */
  readonly model: string;
  /** Sampling temperature 0–2. */
  readonly temperature?: number;
  /** Maximum tokens to generate per turn. */
  readonly maxTokens?: number;
  /** Top-p nucleus sampling. */
  readonly topP?: number;
}

export interface Agent extends AuditFields {
  readonly id: AgentId;
  readonly orgId: OrgId;
  readonly projectId?: ProjectId;
  readonly name: string;
  readonly description: string;
  readonly systemPrompt: string;
  readonly modelConfig: ModelConfig;
  readonly tools: readonly ToolDefinition[];
  readonly status: AgentStatus;
  readonly version: number;
  readonly tags: readonly string[];
}

// ---------------------------------------------------------------------------
// Agent run / execution
// ---------------------------------------------------------------------------

export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface Message {
  readonly id: string;
  readonly role: MessageRole;
  readonly content: string;
  readonly toolCalls?: readonly ToolCall[];
  readonly toolResults?: readonly ToolResult[];
  readonly createdAt: ISODateString;
}

export interface AgentRun extends AuditFields {
  readonly id: RunId;
  readonly agentId: AgentId;
  readonly orgId: OrgId;
  readonly initiatedBy: UserId;
  readonly status: RunStatus;
  readonly messages: readonly Message[];
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly startedAt?: ISODateString;
  readonly completedAt?: ISODateString;
  readonly errorMessage?: string;
  readonly metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Execution context – threaded into every agent invocation
// ---------------------------------------------------------------------------

export interface AgentExecutionContext extends TenantContext {
  readonly runId: RunId;
  readonly agentId: AgentId;
  readonly maxTurns: number;
  readonly timeoutMs: number;
  /** Abort signal – used to cancel a running agent. */
  readonly signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Agent service interface
// ---------------------------------------------------------------------------

export interface AgentService {
  get(ctx: TenantContext, id: AgentId): Promise<Result<Agent>>;
  list(ctx: TenantContext): Promise<Result<readonly Agent[]>>;
  create(ctx: TenantContext, input: CreateAgentInput): Promise<Result<Agent>>;
  update(ctx: TenantContext, id: AgentId, input: UpdateAgentInput): Promise<Result<Agent>>;
  delete(ctx: TenantContext, id: AgentId): Promise<Result<void>>;
  run(ctx: AgentExecutionContext, input: RunAgentInput): Promise<Result<AgentRun>>;
}

// ---------------------------------------------------------------------------
// Input / mutation types
// ---------------------------------------------------------------------------

export interface CreateAgentInput {
  readonly name: string;
  readonly description: string;
  readonly systemPrompt: string;
  readonly modelConfig: ModelConfig;
  readonly tools?: readonly ToolDefinition[];
  readonly projectId?: ProjectId;
  readonly tags?: readonly string[];
}

export type UpdateAgentInput = Partial<
  Omit<CreateAgentInput, "projectId">
> & {
  readonly status?: AgentStatus;
};

export interface RunAgentInput {
  readonly messages: readonly Pick<Message, "role" | "content">[];
  readonly metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Execution provider abstraction (Phase 5)
// ---------------------------------------------------------------------------

export type {
  TokenUsage,
  ExecutionResult,
  ExecutionStep,
  ExecutionParams,
  ExecutionProvider,
} from "./execution-provider.js";

export { LocalExecutionProvider } from "./providers/local-provider.js";
export { OpenAIExecutionProvider } from "./providers/openai-provider.js";
