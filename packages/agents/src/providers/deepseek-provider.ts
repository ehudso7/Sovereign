// ---------------------------------------------------------------------------
// DeepSeek execution provider — Chat Completions API (OpenAI-compatible)
// ---------------------------------------------------------------------------

import type {
  ExecutionProvider,
  ExecutionParams,
  ExecutionResult,
  ExecutionStep,
} from "../execution-provider.js";

interface DeepSeekChoice {
  index: number;
  message: {
    role: string;
    content: string | null;
  };
  finish_reason: string | null;
}

interface DeepSeekResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: DeepSeekChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface DeepSeekErrorResponse {
  error: {
    message: string;
    type: string;
    code: string | null;
  };
}

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

/**
 * DeepSeek execution provider.
 * Uses the DeepSeek Chat API (OpenAI-compatible format).
 */
export class DeepSeekExecutionProvider implements ExecutionProvider {
  readonly name = "deepseek" as const;

  constructor(private readonly apiKey: string) {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error("DeepSeek API key is required");
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

    const messages: Array<{ role: string; content: string }> = [];
    if (params.instructions.length > 0) {
      messages.push({ role: "system", content: params.instructions });
    }
    messages.push({ role: "user", content: inputParts.join("\n\n") });

    const model = params.modelConfig.model || "deepseek-chat";

    const requestBody: Record<string, unknown> = {
      model,
      messages,
      ...(params.modelConfig.temperature !== undefined && {
        temperature: params.modelConfig.temperature,
      }),
      ...(params.modelConfig.maxTokens !== undefined && {
        max_tokens: params.modelConfig.maxTokens,
      }),
    };

    let response: Response;
    try {
      response = await fetch(DEEPSEEK_API_URL, {
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
        input: { model, instructions: params.instructions },
        output: {},
        latencyMs,
        providerMetadata: { provider: "deepseek", api: "chat", error: errorMessage },
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
      let errorMessage = `DeepSeek API returned ${response.status}`;
      let errorCode = `HTTP_${response.status}`;

      try {
        const errorBody = (await response.json()) as DeepSeekErrorResponse;
        if (errorBody.error) {
          errorMessage = errorBody.error.message;
          errorCode = errorBody.error.code ?? errorBody.error.type ?? errorCode;
        }
      } catch {
        // Could not parse error body
      }

      const errorStep: ExecutionStep = {
        type: "llm_call",
        input: { model, instructions: params.instructions },
        output: {},
        latencyMs,
        providerMetadata: {
          provider: "deepseek",
          api: "chat",
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

    const data = (await response.json()) as DeepSeekResponse;

    let assistantContent = "";
    let finishReason = "unknown";
    const firstChoice = data.choices[0];
    if (data.choices.length > 0 && firstChoice) {
      assistantContent = firstChoice.message.content ?? "";
      finishReason = firstChoice.finish_reason ?? "unknown";
    }

    const inputTokens = data.usage?.prompt_tokens ?? 0;
    const outputTokens = data.usage?.completion_tokens ?? 0;
    const totalTokens = data.usage?.total_tokens ?? inputTokens + outputTokens;

    const step: ExecutionStep = {
      type: "llm_call",
      input: {
        model,
        instructions: params.instructions,
        temperature: params.modelConfig.temperature,
      },
      output: {
        role: "assistant",
        content: assistantContent,
        finishReason,
      },
      tokenUsage: { inputTokens, outputTokens, totalTokens },
      providerMetadata: {
        provider: "deepseek",
        api: "chat",
        model: data.model,
        responseId: data.id,
        createdAt: data.created,
      },
      latencyMs,
    };

    return {
      output: {
        response: assistantContent,
        model: data.model,
        finishReason,
      },
      steps: [step],
      tokenUsage: { inputTokens, outputTokens, totalTokens },
    };
  }
}
