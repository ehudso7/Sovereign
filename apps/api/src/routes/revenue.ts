// ---------------------------------------------------------------------------
// Revenue Workspace routes — Phase 11
// ---------------------------------------------------------------------------

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { toCrmAccountId, toCrmContactId, toCrmDealId, toCrmTaskId, toOutreachDraftId } from "@sovereign/core";
import { getServices } from "../services/index.js";
import { authenticate, requirePermission } from "../middleware/auth.js";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const CreateAccountSchema = z.object({
  name: z.string().min(1).max(255),
  domain: z.string().max(255).optional(),
  industry: z.string().max(100).optional(),
  status: z.enum(["active", "inactive", "churned"]).optional(),
  ownerId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

const UpdateAccountSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  domain: z.string().max(255).optional(),
  industry: z.string().max(100).optional(),
  status: z.enum(["active", "inactive", "churned"]).optional(),
  ownerId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

const CreateContactSchema = z.object({
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  email: z.string().email().optional(),
  title: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  accountId: z.string().uuid().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  ownerId: z.string().uuid().optional(),
});

const UpdateContactSchema = z.object({
  firstName: z.string().min(1).max(255).optional(),
  lastName: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
  title: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  accountId: z.string().uuid().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  ownerId: z.string().uuid().optional(),
});

const CreateDealSchema = z.object({
  name: z.string().min(1).max(255),
  accountId: z.string().uuid().optional(),
  stage: z.string().max(100).optional(),
  valueCents: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  currency: z.string().max(3).optional(),
  closeDate: z.string().optional(),
  ownerId: z.string().uuid().optional(),
  probability: z.number().int().min(0).max(100).optional(),
  notes: z.string().optional(),
});

const UpdateDealSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  accountId: z.string().uuid().optional(),
  stage: z.string().max(100).optional(),
  valueCents: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  currency: z.string().max(3).optional(),
  closeDate: z.string().optional(),
  ownerId: z.string().uuid().optional(),
  probability: z.number().int().min(0).max(100).optional(),
  notes: z.string().optional(),
});

const CreateTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  status: z.enum(["open", "in_progress", "completed", "cancelled"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  dueAt: z.string().optional(),
  linkedEntityType: z.string().max(50).optional(),
  linkedEntityId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
});

const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  status: z.enum(["open", "in_progress", "completed", "cancelled"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  dueAt: z.string().optional(),
  linkedEntityType: z.string().max(50).optional(),
  linkedEntityId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
});

const CreateNoteSchema = z.object({
  linkedEntityType: z.string().min(1).max(50),
  linkedEntityId: z.string().uuid(),
  title: z.string().max(500).optional(),
  content: z.string().min(1),
  noteType: z.enum(["general", "meeting", "call", "email"]).optional(),
});

const GenerateOutreachSchema = z.object({
  linkedEntityType: z.string().max(50).optional(),
  linkedEntityId: z.string().uuid().optional(),
  channel: z.enum(["email", "linkedin", "phone"]).optional(),
  context: z.string().optional(),
  contactName: z.string().optional(),
  accountName: z.string().optional(),
});

const SyncEntitySchema = z.object({
  entityType: z.enum(["account", "contact", "deal"]),
  entityId: z.string().uuid(),
  direction: z.enum(["push", "pull"]).optional(),
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

export async function revenueRoutes(server: FastifyInstance): Promise<void> {

  // =========================================================================
  // Overview
  // =========================================================================

  server.get(
    "/api/v1/revenue/overview",
    { preHandler: [authenticate, requirePermission("revenue:read")] },
    async (request, reply) => {
      const session = request.session!;
      const svc = getServices().revenueForOrg(session.orgId);
      const result = await svc.getOverview(session.orgId);
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  // =========================================================================
  // Accounts
  // =========================================================================

  server.get(
    "/api/v1/revenue/accounts",
    { preHandler: [authenticate, requirePermission("revenue:read")] },
    async (request, reply) => {
      const session = request.session!;
      const query = request.query as Record<string, string | undefined>;
      const svc = getServices().revenueForOrg(session.orgId);
      const result = await svc.listAccounts(session.orgId, { status: query.status, ownerId: query.ownerId });
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  server.post(
    "/api/v1/revenue/accounts",
    { preHandler: [authenticate, requirePermission("revenue:write")] },
    async (request, reply) => {
      const session = request.session!;
      const validation = CreateAccountSchema.safeParse(request.body);
      if (!validation.success) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "Invalid input", details: validation.error.errors }, meta: meta(request.id) });
      const svc = getServices().revenueForOrg(session.orgId);
      const result = await svc.createAccount(session.orgId, session.userId, validation.data);
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return reply.status(201).send({ data: result.value, meta: meta(request.id) });
    },
  );

  server.get(
    "/api/v1/revenue/accounts/:accountId",
    { preHandler: [authenticate, requirePermission("revenue:read")] },
    async (request, reply) => {
      const session = request.session!;
      const { accountId } = request.params as { accountId: string };
      const svc = getServices().revenueForOrg(session.orgId);
      const result = await svc.getAccount(session.orgId, toCrmAccountId(accountId));
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  server.patch(
    "/api/v1/revenue/accounts/:accountId",
    { preHandler: [authenticate, requirePermission("revenue:write")] },
    async (request, reply) => {
      const session = request.session!;
      const { accountId } = request.params as { accountId: string };
      const validation = UpdateAccountSchema.safeParse(request.body);
      if (!validation.success) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "Invalid input", details: validation.error.errors }, meta: meta(request.id) });
      const svc = getServices().revenueForOrg(session.orgId);
      const result = await svc.updateAccount(session.orgId, session.userId, toCrmAccountId(accountId), validation.data);
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  // =========================================================================
  // Contacts
  // =========================================================================

  server.get(
    "/api/v1/revenue/contacts",
    { preHandler: [authenticate, requirePermission("revenue:read")] },
    async (request, reply) => {
      const session = request.session!;
      const query = request.query as Record<string, string | undefined>;
      const svc = getServices().revenueForOrg(session.orgId);
      const result = await svc.listContacts(session.orgId, { accountId: query.accountId, ownerId: query.ownerId, status: query.status });
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  server.post(
    "/api/v1/revenue/contacts",
    { preHandler: [authenticate, requirePermission("revenue:write")] },
    async (request, reply) => {
      const session = request.session!;
      const validation = CreateContactSchema.safeParse(request.body);
      if (!validation.success) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "Invalid input", details: validation.error.errors }, meta: meta(request.id) });
      const svc = getServices().revenueForOrg(session.orgId);
      const result = await svc.createContact(session.orgId, session.userId, validation.data);
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return reply.status(201).send({ data: result.value, meta: meta(request.id) });
    },
  );

  server.get(
    "/api/v1/revenue/contacts/:contactId",
    { preHandler: [authenticate, requirePermission("revenue:read")] },
    async (request, reply) => {
      const session = request.session!;
      const { contactId } = request.params as { contactId: string };
      const svc = getServices().revenueForOrg(session.orgId);
      const result = await svc.getContact(session.orgId, toCrmContactId(contactId));
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  server.patch(
    "/api/v1/revenue/contacts/:contactId",
    { preHandler: [authenticate, requirePermission("revenue:write")] },
    async (request, reply) => {
      const session = request.session!;
      const { contactId } = request.params as { contactId: string };
      const validation = UpdateContactSchema.safeParse(request.body);
      if (!validation.success) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "Invalid input", details: validation.error.errors }, meta: meta(request.id) });
      const svc = getServices().revenueForOrg(session.orgId);
      const result = await svc.updateContact(session.orgId, session.userId, toCrmContactId(contactId), validation.data);
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  // =========================================================================
  // Deals
  // =========================================================================

  server.get(
    "/api/v1/revenue/deals",
    { preHandler: [authenticate, requirePermission("revenue:read")] },
    async (request, reply) => {
      const session = request.session!;
      const query = request.query as Record<string, string | undefined>;
      const svc = getServices().revenueForOrg(session.orgId);
      const result = await svc.listDeals(session.orgId, { accountId: query.accountId, stage: query.stage, ownerId: query.ownerId });
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  server.post(
    "/api/v1/revenue/deals",
    { preHandler: [authenticate, requirePermission("revenue:write")] },
    async (request, reply) => {
      const session = request.session!;
      const validation = CreateDealSchema.safeParse(request.body);
      if (!validation.success) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "Invalid input", details: validation.error.errors }, meta: meta(request.id) });
      const svc = getServices().revenueForOrg(session.orgId);
      const result = await svc.createDeal(session.orgId, session.userId, validation.data);
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return reply.status(201).send({ data: result.value, meta: meta(request.id) });
    },
  );

  server.get(
    "/api/v1/revenue/deals/:dealId",
    { preHandler: [authenticate, requirePermission("revenue:read")] },
    async (request, reply) => {
      const session = request.session!;
      const { dealId } = request.params as { dealId: string };
      const svc = getServices().revenueForOrg(session.orgId);
      const result = await svc.getDeal(session.orgId, toCrmDealId(dealId));
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  server.patch(
    "/api/v1/revenue/deals/:dealId",
    { preHandler: [authenticate, requirePermission("revenue:write")] },
    async (request, reply) => {
      const session = request.session!;
      const { dealId } = request.params as { dealId: string };
      const validation = UpdateDealSchema.safeParse(request.body);
      if (!validation.success) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "Invalid input", details: validation.error.errors }, meta: meta(request.id) });
      const svc = getServices().revenueForOrg(session.orgId);
      const result = await svc.updateDeal(session.orgId, session.userId, toCrmDealId(dealId), validation.data);
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  // =========================================================================
  // Tasks
  // =========================================================================

  server.get(
    "/api/v1/revenue/tasks",
    { preHandler: [authenticate, requirePermission("revenue:read")] },
    async (request, reply) => {
      const session = request.session!;
      const query = request.query as Record<string, string | undefined>;
      const svc = getServices().revenueForOrg(session.orgId);
      const result = await svc.listTasks(session.orgId, { status: query.status, ownerId: query.ownerId, linkedEntityType: query.linkedEntityType, linkedEntityId: query.linkedEntityId });
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  server.post(
    "/api/v1/revenue/tasks",
    { preHandler: [authenticate, requirePermission("revenue:write")] },
    async (request, reply) => {
      const session = request.session!;
      const validation = CreateTaskSchema.safeParse(request.body);
      if (!validation.success) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "Invalid input", details: validation.error.errors }, meta: meta(request.id) });
      const svc = getServices().revenueForOrg(session.orgId);
      const result = await svc.createTask(session.orgId, session.userId, validation.data);
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return reply.status(201).send({ data: result.value, meta: meta(request.id) });
    },
  );

  server.get(
    "/api/v1/revenue/tasks/:taskId",
    { preHandler: [authenticate, requirePermission("revenue:read")] },
    async (request, reply) => {
      const session = request.session!;
      const { taskId } = request.params as { taskId: string };
      const svc = getServices().revenueForOrg(session.orgId);
      const result = await svc.getTask(session.orgId, toCrmTaskId(taskId));
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  server.patch(
    "/api/v1/revenue/tasks/:taskId",
    { preHandler: [authenticate, requirePermission("revenue:write")] },
    async (request, reply) => {
      const session = request.session!;
      const { taskId } = request.params as { taskId: string };
      const validation = UpdateTaskSchema.safeParse(request.body);
      if (!validation.success) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "Invalid input", details: validation.error.errors }, meta: meta(request.id) });
      const svc = getServices().revenueForOrg(session.orgId);
      const result = await svc.updateTask(session.orgId, session.userId, toCrmTaskId(taskId), validation.data);
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  // =========================================================================
  // Notes
  // =========================================================================

  server.post(
    "/api/v1/revenue/notes",
    { preHandler: [authenticate, requirePermission("revenue:write")] },
    async (request, reply) => {
      const session = request.session!;
      const validation = CreateNoteSchema.safeParse(request.body);
      if (!validation.success) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "Invalid input", details: validation.error.errors }, meta: meta(request.id) });
      const svc = getServices().revenueForOrg(session.orgId);
      const result = await svc.createNote(session.orgId, session.userId, validation.data);
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return reply.status(201).send({ data: result.value, meta: meta(request.id) });
    },
  );

  server.get(
    "/api/v1/revenue/notes",
    { preHandler: [authenticate, requirePermission("revenue:read")] },
    async (request, reply) => {
      const session = request.session!;
      const query = request.query as Record<string, string | undefined>;
      if (!query.linkedEntityType || !query.linkedEntityId) {
        return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "linkedEntityType and linkedEntityId are required" }, meta: meta(request.id) });
      }
      const svc = getServices().revenueForOrg(session.orgId);
      const result = await svc.listNotesForEntity(session.orgId, query.linkedEntityType, query.linkedEntityId);
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  // =========================================================================
  // Outreach Drafts
  // =========================================================================

  server.post(
    "/api/v1/revenue/outreach-drafts/generate",
    { preHandler: [authenticate, requirePermission("outreach:generate")] },
    async (request, reply) => {
      const session = request.session!;
      const validation = GenerateOutreachSchema.safeParse(request.body);
      if (!validation.success) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "Invalid input", details: validation.error.errors }, meta: meta(request.id) });
      const svc = getServices().revenueForOrg(session.orgId);
      const result = await svc.generateOutreachDraft(session.orgId, session.userId, validation.data);
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return reply.status(201).send({ data: result.value, meta: meta(request.id) });
    },
  );

  server.get(
    "/api/v1/revenue/outreach-drafts/:draftId",
    { preHandler: [authenticate, requirePermission("revenue:read")] },
    async (request, reply) => {
      const session = request.session!;
      const { draftId } = request.params as { draftId: string };
      const svc = getServices().revenueForOrg(session.orgId);
      const result = await svc.getOutreachDraft(session.orgId, toOutreachDraftId(draftId));
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  server.get(
    "/api/v1/revenue/outreach-drafts",
    { preHandler: [authenticate, requirePermission("revenue:read")] },
    async (request, reply) => {
      const session = request.session!;
      const query = request.query as Record<string, string | undefined>;
      const svc = getServices().revenueForOrg(session.orgId);
      const result = await svc.listOutreachDrafts(session.orgId, { approvalStatus: query.approvalStatus });
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );

  // =========================================================================
  // CRM Sync
  // =========================================================================

  server.post(
    "/api/v1/revenue/sync",
    { preHandler: [authenticate, requirePermission("revenue:sync")] },
    async (request, reply) => {
      const session = request.session!;
      const validation = SyncEntitySchema.safeParse(request.body);
      if (!validation.success) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "Invalid input", details: validation.error.errors }, meta: meta(request.id) });
      const svc = getServices().revenueForOrg(session.orgId);
      const result = await svc.syncEntity(session.orgId, session.userId, validation.data);
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return reply.status(201).send({ data: result.value, meta: meta(request.id) });
    },
  );

  server.get(
    "/api/v1/revenue/sync",
    { preHandler: [authenticate, requirePermission("revenue:read")] },
    async (request, reply) => {
      const session = request.session!;
      const query = request.query as Record<string, string | undefined>;
      const svc = getServices().revenueForOrg(session.orgId);
      const result = await svc.listSyncLogs(session.orgId, { status: query.status, entityType: query.entityType });
      if (!result.ok) return reply.status(result.error.statusCode).send({ error: result.error.toJSON(), meta: meta(request.id) });
      return { data: result.value, meta: meta(request.id) };
    },
  );
}
