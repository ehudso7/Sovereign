import {
  toCrmAccountId,
  toCrmContactId,
  toCrmDealId,
  toCrmTaskId,
  toCrmNoteId,
  toOutreachDraftId,
  toCrmSyncLogId,
  toOrgId,
  toUserId,
  toISODateString,
} from "@sovereign/core";
import type {
  OrgId,
  UserId,
  CrmAccountId,
  CrmContactId,
  CrmDealId,
  CrmTaskId,
  CrmNoteId,
  OutreachDraftId,
  CrmSyncLogId,
  CrmAccount,
  CrmContact,
  CrmDeal,
  CrmTask,
  CrmNote,
  OutreachDraft,
  CrmSyncLog,
  CrmAccountStatus,
  CrmContactStatus,
  CrmTaskStatus,
  CrmTaskPriority,
  CrmNoteType,
  OutreachChannel,
  OutreachApprovalStatus,
  CrmSyncDirection,
  CrmSyncStatus,
} from "@sovereign/core";
import type { TenantDb } from "../client.js";
import type {
  CrmAccountRepo,
  CrmContactRepo,
  CrmDealRepo,
  CrmTaskRepo,
  CrmNoteRepo,
  OutreachDraftRepo,
  CrmSyncLogRepo,
} from "./types.js";

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

interface AccountRow {
  id: string; org_id: string; name: string; domain: string | null;
  industry: string | null; status: string; owner_id: string | null;
  notes: string | null; external_crm_id: string | null;
  metadata: Record<string, unknown> | string;
  created_by: string; updated_by: string; created_at: string; updated_at: string;
}

interface ContactRow {
  id: string; org_id: string; account_id: string | null;
  first_name: string; last_name: string; email: string | null;
  title: string | null; phone: string | null; status: string;
  owner_id: string | null; external_crm_id: string | null;
  metadata: Record<string, unknown> | string;
  created_by: string; updated_by: string; created_at: string; updated_at: string;
}

interface DealRow {
  id: string; org_id: string; account_id: string | null; name: string;
  stage: string; value_cents: string | null; currency: string;
  close_date: string | null; owner_id: string | null;
  probability: number | null; notes: string | null;
  external_crm_id: string | null; metadata: Record<string, unknown> | string;
  created_by: string; updated_by: string; created_at: string; updated_at: string;
}

interface TaskRow {
  id: string; org_id: string; title: string; description: string | null;
  status: string; priority: string; due_at: string | null;
  linked_entity_type: string | null; linked_entity_id: string | null;
  owner_id: string | null; metadata: Record<string, unknown> | string;
  created_by: string; updated_by: string; created_at: string; updated_at: string;
}

interface NoteRow {
  id: string; org_id: string; linked_entity_type: string; linked_entity_id: string;
  title: string | null; content: string; note_type: string;
  metadata: Record<string, unknown> | string;
  created_by: string; updated_by: string; created_at: string; updated_at: string;
}

interface DraftRow {
  id: string; org_id: string; linked_entity_type: string | null;
  linked_entity_id: string | null; channel: string; subject: string | null;
  body: string; generated_by: string; approval_status: string;
  approval_id: string | null; metadata: Record<string, unknown> | string;
  created_by: string; updated_by: string; created_at: string; updated_at: string;
}

interface SyncLogRow {
  id: string; org_id: string; direction: string; entity_type: string;
  entity_id: string; external_crm_id: string | null; status: string;
  error: string | null; metadata: Record<string, unknown> | string;
  created_by: string; created_at: string; completed_at: string | null;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function parseJsonb(v: unknown): Record<string, unknown> {
  if (typeof v === "string") return JSON.parse(v) as Record<string, unknown>;
  return (v ?? {}) as Record<string, unknown>;
}

function toAccount(r: AccountRow): CrmAccount {
  return {
    id: toCrmAccountId(r.id), orgId: toOrgId(r.org_id), name: r.name,
    domain: r.domain, industry: r.industry, status: r.status as CrmAccountStatus,
    ownerId: r.owner_id ? toUserId(r.owner_id) : null, notes: r.notes,
    externalCrmId: r.external_crm_id, metadata: parseJsonb(r.metadata),
    createdBy: toUserId(r.created_by), updatedBy: toUserId(r.updated_by),
    createdAt: toISODateString(r.created_at), updatedAt: toISODateString(r.updated_at),
  };
}

function toContact(r: ContactRow): CrmContact {
  return {
    id: toCrmContactId(r.id), orgId: toOrgId(r.org_id),
    accountId: r.account_id ? toCrmAccountId(r.account_id) : null,
    firstName: r.first_name, lastName: r.last_name, email: r.email,
    title: r.title, phone: r.phone, status: r.status as CrmContactStatus,
    ownerId: r.owner_id ? toUserId(r.owner_id) : null,
    externalCrmId: r.external_crm_id, metadata: parseJsonb(r.metadata),
    createdBy: toUserId(r.created_by), updatedBy: toUserId(r.updated_by),
    createdAt: toISODateString(r.created_at), updatedAt: toISODateString(r.updated_at),
  };
}

function toDeal(r: DealRow): CrmDeal {
  return {
    id: toCrmDealId(r.id), orgId: toOrgId(r.org_id),
    accountId: r.account_id ? toCrmAccountId(r.account_id) : null,
    name: r.name, stage: r.stage,
    valueCents: r.value_cents ? parseInt(r.value_cents, 10) : null,
    currency: r.currency, closeDate: r.close_date,
    ownerId: r.owner_id ? toUserId(r.owner_id) : null,
    probability: r.probability, notes: r.notes,
    externalCrmId: r.external_crm_id, metadata: parseJsonb(r.metadata),
    createdBy: toUserId(r.created_by), updatedBy: toUserId(r.updated_by),
    createdAt: toISODateString(r.created_at), updatedAt: toISODateString(r.updated_at),
  };
}

function toTask(r: TaskRow): CrmTask {
  return {
    id: toCrmTaskId(r.id), orgId: toOrgId(r.org_id), title: r.title,
    description: r.description, status: r.status as CrmTaskStatus,
    priority: r.priority as CrmTaskPriority,
    dueAt: r.due_at ? toISODateString(r.due_at) : null,
    linkedEntityType: r.linked_entity_type, linkedEntityId: r.linked_entity_id,
    ownerId: r.owner_id ? toUserId(r.owner_id) : null,
    metadata: parseJsonb(r.metadata),
    createdBy: toUserId(r.created_by), updatedBy: toUserId(r.updated_by),
    createdAt: toISODateString(r.created_at), updatedAt: toISODateString(r.updated_at),
  };
}

function toNote(r: NoteRow): CrmNote {
  return {
    id: toCrmNoteId(r.id), orgId: toOrgId(r.org_id),
    linkedEntityType: r.linked_entity_type, linkedEntityId: r.linked_entity_id,
    title: r.title, content: r.content, noteType: r.note_type as CrmNoteType,
    metadata: parseJsonb(r.metadata),
    createdBy: toUserId(r.created_by), updatedBy: toUserId(r.updated_by),
    createdAt: toISODateString(r.created_at), updatedAt: toISODateString(r.updated_at),
  };
}

function toDraft(r: DraftRow): OutreachDraft {
  return {
    id: toOutreachDraftId(r.id), orgId: toOrgId(r.org_id),
    linkedEntityType: r.linked_entity_type, linkedEntityId: r.linked_entity_id,
    channel: r.channel as OutreachChannel, subject: r.subject, body: r.body,
    generatedBy: r.generated_by, approvalStatus: r.approval_status as OutreachApprovalStatus,
    approvalId: r.approval_id, metadata: parseJsonb(r.metadata),
    createdBy: toUserId(r.created_by), updatedBy: toUserId(r.updated_by),
    createdAt: toISODateString(r.created_at), updatedAt: toISODateString(r.updated_at),
  };
}

function toSyncLog(r: SyncLogRow): CrmSyncLog {
  return {
    id: toCrmSyncLogId(r.id), orgId: toOrgId(r.org_id),
    direction: r.direction as CrmSyncDirection, entityType: r.entity_type,
    entityId: r.entity_id, externalCrmId: r.external_crm_id,
    status: r.status as CrmSyncStatus, error: r.error,
    metadata: parseJsonb(r.metadata), createdBy: toUserId(r.created_by),
    createdAt: toISODateString(r.created_at),
    completedAt: r.completed_at ? toISODateString(r.completed_at) : null,
  };
}

// ---------------------------------------------------------------------------
// PgCrmAccountRepo
// ---------------------------------------------------------------------------

export class PgCrmAccountRepo implements CrmAccountRepo {
  constructor(private readonly db: TenantDb) {}

  async create(input: {
    orgId: OrgId; name: string; domain?: string; industry?: string;
    status?: string; ownerId?: UserId; notes?: string; externalCrmId?: string;
    metadata?: Record<string, unknown>; createdBy: UserId;
  }): Promise<CrmAccount> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<AccountRow>(
        `INSERT INTO crm_accounts (org_id, name, domain, industry, status, owner_id, notes, external_crm_id, metadata, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
         RETURNING *`,
        [this.db.orgId, input.name, input.domain ?? null, input.industry ?? null,
         input.status ?? "active", input.ownerId ?? null, input.notes ?? null,
         input.externalCrmId ?? null, JSON.stringify(input.metadata ?? {}), input.createdBy],
      );
      if (!row) throw new Error("Failed to create CRM account");
      return toAccount(row);
    });
  }

  async getById(id: CrmAccountId, _orgId: OrgId): Promise<CrmAccount | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<AccountRow>(
        "SELECT * FROM crm_accounts WHERE id = $1 AND org_id = $2", [id, this.db.orgId],
      );
      return row ? toAccount(row) : null;
    });
  }

  async listForOrg(_orgId: OrgId, filters?: { status?: string; ownerId?: UserId }): Promise<CrmAccount[]> {
    return this.db.transaction(async (tx) => {
      const conditions = ["org_id = $1"];
      const params: unknown[] = [this.db.orgId];
      let idx = 2;
      if (filters?.status) { conditions.push(`status = $${idx}`); params.push(filters.status); idx++; }
      if (filters?.ownerId) { conditions.push(`owner_id = $${idx}`); params.push(filters.ownerId); idx++; }
      const rows = await tx.query<AccountRow>(
        `SELECT * FROM crm_accounts WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`,
        params,
      );
      return rows.map(toAccount);
    });
  }

  async update(id: CrmAccountId, _orgId: OrgId, input: {
    name?: string; domain?: string; industry?: string; status?: string;
    ownerId?: UserId; notes?: string; externalCrmId?: string;
    metadata?: Record<string, unknown>; updatedBy: UserId;
  }): Promise<CrmAccount | null> {
    return this.db.transaction(async (tx) => {
      const sets: string[] = ["updated_at = now()", "updated_by = $2"];
      const params: unknown[] = [id, input.updatedBy];
      let idx = 3;
      if (input.name !== undefined) { sets.push(`name = $${idx}`); params.push(input.name); idx++; }
      if (input.domain !== undefined) { sets.push(`domain = $${idx}`); params.push(input.domain); idx++; }
      if (input.industry !== undefined) { sets.push(`industry = $${idx}`); params.push(input.industry); idx++; }
      if (input.status !== undefined) { sets.push(`status = $${idx}`); params.push(input.status); idx++; }
      if (input.ownerId !== undefined) { sets.push(`owner_id = $${idx}`); params.push(input.ownerId); idx++; }
      if (input.notes !== undefined) { sets.push(`notes = $${idx}`); params.push(input.notes); idx++; }
      if (input.externalCrmId !== undefined) { sets.push(`external_crm_id = $${idx}`); params.push(input.externalCrmId); idx++; }
      if (input.metadata !== undefined) { sets.push(`metadata = $${idx}`); params.push(JSON.stringify(input.metadata)); idx++; }
      params.push(this.db.orgId);
      const row = await tx.queryOne<AccountRow>(
        `UPDATE crm_accounts SET ${sets.join(", ")} WHERE id = $1 AND org_id = $${idx} RETURNING *`,
        params,
      );
      return row ? toAccount(row) : null;
    });
  }

  async delete(id: CrmAccountId, _orgId: OrgId): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const count = await tx.execute(
        "DELETE FROM crm_accounts WHERE id = $1 AND org_id = $2", [id, this.db.orgId],
      );
      return count > 0;
    });
  }
}

// ---------------------------------------------------------------------------
// PgCrmContactRepo
// ---------------------------------------------------------------------------

export class PgCrmContactRepo implements CrmContactRepo {
  constructor(private readonly db: TenantDb) {}

  async create(input: {
    orgId: OrgId; accountId?: string; firstName: string; lastName: string;
    email?: string; title?: string; phone?: string; status?: string;
    ownerId?: UserId; externalCrmId?: string; metadata?: Record<string, unknown>; createdBy: UserId;
  }): Promise<CrmContact> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<ContactRow>(
        `INSERT INTO crm_contacts (org_id, account_id, first_name, last_name, email, title, phone, status, owner_id, external_crm_id, metadata, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
         RETURNING *`,
        [this.db.orgId, input.accountId ?? null, input.firstName, input.lastName,
         input.email ?? null, input.title ?? null, input.phone ?? null,
         input.status ?? "active", input.ownerId ?? null,
         input.externalCrmId ?? null, JSON.stringify(input.metadata ?? {}), input.createdBy],
      );
      if (!row) throw new Error("Failed to create CRM contact");
      return toContact(row);
    });
  }

  async getById(id: CrmContactId, _orgId: OrgId): Promise<CrmContact | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<ContactRow>(
        "SELECT * FROM crm_contacts WHERE id = $1 AND org_id = $2", [id, this.db.orgId],
      );
      return row ? toContact(row) : null;
    });
  }

  async listForOrg(_orgId: OrgId, filters?: { accountId?: string; ownerId?: UserId; status?: string }): Promise<CrmContact[]> {
    return this.db.transaction(async (tx) => {
      const conditions = ["org_id = $1"];
      const params: unknown[] = [this.db.orgId];
      let idx = 2;
      if (filters?.accountId) { conditions.push(`account_id = $${idx}`); params.push(filters.accountId); idx++; }
      if (filters?.ownerId) { conditions.push(`owner_id = $${idx}`); params.push(filters.ownerId); idx++; }
      if (filters?.status) { conditions.push(`status = $${idx}`); params.push(filters.status); idx++; }
      const rows = await tx.query<ContactRow>(
        `SELECT * FROM crm_contacts WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`,
        params,
      );
      return rows.map(toContact);
    });
  }

  async update(id: CrmContactId, _orgId: OrgId, input: {
    accountId?: string; firstName?: string; lastName?: string;
    email?: string; title?: string; phone?: string; status?: string;
    ownerId?: UserId; externalCrmId?: string;
    metadata?: Record<string, unknown>; updatedBy: UserId;
  }): Promise<CrmContact | null> {
    return this.db.transaction(async (tx) => {
      const sets: string[] = ["updated_at = now()", "updated_by = $2"];
      const params: unknown[] = [id, input.updatedBy];
      let idx = 3;
      if (input.accountId !== undefined) { sets.push(`account_id = $${idx}`); params.push(input.accountId); idx++; }
      if (input.firstName !== undefined) { sets.push(`first_name = $${idx}`); params.push(input.firstName); idx++; }
      if (input.lastName !== undefined) { sets.push(`last_name = $${idx}`); params.push(input.lastName); idx++; }
      if (input.email !== undefined) { sets.push(`email = $${idx}`); params.push(input.email); idx++; }
      if (input.title !== undefined) { sets.push(`title = $${idx}`); params.push(input.title); idx++; }
      if (input.phone !== undefined) { sets.push(`phone = $${idx}`); params.push(input.phone); idx++; }
      if (input.status !== undefined) { sets.push(`status = $${idx}`); params.push(input.status); idx++; }
      if (input.ownerId !== undefined) { sets.push(`owner_id = $${idx}`); params.push(input.ownerId); idx++; }
      if (input.externalCrmId !== undefined) { sets.push(`external_crm_id = $${idx}`); params.push(input.externalCrmId); idx++; }
      if (input.metadata !== undefined) { sets.push(`metadata = $${idx}`); params.push(JSON.stringify(input.metadata)); idx++; }
      params.push(this.db.orgId);
      const row = await tx.queryOne<ContactRow>(
        `UPDATE crm_contacts SET ${sets.join(", ")} WHERE id = $1 AND org_id = $${idx} RETURNING *`,
        params,
      );
      return row ? toContact(row) : null;
    });
  }

  async delete(id: CrmContactId, _orgId: OrgId): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const count = await tx.execute(
        "DELETE FROM crm_contacts WHERE id = $1 AND org_id = $2", [id, this.db.orgId],
      );
      return count > 0;
    });
  }
}

// ---------------------------------------------------------------------------
// PgCrmDealRepo
// ---------------------------------------------------------------------------

export class PgCrmDealRepo implements CrmDealRepo {
  constructor(private readonly db: TenantDb) {}

  async create(input: {
    orgId: OrgId; accountId?: string; name: string; stage?: string;
    valueCents?: number; currency?: string; closeDate?: string;
    ownerId?: UserId; probability?: number; notes?: string;
    externalCrmId?: string; metadata?: Record<string, unknown>; createdBy: UserId;
  }): Promise<CrmDeal> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<DealRow>(
        `INSERT INTO crm_deals (org_id, account_id, name, stage, value_cents, currency, close_date, owner_id, probability, notes, external_crm_id, metadata, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
         RETURNING *`,
        [this.db.orgId, input.accountId ?? null, input.name, input.stage ?? "discovery",
         input.valueCents ?? null, input.currency ?? "USD", input.closeDate ?? null,
         input.ownerId ?? null, input.probability ?? null, input.notes ?? null,
         input.externalCrmId ?? null, JSON.stringify(input.metadata ?? {}), input.createdBy],
      );
      if (!row) throw new Error("Failed to create CRM deal");
      return toDeal(row);
    });
  }

  async getById(id: CrmDealId, _orgId: OrgId): Promise<CrmDeal | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<DealRow>(
        "SELECT * FROM crm_deals WHERE id = $1 AND org_id = $2", [id, this.db.orgId],
      );
      return row ? toDeal(row) : null;
    });
  }

  async listForOrg(_orgId: OrgId, filters?: { accountId?: string; stage?: string; ownerId?: UserId }): Promise<CrmDeal[]> {
    return this.db.transaction(async (tx) => {
      const conditions = ["org_id = $1"];
      const params: unknown[] = [this.db.orgId];
      let idx = 2;
      if (filters?.accountId) { conditions.push(`account_id = $${idx}`); params.push(filters.accountId); idx++; }
      if (filters?.stage) { conditions.push(`stage = $${idx}`); params.push(filters.stage); idx++; }
      if (filters?.ownerId) { conditions.push(`owner_id = $${idx}`); params.push(filters.ownerId); idx++; }
      const rows = await tx.query<DealRow>(
        `SELECT * FROM crm_deals WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`,
        params,
      );
      return rows.map(toDeal);
    });
  }

  async update(id: CrmDealId, _orgId: OrgId, input: {
    accountId?: string; name?: string; stage?: string;
    valueCents?: number; currency?: string; closeDate?: string;
    ownerId?: UserId; probability?: number; notes?: string;
    externalCrmId?: string; metadata?: Record<string, unknown>; updatedBy: UserId;
  }): Promise<CrmDeal | null> {
    return this.db.transaction(async (tx) => {
      const sets: string[] = ["updated_at = now()", "updated_by = $2"];
      const params: unknown[] = [id, input.updatedBy];
      let idx = 3;
      if (input.accountId !== undefined) { sets.push(`account_id = $${idx}`); params.push(input.accountId); idx++; }
      if (input.name !== undefined) { sets.push(`name = $${idx}`); params.push(input.name); idx++; }
      if (input.stage !== undefined) { sets.push(`stage = $${idx}`); params.push(input.stage); idx++; }
      if (input.valueCents !== undefined) { sets.push(`value_cents = $${idx}`); params.push(input.valueCents); idx++; }
      if (input.currency !== undefined) { sets.push(`currency = $${idx}`); params.push(input.currency); idx++; }
      if (input.closeDate !== undefined) { sets.push(`close_date = $${idx}`); params.push(input.closeDate); idx++; }
      if (input.ownerId !== undefined) { sets.push(`owner_id = $${idx}`); params.push(input.ownerId); idx++; }
      if (input.probability !== undefined) { sets.push(`probability = $${idx}`); params.push(input.probability); idx++; }
      if (input.notes !== undefined) { sets.push(`notes = $${idx}`); params.push(input.notes); idx++; }
      if (input.externalCrmId !== undefined) { sets.push(`external_crm_id = $${idx}`); params.push(input.externalCrmId); idx++; }
      if (input.metadata !== undefined) { sets.push(`metadata = $${idx}`); params.push(JSON.stringify(input.metadata)); idx++; }
      params.push(this.db.orgId);
      const row = await tx.queryOne<DealRow>(
        `UPDATE crm_deals SET ${sets.join(", ")} WHERE id = $1 AND org_id = $${idx} RETURNING *`,
        params,
      );
      return row ? toDeal(row) : null;
    });
  }

  async delete(id: CrmDealId, _orgId: OrgId): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const count = await tx.execute(
        "DELETE FROM crm_deals WHERE id = $1 AND org_id = $2", [id, this.db.orgId],
      );
      return count > 0;
    });
  }
}

// ---------------------------------------------------------------------------
// PgCrmTaskRepo
// ---------------------------------------------------------------------------

export class PgCrmTaskRepo implements CrmTaskRepo {
  constructor(private readonly db: TenantDb) {}

  async create(input: {
    orgId: OrgId; title: string; description?: string; status?: string;
    priority?: string; dueAt?: string; linkedEntityType?: string;
    linkedEntityId?: string; ownerId?: UserId; metadata?: Record<string, unknown>;
    createdBy: UserId;
  }): Promise<CrmTask> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<TaskRow>(
        `INSERT INTO crm_tasks (org_id, title, description, status, priority, due_at, linked_entity_type, linked_entity_id, owner_id, metadata, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
         RETURNING *`,
        [this.db.orgId, input.title, input.description ?? null,
         input.status ?? "open", input.priority ?? "medium",
         input.dueAt ?? null, input.linkedEntityType ?? null,
         input.linkedEntityId ?? null, input.ownerId ?? null,
         JSON.stringify(input.metadata ?? {}), input.createdBy],
      );
      if (!row) throw new Error("Failed to create CRM task");
      return toTask(row);
    });
  }

  async getById(id: CrmTaskId, _orgId: OrgId): Promise<CrmTask | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<TaskRow>(
        "SELECT * FROM crm_tasks WHERE id = $1 AND org_id = $2", [id, this.db.orgId],
      );
      return row ? toTask(row) : null;
    });
  }

  async listForOrg(_orgId: OrgId, filters?: { status?: string; ownerId?: UserId; linkedEntityType?: string; linkedEntityId?: string }): Promise<CrmTask[]> {
    return this.db.transaction(async (tx) => {
      const conditions = ["org_id = $1"];
      const params: unknown[] = [this.db.orgId];
      let idx = 2;
      if (filters?.status) { conditions.push(`status = $${idx}`); params.push(filters.status); idx++; }
      if (filters?.ownerId) { conditions.push(`owner_id = $${idx}`); params.push(filters.ownerId); idx++; }
      if (filters?.linkedEntityType) { conditions.push(`linked_entity_type = $${idx}`); params.push(filters.linkedEntityType); idx++; }
      if (filters?.linkedEntityId) { conditions.push(`linked_entity_id = $${idx}`); params.push(filters.linkedEntityId); idx++; }
      const rows = await tx.query<TaskRow>(
        `SELECT * FROM crm_tasks WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`,
        params,
      );
      return rows.map(toTask);
    });
  }

  async update(id: CrmTaskId, _orgId: OrgId, input: {
    title?: string; description?: string; status?: string; priority?: string;
    dueAt?: string; linkedEntityType?: string; linkedEntityId?: string;
    ownerId?: UserId; metadata?: Record<string, unknown>; updatedBy: UserId;
  }): Promise<CrmTask | null> {
    return this.db.transaction(async (tx) => {
      const sets: string[] = ["updated_at = now()", "updated_by = $2"];
      const params: unknown[] = [id, input.updatedBy];
      let idx = 3;
      if (input.title !== undefined) { sets.push(`title = $${idx}`); params.push(input.title); idx++; }
      if (input.description !== undefined) { sets.push(`description = $${idx}`); params.push(input.description); idx++; }
      if (input.status !== undefined) { sets.push(`status = $${idx}`); params.push(input.status); idx++; }
      if (input.priority !== undefined) { sets.push(`priority = $${idx}`); params.push(input.priority); idx++; }
      if (input.dueAt !== undefined) { sets.push(`due_at = $${idx}`); params.push(input.dueAt); idx++; }
      if (input.linkedEntityType !== undefined) { sets.push(`linked_entity_type = $${idx}`); params.push(input.linkedEntityType); idx++; }
      if (input.linkedEntityId !== undefined) { sets.push(`linked_entity_id = $${idx}`); params.push(input.linkedEntityId); idx++; }
      if (input.ownerId !== undefined) { sets.push(`owner_id = $${idx}`); params.push(input.ownerId); idx++; }
      if (input.metadata !== undefined) { sets.push(`metadata = $${idx}`); params.push(JSON.stringify(input.metadata)); idx++; }
      params.push(this.db.orgId);
      const row = await tx.queryOne<TaskRow>(
        `UPDATE crm_tasks SET ${sets.join(", ")} WHERE id = $1 AND org_id = $${idx} RETURNING *`,
        params,
      );
      return row ? toTask(row) : null;
    });
  }

  async delete(id: CrmTaskId, _orgId: OrgId): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const count = await tx.execute(
        "DELETE FROM crm_tasks WHERE id = $1 AND org_id = $2", [id, this.db.orgId],
      );
      return count > 0;
    });
  }
}

// ---------------------------------------------------------------------------
// PgCrmNoteRepo
// ---------------------------------------------------------------------------

export class PgCrmNoteRepo implements CrmNoteRepo {
  constructor(private readonly db: TenantDb) {}

  async create(input: {
    orgId: OrgId; linkedEntityType: string; linkedEntityId: string;
    title?: string; content: string; noteType?: string;
    metadata?: Record<string, unknown>; createdBy: UserId;
  }): Promise<CrmNote> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<NoteRow>(
        `INSERT INTO crm_notes (org_id, linked_entity_type, linked_entity_id, title, content, note_type, metadata, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
         RETURNING *`,
        [this.db.orgId, input.linkedEntityType, input.linkedEntityId,
         input.title ?? null, input.content, input.noteType ?? "general",
         JSON.stringify(input.metadata ?? {}), input.createdBy],
      );
      if (!row) throw new Error("Failed to create CRM note");
      return toNote(row);
    });
  }

  async getById(id: CrmNoteId, _orgId: OrgId): Promise<CrmNote | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<NoteRow>(
        "SELECT * FROM crm_notes WHERE id = $1 AND org_id = $2", [id, this.db.orgId],
      );
      return row ? toNote(row) : null;
    });
  }

  async listForEntity(_orgId: OrgId, linkedEntityType: string, linkedEntityId: string): Promise<CrmNote[]> {
    return this.db.transaction(async (tx) => {
      const rows = await tx.query<NoteRow>(
        "SELECT * FROM crm_notes WHERE org_id = $1 AND linked_entity_type = $2 AND linked_entity_id = $3 ORDER BY created_at DESC",
        [this.db.orgId, linkedEntityType, linkedEntityId],
      );
      return rows.map(toNote);
    });
  }

  async listForOrg(_orgId: OrgId): Promise<CrmNote[]> {
    return this.db.transaction(async (tx) => {
      const rows = await tx.query<NoteRow>(
        "SELECT * FROM crm_notes WHERE org_id = $1 ORDER BY created_at DESC", [this.db.orgId],
      );
      return rows.map(toNote);
    });
  }

  async update(id: CrmNoteId, _orgId: OrgId, input: {
    title?: string; content?: string; noteType?: string;
    metadata?: Record<string, unknown>; updatedBy: UserId;
  }): Promise<CrmNote | null> {
    return this.db.transaction(async (tx) => {
      const sets: string[] = ["updated_at = now()", "updated_by = $2"];
      const params: unknown[] = [id, input.updatedBy];
      let idx = 3;
      if (input.title !== undefined) { sets.push(`title = $${idx}`); params.push(input.title); idx++; }
      if (input.content !== undefined) { sets.push(`content = $${idx}`); params.push(input.content); idx++; }
      if (input.noteType !== undefined) { sets.push(`note_type = $${idx}`); params.push(input.noteType); idx++; }
      if (input.metadata !== undefined) { sets.push(`metadata = $${idx}`); params.push(JSON.stringify(input.metadata)); idx++; }
      params.push(this.db.orgId);
      const row = await tx.queryOne<NoteRow>(
        `UPDATE crm_notes SET ${sets.join(", ")} WHERE id = $1 AND org_id = $${idx} RETURNING *`,
        params,
      );
      return row ? toNote(row) : null;
    });
  }

  async delete(id: CrmNoteId, _orgId: OrgId): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const count = await tx.execute(
        "DELETE FROM crm_notes WHERE id = $1 AND org_id = $2", [id, this.db.orgId],
      );
      return count > 0;
    });
  }
}

// ---------------------------------------------------------------------------
// PgOutreachDraftRepo
// ---------------------------------------------------------------------------

export class PgOutreachDraftRepo implements OutreachDraftRepo {
  constructor(private readonly db: TenantDb) {}

  async create(input: {
    orgId: OrgId; linkedEntityType?: string; linkedEntityId?: string;
    channel: string; subject?: string; body: string; generatedBy?: string;
    approvalStatus?: string; approvalId?: string;
    metadata?: Record<string, unknown>; createdBy: UserId;
  }): Promise<OutreachDraft> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<DraftRow>(
        `INSERT INTO outreach_drafts (org_id, linked_entity_type, linked_entity_id, channel, subject, body, generated_by, approval_status, approval_id, metadata, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
         RETURNING *`,
        [this.db.orgId, input.linkedEntityType ?? null, input.linkedEntityId ?? null,
         input.channel, input.subject ?? null, input.body,
         input.generatedBy ?? "ai", input.approvalStatus ?? "draft",
         input.approvalId ?? null, JSON.stringify(input.metadata ?? {}), input.createdBy],
      );
      if (!row) throw new Error("Failed to create outreach draft");
      return toDraft(row);
    });
  }

  async getById(id: OutreachDraftId, _orgId: OrgId): Promise<OutreachDraft | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<DraftRow>(
        "SELECT * FROM outreach_drafts WHERE id = $1 AND org_id = $2", [id, this.db.orgId],
      );
      return row ? toDraft(row) : null;
    });
  }

  async listForOrg(_orgId: OrgId, filters?: { approvalStatus?: string; linkedEntityType?: string; linkedEntityId?: string }): Promise<OutreachDraft[]> {
    return this.db.transaction(async (tx) => {
      const conditions = ["org_id = $1"];
      const params: unknown[] = [this.db.orgId];
      let idx = 2;
      if (filters?.approvalStatus) { conditions.push(`approval_status = $${idx}`); params.push(filters.approvalStatus); idx++; }
      if (filters?.linkedEntityType) { conditions.push(`linked_entity_type = $${idx}`); params.push(filters.linkedEntityType); idx++; }
      if (filters?.linkedEntityId) { conditions.push(`linked_entity_id = $${idx}`); params.push(filters.linkedEntityId); idx++; }
      const rows = await tx.query<DraftRow>(
        `SELECT * FROM outreach_drafts WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`,
        params,
      );
      return rows.map(toDraft);
    });
  }

  async update(id: OutreachDraftId, _orgId: OrgId, input: {
    subject?: string; body?: string; approvalStatus?: string;
    approvalId?: string; metadata?: Record<string, unknown>; updatedBy: UserId;
  }): Promise<OutreachDraft | null> {
    return this.db.transaction(async (tx) => {
      const sets: string[] = ["updated_at = now()", "updated_by = $2"];
      const params: unknown[] = [id, input.updatedBy];
      let idx = 3;
      if (input.subject !== undefined) { sets.push(`subject = $${idx}`); params.push(input.subject); idx++; }
      if (input.body !== undefined) { sets.push(`body = $${idx}`); params.push(input.body); idx++; }
      if (input.approvalStatus !== undefined) { sets.push(`approval_status = $${idx}`); params.push(input.approvalStatus); idx++; }
      if (input.approvalId !== undefined) { sets.push(`approval_id = $${idx}`); params.push(input.approvalId); idx++; }
      if (input.metadata !== undefined) { sets.push(`metadata = $${idx}`); params.push(JSON.stringify(input.metadata)); idx++; }
      params.push(this.db.orgId);
      const row = await tx.queryOne<DraftRow>(
        `UPDATE outreach_drafts SET ${sets.join(", ")} WHERE id = $1 AND org_id = $${idx} RETURNING *`,
        params,
      );
      return row ? toDraft(row) : null;
    });
  }

  async delete(id: OutreachDraftId, _orgId: OrgId): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const count = await tx.execute(
        "DELETE FROM outreach_drafts WHERE id = $1 AND org_id = $2", [id, this.db.orgId],
      );
      return count > 0;
    });
  }
}

// ---------------------------------------------------------------------------
// PgCrmSyncLogRepo
// ---------------------------------------------------------------------------

export class PgCrmSyncLogRepo implements CrmSyncLogRepo {
  constructor(private readonly db: TenantDb) {}

  async create(input: {
    orgId: OrgId; direction: string; entityType: string; entityId: string;
    externalCrmId?: string; status?: string; metadata?: Record<string, unknown>;
    createdBy: UserId;
  }): Promise<CrmSyncLog> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<SyncLogRow>(
        `INSERT INTO crm_sync_log (org_id, direction, entity_type, entity_id, external_crm_id, status, metadata, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [this.db.orgId, input.direction, input.entityType, input.entityId,
         input.externalCrmId ?? null, input.status ?? "pending",
         JSON.stringify(input.metadata ?? {}), input.createdBy],
      );
      if (!row) throw new Error("Failed to create CRM sync log");
      return toSyncLog(row);
    });
  }

  async getById(id: CrmSyncLogId, _orgId: OrgId): Promise<CrmSyncLog | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<SyncLogRow>(
        "SELECT * FROM crm_sync_log WHERE id = $1 AND org_id = $2", [id, this.db.orgId],
      );
      return row ? toSyncLog(row) : null;
    });
  }

  async listForOrg(_orgId: OrgId, filters?: { status?: string; entityType?: string; entityId?: string }): Promise<CrmSyncLog[]> {
    return this.db.transaction(async (tx) => {
      const conditions = ["org_id = $1"];
      const params: unknown[] = [this.db.orgId];
      let idx = 2;
      if (filters?.status) { conditions.push(`status = $${idx}`); params.push(filters.status); idx++; }
      if (filters?.entityType) { conditions.push(`entity_type = $${idx}`); params.push(filters.entityType); idx++; }
      if (filters?.entityId) { conditions.push(`entity_id = $${idx}`); params.push(filters.entityId); idx++; }
      const rows = await tx.query<SyncLogRow>(
        `SELECT * FROM crm_sync_log WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`,
        params,
      );
      return rows.map(toSyncLog);
    });
  }

  async updateStatus(id: CrmSyncLogId, _orgId: OrgId, status: string, extras?: {
    externalCrmId?: string; error?: string; completedAt?: string;
  }): Promise<CrmSyncLog | null> {
    return this.db.transaction(async (tx) => {
      const sets: string[] = ["status = $2"];
      const params: unknown[] = [id, status];
      let idx = 3;
      if (extras?.externalCrmId !== undefined) { sets.push(`external_crm_id = $${idx}`); params.push(extras.externalCrmId); idx++; }
      if (extras?.error !== undefined) { sets.push(`error = $${idx}`); params.push(extras.error); idx++; }
      if (extras?.completedAt !== undefined) { sets.push(`completed_at = $${idx}`); params.push(extras.completedAt); idx++; }
      params.push(this.db.orgId);
      const row = await tx.queryOne<SyncLogRow>(
        `UPDATE crm_sync_log SET ${sets.join(", ")} WHERE id = $1 AND org_id = $${idx} RETURNING *`,
        params,
      );
      return row ? toSyncLog(row) : null;
    });
  }
}
