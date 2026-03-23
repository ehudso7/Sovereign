// ---------------------------------------------------------------------------
// Browser Session routes — /api/v1/browser-sessions/*
// ---------------------------------------------------------------------------

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { toBrowserSessionId, toRunId } from "@sovereign/core";
import type { BrowserSessionStatus, RunId } from "@sovereign/core";
import { getServices } from "../services/index.js";
import { authenticate, requirePermission } from "../middleware/auth.js";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const createSessionSchema = z.object({
  runId: z.string().uuid(),
  browserType: z.enum(["chromium", "firefox", "webkit"]).optional(),
});

const listSessionsQuerySchema = z.object({
  runId: z.string().uuid().optional(),
  status: z.string().optional(),
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

export async function browserSessionRoutes(server: FastifyInstance): Promise<void> {
  // POST /api/v1/browser-sessions — create a new browser session
  server.post(
    "/api/v1/browser-sessions",
    { preHandler: [authenticate, requirePermission("browser:control")] },
    async (request, reply) => {
      const body = createSessionSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          error: { code: "BAD_REQUEST", message: "Invalid request body", details: body.error.issues },
          meta: meta(request.id),
        });
      }

      const services = getServices();
      const browserService = services.browserSessionForOrg(request.session!.orgId);
      const result = await browserService.createSession(
        toRunId(body.data.runId),
        request.session!.orgId,
        request.session!.userId,
        body.data.browserType,
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

  // GET /api/v1/browser-sessions — list browser sessions for the org
  server.get(
    "/api/v1/browser-sessions",
    { preHandler: [authenticate, requirePermission("browser:read")] },
    async (request, reply) => {
      const query = listSessionsQuerySchema.safeParse(request.query);
      if (!query.success) {
        return reply.status(400).send({
          error: { code: "BAD_REQUEST", message: "Invalid query parameters", details: query.error.issues },
          meta: meta(request.id),
        });
      }

      const services = getServices();
      const browserService = services.browserSessionForOrg(request.session!.orgId);

      const filters: { runId?: RunId; status?: BrowserSessionStatus } = {};
      if (query.data.runId) filters.runId = toRunId(query.data.runId);
      if (query.data.status) filters.status = query.data.status as BrowserSessionStatus;

      const result = await browserService.listSessions(request.session!.orgId, filters);

      if (!result.ok) {
        return reply.status(result.error.statusCode).send({
          error: { code: result.error.code, message: result.error.message },
          meta: meta(request.id),
        });
      }

      return reply.status(200).send({ data: result.value, meta: meta(request.id) });
    },
  );

  // GET /api/v1/browser-sessions/:sessionId — get session detail
  server.get<{ Params: { sessionId: string } }>(
    "/api/v1/browser-sessions/:sessionId",
    { preHandler: [authenticate, requirePermission("browser:read")] },
    async (request, reply) => {
      const services = getServices();
      const browserService = services.browserSessionForOrg(request.session!.orgId);
      const result = await browserService.getSession(
        toBrowserSessionId(request.params.sessionId),
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

  // GET /api/v1/browser-sessions/:sessionId/artifacts — list artifact keys
  server.get<{ Params: { sessionId: string } }>(
    "/api/v1/browser-sessions/:sessionId/artifacts",
    { preHandler: [authenticate, requirePermission("browser:read")] },
    async (request, reply) => {
      const services = getServices();
      const browserService = services.browserSessionForOrg(request.session!.orgId);
      const result = await browserService.getSession(
        toBrowserSessionId(request.params.sessionId),
        request.session!.orgId,
      );

      if (!result.ok) {
        return reply.status(result.error.statusCode).send({
          error: { code: result.error.code, message: result.error.message },
          meta: meta(request.id),
        });
      }

      return reply.status(200).send({
        data: result.value.artifactKeys,
        meta: meta(request.id),
      });
    },
  );

  // POST /api/v1/browser-sessions/:sessionId/takeover — request takeover
  server.post<{ Params: { sessionId: string } }>(
    "/api/v1/browser-sessions/:sessionId/takeover",
    { preHandler: [authenticate, requirePermission("browser:takeover")] },
    async (request, reply) => {
      const services = getServices();
      const browserService = services.browserSessionForOrg(request.session!.orgId);
      const result = await browserService.requestTakeover(
        toBrowserSessionId(request.params.sessionId),
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

  // POST /api/v1/browser-sessions/:sessionId/release — release takeover
  server.post<{ Params: { sessionId: string } }>(
    "/api/v1/browser-sessions/:sessionId/release",
    { preHandler: [authenticate, requirePermission("browser:takeover")] },
    async (request, reply) => {
      const services = getServices();
      const browserService = services.browserSessionForOrg(request.session!.orgId);
      const result = await browserService.releaseTakeover(
        toBrowserSessionId(request.params.sessionId),
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

  // POST /api/v1/browser-sessions/:sessionId/close — close session
  server.post<{ Params: { sessionId: string } }>(
    "/api/v1/browser-sessions/:sessionId/close",
    { preHandler: [authenticate, requirePermission("browser:control")] },
    async (request, reply) => {
      const services = getServices();
      const browserService = services.browserSessionForOrg(request.session!.orgId);
      const result = await browserService.closeSession(
        toBrowserSessionId(request.params.sessionId),
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
