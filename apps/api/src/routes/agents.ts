// ---------------------------------------------------------------------------
// Agent Studio routes — /api/v1/agents/*
// ---------------------------------------------------------------------------

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { toAgentId, toAgentVersionId, toProjectId } from "@sovereign/core";
import { getServices } from "../services/index.js";
import { authenticate, requirePermission } from "../middleware/auth.js";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const slugRegex = /^[a-z0-9-]+$/;

const createAgentSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(63).regex(slugRegex, "Slug must be lowercase alphanumeric with hyphens"),
  description: z.string().max(2000).optional(),
});

const updateAgentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
});

const toolConfigSchema = z.object({
  name: z.string().min(1),
  connectorId: z.string().optional(),
  parameters: z.record(z.unknown()).optional(),
});

const budgetConfigSchema = z.object({
  maxTokens: z.number().int().positive().optional(),
  maxCostCents: z.number().int().positive().optional(),
  maxRunsPerDay: z.number().int().positive().optional(),
}).nullable();

const approvalRuleSchema = z.object({
  action: z.string().min(1),
  requireApproval: z.boolean(),
  approverRoles: z.array(z.string()).optional(),
});

const memoryConfigSchema = z.object({
  mode: z.enum(["none", "session", "persistent"]),
  lanes: z.array(z.string()).optional(),
}).nullable();

const scheduleConfigSchema = z.object({
  enabled: z.boolean(),
  cron: z.string().optional(),
  timezone: z.string().optional(),
}).nullable();

const modelConfigSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  topP: z.number().min(0).max(1).optional(),
});

const createVersionSchema = z.object({
  goals: z.array(z.string()).optional(),
  instructions: z.string().optional(),
  tools: z.array(toolConfigSchema).optional(),
  budget: budgetConfigSchema.optional(),
  approvalRules: z.array(approvalRuleSchema).optional(),
  memoryConfig: memoryConfigSchema.optional(),
  schedule: scheduleConfigSchema.optional(),
  modelConfig: modelConfigSchema.optional(),
});

const updateVersionSchema = z.object({
  goals: z.array(z.string()).optional(),
  instructions: z.string().optional(),
  tools: z.array(toolConfigSchema).optional(),
  budget: budgetConfigSchema.optional(),
  approvalRules: z.array(approvalRuleSchema).optional(),
  memoryConfig: memoryConfigSchema.optional(),
  schedule: scheduleConfigSchema.optional(),
  modelConfig: modelConfigSchema.optional(),
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

export async function agentRoutes(server: FastifyInstance): Promise<void> {
  // GET /api/v1/agents
  server.get("/api/v1/agents", { preHandler: [authenticate] }, async (request, reply) => {
    const query = request.query as Record<string, string>;
    const services = getServices();
    const agentService = services.agentStudioForOrg(request.session!.orgId);

    const filters: { projectId?: ReturnType<typeof toProjectId>; status?: "draft" | "published" | "archived" } = {};
    if (query.projectId) filters.projectId = toProjectId(query.projectId);
    if (query.status && ["draft", "published", "archived"].includes(query.status)) {
      filters.status = query.status as "draft" | "published" | "archived";
    }

    const result = await agentService.listAgents(request.session!.orgId, filters);

    if (!result.ok) {
      return reply.status(result.error.statusCode).send({
        error: { code: result.error.code, message: result.error.message },
        meta: meta(request.id),
      });
    }

    return reply.status(200).send({ data: result.value, meta: meta(request.id) });
  });

  // POST /api/v1/agents
  server.post(
    "/api/v1/agents",
    { preHandler: [authenticate, requirePermission("agent:create")] },
    async (request, reply) => {
      const body = createAgentSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          error: { code: "BAD_REQUEST", message: "Invalid request body", details: body.error.issues },
          meta: meta(request.id),
        });
      }

      const services = getServices();
      const agentService = services.agentStudioForOrg(request.session!.orgId);
      const result = await agentService.createAgent(
        {
          orgId: request.session!.orgId,
          projectId: toProjectId(body.data.projectId),
          name: body.data.name,
          slug: body.data.slug,
          description: body.data.description,
        },
        request.session!.userId,
      );

      if (!result.ok) {
        return reply.status(result.error.statusCode).send({
          error: { code: result.error.code, message: result.error.message },
          meta: meta(request.id),
        });
      }

      return reply.status(201).send({ data: result.value, meta: meta(request.id) });
    },
  );

  // GET /api/v1/agents/:agentId
  server.get<{ Params: { agentId: string } }>(
    "/api/v1/agents/:agentId",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const services = getServices();
      const agentService = services.agentStudioForOrg(request.session!.orgId);
      const result = await agentService.getAgent(
        toAgentId(request.params.agentId),
        request.session!.orgId,
      );

      if (!result.ok) {
        return reply.status(result.error.statusCode).send({
          error: { code: result.error.code, message: result.error.message },
          meta: meta(request.id),
        });
      }

      return reply.status(200).send({ data: result.value, meta: meta(request.id) });
    },
  );

  // PATCH /api/v1/agents/:agentId
  server.patch<{ Params: { agentId: string } }>(
    "/api/v1/agents/:agentId",
    { preHandler: [authenticate, requirePermission("agent:update")] },
    async (request, reply) => {
      const body = updateAgentSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          error: { code: "BAD_REQUEST", message: "Invalid request body", details: body.error.issues },
          meta: meta(request.id),
        });
      }

      const services = getServices();
      const agentService = services.agentStudioForOrg(request.session!.orgId);
      const result = await agentService.updateAgent(
        toAgentId(request.params.agentId),
        request.session!.orgId,
        body.data,
      );

      if (!result.ok) {
        return reply.status(result.error.statusCode).send({
          error: { code: result.error.code, message: result.error.message },
          meta: meta(request.id),
        });
      }

      return reply.status(200).send({ data: result.value, meta: meta(request.id) });
    },
  );

  // DELETE /api/v1/agents/:agentId (archives, doesn't delete)
  server.delete<{ Params: { agentId: string } }>(
    "/api/v1/agents/:agentId",
    { preHandler: [authenticate, requirePermission("agent:archive")] },
    async (request, reply) => {
      const services = getServices();
      const agentService = services.agentStudioForOrg(request.session!.orgId);
      const result = await agentService.archiveAgent(
        toAgentId(request.params.agentId),
        request.session!.orgId,
      );

      if (!result.ok) {
        return reply.status(result.error.statusCode).send({
          error: { code: result.error.code, message: result.error.message },
          meta: meta(request.id),
        });
      }

      return reply.status(200).send({ data: result.value, meta: meta(request.id) });
    },
  );

  // -------------------------------------------------------------------------
  // Version routes
  // -------------------------------------------------------------------------

  // GET /api/v1/agents/:agentId/versions
  server.get<{ Params: { agentId: string } }>(
    "/api/v1/agents/:agentId/versions",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const services = getServices();
      const agentService = services.agentStudioForOrg(request.session!.orgId);
      const result = await agentService.listVersions(
        toAgentId(request.params.agentId),
        request.session!.orgId,
      );

      if (!result.ok) {
        return reply.status(result.error.statusCode).send({
          error: { code: result.error.code, message: result.error.message },
          meta: meta(request.id),
        });
      }

      return reply.status(200).send({ data: result.value, meta: meta(request.id) });
    },
  );

  // POST /api/v1/agents/:agentId/versions
  server.post<{ Params: { agentId: string } }>(
    "/api/v1/agents/:agentId/versions",
    { preHandler: [authenticate, requirePermission("agent:update")] },
    async (request, reply) => {
      const body = createVersionSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          error: { code: "BAD_REQUEST", message: "Invalid request body", details: body.error.issues },
          meta: meta(request.id),
        });
      }

      const services = getServices();
      const agentService = services.agentStudioForOrg(request.session!.orgId);
      const result = await agentService.createVersion(
        {
          agentId: toAgentId(request.params.agentId),
          orgId: request.session!.orgId,
          ...body.data,
        },
        request.session!.userId,
      );

      if (!result.ok) {
        return reply.status(result.error.statusCode).send({
          error: { code: result.error.code, message: result.error.message },
          meta: meta(request.id),
        });
      }

      return reply.status(201).send({ data: result.value, meta: meta(request.id) });
    },
  );

  // PATCH /api/v1/agents/:agentId/versions/:versionId
  server.patch<{ Params: { agentId: string; versionId: string } }>(
    "/api/v1/agents/:agentId/versions/:versionId",
    { preHandler: [authenticate, requirePermission("agent:update")] },
    async (request, reply) => {
      const body = updateVersionSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          error: { code: "BAD_REQUEST", message: "Invalid request body", details: body.error.issues },
          meta: meta(request.id),
        });
      }

      const services = getServices();
      const agentService = services.agentStudioForOrg(request.session!.orgId);
      const result = await agentService.updateVersion(
        toAgentVersionId(request.params.versionId),
        request.session!.orgId,
        body.data,
      );

      if (!result.ok) {
        return reply.status(result.error.statusCode).send({
          error: { code: result.error.code, message: result.error.message },
          meta: meta(request.id),
        });
      }

      return reply.status(200).send({ data: result.value, meta: meta(request.id) });
    },
  );

  // POST /api/v1/agents/:agentId/versions/:versionId/publish
  server.post<{ Params: { agentId: string; versionId: string } }>(
    "/api/v1/agents/:agentId/versions/:versionId/publish",
    { preHandler: [authenticate, requirePermission("agent:publish")] },
    async (request, reply) => {
      const services = getServices();
      const agentService = services.agentStudioForOrg(request.session!.orgId);
      const result = await agentService.publishVersion(
        toAgentId(request.params.agentId),
        toAgentVersionId(request.params.versionId),
        request.session!.orgId,
      );

      if (!result.ok) {
        return reply.status(result.error.statusCode).send({
          error: { code: result.error.code, message: result.error.message },
          meta: meta(request.id),
        });
      }

      return reply.status(200).send({ data: result.value, meta: meta(request.id) });
    },
  );

  // POST /api/v1/agents/:agentId/unpublish
  server.post<{ Params: { agentId: string } }>(
    "/api/v1/agents/:agentId/unpublish",
    { preHandler: [authenticate, requirePermission("agent:publish")] },
    async (request, reply) => {
      const services = getServices();
      const agentService = services.agentStudioForOrg(request.session!.orgId);
      const result = await agentService.unpublishAgent(
        toAgentId(request.params.agentId),
        request.session!.orgId,
      );

      if (!result.ok) {
        return reply.status(result.error.statusCode).send({
          error: { code: result.error.code, message: result.error.message },
          meta: meta(request.id),
        });
      }

      return reply.status(200).send({ data: result.value, meta: meta(request.id) });
    },
  );
}
