// ---------------------------------------------------------------------------
// Connector routes — /api/v1/connectors/*
// ---------------------------------------------------------------------------

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { toConnectorId } from "@sovereign/core";
import { getServices } from "../services/index.js";
import { authenticate, requirePermission } from "../middleware/auth.js";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const configureSchema = z.object({
  config: z.record(z.unknown()).optional(),
  credentials: z
    .object({
      type: z.string().min(1),
      data: z.string().min(1),
    })
    .optional(),
});

const installSchema = z.object({
  config: z.record(z.unknown()).optional(),
  grantedScopes: z.array(z.string()).optional(),
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

export async function connectorRoutes(server: FastifyInstance): Promise<void> {
  // GET /api/v1/connectors — list catalog
  server.get(
    "/api/v1/connectors",
    { preHandler: [authenticate, requirePermission("connector:read")] },
    async (request, reply) => {
      const query = request.query as Record<string, string>;
      const services = getServices();
      const connectorService = services.connectorForOrg(request.session!.orgId);

      const filters: { category?: string; trustTier?: string } = {};
      if (query.category) filters.category = query.category;
      if (query.trustTier) filters.trustTier = query.trustTier;

      const result = await connectorService.listCatalog(filters);

      if (!result.ok) {
        return reply.status(result.error.statusCode).send({
          error: { code: result.error.code, message: result.error.message },
          meta: meta(request.id),
        });
      }

      return reply.status(200).send({ data: result.value, meta: meta(request.id) });
    },
  );

  // GET /api/v1/connectors/installed — list installed for org
  server.get(
    "/api/v1/connectors/installed",
    { preHandler: [authenticate, requirePermission("connector:read")] },
    async (request, reply) => {
      const services = getServices();
      const connectorService = services.connectorForOrg(request.session!.orgId);

      const result = await connectorService.listInstalled(request.session!.orgId);

      if (!result.ok) {
        return reply.status(result.error.statusCode).send({
          error: { code: result.error.code, message: result.error.message },
          meta: meta(request.id),
        });
      }

      return reply.status(200).send({ data: result.value, meta: meta(request.id) });
    },
  );

  // GET /api/v1/connectors/:connectorId — get connector detail
  server.get<{ Params: { connectorId: string } }>(
    "/api/v1/connectors/:connectorId",
    { preHandler: [authenticate, requirePermission("connector:read")] },
    async (request, reply) => {
      const services = getServices();
      const connectorService = services.connectorForOrg(request.session!.orgId);

      const result = await connectorService.getConnector(
        toConnectorId(request.params.connectorId),
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

  // GET /api/v1/connectors/:connectorId/scopes — get connector scopes
  server.get<{ Params: { connectorId: string } }>(
    "/api/v1/connectors/:connectorId/scopes",
    { preHandler: [authenticate, requirePermission("connector:read")] },
    async (request, reply) => {
      const services = getServices();
      const connectorService = services.connectorForOrg(request.session!.orgId);

      const result = await connectorService.getScopes(
        toConnectorId(request.params.connectorId),
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

  // POST /api/v1/connectors/:connectorId/install — install connector
  server.post<{ Params: { connectorId: string } }>(
    "/api/v1/connectors/:connectorId/install",
    { preHandler: [authenticate, requirePermission("connector:install")] },
    async (request, reply) => {
      const body = installSchema.safeParse(request.body ?? {});
      if (!body.success) {
        return reply.status(400).send({
          error: { code: "BAD_REQUEST", message: "Invalid request body", details: body.error.issues },
          meta: meta(request.id),
        });
      }

      const services = getServices();
      const connectorService = services.connectorForOrg(request.session!.orgId);

      const result = await connectorService.install(
        toConnectorId(request.params.connectorId),
        request.session!.orgId,
        request.session!.userId,
        body.data.config,
        body.data.grantedScopes,
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

  // PATCH /api/v1/connectors/:connectorId/configure — configure with credentials
  server.patch<{ Params: { connectorId: string } }>(
    "/api/v1/connectors/:connectorId/configure",
    { preHandler: [authenticate, requirePermission("connector:configure")] },
    async (request, reply) => {
      const body = configureSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          error: { code: "BAD_REQUEST", message: "Invalid request body", details: body.error.issues },
          meta: meta(request.id),
        });
      }

      const services = getServices();
      const connectorService = services.connectorForOrg(request.session!.orgId);

      const result = await connectorService.configure(
        toConnectorId(request.params.connectorId),
        request.session!.orgId,
        request.session!.userId,
        body.data.config,
        body.data.credentials,
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

  // POST /api/v1/connectors/:connectorId/test — test connector
  server.post<{ Params: { connectorId: string } }>(
    "/api/v1/connectors/:connectorId/test",
    { preHandler: [authenticate, requirePermission("connector:test")] },
    async (request, reply) => {
      const services = getServices();
      const connectorService = services.connectorForOrg(request.session!.orgId);

      const result = await connectorService.test(
        toConnectorId(request.params.connectorId),
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

  // POST /api/v1/connectors/:connectorId/revoke — revoke connector
  server.post<{ Params: { connectorId: string } }>(
    "/api/v1/connectors/:connectorId/revoke",
    { preHandler: [authenticate, requirePermission("connector:revoke")] },
    async (request, reply) => {
      const services = getServices();
      const connectorService = services.connectorForOrg(request.session!.orgId);

      const result = await connectorService.revoke(
        toConnectorId(request.params.connectorId),
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
