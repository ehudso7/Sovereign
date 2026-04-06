// ---------------------------------------------------------------------------
// Terminal Session routes — /api/v1/terminal-sessions/* (Phase 15)
// ---------------------------------------------------------------------------

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { toTerminalSessionId } from "@sovereign/core";
import { getServices } from "../services/index.js";
import { authenticate, requirePermission } from "../middleware/auth.js";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const createSessionSchema = z.object({
  projectId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const listSessionsQuerySchema = z.object({
  status: z.enum(["provisioning", "active", "idle", "closed", "failed"]).optional(),
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

export async function terminalSessionRoutes(server: FastifyInstance): Promise<void> {
  // POST /api/v1/terminal-sessions — create a new terminal session
  server.post(
    "/api/v1/terminal-sessions",
    { preHandler: [authenticate, requirePermission("terminal:create")] },
    async (request, reply) => {
      const body = createSessionSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          error: { code: "BAD_REQUEST", message: "Invalid request body", details: body.error.issues },
          meta: meta(request.id),
        });
      }

      const services = getServices();
      const terminalService = services.terminalSessionForOrg(request.session!.orgId);
      const result = await terminalService.createSession({
        orgId: request.session!.orgId,
        userId: request.session!.userId,
        projectId: body.data.projectId,
        metadata: body.data.metadata ?? {},
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

  // GET /api/v1/terminal-sessions — list sessions for the current user
  server.get(
    "/api/v1/terminal-sessions",
    { preHandler: [authenticate, requirePermission("terminal:read")] },
    async (request, reply) => {
      const query = listSessionsQuerySchema.safeParse(request.query);
      if (!query.success) {
        return reply.status(400).send({
          error: { code: "BAD_REQUEST", message: "Invalid query params", details: query.error.issues },
          meta: meta(request.id),
        });
      }

      const services = getServices();
      const terminalService = services.terminalSessionForOrg(request.session!.orgId);
      const result = await terminalService.listSessions({
        userId: request.session!.userId,
        status: query.data.status,
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

  // GET /api/v1/terminal-sessions/:sessionId — get session detail
  server.get(
    "/api/v1/terminal-sessions/:sessionId",
    { preHandler: [authenticate, requirePermission("terminal:read")] },
    async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };

      const services = getServices();
      const terminalService = services.terminalSessionForOrg(request.session!.orgId);
      const result = await terminalService.getSession(toTerminalSessionId(sessionId));

      if (!result.ok) {
        return reply.status(result.error.statusCode).send({
          error: { code: result.error.code, message: result.error.message },
          meta: meta(request.id),
        });
      }

      return reply.send({ data: result.value, meta: meta(request.id) });
    },
  );

  // POST /api/v1/terminal-sessions/:sessionId/close — close session
  server.post(
    "/api/v1/terminal-sessions/:sessionId/close",
    { preHandler: [authenticate, requirePermission("terminal:create")] },
    async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };

      const services = getServices();
      const terminalService = services.terminalSessionForOrg(request.session!.orgId);
      const result = await terminalService.closeSession(toTerminalSessionId(sessionId));

      if (!result.ok) {
        return reply.status(result.error.statusCode).send({
          error: { code: result.error.code, message: result.error.message },
          meta: meta(request.id),
        });
      }

      return reply.send({ data: result.value, meta: meta(request.id) });
    },
  );

  // POST /api/v1/terminal-sessions/:sessionId/resize — resize terminal
  server.post(
    "/api/v1/terminal-sessions/:sessionId/resize",
    { preHandler: [authenticate, requirePermission("terminal:create")] },
    async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const resizeSchema = z.object({
        cols: z.number().int().min(1).max(500),
        rows: z.number().int().min(1).max(200),
      });
      const body = resizeSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          error: { code: "BAD_REQUEST", message: "Invalid resize params", details: body.error.issues },
          meta: meta(request.id),
        });
      }

      // Resize is a pass-through to the terminal proxy; session metadata is updated
      const services = getServices();
      const terminalService = services.terminalSessionForOrg(request.session!.orgId);
      const result = await terminalService.updateSessionMetadata(
        toTerminalSessionId(sessionId),
        { cols: body.data.cols, rows: body.data.rows },
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
