// ---------------------------------------------------------------------------
// OpenAI execution provider — production provider using Responses API
// ---------------------------------------------------------------------------

import type {
  ExecutionProvider,
  ExecutionParams,
  ExecutionResult,
  ExecutionStep,
} from "../execution-provider.js";

/**
 * Shape of the OpenAI Responses API response (subset of fields we need).
 * See: https://platform.openai.com/docs/api-reference/responses
 */
interface OpenAIResponseOutput {
  type: string;
  text?: string;
  content?: Array<{ type: string; text?: string }>;
}

interface OpenAIResponsesResponse {
  id: string;
  object: string;
  created_at: number;
  model: string;
  status: string;
  output: OpenAIResponseOutput[];
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  error?: {
    code: string;
    message: string;
  } | null;
}

interface OpenAIErrorResponse {
  error: {
    message: string;
    type: string;
    code: string | null;
  };
}

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

/**
 * OpenAI execution provider.
 * Calls the OpenAI Responses API using native fetch().
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

    // Build the input string for the Responses API
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
      instructions: params.instructions.length > 0 ? params.instructions : undefined,
      input: inputParts.join("\n\n"),
      temperature: params.modelConfig.temperature ?? 0.7,
      ...(params.modelConfig.maxTokens !== undefined && {
        max_output_tokens: params.modelConfig.maxTokens,
      }),
    };

    let response: Response;
    try {
      response = await fetch(OPENAI_RESPONSES_URL, {
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
        input: { model: params.modelConfig.model, instructions: params.instructions },
        output: {},
        latencyMs,
        providerMetadata: { provider: "openai", api: "responses", error: errorMessage },
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
        input: { model: params.modelConfig.model, instructions: params.instructions },
        output: {},
        latencyMs,
        providerMetadata: {
          provider: "openai",
          api: "responses",
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

    const data = (await response.json()) as OpenAIResponsesResponse;

    // Extract text from the Responses API output array
    let assistantContent = "";
    for (const item of data.output) {
      if (item.type === "message" && item.content) {
        for (const part of item.content) {
          if (part.type === "output_text" && part.text) {
            assistantContent += part.text;
          }
        }
      }
    }

    const inputTokens = data.usage?.input_tokens ?? 0;
    const outputTokens = data.usage?.output_tokens ?? 0;
    const totalTokens = data.usage?.total_tokens ?? inputTokens + outputTokens;

    const step: ExecutionStep = {
      type: "llm_call",
      input: {
        model: params.modelConfig.model,
        instructions: params.instructions,
        temperature: params.modelConfig.temperature ?? 0.7,
      },
      output: {
        role: "assistant",
        content: assistantContent,
        status: data.status,
      },
      tokenUsage: {
        inputTokens,
        outputTokens,
        totalTokens,
      },
      providerMetadata: {
        provider: "openai",
        api: "responses",
        model: data.model,
        responseId: data.id,
        createdAt: data.created_at,
      },
      latencyMs,
    };

    return {
      output: {
        response: assistantContent,
        model: data.model,
        status: data.status,
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
