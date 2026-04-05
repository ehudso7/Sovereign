// ---------------------------------------------------------------------------
// Revenue Workspace Service — Phase 11
// ---------------------------------------------------------------------------

import {
  ok,
  err,
  AppError,
} from "@sovereign/core";
import type {
  OrgId,
  UserId,
  Result,
  CrmAccountId,
  CrmContactId,
  CrmDealId,
  CrmTaskId,
  OutreachDraftId,
  CrmAccount,
  CrmContact,
  CrmDeal,
  CrmTask,
  CrmNote,
  OutreachDraft,
  CrmSyncLog,
  AuditEmitter,
} from "@sovereign/core";
import type {
  CrmAccountRepo,
  CrmContactRepo,
  CrmDealRepo,
  CrmTaskRepo,
  CrmNoteRepo,
  OutreachDraftRepo,
  CrmSyncLogRepo,
} from "@sovereign/db";

// ---------------------------------------------------------------------------
// Revenue Overview
// ---------------------------------------------------------------------------

export interface RevenueOverview {
  accountCount: number;
  contactCount: number;
  dealCount: number;
  taskCount: number;
  openDealValueCents: number;
  dealsByStage: Record<string, number>;
  openTaskCount: number;
  recentSyncCount: number;
}

// ---------------------------------------------------------------------------
// CRM Sync Adapter (minimal stub for dev/proof)
// ---------------------------------------------------------------------------

export interface CrmSyncAdapter {
  pushAccount(account: CrmAccount): Promise<{ externalId: string }>;
  pushContact(contact: CrmContact): Promise<{ externalId: string }>;
  pushDeal(deal: CrmDeal): Promise<{ externalId: string }>;
}

/** Local/dev stub sync adapter — simulates external CRM sync */
export class LocalCrmSyncAdapter implements CrmSyncAdapter {
  async pushAccount(account: CrmAccount): Promise<{ externalId: string }> {
    return { externalId: `ext-account-${account.id.slice(0, 8)}` };
  }
  async pushContact(contact: CrmContact): Promise<{ externalId: string }> {
    return { externalId: `ext-contact-${contact.id.slice(0, 8)}` };
  }
  async pushDeal(deal: CrmDeal): Promise<{ externalId: string }> {
    return { externalId: `ext-deal-${deal.id.slice(0, 8)}` };
  }
}

// ---------------------------------------------------------------------------
// PgRevenueService
// ---------------------------------------------------------------------------

export class PgRevenueService {
  constructor(
    private readonly accountRepo: CrmAccountRepo,
    private readonly contactRepo: CrmContactRepo,
    private readonly dealRepo: CrmDealRepo,
    private readonly taskRepo: CrmTaskRepo,
    private readonly noteRepo: CrmNoteRepo,
    private readonly draftRepo: OutreachDraftRepo,
    private readonly syncLogRepo: CrmSyncLogRepo,
    private readonly auditEmitter: AuditEmitter,
    private readonly syncAdapter: CrmSyncAdapter = new LocalCrmSyncAdapter(),
  ) {}

  private _policyService: import("./policy.service.js").PgPolicyService | null = null;

  /** Attach a policy service for runtime enforcement of sync actions. */
  setPolicyService(svc: import("./policy.service.js").PgPolicyService): void {
    this._policyService = svc;
  }

  // =========================================================================
  // Accounts
  // =========================================================================

  async createAccount(orgId: OrgId, userId: UserId, input: {
    name: string; domain?: string; industry?: string; status?: string;
    ownerId?: string; notes?: string;
  }): Promise<Result<CrmAccount>> {
    try {
      const account = await this.accountRepo.create({
        orgId, name: input.name, domain: input.domain, industry: input.industry,
        status: input.status, ownerId: input.ownerId as UserId | undefined,
        notes: input.notes, createdBy: userId,
      });
      await this.auditEmitter.emit({
        orgId, actorId: userId, actorType: "user",
        action: "revenue.account_created", resourceType: "crm_account",
        resourceId: account.id, metadata: { name: account.name },
      });
      return ok(account);
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  async getAccount(orgId: OrgId, id: CrmAccountId): Promise<Result<CrmAccount>> {
    try {
      const account = await this.accountRepo.getById(id, orgId);
      if (!account) return err(AppError.notFound("Account", id));
      return ok(account);
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  async listAccounts(orgId: OrgId, filters?: { status?: string; ownerId?: string }): Promise<Result<CrmAccount[]>> {
    try {
      const accounts = await this.accountRepo.listForOrg(orgId, {
        status: filters?.status,
        ownerId: filters?.ownerId as UserId | undefined,
      });
      return ok(accounts);
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  async updateAccount(orgId: OrgId, userId: UserId, id: CrmAccountId, input: {
    name?: string; domain?: string; industry?: string; status?: string;
    ownerId?: string; notes?: string;
  }): Promise<Result<CrmAccount>> {
    try {
      const account = await this.accountRepo.update(id, orgId, {
        ...input, ownerId: input.ownerId as UserId | undefined, updatedBy: userId,
      });
      if (!account) return err(AppError.notFound("Account", id));
      await this.auditEmitter.emit({
        orgId, actorId: userId, actorType: "user",
        action: "revenue.account_updated", resourceType: "crm_account",
        resourceId: account.id, metadata: { name: account.name },
      });
      return ok(account);
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  // =========================================================================
  // Contacts
  // =========================================================================

  async createContact(orgId: OrgId, userId: UserId, input: {
    firstName: string; lastName: string; email?: string; title?: string;
    phone?: string; accountId?: string; status?: string; ownerId?: string;
  }): Promise<Result<CrmContact>> {
    try {
      const contact = await this.contactRepo.create({
        orgId, firstName: input.firstName, lastName: input.lastName,
        email: input.email, title: input.title, phone: input.phone,
        accountId: input.accountId, status: input.status,
        ownerId: input.ownerId as UserId | undefined, createdBy: userId,
      });
      await this.auditEmitter.emit({
        orgId, actorId: userId, actorType: "user",
        action: "revenue.contact_created", resourceType: "crm_contact",
        resourceId: contact.id, metadata: { name: `${contact.firstName} ${contact.lastName}` },
      });
      return ok(contact);
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  async getContact(orgId: OrgId, id: CrmContactId): Promise<Result<CrmContact>> {
    try {
      const contact = await this.contactRepo.getById(id, orgId);
      if (!contact) return err(AppError.notFound("Contact", id));
      return ok(contact);
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  async listContacts(orgId: OrgId, filters?: { accountId?: string; ownerId?: string; status?: string }): Promise<Result<CrmContact[]>> {
    try {
      const contacts = await this.contactRepo.listForOrg(orgId, {
        accountId: filters?.accountId,
        ownerId: filters?.ownerId as UserId | undefined,
        status: filters?.status,
      });
      return ok(contacts);
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  async updateContact(orgId: OrgId, userId: UserId, id: CrmContactId, input: {
    firstName?: string; lastName?: string; email?: string; title?: string;
    phone?: string; accountId?: string; status?: string; ownerId?: string;
  }): Promise<Result<CrmContact>> {
    try {
      const contact = await this.contactRepo.update(id, orgId, {
        ...input, ownerId: input.ownerId as UserId | undefined, updatedBy: userId,
      });
      if (!contact) return err(AppError.notFound("Contact", id));
      await this.auditEmitter.emit({
        orgId, actorId: userId, actorType: "user",
        action: "revenue.contact_updated", resourceType: "crm_contact",
        resourceId: contact.id, metadata: { name: `${contact.firstName} ${contact.lastName}` },
      });
      return ok(contact);
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  // =========================================================================
  // Deals
  // =========================================================================

  async createDeal(orgId: OrgId, userId: UserId, input: {
    name: string; accountId?: string; stage?: string; valueCents?: number;
    currency?: string; closeDate?: string; ownerId?: string;
    probability?: number; notes?: string;
  }): Promise<Result<CrmDeal>> {
    try {
      const deal = await this.dealRepo.create({
        orgId, name: input.name, accountId: input.accountId,
        stage: input.stage, valueCents: input.valueCents,
        currency: input.currency, closeDate: input.closeDate,
        ownerId: input.ownerId as UserId | undefined,
        probability: input.probability, notes: input.notes, createdBy: userId,
      });
      await this.auditEmitter.emit({
        orgId, actorId: userId, actorType: "user",
        action: "revenue.deal_created", resourceType: "crm_deal",
        resourceId: deal.id, metadata: { name: deal.name, stage: deal.stage },
      });
      return ok(deal);
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  async getDeal(orgId: OrgId, id: CrmDealId): Promise<Result<CrmDeal>> {
    try {
      const deal = await this.dealRepo.getById(id, orgId);
      if (!deal) return err(AppError.notFound("Deal", id));
      return ok(deal);
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  async listDeals(orgId: OrgId, filters?: { accountId?: string; stage?: string; ownerId?: string }): Promise<Result<CrmDeal[]>> {
    try {
      const deals = await this.dealRepo.listForOrg(orgId, {
        accountId: filters?.accountId,
        stage: filters?.stage,
        ownerId: filters?.ownerId as UserId | undefined,
      });
      return ok(deals);
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  async updateDeal(orgId: OrgId, userId: UserId, id: CrmDealId, input: {
    name?: string; accountId?: string; stage?: string; valueCents?: number;
    currency?: string; closeDate?: string; ownerId?: string;
    probability?: number; notes?: string;
  }): Promise<Result<CrmDeal>> {
    try {
      const deal = await this.dealRepo.update(id, orgId, {
        ...input, ownerId: input.ownerId as UserId | undefined, updatedBy: userId,
      });
      if (!deal) return err(AppError.notFound("Deal", id));
      await this.auditEmitter.emit({
        orgId, actorId: userId, actorType: "user",
        action: "revenue.deal_updated", resourceType: "crm_deal",
        resourceId: deal.id, metadata: { name: deal.name, stage: deal.stage },
      });
      return ok(deal);
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  // =========================================================================
  // Tasks
  // =========================================================================

  async createTask(orgId: OrgId, userId: UserId, input: {
    title: string; description?: string; status?: string; priority?: string;
    dueAt?: string; linkedEntityType?: string; linkedEntityId?: string;
    ownerId?: string;
  }): Promise<Result<CrmTask>> {
    try {
      const task = await this.taskRepo.create({
        orgId, title: input.title, description: input.description,
        status: input.status, priority: input.priority,
        dueAt: input.dueAt, linkedEntityType: input.linkedEntityType,
        linkedEntityId: input.linkedEntityId,
        ownerId: input.ownerId as UserId | undefined, createdBy: userId,
      });
      await this.auditEmitter.emit({
        orgId, actorId: userId, actorType: "user",
        action: "revenue.task_created", resourceType: "crm_task",
        resourceId: task.id, metadata: { title: task.title },
      });
      return ok(task);
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  async getTask(orgId: OrgId, id: CrmTaskId): Promise<Result<CrmTask>> {
    try {
      const task = await this.taskRepo.getById(id, orgId);
      if (!task) return err(AppError.notFound("Task", id));
      return ok(task);
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  async listTasks(orgId: OrgId, filters?: { status?: string; ownerId?: string; linkedEntityType?: string; linkedEntityId?: string }): Promise<Result<CrmTask[]>> {
    try {
      const tasks = await this.taskRepo.listForOrg(orgId, {
        status: filters?.status,
        ownerId: filters?.ownerId as UserId | undefined,
        linkedEntityType: filters?.linkedEntityType,
        linkedEntityId: filters?.linkedEntityId,
      });
      return ok(tasks);
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  async updateTask(orgId: OrgId, userId: UserId, id: CrmTaskId, input: {
    title?: string; description?: string; status?: string; priority?: string;
    dueAt?: string; linkedEntityType?: string; linkedEntityId?: string;
    ownerId?: string;
  }): Promise<Result<CrmTask>> {
    try {
      const task = await this.taskRepo.update(id, orgId, {
        ...input, ownerId: input.ownerId as UserId | undefined, updatedBy: userId,
      });
      if (!task) return err(AppError.notFound("Task", id));
      await this.auditEmitter.emit({
        orgId, actorId: userId, actorType: "user",
        action: "revenue.task_updated", resourceType: "crm_task",
        resourceId: task.id, metadata: { title: task.title, status: task.status },
      });
      return ok(task);
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  // =========================================================================
  // Notes
  // =========================================================================

  async createNote(orgId: OrgId, userId: UserId, input: {
    linkedEntityType: string; linkedEntityId: string;
    title?: string; content: string; noteType?: string;
  }): Promise<Result<CrmNote>> {
    try {
      const note = await this.noteRepo.create({
        orgId, linkedEntityType: input.linkedEntityType,
        linkedEntityId: input.linkedEntityId, title: input.title,
        content: input.content, noteType: input.noteType, createdBy: userId,
      });
      await this.auditEmitter.emit({
        orgId, actorId: userId, actorType: "user",
        action: "revenue.note_created", resourceType: "crm_note",
        resourceId: note.id, metadata: { linkedEntityType: note.linkedEntityType, linkedEntityId: note.linkedEntityId },
      });
      return ok(note);
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  async listNotesForEntity(orgId: OrgId, linkedEntityType: string, linkedEntityId: string): Promise<Result<CrmNote[]>> {
    try {
      const notes = await this.noteRepo.listForEntity(orgId, linkedEntityType, linkedEntityId);
      return ok(notes);
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  // =========================================================================
  // Outreach Drafts
  // =========================================================================

  async generateOutreachDraft(orgId: OrgId, userId: UserId, input: {
    linkedEntityType?: string; linkedEntityId?: string;
    channel?: string; context?: string; contactName?: string; accountName?: string;
  }): Promise<Result<OutreachDraft>> {
    try {
      // Gather context for generation
      const contextParts: string[] = [];
      if (input.context) contextParts.push(input.context);

      // If linked to a contact, gather their info for the draft
      if (input.linkedEntityType === "contact" && input.linkedEntityId) {
        const contact = await this.contactRepo.getById(input.linkedEntityId as CrmContactId, orgId);
        if (contact) {
          contextParts.push(`Contact: ${contact.firstName} ${contact.lastName}`);
          if (contact.title) contextParts.push(`Title: ${contact.title}`);
          if (contact.email) contextParts.push(`Email: ${contact.email}`);
        }
      }

      if (input.linkedEntityType === "account" && input.linkedEntityId) {
        const account = await this.accountRepo.getById(input.linkedEntityId as CrmAccountId, orgId);
        if (account) {
          contextParts.push(`Account: ${account.name}`);
          if (account.industry) contextParts.push(`Industry: ${account.industry}`);
        }
      }

      // Gather relevant notes for context
      if (input.linkedEntityType && input.linkedEntityId) {
        const notes = await this.noteRepo.listForEntity(orgId, input.linkedEntityType, input.linkedEntityId);
        if (notes.length > 0) {
          contextParts.push(`Recent notes: ${notes.slice(0, 3).map(n => n.content).join(" | ")}`);
        }
      }

      const channel = input.channel ?? "email";
      const contactName = input.contactName ?? "there";

      // Derive accountName from input or from linked entity context
      let accountName = input.accountName ?? "";
      if (!accountName && input.linkedEntityType === "account" && input.linkedEntityId) {
        const account = await this.accountRepo.getById(input.linkedEntityId as CrmAccountId, orgId);
        if (account) accountName = account.name;
      }

      // Generate draft content (deterministic for dev/CI, production would use AI runtime)
      // The user-provided context is treated as instructions to shape the outreach tone,
      // NOT pasted verbatim into the body.
      const subject = channel === "email"
        ? `Following up — ${accountName || "our conversation"}`
        : undefined;

      // Determine tone/urgency from context
      const contextStr = contextParts.join(". ");
      const isFollowUp = contextStr.length > 0;
      const mentionsUrgency = /urgent|asap|quick|soon|deadline/i.test(contextStr);
      const mentionsHesitation = /hesitant|on the edge|unsure|considering|fence/i.test(contextStr);

      let openingLine: string;
      let closingLine: string;

      if (mentionsHesitation) {
        openingLine = `I've been thinking about our recent conversation${accountName ? ` regarding ${accountName}` : ""} and wanted to share a few additional thoughts that might be helpful.`;
        closingLine = "I'd love to walk you through the details whenever works best for you — no pressure at all.";
      } else if (mentionsUrgency) {
        openingLine = `I wanted to quickly follow up${accountName ? ` on ${accountName}` : ""} as I know timing is important here.`;
        closingLine = "Could we find a few minutes this week to finalize the details?";
      } else if (isFollowUp) {
        openingLine = `Based on our recent interactions${accountName ? ` regarding ${accountName}` : ""}, I wanted to follow up.`;
        closingLine = "Would you have time for a brief conversation this week?";
      } else {
        openingLine = "I wanted to reach out and connect.";
        closingLine = "Would you have time for a brief conversation this week?";
      }

      const body = [
        `Hi ${contactName},`,
        "",
        openingLine,
        "",
        closingLine,
        "",
        "Best regards",
      ].join("\n");

      const draft = await this.draftRepo.create({
        orgId, linkedEntityType: input.linkedEntityType,
        linkedEntityId: input.linkedEntityId, channel,
        subject, body, generatedBy: "ai",
        approvalStatus: "draft", createdBy: userId,
      });

      await this.auditEmitter.emit({
        orgId, actorId: userId, actorType: "user",
        action: "outreach.generated", resourceType: "outreach_draft",
        resourceId: draft.id, metadata: { channel, linkedEntityType: input.linkedEntityType },
      });

      return ok(draft);
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  async getOutreachDraft(orgId: OrgId, id: OutreachDraftId): Promise<Result<OutreachDraft>> {
    try {
      const draft = await this.draftRepo.getById(id, orgId);
      if (!draft) return err(AppError.notFound("OutreachDraft", id));
      return ok(draft);
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  async listOutreachDrafts(orgId: OrgId, filters?: { approvalStatus?: string }): Promise<Result<OutreachDraft[]>> {
    try {
      const drafts = await this.draftRepo.listForOrg(orgId, { approvalStatus: filters?.approvalStatus });
      return ok(drafts);
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  // =========================================================================
  // CRM Sync
  // =========================================================================

  async syncEntity(orgId: OrgId, userId: UserId, input: {
    entityType: string; entityId: string; direction?: string;
  }): Promise<Result<CrmSyncLog & { approvalId?: string; policyDecision?: string }>> {
    try {
      const direction = input.direction ?? "push";

      // Policy evaluation gate — sync is a controlled action
      if (this._policyService) {
        const policyResult = await this._policyService.evaluate({
          orgId,
          subjectType: "revenue",
          subjectId: input.entityId,
          actionType: "revenue.sync",
          requestedBy: userId,
          context: { entityType: input.entityType, direction },
        });

        if (policyResult.ok) {
          const { decision, approvalId, reason } = policyResult.value;

          if (decision === "deny" || decision === "quarantined") {
            return err(AppError.forbidden(`Sync blocked by policy: ${reason}`));
          }

          if (decision === "require_approval") {
            // Create sync log in pending_approval state
            const syncLog = await this.syncLogRepo.create({
              orgId, direction, entityType: input.entityType,
              entityId: input.entityId, status: "pending",
              metadata: { approvalId, policyDecision: "require_approval" },
              createdBy: userId,
            });

            await this.auditEmitter.emit({
              orgId, actorId: userId, actorType: "user",
              action: "revenue.sync_requested", resourceType: "crm_sync_log",
              resourceId: syncLog.id, metadata: { entityType: input.entityType, policyDecision: "require_approval", approvalId },
            });

            // Return the sync log with approval info — sync is blocked until approved
            return ok({ ...syncLog, approvalId: approvalId as string | undefined, policyDecision: "require_approval" });
          }
          // decision === "allow" — proceed with sync below
        }
      }

      // Create sync log entry
      const syncLog = await this.syncLogRepo.create({
        orgId, direction, entityType: input.entityType,
        entityId: input.entityId, createdBy: userId,
      });

      await this.auditEmitter.emit({
        orgId, actorId: userId, actorType: "user",
        action: "revenue.sync_requested", resourceType: "crm_sync_log",
        resourceId: syncLog.id, metadata: { entityType: input.entityType, entityId: input.entityId, direction },
      });

      // Execute sync via adapter
      try {
        let externalId: string | undefined;

        if (input.entityType === "account") {
          const account = await this.accountRepo.getById(input.entityId as CrmAccountId, orgId);
          if (!account) {
            await this.syncLogRepo.updateStatus(syncLog.id, orgId, "failed", { error: "Account not found" });
            return err(AppError.notFound("Account", input.entityId));
          }
          const result = await this.syncAdapter.pushAccount(account);
          externalId = result.externalId;
          // Store external ID back on the account
          await this.accountRepo.update(account.id, orgId, { externalCrmId: externalId, updatedBy: userId });
        } else if (input.entityType === "contact") {
          const contact = await this.contactRepo.getById(input.entityId as CrmContactId, orgId);
          if (!contact) {
            await this.syncLogRepo.updateStatus(syncLog.id, orgId, "failed", { error: "Contact not found" });
            return err(AppError.notFound("Contact", input.entityId));
          }
          const result = await this.syncAdapter.pushContact(contact);
          externalId = result.externalId;
          await this.contactRepo.update(contact.id, orgId, { externalCrmId: externalId, updatedBy: userId });
        } else if (input.entityType === "deal") {
          const deal = await this.dealRepo.getById(input.entityId as CrmDealId, orgId);
          if (!deal) {
            await this.syncLogRepo.updateStatus(syncLog.id, orgId, "failed", { error: "Deal not found" });
            return err(AppError.notFound("Deal", input.entityId));
          }
          const result = await this.syncAdapter.pushDeal(deal);
          externalId = result.externalId;
          await this.dealRepo.update(deal.id, orgId, { externalCrmId: externalId, updatedBy: userId });
        } else {
          await this.syncLogRepo.updateStatus(syncLog.id, orgId, "failed", { error: `Unsupported entity type: ${input.entityType}` });
          return err(AppError.badRequest(`Unsupported entity type: ${input.entityType}`));
        }

        const updated = await this.syncLogRepo.updateStatus(syncLog.id, orgId, "completed", {
          externalCrmId: externalId, completedAt: new Date().toISOString(),
        });

        await this.auditEmitter.emit({
          orgId, actorId: userId, actorType: "user",
          action: "revenue.sync_completed", resourceType: "crm_sync_log",
          resourceId: syncLog.id, metadata: { entityType: input.entityType, externalCrmId: externalId },
        });

        return ok(updated ?? syncLog);
      } catch (syncError) {
        const errorMsg = syncError instanceof Error ? syncError.message : "Sync failed";
        await this.syncLogRepo.updateStatus(syncLog.id, orgId, "failed", { error: errorMsg });
        await this.auditEmitter.emit({
          orgId, actorId: userId, actorType: "user",
          action: "revenue.sync_failed", resourceType: "crm_sync_log",
          resourceId: syncLog.id, metadata: { entityType: input.entityType, error: errorMsg },
        });
        return err(AppError.internal(errorMsg));
      }
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  async listSyncLogs(orgId: OrgId, filters?: { status?: string; entityType?: string }): Promise<Result<CrmSyncLog[]>> {
    try {
      const logs = await this.syncLogRepo.listForOrg(orgId, filters);
      return ok(logs);
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }

  // =========================================================================
  // Overview
  // =========================================================================

  async getOverview(orgId: OrgId): Promise<Result<RevenueOverview>> {
    try {
      const [accounts, contacts, deals, tasks, syncLogs] = await Promise.all([
        this.accountRepo.listForOrg(orgId),
        this.contactRepo.listForOrg(orgId),
        this.dealRepo.listForOrg(orgId),
        this.taskRepo.listForOrg(orgId),
        this.syncLogRepo.listForOrg(orgId),
      ]);

      const dealsByStage: Record<string, number> = {};
      let openDealValueCents = 0;
      for (const deal of deals) {
        dealsByStage[deal.stage] = (dealsByStage[deal.stage] ?? 0) + 1;
        if (deal.valueCents) openDealValueCents += deal.valueCents;
      }

      const openTaskCount = tasks.filter(t => t.status === "open" || t.status === "in_progress").length;

      return ok({
        accountCount: accounts.length,
        contactCount: contacts.length,
        dealCount: deals.length,
        taskCount: tasks.length,
        openDealValueCents,
        dealsByStage,
        openTaskCount,
        recentSyncCount: syncLogs.length,
      });
    } catch (e) { return err(AppError.internal((e as Error).message)); }
  }
}
