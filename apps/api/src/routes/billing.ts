// ---------------------------------------------------------------------------
// Billing and Usage routes — Phase 12
// ---------------------------------------------------------------------------

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { toInvoiceId, toSpendAlertId } from "@sovereign/core";
import type { BillingPlan, UsageMeter } from "@sovereign/core";
import { getServices } from "../services/index.js";
import { authenticate, requirePermission } from "../middleware/auth.js";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const UpdateAccountSchema = z.object({
  billingEmail: z.string().email().optional(),
  spendLimitCents: z.number().int().min(0).optional(),
});

const ChangePlanSchema = z.object({
  plan: z.enum(["free", "team", "enterprise"]),
});

const CreateSpendAlertSchema = z.object({
  thresholdCents: z.number().int().min(100),
});

const CheckEntitlementSchema = z.object({
  meter: z.enum(["agent_runs", "llm_tokens", "connector_calls", "browser_sessions", "storage_bytes"]),
});

function meta(requestId: string) {
  return { request_id: requestId, timestamp: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function billingRoutes(server: FastifyInstance): Promise<void> {

  // GET /api/v1/billing/account
  server.get(
    "/api/v1/billing/account",
    { preHandler: [authenticate, requirePermission("billing:read")] },
    async (request, reply) => {
      const session = request.session!;
      const svc = getServices().billingForOrg(session.orgId);
      const result = await svc.getOrCreateAccount(session.orgId, session.userId);
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  // PATCH /api/v1/billing/account
  server.patch(
    "/api/v1/billing/account",
    { preHandler: [authenticate, requirePermission("billing:write")] },
    async (request, reply) => {
      const session = request.session!;
      const validation = UpdateAccountSchema.safeParse(request.body);
      if (!validation.success) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "Invalid input", details: validation.error.errors }, meta: meta(request.id) });
      const svc = getServices().billingForOrg(session.orgId);
      const result = await svc.updateAccount(session.orgId, session.userId, validation.data);
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  // GET /api/v1/billing/plans
  server.get(
    "/api/v1/billing/plans",
    { preHandler: [authenticate, requirePermission("billing:read")] },
    async (request, reply) => {
      const svc = getServices().billingForOrg(request.session!.orgId);
      const result = await svc.listPlans();
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  // POST /api/v1/billing/account/change-plan
  server.post(
    "/api/v1/billing/account/change-plan",
    { preHandler: [authenticate, requirePermission("billing:manage_plan")] },
    async (request, reply) => {
      const session = request.session!;
      const validation = ChangePlanSchema.safeParse(request.body);
      if (!validation.success) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "Invalid input", details: validation.error.errors }, meta: meta(request.id) });
      const svc = getServices().billingForOrg(session.orgId);
      const result = await svc.changePlan(session.orgId, session.userId, validation.data.plan as BillingPlan);
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  // GET /api/v1/billing/usage
  server.get(
    "/api/v1/billing/usage",
    { preHandler: [authenticate, requirePermission("billing:read")] },
    async (request, reply) => {
      const session = request.session!;
      const svc = getServices().billingForOrg(session.orgId);
      const result = await svc.getUsageSummary(session.orgId);
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  // GET /api/v1/billing/invoice-preview
  server.get(
    "/api/v1/billing/invoice-preview",
    { preHandler: [authenticate, requirePermission("billing:read")] },
    async (request, reply) => {
      const session = request.session!;
      const svc = getServices().billingForOrg(session.orgId);
      const result = await svc.getInvoicePreview(session.orgId);
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  // GET /api/v1/billing/invoices
  server.get(
    "/api/v1/billing/invoices",
    { preHandler: [authenticate, requirePermission("billing:read")] },
    async (request, reply) => {
      const session = request.session!;
      const query = request.query as Record<string, string | undefined>;
      const svc = getServices().billingForOrg(session.orgId);
      const result = await svc.listInvoices(session.orgId, { status: query.status });
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  // GET /api/v1/billing/invoices/:invoiceId
  server.get(
    "/api/v1/billing/invoices/:invoiceId",
    { preHandler: [authenticate, requirePermission("billing:read")] },
    async (request, reply) => {
      const session = request.session!;
      const { invoiceId } = request.params as { invoiceId: string };
      const svc = getServices().billingForOrg(session.orgId);
      const result = await svc.getInvoice(session.orgId, toInvoiceId(invoiceId));
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  // POST /api/v1/billing/entitlement-check
  server.post(
    "/api/v1/billing/entitlement-check",
    { preHandler: [authenticate, requirePermission("billing:read")] },
    async (request, reply) => {
      const session = request.session!;
      const validation = CheckEntitlementSchema.safeParse(request.body);
      if (!validation.success) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "Invalid input", details: validation.error.errors }, meta: meta(request.id) });
      const svc = getServices().billingForOrg(session.orgId);
      const result = await svc.checkEntitlement(session.orgId, validation.data.meter as UsageMeter);
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  // GET /api/v1/billing/alerts
  server.get(
    "/api/v1/billing/alerts",
    { preHandler: [authenticate, requirePermission("billing:read")] },
    async (request, reply) => {
      const session = request.session!;
      const query = request.query as Record<string, string | undefined>;
      const svc = getServices().billingForOrg(session.orgId);
      const result = await svc.listSpendAlerts(session.orgId, { status: query.status });
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  // POST /api/v1/billing/alerts
  server.post(
    "/api/v1/billing/alerts",
    { preHandler: [authenticate, requirePermission("billing:write")] },
    async (request, reply) => {
      const session = request.session!;
      const validation = CreateSpendAlertSchema.safeParse(request.body);
      if (!validation.success) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "Invalid input", details: validation.error.errors }, meta: meta(request.id) });
      const svc = getServices().billingForOrg(session.orgId);
      const result = await svc.createSpendAlert(session.orgId, session.userId, validation.data.thresholdCents);
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return reply.status(201).send({ data: result.value, meta: meta(request.id) });
    },
  );

  // POST /api/v1/billing/alerts/:alertId/acknowledge
  server.post(
    "/api/v1/billing/alerts/:alertId/acknowledge",
    { preHandler: [authenticate, requirePermission("billing:write")] },
    async (request, reply) => {
      const session = request.session!;
      const { alertId } = request.params as { alertId: string };
      const svc = getServices().billingForOrg(session.orgId);
      const result = await svc.acknowledgeSpendAlert(session.orgId, session.userId, toSpendAlertId(alertId));
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  // POST /api/v1/billing/provider/sync
  server.post(
    "/api/v1/billing/provider/sync",
    { preHandler: [authenticate, requirePermission("billing:sync")] },
    async (request, reply) => {
      const session = request.session!;
      const svc = getServices().billingForOrg(session.orgId);
      const result = await svc.syncWithProvider(session.orgId, session.userId);
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );
}
