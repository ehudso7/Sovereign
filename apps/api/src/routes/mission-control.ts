// ---------------------------------------------------------------------------
// Mission Control routes — /api/v1/mission-control/*
// Phase 9: Observability and Mission Control
// ---------------------------------------------------------------------------

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { toRunId, toAlertEventId } from "@sovereign/core";
import { getServices } from "../services/index.js";
import { authenticate, requirePermission } from "../middleware/auth.js";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const runListQuerySchema = z.object({
  status: z.string().optional(),
  agentId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  hasBrowser: z.coerce.boolean().optional(),
  hasTool: z.coerce.boolean().optional(),
  hasMemory: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

const alertListQuerySchema = z.object({
  status: z.string().optional(),
  severity: z.string().optional(),
  conditionType: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
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

export async function missionControlRoutes(server: FastifyInstance): Promise<void> {
  // GET /api/v1/mission-control/overview
  server.get(
    "/api/v1/mission-control/overview",
    { preHandler: [authenticate, requirePermission("observability:read")] },
    async (request, reply) => {
      const services = getServices();
      const mc = services.missionControlForOrg(request.session!.orgId);

      // Generate any new alerts on overview load
      await mc.generateAlerts(request.session!.orgId);

      const result = await mc.getOverview(request.session!.orgId);
      if (!result.ok) {
        return reply.status(result.error.statusCode).send({
          error: { code: result.error.code, message: result.error.message },
          meta: meta(request.id),
        });
      }

      return reply.status(200).send({ data: result.value, meta: meta(request.id) });
    },
  );

  // GET /api/v1/mission-control/runs
  server.get(
    "/api/v1/mission-control/runs",
    { preHandler: [authenticate, requirePermission("observability:read")] },
    async (request, reply) => {
      const query = runListQuerySchema.safeParse(request.query);
      if (!query.success) {
        return reply.status(400).send({
          error: { code: "BAD_REQUEST", message: "Invalid query", details: query.error.issues },
          meta: meta(request.id),
        });
      }

      const services = getServices();
      const mc = services.missionControlForOrg(request.session!.orgId);
      const result = await mc.listRuns(request.session!.orgId, query.data);

      if (!result.ok) {
        return reply.status(result.error.statusCode).send({
          error: { code: result.error.code, message: result.error.message },
          meta: meta(request.id),
        });
      }

      return reply.status(200).send({ data: result.value, meta: meta(request.id) });
    },
  );

  // GET /api/v1/mission-control/runs/:runId
  server.get<{ Params: { runId: string } }>(
    "/api/v1/mission-control/runs/:runId",
    { preHandler: [authenticate, requirePermission("observability:read")] },
    async (request, reply) => {
      const services = getServices();
      const mc = services.missionControlForOrg(request.session!.orgId);
      const result = await mc.getRunDetail(
        toRunId(request.params.runId),
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

  // GET /api/v1/mission-control/runs/:runId/timeline
  server.get<{ Params: { runId: string } }>(
    "/api/v1/mission-control/runs/:runId/timeline",
    { preHandler: [authenticate, requirePermission("observability:read")] },
    async (request, reply) => {
      const services = getServices();
      const mc = services.missionControlForOrg(request.session!.orgId);
      const result = await mc.getRunTimeline(
        toRunId(request.params.runId),
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

  // GET /api/v1/mission-control/runs/:runId/steps
  server.get<{ Params: { runId: string } }>(
    "/api/v1/mission-control/runs/:runId/steps",
    { preHandler: [authenticate, requirePermission("observability:read")] },
    async (request, reply) => {
      const services = getServices();
      const mc = services.missionControlForOrg(request.session!.orgId);
      const result = await mc.getRunSteps(
        toRunId(request.params.runId),
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

  // GET /api/v1/mission-control/runs/:runId/linked-browser-sessions
  server.get<{ Params: { runId: string } }>(
    "/api/v1/mission-control/runs/:runId/linked-browser-sessions",
    { preHandler: [authenticate, requirePermission("observability:read")] },
    async (request, reply) => {
      const services = getServices();
      const mc = services.missionControlForOrg(request.session!.orgId);
      const result = await mc.getLinkedBrowserSessions(
        toRunId(request.params.runId),
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

  // GET /api/v1/mission-control/alerts
  server.get(
    "/api/v1/mission-control/alerts",
    { preHandler: [authenticate, requirePermission("observability:read")] },
    async (request, reply) => {
      const query = alertListQuerySchema.safeParse(request.query);
      if (!query.success) {
        return reply.status(400).send({
          error: { code: "BAD_REQUEST", message: "Invalid query", details: query.error.issues },
          meta: meta(request.id),
        });
      }

      const services = getServices();
      const mc = services.missionControlForOrg(request.session!.orgId);
      const result = await mc.listAlerts(request.session!.orgId, query.data);

      if (!result.ok) {
        return reply.status(result.error.statusCode).send({
          error: { code: result.error.code, message: result.error.message },
          meta: meta(request.id),
        });
      }

      return reply.status(200).send({ data: result.value, meta: meta(request.id) });
    },
  );

  // POST /api/v1/mission-control/alerts/:alertId/acknowledge
  server.post<{ Params: { alertId: string } }>(
    "/api/v1/mission-control/alerts/:alertId/acknowledge",
    { preHandler: [authenticate, requirePermission("observability:alerts")] },
    async (request, reply) => {
      const services = getServices();
      const mc = services.missionControlForOrg(request.session!.orgId);
      const result = await mc.acknowledgeAlert(
        toAlertEventId(request.params.alertId),
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
}
