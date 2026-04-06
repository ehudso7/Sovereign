// ---------------------------------------------------------------------------
// Agent Chat routes — /api/v1/agent-chat/* (Phase 15)
// ---------------------------------------------------------------------------

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { toAgentChatSessionId } from "@sovereign/core";
import { getServices } from "../services/index.js";
import { authenticate, requirePermission } from "../middleware/auth.js";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const sendMessageSchema = z.object({
  sessionId: z.string().uuid().optional(),
  provider: z.enum(["openai", "anthropic", "google", "deepseek", "custom"]),
  model: z.string().min(1),
  message: z.string().min(1).max(50000),
  terminalSessionId: z.string().uuid().optional(),
  terminalContext: z.string().max(10000).optional(),
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function meta(requestId: string) {
  return { request_id: requestId, timestamp: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function agentChatRoutes(server: FastifyInstance): Promise<void> {
  // GET /api/v1/agent-providers — list available AI providers
  server.get(
    "/api/v1/agent-providers",
    { preHandler: [authenticate, requirePermission("agent_provider:read")] },
    async (request, reply) => {
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

      return reply.send({ data: providers, meta: meta(request.id) });
    },
  );

  // POST /api/v1/agent-chat — send message to AI agent
  server.post(
    "/api/v1/agent-chat",
    { preHandler: [authenticate, requirePermission("agent_chat:use")] },
    async (request, reply) => {
      const body = sendMessageSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          error: { code: "BAD_REQUEST", message: "Invalid request body", details: body.error.issues },
          meta: meta(request.id),
        });
      }

      const services = getServices();
      const agentChatService = services.agentChatForOrg(request.session!.orgId);
      const result = await agentChatService.sendMessage({
        orgId: request.session!.orgId,
        userId: request.session!.userId,
        sessionId: body.data.sessionId,
        provider: body.data.provider,
        model: body.data.model,
        message: body.data.message,
        terminalSessionId: body.data.terminalSessionId,
        terminalContext: body.data.terminalContext,
      });

      if (!result.ok) {
        return reply.status(result.error.statusCode).send({
          error: { code: result.error.code, message: result.error.message },
          meta: meta(request.id),
        });
      }

      return reply.send({ data: result.value, meta: meta(request.id) });
    },
  );

  // GET /api/v1/agent-chat/:sessionId/history — get chat history
  server.get(
    "/api/v1/agent-chat/:sessionId/history",
    { preHandler: [authenticate, requirePermission("agent_chat:use")] },
    async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };

      const services = getServices();
      const agentChatService = services.agentChatForOrg(request.session!.orgId);
      const result = await agentChatService.getHistory(
        toAgentChatSessionId(sessionId),
      );

      if (!result.ok) {
        return reply.status(result.error.statusCode).send({
          error: { code: result.error.code, message: result.error.message },
          meta: meta(request.id),
        });
      }

      return reply.send({ data: result.value, meta: meta(request.id) });
    },
  );
}
