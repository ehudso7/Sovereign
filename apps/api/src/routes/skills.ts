// ---------------------------------------------------------------------------
// Skill routes — /api/v1/skills/*
// ---------------------------------------------------------------------------

import type { FastifyInstance } from "fastify";
import { toSkillId } from "@sovereign/core";
import { getServices } from "../services/index.js";
import { authenticate, requirePermission } from "../middleware/auth.js";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function meta(requestId: string) {
  return { request_id: requestId, timestamp: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function skillRoutes(server: FastifyInstance): Promise<void> {
  // GET /api/v1/skills — list catalog
  server.get(
    "/api/v1/skills",
    { preHandler: [authenticate, requirePermission("skill:read")] },
    async (request, reply) => {
      const query = request.query as Record<string, string>;
      const services = getServices();
      const skillService = services.skillForOrg(request.session!.orgId);

      const filters: { trustTier?: string } = {};
      if (query.trustTier) filters.trustTier = query.trustTier;

      const result = await skillService.listCatalog(filters);

      if (!result.ok) {
        return reply.status(result.error.statusCode).send({
          error: { code: result.error.code, message: result.error.message },
          meta: meta(request.id),
        });
      }

      return reply.status(200).send({ data: result.value, meta: meta(request.id) });
    },
  );

  // GET /api/v1/skills/installed — list installed for org
  server.get(
    "/api/v1/skills/installed",
    { preHandler: [authenticate, requirePermission("skill:read")] },
    async (request, reply) => {
      const services = getServices();
      const skillService = services.skillForOrg(request.session!.orgId);

      const result = await skillService.listInstalled(request.session!.orgId);

      if (!result.ok) {
        return reply.status(result.error.statusCode).send({
          error: { code: result.error.code, message: result.error.message },
          meta: meta(request.id),
        });
      }

      return reply.status(200).send({ data: result.value, meta: meta(request.id) });
    },
  );

  // GET /api/v1/skills/:skillId — get skill detail
  server.get<{ Params: { skillId: string } }>(
    "/api/v1/skills/:skillId",
    { preHandler: [authenticate, requirePermission("skill:read")] },
    async (request, reply) => {
      const services = getServices();
      const skillService = services.skillForOrg(request.session!.orgId);

      const result = await skillService.getSkill(
        toSkillId(request.params.skillId),
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

  // POST /api/v1/skills/:skillId/install — install skill
  server.post<{ Params: { skillId: string } }>(
    "/api/v1/skills/:skillId/install",
    { preHandler: [authenticate, requirePermission("skill:install")] },
    async (request, reply) => {
      const services = getServices();
      const skillService = services.skillForOrg(request.session!.orgId);

      const result = await skillService.install(
        toSkillId(request.params.skillId),
        request.session!.orgId,
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

  // POST /api/v1/skills/:skillId/uninstall — uninstall skill
  server.post<{ Params: { skillId: string } }>(
    "/api/v1/skills/:skillId/uninstall",
    { preHandler: [authenticate, requirePermission("skill:uninstall")] },
    async (request, reply) => {
      const services = getServices();
      const skillService = services.skillForOrg(request.session!.orgId);

      const result = await skillService.uninstall(
        toSkillId(request.params.skillId),
        request.session!.orgId,
        request.session!.userId,
      );

      if (!result.ok) {
        return reply.status(result.error.statusCode).send({
          error: { code: result.error.code, message: result.error.message },
          meta: meta(request.id),
        });
      }

      return reply.status(200).send({ data: { success: true }, meta: meta(request.id) });
    },
  );
}
