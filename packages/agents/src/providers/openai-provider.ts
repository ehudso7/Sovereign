// ---------------------------------------------------------------------------
// OpenAI execution provider — production provider using chat completions API
// ---------------------------------------------------------------------------

import type {
  ExecutionProvider,
  ExecutionParams,
  ExecutionResult,
  ExecutionStep,
} from "../execution-provider.js";

/**
 * Shape of the OpenAI chat completions response (subset of fields we need).
 */
interface OpenAIChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIErrorResponse {
  error: {
    message: string;
    type: string;
    code: string | null;
  };
}

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";

/**
 * OpenAI execution provider.
 * Calls the OpenAI Chat Completions API using native fetch().
 */
export class OpenAIExecutionProvider implements ExecutionProvider {
  readonly name = "openai" as const;

  constructor(private readonly apiKey: string) {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error("OpenAI API key is required");
    }
  }

  async execute(params: ExecutionParams): Promise<ExecutionResult> {
    const startTime = Date.now();

    const messages: Array<{ role: string; content: string }> = [];

    // Map instructions to system message
    if (params.instructions.length > 0) {
      messages.push({ role: "system", content: params.instructions });
    }

    // If goals are provided, append them to the system context
    if (params.goals.length > 0) {
      messages.push({
        role: "system",
        content: `Goals:\n${params.goals.map((g, i) => `${i + 1}. ${g}`).join("\n")}`,
      });
    }

    // Map input to user message
    const userContent = Object.keys(params.input).length > 0
      ? JSON.stringify(params.input)
      : "Execute the instructions provided.";
    messages.push({ role: "user", content: userContent });

    const requestBody = {
      model: params.modelConfig.model,
      messages,
      temperature: params.modelConfig.temperature ?? 0.7,
      ...(params.modelConfig.maxTokens !== undefined && {
        max_tokens: params.modelConfig.maxTokens,
      }),
    };

    let response: Response;
    try {
      response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: params.signal,
      });
    } catch (fetchError) {
      const latencyMs = Date.now() - startTime;
      const errorMessage = fetchError instanceof Error ? fetchError.message : "Network error";

      const errorStep: ExecutionStep = {
        type: "llm_call",
        input: { messages, model: params.modelConfig.model },
        output: {},
        latencyMs,
        providerMetadata: { provider: "openai", error: errorMessage },
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
      let errorMessage = `OpenAI API returned ${response.status}`;
      let errorCode = `HTTP_${response.status}`;

      try {
        const errorBody = (await response.json()) as OpenAIErrorResponse;
        if (errorBody.error) {
          errorMessage = errorBody.error.message;
          errorCode = errorBody.error.code ?? errorBody.error.type ?? errorCode;
        }
      } catch {
        // Could not parse error body — use default message
      }

      const errorStep: ExecutionStep = {
        type: "llm_call",
        input: { messages, model: params.modelConfig.model },
        output: {},
        latencyMs,
        providerMetadata: {
          provider: "openai",
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

    const data = (await response.json()) as OpenAIChatCompletionResponse;

    const choice = data.choices[0];
    const assistantContent = choice?.message?.content ?? "";

    const inputTokens = data.usage?.prompt_tokens ?? 0;
    const outputTokens = data.usage?.completion_tokens ?? 0;
    const totalTokens = data.usage?.total_tokens ?? inputTokens + outputTokens;

    const step: ExecutionStep = {
      type: "llm_call",
      input: {
        messages,
        model: params.modelConfig.model,
        temperature: params.modelConfig.temperature ?? 0.7,
      },
      output: {
        role: "assistant",
        content: assistantContent,
        finishReason: choice?.finish_reason ?? "unknown",
      },
      tokenUsage: {
        inputTokens,
        outputTokens,
        totalTokens,
      },
      providerMetadata: {
        provider: "openai",
        model: data.model,
        completionId: data.id,
        created: data.created,
      },
      latencyMs,
    };

    return {
      output: {
        response: assistantContent,
        model: data.model,
        finishReason: choice?.finish_reason ?? "unknown",
      },
      steps: [step],
      tokenUsage: {
        inputTokens,
        outputTokens,
        totalTokens,
      },
    };
  }
}
