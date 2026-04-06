// ---------------------------------------------------------------------------
// Execution providers — unit tests (Phase 15d polish & hardening)
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, afterEach } from "vitest";

import type { ExecutionParams } from "../execution-provider.js";
import { AnthropicExecutionProvider } from "../providers/anthropic-provider.js";
import { GeminiExecutionProvider } from "../providers/gemini-provider.js";
import { DeepSeekExecutionProvider } from "../providers/deepseek-provider.js";
import { OpenAIExecutionProvider } from "../providers/openai-provider.js";
import { LocalExecutionProvider } from "../providers/local-provider.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeParams(overrides?: Partial<ExecutionParams>): ExecutionParams {
  return {
    instructions: "You are a helpful assistant.",
    modelConfig: {
      provider: "test",
      model: "test-model",
      temperature: 0.5,
      maxTokens: 256,
    },
    input: { query: "hello" },
    goals: ["Respond helpfully"],
    ...overrides,
  };
}

/** Save the original global fetch so we can restore it. */
const originalFetch = globalThis.fetch;

afterEach(() => {
  vi.restoreAllMocks();
  globalThis.fetch = originalFetch;
});

// ═══════════════════════════════════════════════════════════════════════════
// Anthropic
// ═══════════════════════════════════════════════════════════════════════════

describe("AnthropicExecutionProvider", () => {
  it("throws on empty API key", () => {
    expect(() => new AnthropicExecutionProvider("")).toThrow(
      "Anthropic API key is required",
    );
  });

  it("throws on whitespace-only API key", () => {
    expect(() => new AnthropicExecutionProvider("   ")).toThrow(
      "Anthropic API key is required",
    );
  });

  it("returns NETWORK_ERROR when fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Connection refused")),
    );
    const provider = new AnthropicExecutionProvider("sk-test-key");
    const result = await provider.execute(makeParams());

    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe("NETWORK_ERROR");
    expect(result.error?.message).toBe("Connection refused");
    expect(result.tokenUsage.totalTokens).toBe(0);
    expect(result.steps).toHaveLength(1);
  });

  it("returns error on HTTP 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({
            type: "error",
            error: { type: "authentication_error", message: "Invalid API key" },
          }),
      }),
    );
    const provider = new AnthropicExecutionProvider("sk-bad-key");
    const result = await provider.execute(makeParams());

    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe("authentication_error");
    expect(result.error?.message).toBe("Invalid API key");
  });

  it("parses a successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            id: "msg_123",
            type: "message",
            role: "assistant",
            content: [{ type: "text", text: "Hello from Claude!" }],
            model: "claude-sonnet-4-20250514",
            stop_reason: "end_turn",
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
      }),
    );
    const provider = new AnthropicExecutionProvider("sk-real-key");
    const result = await provider.execute(makeParams());

    expect(result.error).toBeUndefined();
    expect(result.output).toHaveProperty("response", "Hello from Claude!");
    expect(result.tokenUsage.inputTokens).toBe(10);
    expect(result.tokenUsage.outputTokens).toBe(5);
    expect(result.tokenUsage.totalTokens).toBe(15);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]?.type).toBe("llm_call");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Gemini
// ═══════════════════════════════════════════════════════════════════════════

describe("GeminiExecutionProvider", () => {
  it("throws on empty API key", () => {
    expect(() => new GeminiExecutionProvider("")).toThrow(
      "Gemini API key is required",
    );
  });

  it("throws on whitespace-only API key", () => {
    expect(() => new GeminiExecutionProvider("  ")).toThrow(
      "Gemini API key is required",
    );
  });

  it("returns NETWORK_ERROR when fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("DNS resolution failed")),
    );
    const provider = new GeminiExecutionProvider("gemini-key");
    const result = await provider.execute(makeParams());

    expect(result.error?.code).toBe("NETWORK_ERROR");
    expect(result.error?.message).toBe("DNS resolution failed");
    expect(result.tokenUsage.totalTokens).toBe(0);
  });

  it("returns error on HTTP 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({
            error: { code: 401, message: "API key not valid", status: "UNAUTHENTICATED" },
          }),
      }),
    );
    const provider = new GeminiExecutionProvider("bad-gemini-key");
    const result = await provider.execute(makeParams());

    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe("UNAUTHENTICATED");
    expect(result.error?.message).toBe("API key not valid");
  });

  it("parses a successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ text: "Hello from Gemini!" }],
                  role: "model",
                },
                finishReason: "STOP",
              },
            ],
            usageMetadata: {
              promptTokenCount: 12,
              candidatesTokenCount: 8,
              totalTokenCount: 20,
            },
          }),
      }),
    );
    const provider = new GeminiExecutionProvider("valid-gemini-key");
    const result = await provider.execute(makeParams());

    expect(result.error).toBeUndefined();
    expect(result.output).toHaveProperty("response", "Hello from Gemini!");
    expect(result.tokenUsage.inputTokens).toBe(12);
    expect(result.tokenUsage.outputTokens).toBe(8);
    expect(result.tokenUsage.totalTokens).toBe(20);
    expect(result.steps).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DeepSeek
// ═══════════════════════════════════════════════════════════════════════════

describe("DeepSeekExecutionProvider", () => {
  it("throws on empty API key", () => {
    expect(() => new DeepSeekExecutionProvider("")).toThrow(
      "DeepSeek API key is required",
    );
  });

  it("throws on whitespace-only API key", () => {
    expect(() => new DeepSeekExecutionProvider("\t")).toThrow(
      "DeepSeek API key is required",
    );
  });

  it("returns NETWORK_ERROR when fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("socket hang up")),
    );
    const provider = new DeepSeekExecutionProvider("ds-key");
    const result = await provider.execute(makeParams());

    expect(result.error?.code).toBe("NETWORK_ERROR");
    expect(result.error?.message).toBe("socket hang up");
  });

  it("returns error on HTTP 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({
            error: {
              message: "Incorrect API key provided",
              type: "authentication_error",
              code: "invalid_api_key",
            },
          }),
      }),
    );
    const provider = new DeepSeekExecutionProvider("bad-ds-key");
    const result = await provider.execute(makeParams());

    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe("invalid_api_key");
    expect(result.error?.message).toBe("Incorrect API key provided");
  });

  it("parses a successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            id: "chatcmpl-abc",
            object: "chat.completion",
            created: 1700000000,
            model: "deepseek-chat",
            choices: [
              {
                index: 0,
                message: { role: "assistant", content: "Hello from DeepSeek!" },
                finish_reason: "stop",
              },
            ],
            usage: { prompt_tokens: 15, completion_tokens: 6, total_tokens: 21 },
          }),
      }),
    );
    const provider = new DeepSeekExecutionProvider("valid-ds-key");
    const result = await provider.execute(makeParams());

    expect(result.error).toBeUndefined();
    expect(result.output).toHaveProperty("response", "Hello from DeepSeek!");
    expect(result.tokenUsage.inputTokens).toBe(15);
    expect(result.tokenUsage.outputTokens).toBe(6);
    expect(result.tokenUsage.totalTokens).toBe(21);
    expect(result.steps[0]?.providerMetadata?.["provider"]).toBe("deepseek");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// OpenAI
// ═══════════════════════════════════════════════════════════════════════════

describe("OpenAIExecutionProvider", () => {
  it("throws on empty API key", () => {
    expect(() => new OpenAIExecutionProvider("")).toThrow(
      "OpenAI API key is required",
    );
  });

  it("throws on whitespace-only API key", () => {
    expect(() => new OpenAIExecutionProvider("  ")).toThrow(
      "OpenAI API key is required",
    );
  });

  it("returns NETWORK_ERROR when fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("ECONNRESET")),
    );
    const provider = new OpenAIExecutionProvider("sk-oai-key");
    const result = await provider.execute(makeParams());

    expect(result.error?.code).toBe("NETWORK_ERROR");
    expect(result.error?.message).toBe("ECONNRESET");
    expect(result.tokenUsage.totalTokens).toBe(0);
  });

  it("returns error on HTTP 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({
            error: {
              message: "Incorrect API key provided",
              type: "invalid_request_error",
              code: "invalid_api_key",
            },
          }),
      }),
    );
    const provider = new OpenAIExecutionProvider("sk-bad-oai");
    const result = await provider.execute(makeParams());

    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe("invalid_api_key");
    expect(result.error?.message).toBe("Incorrect API key provided");
  });

  it("parses a successful Responses API response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            id: "resp_abc123",
            object: "response",
            created_at: 1700000000,
            model: "gpt-4o",
            status: "completed",
            output: [
              {
                type: "message",
                content: [{ type: "output_text", text: "Hello from OpenAI!" }],
              },
            ],
            usage: { input_tokens: 20, output_tokens: 10, total_tokens: 30 },
          }),
      }),
    );
    const provider = new OpenAIExecutionProvider("sk-valid-oai");
    const result = await provider.execute(makeParams());

    expect(result.error).toBeUndefined();
    expect(result.output).toHaveProperty("response", "Hello from OpenAI!");
    expect(result.tokenUsage.inputTokens).toBe(20);
    expect(result.tokenUsage.outputTokens).toBe(10);
    expect(result.tokenUsage.totalTokens).toBe(30);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]?.providerMetadata?.["provider"]).toBe("openai");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Local
// ═══════════════════════════════════════════════════════════════════════════

describe("LocalExecutionProvider", () => {
  it("returns deterministic output containing input summary", async () => {
    const provider = new LocalExecutionProvider();
    const params = makeParams({ input: { foo: "bar" } });
    const result = await provider.execute(params);

    expect(result.error).toBeUndefined();
    const response = result.output["response"] as string;
    expect(response).toContain("Local provider processed request");
    expect(response).toContain('foo="bar"');
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]?.providerMetadata?.["simulated"]).toBe(true);
  });

  it("returns deterministic output with no input", async () => {
    const provider = new LocalExecutionProvider();
    const params = makeParams({ input: {} });
    const result = await provider.execute(params);

    const response = result.output["response"] as string;
    expect(response).toContain("no input");
  });

  it("includes goals in the response text", async () => {
    const provider = new LocalExecutionProvider();
    const params = makeParams({ goals: ["goal-alpha", "goal-beta"] });
    const result = await provider.execute(params);

    const response = result.output["response"] as string;
    expect(response).toContain("goal-alpha; goal-beta");
  });

  it("calculates token usage based on input/output size", async () => {
    const provider = new LocalExecutionProvider();
    const params = makeParams({ instructions: "a".repeat(100) });
    const result = await provider.execute(params);

    // instructionTokens = ceil(100 / 4) = 25
    expect(result.tokenUsage.inputTokens).toBeGreaterThanOrEqual(25);
    expect(result.tokenUsage.outputTokens).toBeGreaterThan(0);
    expect(result.tokenUsage.totalTokens).toBe(
      result.tokenUsage.inputTokens + result.tokenUsage.outputTokens,
    );
  });

  it("has provider name set to local", () => {
    const provider = new LocalExecutionProvider();
    expect(provider.name).toBe("local");
  });
});
