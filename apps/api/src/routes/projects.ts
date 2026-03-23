// ---------------------------------------------------------------------------
// Project routes — /api/v1/projects/*
// ---------------------------------------------------------------------------

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { toProjectId } from "@sovereign/core";
import { getServices } from "../services/index.js";
import { authenticate, requirePermission } from "../middleware/auth.js";

const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(63).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  description: z.string().max(2000).optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(63).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(2000).optional(),
  settings: z.record(z.unknown()).optional(),
});

export async function projectRoutes(server: FastifyInstance): Promise<void> {
  // GET /api/v1/projects
  server.get("/api/v1/projects", { preHandler: [authenticate] }, async (request, reply) => {
    const services = getServices();
    const projectService = services.projectsForOrg(request.session!.orgId);
    const query = request.query as Record<string, string>;
    const result = await projectService.listForOrg(request.session!.orgId, {
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      cursor: query.cursor,
    });

    if (!result.ok) {
      return reply.status(result.error.statusCode).send({
        error: { code: result.error.code, message: result.error.message },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }

    return reply.status(200).send({
      data: result.value.data,
      meta: {
        request_id: request.id,
        timestamp: new Date().toISOString(),
        total: result.value.total,
        has_more: result.value.hasMore,
        next_cursor: result.value.nextCursor,
      },
    });
  });

  // POST /api/v1/projects
  server.post(
    "/api/v1/projects",
    { preHandler: [authenticate, requirePermission("project:create")] },
    async (request, reply) => {
      const body = createProjectSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          error: { code: "BAD_REQUEST", message: "Invalid request body", details: body.error.issues },
          meta: { request_id: request.id, timestamp: new Date().toISOString() },
        });
      }

      const services = getServices();
      const projectService = services.projectsForOrg(request.session!.orgId);
      const result = await projectService.create(
        {
          orgId: request.session!.orgId,
          name: body.data.name,
          slug: body.data.slug,
          description: body.data.description,
        },
        request.session!.userId,
      );

      if (!result.ok) {
        return reply.status(result.error.statusCode).send({
          error: { code: result.error.code, message: result.error.message },
          meta: { request_id: request.id, timestamp: new Date().toISOString() },
        });
      }

      return reply.status(201).send({
        data: result.value,
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }
  );

  // GET /api/v1/projects/:projectId
  server.get<{ Params: { projectId: string } }>(
    "/api/v1/projects/:projectId",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const services = getServices();
      const projectService = services.projectsForOrg(request.session!.orgId);
      const result = await projectService.getById(
        toProjectId(request.params.projectId),
        request.session!.orgId,
      );

      if (!result.ok) {
        return reply.status(result.error.statusCode).send({
          error: { code: result.error.code, message: result.error.message },
          meta: { request_id: request.id, timestamp: new Date().toISOString() },
        });
      }

      return reply.status(200).send({
        data: result.value,
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }
  );

  // PATCH /api/v1/projects/:projectId
  server.patch<{ Params: { projectId: string } }>(
    "/api/v1/projects/:projectId",
    { preHandler: [authenticate, requirePermission("project:update")] },
    async (request, reply) => {
      const body = updateProjectSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          error: { code: "BAD_REQUEST", message: "Invalid request body", details: body.error.issues },
          meta: { request_id: request.id, timestamp: new Date().toISOString() },
        });
      }

      const services = getServices();
      const projectService = services.projectsForOrg(request.session!.orgId);
      const result = await projectService.update(
        toProjectId(request.params.projectId),
        request.session!.orgId,
        body.data,
      );

      if (!result.ok) {
        return reply.status(result.error.statusCode).send({
          error: { code: result.error.code, message: result.error.message },
          meta: { request_id: request.id, timestamp: new Date().toISOString() },
        });
      }

      return reply.status(200).send({
        data: result.value,
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }
  );

  // DELETE /api/v1/projects/:projectId
  server.delete<{ Params: { projectId: string } }>(
    "/api/v1/projects/:projectId",
    { preHandler: [authenticate, requirePermission("project:delete")] },
    async (request, reply) => {
      const services = getServices();
      const projectService = services.projectsForOrg(request.session!.orgId);
      const result = await projectService.delete(
        toProjectId(request.params.projectId),
        request.session!.orgId,
      );

      if (!result.ok) {
        return reply.status(result.error.statusCode).send({
          error: { code: result.error.code, message: result.error.message },
          meta: { request_id: request.id, timestamp: new Date().toISOString() },
        });
      }

      return reply.status(200).send({
        data: { message: "Project deleted" },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }
  );
}
