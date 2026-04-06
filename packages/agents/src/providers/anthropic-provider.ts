// ---------------------------------------------------------------------------
// Anthropic Claude execution provider — Messages API
// ---------------------------------------------------------------------------

import type {
  ExecutionProvider,
  ExecutionParams,
  ExecutionResult,
  ExecutionStep,
} from "../execution-provider.js";

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

interface AnthropicMessagesResponse {
  id: string;
  type: string;
  role: string;
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface AnthropicErrorResponse {
  type: "error";
  error: {
    type: string;
    message: string;
  };
}

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_API_VERSION = "2023-06-01";

/**
 * Anthropic Claude execution provider.
 * Calls the Anthropic Messages API using native fetch().
 */
export class AnthropicExecutionProvider implements ExecutionProvider {
  readonly name = "anthropic" as const;

  constructor(private readonly apiKey: string) {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error("Anthropic API key is required");
    }
  }

  async execute(params: ExecutionParams): Promise<ExecutionResult> {
    const startTime = Date.now();

    const inputParts: string[] = [];
    if (params.goals.length > 0) {
      inputParts.push(`Goals:\n${params.goals.map((g, i) => `${i + 1}. ${g}`).join("\n")}`);
    }
    const userContent = Object.keys(params.input).length > 0
      ? JSON.stringify(params.input)
      : "Execute the instructions provided.";
    inputParts.push(userContent);

    const requestBody: Record<string, unknown> = {
      model: params.modelConfig.model,
      max_tokens: params.modelConfig.maxTokens ?? 4096,
      messages: [
        { role: "user", content: inputParts.join("\n\n") },
      ],
      ...(params.instructions.length > 0 && { system: params.instructions }),
      ...(params.modelConfig.temperature !== undefined && {
        temperature: params.modelConfig.temperature,
      }),
    };

    let response: Response;
    try {
      response = await fetch(ANTHROPIC_MESSAGES_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": ANTHROPIC_API_VERSION,
        },
        body: JSON.stringify(requestBody),
        signal: params.signal,
      });
    } catch (fetchError) {
      const latencyMs = Date.now() - startTime;
      const errorMessage = fetchError instanceof Error ? fetchError.message : "Network error";

      const errorStep: ExecutionStep = {
        type: "llm_call",
        input: { model: params.modelConfig.model, instructions: params.instructions },
        output: {},
        latencyMs,
        providerMetadata: { provider: "anthropic", api: "messages", error: errorMessage },
      };

      return {
        output: {},
        steps: [errorStep],
        tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        error: { code: "NETWORK_ERROR", message: errorMessage },
      };
    }

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      let errorMessage = `Anthropic API returned ${response.status}`;
      let errorCode = `HTTP_${response.status}`;

      try {
        const errorBody = (await response.json()) as AnthropicErrorResponse;
        if (errorBody.error) {
          errorMessage = errorBody.error.message;
          errorCode = errorBody.error.type ?? errorCode;
        }
      } catch {
        // Could not parse error body
      }

      const errorStep: ExecutionStep = {
        type: "llm_call",
        input: { model: params.modelConfig.model, instructions: params.instructions },
        output: {},
        latencyMs,
        providerMetadata: {
          provider: "anthropic",
          api: "messages",
          statusCode: response.status,
          error: errorMessage,
        },
      };

      return {
        output: {},
        steps: [errorStep],
        tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        error: { code: errorCode, message: errorMessage },
      };
    }

    const data = (await response.json()) as AnthropicMessagesResponse;

    let assistantContent = "";
    for (const block of data.content) {
      if (block.type === "text" && block.text) {
        assistantContent += block.text;
      }
    }

    const inputTokens = data.usage.input_tokens;
    const outputTokens = data.usage.output_tokens;
    const totalTokens = inputTokens + outputTokens;

    const step: ExecutionStep = {
      type: "llm_call",
      input: {
        model: params.modelConfig.model,
        instructions: params.instructions,
        temperature: params.modelConfig.temperature,
      },
      output: {
        role: "assistant",
        content: assistantContent,
        stopReason: data.stop_reason,
      },
      tokenUsage: { inputTokens, outputTokens, totalTokens },
      providerMetadata: {
        provider: "anthropic",
        api: "messages",
        model: data.model,
        responseId: data.id,
      },
      latencyMs,
    };

    return {
      output: {
        response: assistantContent,
        model: data.model,
        stopReason: data.stop_reason,
      },
      steps: [step],
      tokenUsage: { inputTokens, outputTokens, totalTokens },
    };
  }
}
