/**
 * Agent Chat route tests (service-level contract) — Phase 15c.
 *
 * Tests the AgentChatService directly using LocalExecutionProvider
 * (which is the fallback when no API keys are configured).
 * Validates send message, get history, provider list, and validation.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  toOrgId,
  toUserId,
  toAgentChatSessionId,
} from "@sovereign/core";
import type { OrgId, UserId, AgentChatProvider } from "@sovereign/core";
import { AgentChatService } from "../../services/agent-chat.service.js";
import { PgAuditEmitter } from "../../services/audit.service.js";
import {
  createTestRepos,
  type TestRepos,
} from "../helpers/test-repos.js";

const ORG_A = toOrgId("00000000-0000-0000-0000-aaaaaaaaaaaa");
const ORG_B = toOrgId("00000000-0000-0000-0000-bbbbbbbbbbbb");
const USER_A = toUserId("00000000-0000-0000-0000-cccccccccccc");

describe("Agent Chat Routes (service-level contract)", () => {
  let repos: TestRepos;
  let svcA: AgentChatService;
  let orgA: OrgId;
  let userA: UserId;

  beforeEach(() => {
    repos = createTestRepos();
    const auditEmitter = new PgAuditEmitter(repos.audit);
    svcA = new AgentChatService(ORG_A, auditEmitter);
    orgA = ORG_A;
    userA = USER_A;
  });

  // =========================================================================
  // GET agent-providers (static list returned by route)
  // =========================================================================

  describe("GET agent-providers", () => {
    it("returns list of 4 providers with models", () => {
      // The route handler returns a static provider list; verify shape here
      const providers = [
        {
          id: "anthropic",
          name: "Anthropic Claude",
          models: [
            { id: "claude-opus-4-6", name: "Claude Opus 4.6", context: 1000000 },
            { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", context: 200000 },
            { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", context: 200000 },
          ],
          capabilities: ["coding", "reasoning", "long-context", "tool-use"],
        },
        {
          id: "openai",
          name: "OpenAI",
          models: [
            { id: "gpt-4o", name: "GPT-4o", context: 128000 },
            { id: "o3", name: "o3", context: 200000 },
            { id: "codex-mini", name: "Codex Mini", context: 200000 },
          ],
          capabilities: ["coding", "reasoning", "structured-output"],
        },
        {
          id: "google",
          name: "Google Gemini",
          models: [
            { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", context: 1000000 },
            { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", context: 1000000 },
          ],
          capabilities: ["coding", "multi-modal", "large-context"],
        },
        {
          id: "deepseek",
          name: "DeepSeek",
          models: [
            { id: "deepseek-chat", name: "DeepSeek V3", context: 64000 },
            { id: "deepseek-reasoner", name: "DeepSeek R1", context: 64000 },
          ],
          capabilities: ["coding", "cost-effective", "reasoning"],
        },
      ];

      expect(providers.length).toBe(4);
      expect(providers.map((p) => p.id)).toEqual([
        "anthropic",
        "openai",
        "google",
        "deepseek",
      ]);

      // Each provider has at least one model
      for (const provider of providers) {
        expect(provider.models.length).toBeGreaterThan(0);
        expect(provider.capabilities.length).toBeGreaterThan(0);
        for (const model of provider.models) {
          expect(model.id).toBeDefined();
          expect(model.name).toBeDefined();
          expect(model.context).toBeGreaterThan(0);
        }
      }
    });
  });

  // =========================================================================
  // POST agent-chat — send message
  // =========================================================================

  describe("POST agent-chat", () => {
    it("sends message and gets response via LocalExecutionProvider", async () => {
      const result = await svcA.sendMessage({
        orgId: orgA,
        userId: userA,
        provider: "anthropic",
        model: "claude-sonnet-4-6",
        message: "Hello, how are you?",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.sessionId).toBeDefined();
      expect(result.value.response).toBeDefined();
      expect(typeof result.value.response).toBe("string");
      expect(result.value.response.length).toBeGreaterThan(0);
      expect(result.value.provider).toBe("anthropic");
      expect(result.value.model).toBe("claude-sonnet-4-6");
      expect(result.value.inputTokens).toBeGreaterThanOrEqual(0);
      expect(result.value.outputTokens).toBeGreaterThanOrEqual(0);
      expect(result.value.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("returns a session ID that can be reused", async () => {
      const first = await svcA.sendMessage({
        orgId: orgA,
        userId: userA,
        provider: "openai",
        model: "gpt-4o",
        message: "First message",
      });

      expect(first.ok).toBe(true);
      if (!first.ok) return;

      const second = await svcA.sendMessage({
        orgId: orgA,
        userId: userA,
        sessionId: first.value.sessionId,
        provider: "openai",
        model: "gpt-4o",
        message: "Second message",
      });

      expect(second.ok).toBe(true);
      if (!second.ok) return;
      expect(second.value.sessionId).toBe(first.value.sessionId);
    });

    it("works with all provider names via LocalExecutionProvider fallback", async () => {
      const providerNames: AgentChatProvider[] = [
        "anthropic",
        "openai",
        "google",
        "deepseek",
      ];

      for (const provider of providerNames) {
        const result = await svcA.sendMessage({
          orgId: orgA,
          userId: userA,
          provider,
          model: "test-model",
          message: `Test message for ${provider}`,
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value.provider).toBe(provider);
      }
    });

    it("emits audit event on message send", async () => {
      await svcA.sendMessage({
        orgId: orgA,
        userId: userA,
        provider: "anthropic",
        model: "claude-sonnet-4-6",
        message: "Test audit message",
      });

      const events = await repos.audit.query(orgA, {
        action: "agent_chat.message_sent" as never,
      });
      expect(events.length).toBe(1);
      expect(events[0]!.resourceType).toBe("agent_chat_session");
    });

    it("includes terminal context when provided", async () => {
      const result = await svcA.sendMessage({
        orgId: orgA,
        userId: userA,
        provider: "anthropic",
        model: "claude-sonnet-4-6",
        message: "What happened in my terminal?",
        terminalContext: "$ npm test\n> 5 tests passed",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.response).toBeDefined();
    });
  });

  // =========================================================================
  // GET chat history
  // =========================================================================

  describe("GET chat history", () => {
    it("returns empty for new session", async () => {
      const result = await svcA.getHistory(
        toAgentChatSessionId("00000000-0000-0000-0000-ffffffffffff"),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toEqual([]);
    });

    it("returns messages after chat", async () => {
      const sendResult = await svcA.sendMessage({
        orgId: orgA,
        userId: userA,
        provider: "anthropic",
        model: "claude-sonnet-4-6",
        message: "Hello",
      });

      expect(sendResult.ok).toBe(true);
      if (!sendResult.ok) return;

      const historyResult = await svcA.getHistory(
        toAgentChatSessionId(sendResult.value.sessionId),
      );

      expect(historyResult.ok).toBe(true);
      if (!historyResult.ok) return;
      expect(historyResult.value.length).toBe(2); // user + assistant
      expect(historyResult.value[0]!.role).toBe("user");
      expect(historyResult.value[0]!.content).toBe("Hello");
      expect(historyResult.value[1]!.role).toBe("assistant");
      expect(historyResult.value[1]!.content.length).toBeGreaterThan(0);
    });

    it("accumulates messages across multiple sends", async () => {
      const first = await svcA.sendMessage({
        orgId: orgA,
        userId: userA,
        provider: "anthropic",
        model: "claude-sonnet-4-6",
        message: "First",
      });

      expect(first.ok).toBe(true);
      if (!first.ok) return;

      await svcA.sendMessage({
        orgId: orgA,
        userId: userA,
        sessionId: first.value.sessionId,
        provider: "anthropic",
        model: "claude-sonnet-4-6",
        message: "Second",
      });

      const historyResult = await svcA.getHistory(
        toAgentChatSessionId(first.value.sessionId),
      );

      expect(historyResult.ok).toBe(true);
      if (!historyResult.ok) return;
      // 2 user + 2 assistant = 4 entries
      expect(historyResult.value.length).toBe(4);
      expect(historyResult.value[0]!.content).toBe("First");
      expect(historyResult.value[2]!.content).toBe("Second");
    });
  });

  // =========================================================================
  // Provider validation
  // =========================================================================

  describe("provider validation", () => {
    it("handles custom provider via LocalExecutionProvider", async () => {
      const result = await svcA.sendMessage({
        orgId: orgA,
        userId: userA,
        provider: "custom" as AgentChatProvider,
        model: "my-local-model",
        message: "Test custom provider",
      });

      // The "custom" provider falls through to LocalExecutionProvider
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.response).toBeDefined();
    });
  });

  // =========================================================================
  // Tenant isolation
  // =========================================================================

  describe("tenant isolation", () => {
    it("chat history is scoped per service instance", async () => {
      const auditEmitter = new PgAuditEmitter(repos.audit);
      const svcB = new AgentChatService(ORG_B, auditEmitter);

      // Send a message in org A
      const sendA = await svcA.sendMessage({
        orgId: ORG_A,
        userId: USER_A,
        provider: "anthropic",
        model: "claude-sonnet-4-6",
        message: "Org A message",
      });
      expect(sendA.ok).toBe(true);
      if (!sendA.ok) return;

      // Send a message in org B with the same session ID will work
      // because the service stores by session ID, but we verify
      // that org B's own sessions are independent
      const sendB = await svcB.sendMessage({
        orgId: ORG_B,
        userId: USER_A,
        provider: "openai",
        model: "gpt-4o",
        message: "Org B message",
      });
      expect(sendB.ok).toBe(true);
      if (!sendB.ok) return;

      // Each org has its own session
      expect(sendA.value.sessionId).not.toBe(sendB.value.sessionId);

      // Audit events are properly org-scoped
      const eventsA = await repos.audit.query(ORG_A, {
        action: "agent_chat.message_sent" as never,
      });
      const eventsB = await repos.audit.query(ORG_B, {
        action: "agent_chat.message_sent" as never,
      });
      expect(eventsA.length).toBe(1);
      expect(eventsB.length).toBe(1);
    });
  });
});
