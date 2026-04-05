// ---------------------------------------------------------------------------
// Memory routes — /api/v1/memories/*
// ---------------------------------------------------------------------------

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { toMemoryId } from "@sovereign/core";
import type { MemoryKind, MemoryScopeType, MemoryStatus } from "@sovereign/core";
import { getServices } from "../services/index.js";
import { authenticate, requirePermission } from "../middleware/auth.js";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const createMemorySchema = z.object({
  scopeType: z.enum(["org", "project", "agent", "user"]),
  scopeId: z.string().uuid(),
  kind: z.enum(["semantic", "episodic", "procedural"]),
  title: z.string().min(1).max(500),
  summary: z.string().min(1).max(2000),
  content: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
  sourceRunId: z.string().uuid().optional(),
  sourceAgentId: z.string().uuid().optional(),
  expiresAt: z.string().optional(),
});

const updateMemorySchema = z.object({
  title: z.string().min(1).max(500).optional(),
  summary: z.string().max(2000).optional(),
  content: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const listQuerySchema = z.object({
  scopeType: z.string().optional(),
  scopeId: z.string().optional(),
  kind: z.string().optional(),
  status: z.string().optional(),
});

const searchQuerySchema = z.object({
  q: z.string().min(1),
  scopeType: z.string().optional(),
  scopeId: z.string().optional(),
  kind: z.string().optional(),
  maxResults: z.coerce.number().int().min(1).max(100).optional(),
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

export async function memoryRoutes(server: FastifyInstance): Promise<void> {
  // POST /api/v1/memories — create a memory
  server.post(
    "/api/v1/memories",
    { preHandler: [authenticate, requirePermission("memory:write")] },
    async (request, reply) => {
      const body = createMemorySchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          error: { code: "BAD_REQUEST", message: "Invalid request body", details: body.error.issues },
          meta: meta(request.id),
        });
      }

      const services = getServices();
      const memoryService = services.memoryForOrg(request.session!.orgId);
      const result = await memoryService.createMemory({
        orgId: request.session!.orgId,
        scopeType: body.data.scopeType,
        scopeId: body.data.scopeId,
        kind: body.data.kind,
        title: body.data.title,
        summary: body.data.summary,
        content: body.data.content,
        metadata: body.data.metadata,
        sourceRunId: body.data.sourceRunId,
        sourceAgentId: body.data.sourceAgentId,
        createdBy: request.session!.userId,
        expiresAt: body.data.expiresAt,
      });

      if (!result.ok) {
        return reply.status(result.error.statusCode).send({
          error: { code: result.error.code, message: result.error.message },
          meta: meta(request.id),
        });
      }

      return reply.status(201).send({ data: result.value, meta: meta(request.id) });
    },
  );

  // GET /api/v1/memories — list memories
  server.get(
    "/api/v1/memories",
    { preHandler: [authenticate, requirePermission("memory:read")] },
    async (request, reply) => {
      const query = listQuerySchema.safeParse(request.query);
      if (!query.success) {
        return reply.status(400).send({
          error: { code: "BAD_REQUEST", message: "Invalid query", details: query.error.issues },
          meta: meta(request.id),
        });
      }

      const services = getServices();
      const memoryService = services.memoryForOrg(request.session!.orgId);
      const filters: { scopeType?: MemoryScopeType; scopeId?: string; kind?: MemoryKind; status?: MemoryStatus } = {};
      if (query.data.scopeType) filters.scopeType = query.data.scopeType as MemoryScopeType;
      if (query.data.scopeId) filters.scopeId = query.data.scopeId;
      if (query.data.kind) filters.kind = query.data.kind as MemoryKind;
      if (query.data.status) filters.status = query.data.status as MemoryStatus;

      const result = await memoryService.listMemories(request.session!.orgId, filters);

      if (!result.ok) {
        return reply.status(result.error.statusCode).send({
          error: { code: result.error.code, message: result.error.message },
          meta: meta(request.id),
        });
      }

      return reply.status(200).send({ data: result.value, meta: meta(request.id) });
    },
  );

  // GET /api/v1/memories/search — search memories
  server.get(
    "/api/v1/memories/search",
    { preHandler: [authenticate, requirePermission("memory:read")] },
    async (request, reply) => {
      const query = searchQuerySchema.safeParse(request.query);
      if (!query.success) {
        return reply.status(400).send({
          error: { code: "BAD_REQUEST", message: "Invalid query", details: query.error.issues },
          meta: meta(request.id),
        });
      }

      const services = getServices();
      const memoryService = services.memoryForOrg(request.session!.orgId);
      const result = await memoryService.searchMemories(
        request.session!.orgId,
        query.data.q,
        {
          scopeType: query.data.scopeType as MemoryScopeType | undefined,
          scopeId: query.data.scopeId,
          kind: query.data.kind as MemoryKind | undefined,
          maxResults: query.data.maxResults,
        },
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

  // GET /api/v1/memories/:memoryId — get memory detail
  server.get<{ Params: { memoryId: string } }>(
    "/api/v1/memories/:memoryId",
    { preHandler: [authenticate, requirePermission("memory:read")] },
    async (request, reply) => {
      const services = getServices();
      const memoryService = services.memoryForOrg(request.session!.orgId);
      const result = await memoryService.getMemory(
        toMemoryId(request.params.memoryId),
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

  // PATCH /api/v1/memories/:memoryId — update memory
  server.patch<{ Params: { memoryId: string } }>(
    "/api/v1/memories/:memoryId",
    { preHandler: [authenticate, requirePermission("memory:write")] },
    async (request, reply) => {
      const body = updateMemorySchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          error: { code: "BAD_REQUEST", message: "Invalid request body", details: body.error.issues },
          meta: meta(request.id),
        });
      }

      const services = getServices();
      const memoryService = services.memoryForOrg(request.session!.orgId);
      const result = await memoryService.updateMemory(
        toMemoryId(request.params.memoryId),
        request.session!.orgId,
        { ...body.data, updatedBy: request.session!.userId },
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

  // POST /api/v1/memories/:memoryId/redact
  server.post<{ Params: { memoryId: string } }>(
    "/api/v1/memories/:memoryId/redact",
    { preHandler: [authenticate, requirePermission("memory:redact")] },
    async (request, reply) => {
      const services = getServices();
      const memoryService = services.memoryForOrg(request.session!.orgId);
      const result = await memoryService.redactMemory(
        toMemoryId(request.params.memoryId),
        request.session!.orgId,
        request.session!.userId,
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

  // POST /api/v1/memories/:memoryId/expire
  server.post<{ Params: { memoryId: string } }>(
    "/api/v1/memories/:memoryId/expire",
    { preHandler: [authenticate, requirePermission("memory:redact")] },
    async (request, reply) => {
      const services = getServices();
      const memoryService = services.memoryForOrg(request.session!.orgId);
      const result = await memoryService.expireMemory(
        toMemoryId(request.params.memoryId),
        request.session!.orgId,
        request.session!.userId,
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

  // POST /api/v1/memories/:memoryId/delete
  server.post<{ Params: { memoryId: string } }>(
    "/api/v1/memories/:memoryId/delete",
    { preHandler: [authenticate, requirePermission("memory:delete")] },
    async (request, reply) => {
      const services = getServices();
      const memoryService = services.memoryForOrg(request.session!.orgId);
      const result = await memoryService.deleteMemory(
        toMemoryId(request.params.memoryId),
        request.session!.orgId,
        request.session!.userId,
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

  // POST /api/v1/memories/:memoryId/promote
  server.post<{ Params: { memoryId: string } }>(
    "/api/v1/memories/:memoryId/promote",
    { preHandler: [authenticate, requirePermission("memory:write")] },
    async (request, reply) => {
      const services = getServices();
      const memoryService = services.memoryForOrg(request.session!.orgId);
      const result = await memoryService.promoteMemory(
        toMemoryId(request.params.memoryId),
        request.session!.orgId,
        request.session!.userId,
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

  // GET /api/v1/memories/:memoryId/links
  server.get<{ Params: { memoryId: string } }>(
    "/api/v1/memories/:memoryId/links",
    { preHandler: [authenticate, requirePermission("memory:read")] },
    async (request, reply) => {
      const services = getServices();
      const memoryService = services.memoryForOrg(request.session!.orgId);
      const result = await memoryService.getLinksForMemory(
        toMemoryId(request.params.memoryId),
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
