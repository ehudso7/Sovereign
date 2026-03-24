// ---------------------------------------------------------------------------
// Onboarding, Docs, Support, Admin routes — Phase 13
// ---------------------------------------------------------------------------

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getServices } from "../services/index.js";
import { authenticate, requirePermission } from "../middleware/auth.js";

const CompleteStepSchema = z.object({
  stepKey: z.string().min(1),
});

function meta(requestId: string) {
  return { request_id: requestId, timestamp: new Date().toISOString() };
}

export async function onboardingRoutes(server: FastifyInstance): Promise<void> {

  // =========================================================================
  // Onboarding
  // =========================================================================

  server.get(
    "/api/v1/onboarding",
    { preHandler: [authenticate, requirePermission("onboarding:read")] },
    async (request, reply) => {
      const session = request.session!;
      const svc = getServices().onboardingForOrg(session.orgId);
      const result = await svc.getProgress(session.orgId);
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  server.post(
    "/api/v1/onboarding/complete",
    { preHandler: [authenticate, requirePermission("onboarding:write")] },
    async (request, reply) => {
      const session = request.session!;
      const validation = CompleteStepSchema.safeParse(request.body);
      if (!validation.success) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "Invalid input", details: validation.error.errors }, meta: meta(request.id) });
      const svc = getServices().onboardingForOrg(session.orgId);
      const result = await svc.completeStep(session.orgId, session.userId, validation.data.stepKey);
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: { completed: true }, meta: meta(request.id) };
    },
  );

  // =========================================================================
  // Docs
  // =========================================================================

  server.get(
    "/api/v1/docs",
    { preHandler: [authenticate, requirePermission("docs:read")] },
    async (request, reply) => {
      const svc = getServices().onboardingForOrg(request.session!.orgId);
      const result = await svc.listDocs();
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  server.get(
    "/api/v1/docs/:slug",
    { preHandler: [authenticate, requirePermission("docs:read")] },
    async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const svc = getServices().onboardingForOrg(request.session!.orgId);
      const result = await svc.getDoc(slug);
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  // =========================================================================
  // Support Diagnostics
  // =========================================================================

  server.get(
    "/api/v1/support/diagnostics",
    { preHandler: [authenticate, requirePermission("support:read")] },
    async (request, reply) => {
      const session = request.session!;
      const svc = getServices().onboardingForOrg(session.orgId);
      const result = await svc.getDiagnostics(session.orgId, session.userId);
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  // =========================================================================
  // Admin
  // =========================================================================

  server.get(
    "/api/v1/admin/overview",
    { preHandler: [authenticate, requirePermission("admin:read")] },
    async (request, reply) => {
      const session = request.session!;
      const svc = getServices().onboardingForOrg(session.orgId);
      const result = await svc.getAdminOverview(session.orgId, session.userId);
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  server.get(
    "/api/v1/admin/memberships",
    { preHandler: [authenticate, requirePermission("admin:read")] },
    async (request, reply) => {
      const session = request.session!;
      const svc = getServices().onboardingForOrg(session.orgId);
      const result = await svc.getAdminMemberships(session.orgId);
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  server.get(
    "/api/v1/admin/settings-summary",
    { preHandler: [authenticate, requirePermission("admin:read")] },
    async (request, reply) => {
      const session = request.session!;
      const svc = getServices().onboardingForOrg(session.orgId);
      const result = await svc.getSettingsSummary(session.orgId);
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );
}
