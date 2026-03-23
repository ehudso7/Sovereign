// ---------------------------------------------------------------------------
// Execution provider abstraction — Phase 5
// ---------------------------------------------------------------------------

/**
 * Token usage metrics from an execution.
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/**
 * Result of a full execution run from a provider.
 */
export interface ExecutionResult {
  output: Record<string, unknown>;
  steps: ExecutionStep[];
  tokenUsage: TokenUsage;
  error?: { code: string; message: string };
}

/**
 * A single step within an execution.
 */
export interface ExecutionStep {
  type: "llm_call" | "system";
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  tokenUsage?: TokenUsage;
  providerMetadata?: Record<string, unknown>;
  latencyMs: number;
}

/**
 * Parameters for executing an agent run.
 */
export interface ExecutionParams {
  instructions: string;
  modelConfig: {
    provider: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
  };
  input: Record<string, unknown>;
  goals: readonly string[];
  signal?: AbortSignal;
}

/**
 * Provider interface — implement this for each AI backend (local, OpenAI, etc.)
 */
export interface ExecutionProvider {
  readonly name: string;
  execute(params: ExecutionParams): Promise<ExecutionResult>;
}
