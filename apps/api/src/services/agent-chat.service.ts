// ---------------------------------------------------------------------------
// Agent Chat Service — Phase 15
// ---------------------------------------------------------------------------

import type {
  OrgId,
  UserId,
  AgentChatSessionId,
  AgentChatProvider,
  Result,
  AuditEmitter,
} from "@sovereign/core";
import { ok, err, AppError, toAgentChatSessionId, toISODateString } from "@sovereign/core";
import type {
  ExecutionProvider,
} from "@sovereign/agents";
import {
  AnthropicExecutionProvider,
  OpenAIExecutionProvider,
  GeminiExecutionProvider,
  DeepSeekExecutionProvider,
  LocalExecutionProvider,
} from "@sovereign/agents";
import crypto from "node:crypto";

interface SendMessageInput {
  orgId: OrgId;
  userId: UserId;
  sessionId?: string;
  provider: AgentChatProvider;
  model: string;
  message: string;
  terminalSessionId?: string;
  terminalContext?: string;
}

interface ChatHistoryEntry {
  role: "user" | "assistant";
  content: string;
  provider: string;
  model: string;
  timestamp: string;
}

interface SendMessageResult {
  sessionId: string;
  response: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

/**
 * Agent chat service that routes messages to configured AI providers.
 * Uses the ExecutionProvider abstraction from @sovereign/agents.
 */
export class AgentChatService {
  private readonly history = new Map<string, ChatHistoryEntry[]>();

  constructor(
    readonly orgId: OrgId,
    private readonly audit: AuditEmitter,
  ) {}

  async sendMessage(input: SendMessageInput): Promise<Result<SendMessageResult>> {
    const sessionId = input.sessionId
      ? toAgentChatSessionId(input.sessionId)
      : toAgentChatSessionId(crypto.randomUUID());

    const provider = this.resolveProvider(input.provider);

    // Build instructions with optional terminal context
    let instructions = "You are a helpful AI coding assistant. Be concise and provide working code.";
    if (input.terminalContext) {
      instructions += `\n\nTerminal context (recent output):\n\`\`\`\n${input.terminalContext}\n\`\`\``;
    }

    const startTime = Date.now();
    const result = await provider.execute({
      instructions,
      modelConfig: {
        provider: input.provider,
        model: input.model,
        temperature: 0.3,
      },
      input: { message: input.message },
      goals: ["Answer the user's question or request"],
      signal: undefined,
    });
    const latencyMs = Date.now() - startTime;

    if (result.error) {
      return err(AppError.internal(result.error.message));
    }

    const response = (result.output.response as string) ?? "";

    // Store in history
    const historyEntries = this.history.get(sessionId) ?? [];
    historyEntries.push(
      {
        role: "user",
        content: input.message,
        provider: input.provider,
        model: input.model,
        timestamp: toISODateString(new Date()),
      },
      {
        role: "assistant",
        content: response,
        provider: input.provider,
        model: input.model,
        timestamp: toISODateString(new Date()),
      },
    );
    this.history.set(sessionId, historyEntries);

    await this.audit.emit({
      orgId: input.orgId,
      action: "agent_chat.message_sent" as never,
      actorType: "user",
      actorId: input.userId,
      resourceType: "agent_chat_session",
      resourceId: sessionId,
      metadata: {
        provider: input.provider,
        model: input.model,
        inputTokens: result.tokenUsage.inputTokens,
        outputTokens: result.tokenUsage.outputTokens,
      },
    });

    return ok({
      sessionId,
      response,
      provider: input.provider,
      model: input.model,
      inputTokens: result.tokenUsage.inputTokens,
      outputTokens: result.tokenUsage.outputTokens,
      latencyMs,
    });
  }

  async getHistory(sessionId: AgentChatSessionId): Promise<Result<ChatHistoryEntry[]>> {
    const entries = this.history.get(sessionId);
    if (!entries) {
      return ok([]);
    }
    return ok(entries);
  }

  private resolveProvider(provider: AgentChatProvider): ExecutionProvider {
    switch (provider) {
      case "anthropic": {
        const key = process.env.ANTHROPIC_API_KEY;
        if (key) return new AnthropicExecutionProvider(key);
        return new LocalExecutionProvider();
      }
      case "openai": {
        const key = process.env.OPENAI_API_KEY;
        if (key) return new OpenAIExecutionProvider(key);
        return new LocalExecutionProvider();
      }
      case "google": {
        const key = process.env.GEMINI_API_KEY;
        if (key) return new GeminiExecutionProvider(key);
        return new LocalExecutionProvider();
      }
      case "deepseek": {
        const key = process.env.DEEPSEEK_API_KEY;
        if (key) return new DeepSeekExecutionProvider(key);
        return new LocalExecutionProvider();
      }
      default:
        return new LocalExecutionProvider();
    }
  }
}
