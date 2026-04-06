// ---------------------------------------------------------------------------
// Google Gemini execution provider — Gemini API
// ---------------------------------------------------------------------------

import type {
  ExecutionProvider,
  ExecutionParams,
  ExecutionResult,
  ExecutionStep,
} from "../execution-provider.js";

interface GeminiCandidate {
  content: {
    parts: Array<{ text?: string }>;
    role: string;
  };
  finishReason: string;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Google Gemini execution provider.
 * Calls the Gemini API using native fetch().
 */
export class GeminiExecutionProvider implements ExecutionProvider {
  readonly name = "google" as const;

  constructor(private readonly apiKey: string) {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error("Gemini API key is required");
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

    const model = params.modelConfig.model || "gemini-2.0-flash";
    const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${this.apiKey}`;

    const requestBody: Record<string, unknown> = {
      contents: [
        {
          role: "user",
          parts: [{ text: inputParts.join("\n\n") }],
        },
      ],
      ...(params.instructions.length > 0 && {
        systemInstruction: {
          parts: [{ text: params.instructions }],
        },
      }),
      generationConfig: {
        ...(params.modelConfig.temperature !== undefined && {
          temperature: params.modelConfig.temperature,
        }),
        ...(params.modelConfig.maxTokens !== undefined && {
          maxOutputTokens: params.modelConfig.maxTokens,
        }),
      },
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        providerMetadata: { provider: "google", api: "gemini", error: errorMessage },
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
      let errorMessage = `Gemini API returned ${response.status}`;
      let errorCode = `HTTP_${response.status}`;

      try {
        const errorBody = (await response.json()) as GeminiResponse;
        if (errorBody.error) {
          errorMessage = errorBody.error.message;
          errorCode = errorBody.error.status ?? errorCode;
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
          provider: "google",
          api: "gemini",
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

    const data = (await response.json()) as GeminiResponse;

    let assistantContent = "";
    let finishReason = "UNKNOWN";
    const firstCandidate = data.candidates?.[0];
    if (firstCandidate) {
      finishReason = firstCandidate.finishReason;
      for (const part of firstCandidate.content.parts) {
        if (part.text) {
          assistantContent += part.text;
        }
      }
    }

    const inputTokens = data.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = data.usageMetadata?.candidatesTokenCount ?? 0;
    const totalTokens = data.usageMetadata?.totalTokenCount ?? inputTokens + outputTokens;

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
        provider: "google",
        api: "gemini",
        model,
      },
      latencyMs,
    };

    return {
      output: {
        response: assistantContent,
        model,
        finishReason,
      },
      steps: [step],
      tokenUsage: { inputTokens, outputTokens, totalTokens },
    };
  }
}
