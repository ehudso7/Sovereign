import {
  toPolicyId,
  toPolicyDecisionId,
  toApprovalId,
  toQuarantineRecordId,
  toOrgId,
  toUserId,
  toISODateString,
} from "@sovereign/core";
import type {
  OrgId,
  UserId,
  PolicyId,
  PolicyDecisionId,
  ApprovalId,
  QuarantineRecordId,
  Policy,
  PolicyDecision,
  Approval,
  QuarantineRecord,
  PolicyType,
  PolicyStatus,
  EnforcementMode,
  PolicyScopeType,
  PolicyRule,
  PolicyDecisionResult,
  ApprovalStatus,
  QuarantineStatus,
} from "@sovereign/core";
import type { TenantDb } from "../client.js";
import type {
  PolicyRepo,
  PolicyDecisionRepo,
  ApprovalRepo,
  QuarantineRecordRepo,
} from "./types.js";

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

interface PolicyRow {
  id: string;
  org_id: string;
  name: string;
  description: string;
  policy_type: string;
  status: string;
  enforcement_mode: string;
  scope_type: string;
  scope_id: string | null;
  rules: unknown[] | string;
  priority: number;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

interface PolicyDecisionRow {
  id: string;
  org_id: string;
  policy_id: string | null;
  subject_type: string;
  subject_id: string | null;
  action_type: string;
  result: string;
  reason: string;
  metadata: Record<string, unknown> | string;
  requested_by: string | null;
  approval_id: string | null;
  evaluated_at: string;
}

interface ApprovalRow {
  id: string;
  org_id: string;
  subject_type: string;
  subject_id: string | null;
  action_type: string;
  status: string;
  request_note: string;
  decision_note: string;
  requested_by: string;
  decided_by: string | null;
  policy_decision_id: string | null;
  expires_at: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

interface QuarantineRecordRow {
  id: string;
  org_id: string;
  subject_type: string;
  subject_id: string;
  reason: string;
  status: string;
  policy_decision_id: string | null;
  quarantined_by: string;
  released_by: string | null;
  released_at: string | null;
  release_note: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Row → entity mappers
// ---------------------------------------------------------------------------

function toPolicy(row: PolicyRow): Policy {
  const rules =
    typeof row.rules === "string"
      ? (JSON.parse(row.rules) as PolicyRule[])
      : (row.rules as PolicyRule[]);

  return {
    id: toPolicyId(row.id),
    orgId: toOrgId(row.org_id),
    name: row.name,
    description: row.description,
    policyType: row.policy_type as PolicyType,
    status: row.status as PolicyStatus,
    enforcementMode: row.enforcement_mode as EnforcementMode,
    scopeType: row.scope_type as PolicyScopeType,
    scopeId: row.scope_id,
    rules,
    priority: row.priority,
    createdBy: toUserId(row.created_by),
    updatedBy: row.updated_by ? toUserId(row.updated_by) : null,
    createdAt: toISODateString(row.created_at),
    updatedAt: toISODateString(row.updated_at),
  };
}

function toPolicyDecision(row: PolicyDecisionRow): PolicyDecision {
  const metadata =
    typeof row.metadata === "string"
      ? (JSON.parse(row.metadata) as Record<string, unknown>)
      : row.metadata;

  return {
    id: toPolicyDecisionId(row.id),
    orgId: toOrgId(row.org_id),
    policyId: row.policy_id ? toPolicyId(row.policy_id) : null,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    actionType: row.action_type,
    result: row.result as PolicyDecisionResult,
    reason: row.reason,
    metadata,
    requestedBy: row.requested_by ? toUserId(row.requested_by) : null,
    approvalId: row.approval_id ? toApprovalId(row.approval_id) : null,
    evaluatedAt: toISODateString(row.evaluated_at),
  };
}

function toApproval(row: ApprovalRow): Approval {
  return {
    id: toApprovalId(row.id),
    orgId: toOrgId(row.org_id),
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    actionType: row.action_type,
    status: row.status as ApprovalStatus,
    requestNote: row.request_note,
    decisionNote: row.decision_note,
    requestedBy: toUserId(row.requested_by),
    decidedBy: row.decided_by ? toUserId(row.decided_by) : null,
    policyDecisionId: row.policy_decision_id
      ? toPolicyDecisionId(row.policy_decision_id)
      : null,
    expiresAt: row.expires_at ? toISODateString(row.expires_at) : null,
    decidedAt: row.decided_at ? toISODateString(row.decided_at) : null,
    createdAt: toISODateString(row.created_at),
    updatedAt: toISODateString(row.updated_at),
  };
}

function toQuarantineRecord(row: QuarantineRecordRow): QuarantineRecord {
  return {
    id: toQuarantineRecordId(row.id),
    orgId: toOrgId(row.org_id),
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    reason: row.reason,
    status: row.status as QuarantineStatus,
    policyDecisionId: row.policy_decision_id
      ? toPolicyDecisionId(row.policy_decision_id)
      : null,
    quarantinedBy: toUserId(row.quarantined_by),
    releasedBy: row.released_by ? toUserId(row.released_by) : null,
    releasedAt: row.released_at ? toISODateString(row.released_at) : null,
    releaseNote: row.release_note,
    createdAt: toISODateString(row.created_at),
    updatedAt: toISODateString(row.updated_at),
  };
}

// ---------------------------------------------------------------------------
// PgPolicyRepo
// ---------------------------------------------------------------------------

export class PgPolicyRepo implements PolicyRepo {
  constructor(private readonly db: TenantDb) {}

  async create(input: {
    orgId: OrgId;
    name: string;
    description?: string;
    policyType: string;
    enforcementMode: string;
    scopeType: string;
    scopeId?: string;
    rules?: unknown[];
    priority?: number;
    createdBy: UserId;
  }): Promise<Policy> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<PolicyRow>(
        `INSERT INTO policies (
          org_id, name, description, policy_type, enforcement_mode,
          scope_type, scope_id, rules, priority, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          this.db.orgId,
          input.name,
          input.description ?? "",
          input.policyType,
          input.enforcementMode,
          input.scopeType,
          input.scopeId ?? null,
          JSON.stringify(input.rules ?? []),
          input.priority ?? 0,
          input.createdBy,
        ],
      );
      if (!row) throw new Error("Failed to create policy");
      return toPolicy(row);
    });
  }

  async getById(id: PolicyId, _orgId: OrgId): Promise<Policy | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<PolicyRow>(
        "SELECT * FROM policies WHERE id = $1 AND org_id = $2",
        [id, this.db.orgId],
      );
      return row ? toPolicy(row) : null;
    });
  }

  async listForOrg(
    _orgId: OrgId,
    filters?: { status?: string; scopeType?: string; policyType?: string },
  ): Promise<Policy[]> {
    return this.db.transaction(async (tx) => {
      const conditions: string[] = ["org_id = $1"];
      const params: unknown[] = [this.db.orgId];
      let idx = 2;

      if (filters?.status !== undefined) {
        conditions.push(`status = $${idx++}`);
        params.push(filters.status);
      }
      if (filters?.scopeType !== undefined) {
        conditions.push(`scope_type = $${idx++}`);
        params.push(filters.scopeType);
      }
      if (filters?.policyType !== undefined) {
        conditions.push(`policy_type = $${idx++}`);
        params.push(filters.policyType);
      }

      const rows = await tx.query<PolicyRow>(
        `SELECT * FROM policies WHERE ${conditions.join(" AND ")} ORDER BY priority DESC, created_at DESC`,
        params,
      );
      return rows.map(toPolicy);
    });
  }

  async update(
    id: PolicyId,
    _orgId: OrgId,
    input: {
      name?: string;
      description?: string;
      rules?: unknown[];
      priority?: number;
      status?: string;
      enforcementMode?: string;
      updatedBy: UserId;
    },
  ): Promise<Policy | null> {
    return this.db.transaction(async (tx) => {
      const sets: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (input.name !== undefined) {
        sets.push(`name = $${idx++}`);
        params.push(input.name);
      }
      if (input.description !== undefined) {
        sets.push(`description = $${idx++}`);
        params.push(input.description);
      }
      if (input.rules !== undefined) {
        sets.push(`rules = $${idx++}`);
        params.push(JSON.stringify(input.rules));
      }
      if (input.priority !== undefined) {
        sets.push(`priority = $${idx++}`);
        params.push(input.priority);
      }
      if (input.status !== undefined) {
        sets.push(`status = $${idx++}`);
        params.push(input.status);
      }
      if (input.enforcementMode !== undefined) {
        sets.push(`enforcement_mode = $${idx++}`);
        params.push(input.enforcementMode);
      }

      sets.push(`updated_by = $${idx++}`);
      params.push(input.updatedBy);
      sets.push("updated_at = now()");
      params.push(id);
      params.push(this.db.orgId);

      if (sets.length === 2) {
        // Only updated_by and updated_at were set — still persist the update
      }

      const row = await tx.queryOne<PolicyRow>(
        `UPDATE policies SET ${sets.join(", ")} WHERE id = $${idx++} AND org_id = $${idx} RETURNING *`,
        params,
      );
      return row ? toPolicy(row) : null;
    });
  }

  async delete(id: PolicyId, _orgId: OrgId): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const count = await tx.execute(
        "DELETE FROM policies WHERE id = $1 AND org_id = $2",
        [id, this.db.orgId],
      );
      return count > 0;
    });
  }
}

// ---------------------------------------------------------------------------
// PgPolicyDecisionRepo
// ---------------------------------------------------------------------------

export class PgPolicyDecisionRepo implements PolicyDecisionRepo {
  constructor(private readonly db: TenantDb) {}

  async create(input: {
    orgId: OrgId;
    policyId?: string;
    subjectType: string;
    subjectId?: string;
    actionType: string;
    result: string;
    reason?: string;
    metadata?: Record<string, unknown>;
    requestedBy?: string;
    approvalId?: string;
  }): Promise<PolicyDecision> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<PolicyDecisionRow>(
        `INSERT INTO policy_decisions (
          org_id, policy_id, subject_type, subject_id,
          action_type, result, reason, metadata, requested_by, approval_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          this.db.orgId,
          input.policyId ?? null,
          input.subjectType,
          input.subjectId ?? null,
          input.actionType,
          input.result,
          input.reason ?? "",
          JSON.stringify(input.metadata ?? {}),
          input.requestedBy ?? null,
          input.approvalId ?? null,
        ],
      );
      if (!row) throw new Error("Failed to create policy decision");
      return toPolicyDecision(row);
    });
  }

  async getById(
    id: PolicyDecisionId,
    _orgId: OrgId,
  ): Promise<PolicyDecision | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<PolicyDecisionRow>(
        "SELECT * FROM policy_decisions WHERE id = $1 AND org_id = $2",
        [id, this.db.orgId],
      );
      return row ? toPolicyDecision(row) : null;
    });
  }

  async listForOrg(
    _orgId: OrgId,
    filters?: {
      result?: string;
      subjectType?: string;
      actionType?: string;
      limit?: number;
    },
  ): Promise<PolicyDecision[]> {
    return this.db.transaction(async (tx) => {
      const conditions: string[] = ["org_id = $1"];
      const params: unknown[] = [this.db.orgId];
      let idx = 2;

      if (filters?.result !== undefined) {
        conditions.push(`result = $${idx++}`);
        params.push(filters.result);
      }
      if (filters?.subjectType !== undefined) {
        conditions.push(`subject_type = $${idx++}`);
        params.push(filters.subjectType);
      }
      if (filters?.actionType !== undefined) {
        conditions.push(`action_type = $${idx++}`);
        params.push(filters.actionType);
      }

      const limit = filters?.limit ?? 100;
      params.push(limit);

      const rows = await tx.query<PolicyDecisionRow>(
        `SELECT * FROM policy_decisions WHERE ${conditions.join(" AND ")}
         ORDER BY evaluated_at DESC
         LIMIT $${idx}`,
        params,
      );
      return rows.map(toPolicyDecision);
    });
  }
}

// ---------------------------------------------------------------------------
// PgApprovalRepo
// ---------------------------------------------------------------------------

export class PgApprovalRepo implements ApprovalRepo {
  constructor(private readonly db: TenantDb) {}

  async create(input: {
    orgId: OrgId;
    subjectType: string;
    subjectId?: string;
    actionType: string;
    requestNote?: string;
    requestedBy: UserId;
    policyDecisionId?: string;
    expiresAt?: string;
  }): Promise<Approval> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<ApprovalRow>(
        `INSERT INTO approvals (
          org_id, subject_type, subject_id, action_type,
          request_note, requested_by, policy_decision_id, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          this.db.orgId,
          input.subjectType,
          input.subjectId ?? null,
          input.actionType,
          input.requestNote ?? "",
          input.requestedBy,
          input.policyDecisionId ?? null,
          input.expiresAt ?? null,
        ],
      );
      if (!row) throw new Error("Failed to create approval");
      return toApproval(row);
    });
  }

  async getById(id: ApprovalId, _orgId: OrgId): Promise<Approval | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<ApprovalRow>(
        "SELECT * FROM approvals WHERE id = $1 AND org_id = $2",
        [id, this.db.orgId],
      );
      return row ? toApproval(row) : null;
    });
  }

  async listForOrg(
    _orgId: OrgId,
    filters?: { status?: string; subjectType?: string; limit?: number },
  ): Promise<Approval[]> {
    return this.db.transaction(async (tx) => {
      const conditions: string[] = ["org_id = $1"];
      const params: unknown[] = [this.db.orgId];
      let idx = 2;

      if (filters?.status !== undefined) {
        conditions.push(`status = $${idx++}`);
        params.push(filters.status);
      }
      if (filters?.subjectType !== undefined) {
        conditions.push(`subject_type = $${idx++}`);
        params.push(filters.subjectType);
      }

      const limit = filters?.limit ?? 100;
      params.push(limit);

      const rows = await tx.query<ApprovalRow>(
        `SELECT * FROM approvals WHERE ${conditions.join(" AND ")}
         ORDER BY created_at DESC
         LIMIT $${idx}`,
        params,
      );
      return rows.map(toApproval);
    });
  }

  async decide(
    id: ApprovalId,
    _orgId: OrgId,
    input: {
      status: "approved" | "denied";
      decidedBy: UserId;
      decisionNote?: string;
    },
  ): Promise<Approval | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<ApprovalRow>(
        `UPDATE approvals
         SET status = $1,
             decided_by = $2,
             decision_note = $3,
             decided_at = now(),
             updated_at = now()
         WHERE id = $4 AND org_id = $5 AND status = 'pending'
         RETURNING *`,
        [
          input.status,
          input.decidedBy,
          input.decisionNote ?? "",
          id,
          this.db.orgId,
        ],
      );
      return row ? toApproval(row) : null;
    });
  }

  async cancel(id: ApprovalId, _orgId: OrgId): Promise<Approval | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<ApprovalRow>(
        `UPDATE approvals
         SET status = 'cancelled',
             updated_at = now()
         WHERE id = $1 AND org_id = $2 AND status = 'pending'
         RETURNING *`,
        [id, this.db.orgId],
      );
      return row ? toApproval(row) : null;
    });
  }

  async expirePending(_orgId: OrgId): Promise<number> {
    return this.db.transaction(async (tx) => {
      const count = await tx.execute(
        `UPDATE approvals SET status = 'expired', updated_at = now()
         WHERE org_id = $1 AND status = 'pending' AND expires_at IS NOT NULL AND expires_at < now()`,
        [this.db.orgId],
      );
      return count;
    });
  }
}

// ---------------------------------------------------------------------------
// PgQuarantineRecordRepo
// ---------------------------------------------------------------------------

export class PgQuarantineRecordRepo implements QuarantineRecordRepo {
  constructor(private readonly db: TenantDb) {}

  async create(input: {
    orgId: OrgId;
    subjectType: string;
    subjectId: string;
    reason: string;
    quarantinedBy: UserId;
    policyDecisionId?: string;
  }): Promise<QuarantineRecord> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<QuarantineRecordRow>(
        `INSERT INTO quarantine_records (
          org_id, subject_type, subject_id, reason,
          quarantined_by, policy_decision_id
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [
          this.db.orgId,
          input.subjectType,
          input.subjectId,
          input.reason,
          input.quarantinedBy,
          input.policyDecisionId ?? null,
        ],
      );
      if (!row) throw new Error("Failed to create quarantine record");
      return toQuarantineRecord(row);
    });
  }

  async getById(
    id: QuarantineRecordId,
    _orgId: OrgId,
  ): Promise<QuarantineRecord | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<QuarantineRecordRow>(
        "SELECT * FROM quarantine_records WHERE id = $1 AND org_id = $2",
        [id, this.db.orgId],
      );
      return row ? toQuarantineRecord(row) : null;
    });
  }

  async listForOrg(
    _orgId: OrgId,
    filters?: { status?: string; subjectType?: string },
  ): Promise<QuarantineRecord[]> {
    return this.db.transaction(async (tx) => {
      const conditions: string[] = ["org_id = $1"];
      const params: unknown[] = [this.db.orgId];
      let idx = 2;

      if (filters?.status !== undefined) {
        conditions.push(`status = $${idx++}`);
        params.push(filters.status);
      }
      if (filters?.subjectType !== undefined) {
        conditions.push(`subject_type = $${idx++}`);
        params.push(filters.subjectType);
      }

      const rows = await tx.query<QuarantineRecordRow>(
        `SELECT * FROM quarantine_records WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`,
        params,
      );
      return rows.map(toQuarantineRecord);
    });
  }

  async getActiveForSubject(
    _orgId: OrgId,
    subjectType: string,
    subjectId: string,
  ): Promise<QuarantineRecord | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<QuarantineRecordRow>(
        `SELECT * FROM quarantine_records
         WHERE org_id = $1 AND subject_type = $2 AND subject_id = $3 AND status = 'active'
         ORDER BY created_at DESC
         LIMIT 1`,
        [this.db.orgId, subjectType, subjectId],
      );
      return row ? toQuarantineRecord(row) : null;
    });
  }

  async release(
    id: QuarantineRecordId,
    _orgId: OrgId,
    input: { releasedBy: UserId; releaseNote?: string },
  ): Promise<QuarantineRecord | null> {
    return this.db.transaction(async (tx) => {
      const row = await tx.queryOne<QuarantineRecordRow>(
        `UPDATE quarantine_records
         SET status = 'released',
             released_by = $1,
             release_note = $2,
             released_at = now(),
             updated_at = now()
         WHERE id = $3 AND org_id = $4 AND status = 'active'
         RETURNING *`,
        [input.releasedBy, input.releaseNote ?? "", id, this.db.orgId],
      );
      return row ? toQuarantineRecord(row) : null;
    });
  }
}
