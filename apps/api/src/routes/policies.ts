// ---------------------------------------------------------------------------
// Policy, Approval, Quarantine, Audit routes — Phase 10
// ---------------------------------------------------------------------------

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { toPolicyId, toApprovalId, toQuarantineRecordId } from "@sovereign/core";

import { getServices } from "../services/index.js";
import { authenticate, requirePermission } from "../middleware/auth.js";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const CreatePolicySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  policyType: z.enum(["access_control", "deny", "require_approval", "quarantine", "budget_cap", "content_filter"]),
  enforcementMode: z.enum(["allow", "deny", "require_approval", "quarantine"]),
  scopeType: z.enum(["org", "project", "agent", "connector", "browser", "memory", "run"]),
  scopeId: z.string().uuid().optional(),
  rules: z.array(z.object({
    actionPattern: z.string().min(1),
    conditions: z.record(z.unknown()).optional(),
  })).optional(),
  priority: z.coerce.number().int().min(0).max(1000).optional(),
});

const UpdatePolicySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  rules: z.array(z.object({
    actionPattern: z.string().min(1),
    conditions: z.record(z.unknown()).optional(),
  })).optional(),
  priority: z.coerce.number().int().min(0).max(1000).optional(),
  enforcementMode: z.enum(["allow", "deny", "require_approval", "quarantine"]).optional(),
});

const EvaluatePolicySchema = z.object({
  subjectType: z.string().min(1),
  subjectId: z.string().uuid().optional(),
  actionType: z.string().min(1),
  context: z.record(z.unknown()).optional(),
});

const DecisionSchema = z.object({
  note: z.string().optional(),
});

const QuarantineSchema = z.object({
  subjectType: z.string().min(1),
  subjectId: z.string().uuid(),
  reason: z.string().min(1),
});

const ReleaseSchema = z.object({
  note: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function meta(requestId: string) {
  return { request_id: requestId, timestamp: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function policyRoutes(server: FastifyInstance): Promise<void> {
  // =========================================================================
  // Policy CRUD
  // =========================================================================

  // GET /api/v1/policies
  server.get(
    "/api/v1/policies",
    { preHandler: [authenticate, requirePermission("policy:read")] },
    async (request, reply) => {
      const session = request.session!;
      const svc = getServices().policyForOrg(session.orgId);
      const query = request.query as Record<string, string | undefined>;
      const result = await svc.listPolicies(session.orgId, {
        status: query.status,
        scopeType: query.scopeType,
        policyType: query.policyType,
      });
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  // POST /api/v1/policies
  server.post(
    "/api/v1/policies",
    { preHandler: [authenticate, requirePermission("policy:write")] },
    async (request, reply) => {
      const session = request.session!;
      const parsed = CreatePolicySchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: parsed.error.message }, meta: meta(request.id) });

      const svc = getServices().policyForOrg(session.orgId);
      const result = await svc.createPolicy({ ...parsed.data, orgId: session.orgId, createdBy: session.userId });
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return reply.status(201).send({ data: result.value, meta: meta(request.id) });
    },
  );

  // GET /api/v1/policies/:policyId
  server.get(
    "/api/v1/policies/:policyId",
    { preHandler: [authenticate, requirePermission("policy:read")] },
    async (request, reply) => {
      const session = request.session!;
      const { policyId } = request.params as { policyId: string };
      const svc = getServices().policyForOrg(session.orgId);
      const result = await svc.getPolicy(toPolicyId(policyId), session.orgId);
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  // PATCH /api/v1/policies/:policyId
  server.patch(
    "/api/v1/policies/:policyId",
    { preHandler: [authenticate, requirePermission("policy:write")] },
    async (request, reply) => {
      const session = request.session!;
      const { policyId } = request.params as { policyId: string };
      const parsed = UpdatePolicySchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: parsed.error.message }, meta: meta(request.id) });

      const svc = getServices().policyForOrg(session.orgId);
      const result = await svc.updatePolicy(toPolicyId(policyId), session.orgId, { ...parsed.data, updatedBy: session.userId });
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  // POST /api/v1/policies/:policyId/disable
  server.post(
    "/api/v1/policies/:policyId/disable",
    { preHandler: [authenticate, requirePermission("policy:write")] },
    async (request, reply) => {
      const session = request.session!;
      const { policyId } = request.params as { policyId: string };
      const svc = getServices().policyForOrg(session.orgId);
      const result = await svc.disablePolicy(toPolicyId(policyId), session.orgId, session.userId);
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  // POST /api/v1/policies/:policyId/enable
  server.post(
    "/api/v1/policies/:policyId/enable",
    { preHandler: [authenticate, requirePermission("policy:write")] },
    async (request, reply) => {
      const session = request.session!;
      const { policyId } = request.params as { policyId: string };
      const svc = getServices().policyForOrg(session.orgId);
      const result = await svc.enablePolicy(toPolicyId(policyId), session.orgId, session.userId);
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  // POST /api/v1/policies/evaluate
  server.post(
    "/api/v1/policies/evaluate",
    { preHandler: [authenticate, requirePermission("policy:read")] },
    async (request, reply) => {
      const session = request.session!;
      const parsed = EvaluatePolicySchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: parsed.error.message }, meta: meta(request.id) });

      const svc = getServices().policyForOrg(session.orgId);
      const result = await svc.evaluate({
        orgId: session.orgId,
        requestedBy: session.userId,
        ...parsed.data,
      });
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  // =========================================================================
  // Approvals
  // =========================================================================

  // GET /api/v1/approvals
  server.get(
    "/api/v1/approvals",
    { preHandler: [authenticate, requirePermission("approval:read")] },
    async (request, reply) => {
      const session = request.session!;
      const query = request.query as Record<string, string | undefined>;
      const svc = getServices().policyForOrg(session.orgId);
      const result = await svc.listApprovals(session.orgId, {
        status: query.status,
        subjectType: query.subjectType,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
      });
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  // GET /api/v1/approvals/:approvalId
  server.get(
    "/api/v1/approvals/:approvalId",
    { preHandler: [authenticate, requirePermission("approval:read")] },
    async (request, reply) => {
      const session = request.session!;
      const { approvalId } = request.params as { approvalId: string };
      const svc = getServices().policyForOrg(session.orgId);
      const result = await svc.getApproval(toApprovalId(approvalId), session.orgId);
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  // POST /api/v1/approvals/:approvalId/approve
  server.post(
    "/api/v1/approvals/:approvalId/approve",
    { preHandler: [authenticate, requirePermission("approval:decide")] },
    async (request, reply) => {
      const session = request.session!;
      const { approvalId } = request.params as { approvalId: string };
      const parsed = DecisionSchema.safeParse(request.body ?? {});
      if (!parsed.success) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: parsed.error.message }, meta: meta(request.id) });

      const svc = getServices().policyForOrg(session.orgId);
      const result = await svc.approveRequest(toApprovalId(approvalId), session.orgId, session.userId, parsed.data.note);
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  // POST /api/v1/approvals/:approvalId/deny
  server.post(
    "/api/v1/approvals/:approvalId/deny",
    { preHandler: [authenticate, requirePermission("approval:decide")] },
    async (request, reply) => {
      const session = request.session!;
      const { approvalId } = request.params as { approvalId: string };
      const parsed = DecisionSchema.safeParse(request.body ?? {});
      if (!parsed.success) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: parsed.error.message }, meta: meta(request.id) });

      const svc = getServices().policyForOrg(session.orgId);
      const result = await svc.denyRequest(toApprovalId(approvalId), session.orgId, session.userId, parsed.data.note);
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  // =========================================================================
  // Quarantine
  // =========================================================================

  // GET /api/v1/quarantine
  server.get(
    "/api/v1/quarantine",
    { preHandler: [authenticate, requirePermission("quarantine:read")] },
    async (request, reply) => {
      const session = request.session!;
      const query = request.query as Record<string, string | undefined>;
      const svc = getServices().policyForOrg(session.orgId);
      const result = await svc.listQuarantine(session.orgId, {
        status: query.status,
        subjectType: query.subjectType,
      });
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  // POST /api/v1/quarantine
  server.post(
    "/api/v1/quarantine",
    { preHandler: [authenticate, requirePermission("quarantine:manage")] },
    async (request, reply) => {
      const session = request.session!;
      const parsed = QuarantineSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: parsed.error.message }, meta: meta(request.id) });

      const svc = getServices().policyForOrg(session.orgId);
      const result = await svc.quarantineSubject({
        orgId: session.orgId,
        quarantinedBy: session.userId,
        ...parsed.data,
      });
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return reply.status(201).send({ data: result.value, meta: meta(request.id) });
    },
  );

  // POST /api/v1/quarantine/:recordId/release
  server.post(
    "/api/v1/quarantine/:recordId/release",
    { preHandler: [authenticate, requirePermission("quarantine:manage")] },
    async (request, reply) => {
      const session = request.session!;
      const { recordId } = request.params as { recordId: string };
      const parsed = ReleaseSchema.safeParse(request.body ?? {});
      if (!parsed.success) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: parsed.error.message }, meta: meta(request.id) });

      const svc = getServices().policyForOrg(session.orgId);
      const result = await svc.releaseFromQuarantine(
        toQuarantineRecordId(recordId), session.orgId, session.userId, parsed.data.note,
      );
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  // =========================================================================
  // Audit (read-only)
  // =========================================================================

  // GET /api/v1/audit
  server.get(
    "/api/v1/audit",
    { preHandler: [authenticate, requirePermission("audit:read")] },
    async (request) => {
      const session = request.session!;
      const query = request.query as Record<string, string | undefined>;
      const services = getServices();
      const auditEmitter = services.auditForOrg(session.orgId);
      const events = await auditEmitter.query(session.orgId, {
        action: query.action as never,
        resourceType: query.resourceType,
        resourceId: query.resourceId,
        actorId: query.actorId as never,
        limit: query.limit ? parseInt(query.limit, 10) : 100,
      });
      return { data: events, meta: meta(request.id) };
    },
  );

  // GET /api/v1/audit/:eventId
  server.get(
    "/api/v1/audit/:eventId",
    { preHandler: [authenticate, requirePermission("audit:read")] },
    async (request, reply) => {
      const session = request.session!;
      const { eventId } = request.params as { eventId: string };
      const services = getServices();
      const auditEmitter = services.auditForOrg(session.orgId);
      // Query by resourceId to find the event
      const events = await auditEmitter.query(session.orgId, { limit: 500 });
      const event = events.find((e) => e.id === eventId);
      if (!event) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Audit event not found" }, meta: meta(request.id) });
      return { data: event, meta: meta(request.id) };
    },
  );
}
