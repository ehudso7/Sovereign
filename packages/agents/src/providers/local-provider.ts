// ---------------------------------------------------------------------------
// Local execution provider — deterministic mock for dev and CI
// ---------------------------------------------------------------------------

import type {
  ExecutionProvider,
  ExecutionParams,
  ExecutionResult,
  ExecutionStep,
} from "../execution-provider.js";

/**
 * Local execution provider that returns deterministic output.
 * Used for local development and CI — does NOT call any external services.
 */
export class LocalExecutionProvider implements ExecutionProvider {
  readonly name = "local" as const;

  async execute(params: ExecutionParams): Promise<ExecutionResult> {
    const startTime = Date.now();

    // Build a deterministic response based on the input
    const inputSummary = Object.keys(params.input).length > 0
      ? Object.entries(params.input)
          .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
          .join(", ")
      : "no input";

    const goalsSummary = params.goals.length > 0
      ? params.goals.join("; ")
      : "no goals specified";

    const responseText = `Local provider processed request. Instructions length: ${params.instructions.length}. Input: ${inputSummary}. Goals: ${goalsSummary}.`;

    // Simulate deterministic token counts based on input size
    const instructionTokens = Math.ceil(params.instructions.length / 4);
    const inputTokens = Math.ceil(JSON.stringify(params.input).length / 4);
    const outputTokens = Math.ceil(responseText.length / 4);

    const stepLatencyMs = Date.now() - startTime;

    const step: ExecutionStep = {
      type: "llm_call",
      input: {
        messages: [
          { role: "system", content: params.instructions },
          { role: "user", content: JSON.stringify(params.input) },
        ],
        model: params.modelConfig.model,
        temperature: params.modelConfig.temperature ?? 0.7,
      },
      output: {
        role: "assistant",
        content: responseText,
      },
      tokenUsage: {
        inputTokens: instructionTokens + inputTokens,
        outputTokens,
        totalTokens: instructionTokens + inputTokens + outputTokens,
      },
      providerMetadata: {
        provider: "local",
        model: params.modelConfig.model,
        simulated: true,
      },
      latencyMs: stepLatencyMs,
    };

    const totalInputTokens = instructionTokens + inputTokens;
    const totalOutputTokens = outputTokens;

    return {
      output: {
        response: responseText,
        model: params.modelConfig.model,
        provider: "local",
      },
      steps: [step],
      tokenUsage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
      },
    };
  }
}
