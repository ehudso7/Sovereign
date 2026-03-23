// ---------------------------------------------------------------------------
// Run Engine routes — /api/v1/runs/*, /api/v1/agents/:agentId/runs
// ---------------------------------------------------------------------------

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { toRunId, toAgentId, toProjectId } from "@sovereign/core";
import type { AgentId, ProjectId, RunStatus } from "@sovereign/core";
import { getServices } from "../services/index.js";
import { authenticate, requirePermission } from "../middleware/auth.js";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const createRunSchema = z.object({
  input: z.record(z.unknown()).optional(),
});

const listRunsQuerySchema = z.object({
  agentId: z.string().uuid().optional(),
  status: z.string().optional(),
  projectId: z.string().uuid().optional(),
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

export async function runRoutes(server: FastifyInstance): Promise<void> {
  // POST /api/v1/agents/:agentId/runs — create a new run for an agent
  server.post<{ Params: { agentId: string } }>(
    "/api/v1/agents/:agentId/runs",
    { preHandler: [authenticate, requirePermission("run:create")] },
    async (request, reply) => {
      const body = createRunSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          error: { code: "BAD_REQUEST", message: "Invalid request body", details: body.error.issues },
          meta: meta(request.id),
        });
      }

      const services = getServices();
      const runService = services.runForOrg(request.session!.orgId);
      const result = await runService.createRun(
        toAgentId(request.params.agentId),
        request.session!.orgId,
        request.session!.userId,
        body.data.input,
        "manual",
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

  // GET /api/v1/agents/:agentId/runs — list runs for a specific agent
  server.get<{ Params: { agentId: string } }>(
    "/api/v1/agents/:agentId/runs",
    { preHandler: [authenticate, requirePermission("run:read")] },
    async (request, reply) => {
      const services = getServices();
      const runService = services.runForOrg(request.session!.orgId);
      const result = await runService.listRunsForAgent(
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

  // GET /api/v1/runs — list runs for the org (all agents, filterable by agentId/status/projectId)
  server.get("/api/v1/runs", { preHandler: [authenticate, requirePermission("run:read")] }, async (request, reply) => {
    const query = listRunsQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).send({
        error: { code: "BAD_REQUEST", message: "Invalid query parameters", details: query.error.issues },
        meta: meta(request.id),
      });
    }

    const services = getServices();
    const runService = services.runForOrg(request.session!.orgId);

    const filters: { agentId?: AgentId; status?: RunStatus; projectId?: ProjectId } = {};
    if (query.data.agentId) filters.agentId = toAgentId(query.data.agentId);
    if (query.data.status) filters.status = query.data.status as RunStatus;
    if (query.data.projectId) filters.projectId = toProjectId(query.data.projectId);

    const result = await runService.listRuns(request.session!.orgId, filters);

    if (!result.ok) {
      return reply.status(result.error.statusCode).send({
        error: { code: result.error.code, message: result.error.message },
        meta: meta(request.id),
      });
    }

    return reply.status(200).send({ data: result.value, meta: meta(request.id) });
  });

  // GET /api/v1/runs/:runId — get a single run
  server.get<{ Params: { runId: string } }>(
    "/api/v1/runs/:runId",
    { preHandler: [authenticate, requirePermission("run:read")] },
    async (request, reply) => {
      const services = getServices();
      const runService = services.runForOrg(request.session!.orgId);
      const result = await runService.getRun(
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

  // GET /api/v1/runs/:runId/steps — get steps for a run
  server.get<{ Params: { runId: string } }>(
    "/api/v1/runs/:runId/steps",
    { preHandler: [authenticate, requirePermission("run:read")] },
    async (request, reply) => {
      const services = getServices();
      const runService = services.runForOrg(request.session!.orgId);
      const result = await runService.getRunSteps(
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

  // POST /api/v1/runs/:runId/pause — pause a running run
  server.post<{ Params: { runId: string } }>(
    "/api/v1/runs/:runId/pause",
    { preHandler: [authenticate, requirePermission("run:control")] },
    async (request, reply) => {
      const services = getServices();
      const runService = services.runForOrg(request.session!.orgId);
      const result = await runService.pauseRun(
        toRunId(request.params.runId),
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

  // POST /api/v1/runs/:runId/resume — resume a paused run
  server.post<{ Params: { runId: string } }>(
    "/api/v1/runs/:runId/resume",
    { preHandler: [authenticate, requirePermission("run:control")] },
    async (request, reply) => {
      const services = getServices();
      const runService = services.runForOrg(request.session!.orgId);
      const result = await runService.resumeRun(
        toRunId(request.params.runId),
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

  // POST /api/v1/runs/:runId/cancel — cancel a run
  server.post<{ Params: { runId: string } }>(
    "/api/v1/runs/:runId/cancel",
    { preHandler: [authenticate, requirePermission("run:control")] },
    async (request, reply) => {
      const services = getServices();
      const runService = services.runForOrg(request.session!.orgId);
      const result = await runService.cancelRun(
        toRunId(request.params.runId),
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
