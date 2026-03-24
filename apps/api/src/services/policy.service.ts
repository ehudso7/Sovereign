// ---------------------------------------------------------------------------
// Policy engine service — Phase 10 policy evaluation and enforcement
// ---------------------------------------------------------------------------

import { ok, err, AppError } from "@sovereign/core";
import type {
  OrgId,
  UserId,
  PolicyId,
  ApprovalId,
  PolicyDecisionId,
  QuarantineRecordId,
  Policy,
  PolicyDecision,
  Approval,
  QuarantineRecord,
  PolicyDecisionResult,
  Result,
  AuditEmitter,
} from "@sovereign/core";
import type {
  PolicyRepo,
  PolicyDecisionRepo,
  ApprovalRepo,
  QuarantineRecordRepo,
} from "@sovereign/db";

// ---------------------------------------------------------------------------
// Policy evaluation input
// ---------------------------------------------------------------------------

export interface PolicyEvaluationInput {
  readonly orgId: OrgId;
  readonly subjectType: string;
  readonly subjectId?: string;
  readonly actionType: string;
  readonly requestedBy?: UserId;
  readonly context?: Record<string, unknown>;
}

export interface PolicyEvaluationOutput {
  readonly decision: PolicyDecisionResult;
  readonly policyId: PolicyId | null;
  readonly reason: string;
  readonly approvalId?: ApprovalId;
  readonly policyDecisionId: PolicyDecisionId;
}

// ---------------------------------------------------------------------------
// Policy service
// ---------------------------------------------------------------------------

export class PgPolicyService {
  constructor(
    private readonly policyRepo: PolicyRepo,
    private readonly decisionRepo: PolicyDecisionRepo,
    private readonly approvalRepo: ApprovalRepo,
    private readonly quarantineRepo: QuarantineRecordRepo,
    private readonly audit: AuditEmitter,
  ) {}

  // -------------------------------------------------------------------------
  // Policy CRUD
  // -------------------------------------------------------------------------

  async createPolicy(input: {
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
  }): Promise<Result<Policy>> {
    const policy = await this.policyRepo.create(input);

    await this.audit.emit({
      orgId: input.orgId,
      actorId: input.createdBy,
      actorType: "user",
      action: "policy.created",
      resourceType: "policy",
      resourceId: policy.id,
      metadata: { name: policy.name, policyType: policy.policyType, enforcementMode: policy.enforcementMode },
    });

    return ok(policy);
  }

  async getPolicy(policyId: PolicyId, orgId: OrgId): Promise<Result<Policy>> {
    const policy = await this.policyRepo.getById(policyId, orgId);
    if (!policy) return err(AppError.notFound("Policy", policyId));
    return ok(policy);
  }

  async listPolicies(orgId: OrgId, filters?: { status?: string; scopeType?: string; policyType?: string }): Promise<Result<Policy[]>> {
    const policies = await this.policyRepo.listForOrg(orgId, filters);
    return ok(policies);
  }

  async updatePolicy(
    policyId: PolicyId,
    orgId: OrgId,
    input: { name?: string; description?: string; rules?: unknown[]; priority?: number; enforcementMode?: string; updatedBy: UserId },
  ): Promise<Result<Policy>> {
    const updated = await this.policyRepo.update(policyId, orgId, input);
    if (!updated) return err(AppError.notFound("Policy", policyId));

    await this.audit.emit({
      orgId,
      actorId: input.updatedBy,
      actorType: "user",
      action: "policy.updated",
      resourceType: "policy",
      resourceId: policyId,
      metadata: { name: updated.name },
    });

    return ok(updated);
  }

  async disablePolicy(policyId: PolicyId, orgId: OrgId, userId: UserId): Promise<Result<Policy>> {
    const updated = await this.policyRepo.update(policyId, orgId, { status: "disabled", updatedBy: userId });
    if (!updated) return err(AppError.notFound("Policy", policyId));

    await this.audit.emit({
      orgId, actorId: userId, actorType: "user",
      action: "policy.disabled", resourceType: "policy", resourceId: policyId,
      metadata: {},
    });

    return ok(updated);
  }

  async enablePolicy(policyId: PolicyId, orgId: OrgId, userId: UserId): Promise<Result<Policy>> {
    const updated = await this.policyRepo.update(policyId, orgId, { status: "active", updatedBy: userId });
    if (!updated) return err(AppError.notFound("Policy", policyId));

    await this.audit.emit({
      orgId, actorId: userId, actorType: "user",
      action: "policy.enabled", resourceType: "policy", resourceId: policyId,
      metadata: {},
    });

    return ok(updated);
  }

  async archivePolicy(policyId: PolicyId, orgId: OrgId, userId: UserId): Promise<Result<Policy>> {
    const updated = await this.policyRepo.update(policyId, orgId, { status: "archived", updatedBy: userId });
    if (!updated) return err(AppError.notFound("Policy", policyId));

    await this.audit.emit({
      orgId, actorId: userId, actorType: "user",
      action: "policy.archived", resourceType: "policy", resourceId: policyId,
      metadata: {},
    });

    return ok(updated);
  }

  // -------------------------------------------------------------------------
  // Policy evaluation
  // -------------------------------------------------------------------------

  /**
   * Evaluate all active policies for a given action.
   * Returns the most restrictive matching result.
   *
   * Precedence: quarantine > deny > require_approval > allow
   * Within same enforcement mode, higher priority wins.
   */
  async evaluate(input: PolicyEvaluationInput): Promise<Result<PolicyEvaluationOutput>> {
    // Check quarantine first — quarantined subjects are blocked regardless
    if (input.subjectId) {
      const quarantine = await this.quarantineRepo.getActiveForSubject(
        input.orgId, input.subjectType, input.subjectId,
      );
      if (quarantine) {
        const decision = await this.decisionRepo.create({
          orgId: input.orgId,
          subjectType: input.subjectType,
          subjectId: input.subjectId,
          actionType: input.actionType,
          result: "quarantined",
          reason: `Subject is quarantined: ${quarantine.reason}`,
          metadata: { quarantineId: quarantine.id, ...input.context },
          requestedBy: input.requestedBy,
        });

        return ok({
          decision: "quarantined",
          policyId: null,
          reason: `Subject is quarantined: ${quarantine.reason}`,
          policyDecisionId: decision.id,
        });
      }
    }

    // Fetch active policies matching scope
    const policies = await this.policyRepo.listForOrg(input.orgId, {
      status: "active",
      scopeType: input.subjectType,
    });

    // Also fetch org-wide policies
    const orgPolicies = await this.policyRepo.listForOrg(input.orgId, {
      status: "active",
      scopeType: "org",
    });

    const allPolicies = [...policies, ...orgPolicies]
      .sort((a, b) => b.priority - a.priority); // Higher priority first

    // Find the most restrictive matching policy
    let matchedPolicy: Policy | null = null;
    let matchedResult: PolicyDecisionResult = "allow";

    const SEVERITY_ORDER: Record<string, number> = {
      quarantine: 4,
      deny: 3,
      require_approval: 2,
      allow: 1,
    };

    for (const policy of allPolicies) {
      // Check if policy scope matches
      if (policy.scopeId && policy.scopeId !== input.subjectId) continue;

      // Check if any rule matches the action
      const rules = policy.rules as Array<{ actionPattern: string; conditions?: Record<string, unknown> }>;
      const matches = rules.length === 0 || rules.some((rule) => {
        if (rule.actionPattern === "*") return true;
        if (rule.actionPattern === input.actionType) return true;
        // Glob-style: "connector.*" matches "connector.use"
        if (rule.actionPattern.endsWith(".*")) {
          const prefix = rule.actionPattern.slice(0, -2);
          return input.actionType.startsWith(prefix + ".");
        }
        return false;
      });

      if (matches) {
        const severity = SEVERITY_ORDER[policy.enforcementMode] ?? 0;
        const currentSeverity = SEVERITY_ORDER[matchedResult] ?? 0;

        if (severity > currentSeverity) {
          matchedResult = policy.enforcementMode as PolicyDecisionResult;
          matchedPolicy = policy;
        }
      }
    }

    // Create decision record
    const decision = await this.decisionRepo.create({
      orgId: input.orgId,
      policyId: matchedPolicy?.id,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      actionType: input.actionType,
      result: matchedResult,
      reason: matchedPolicy
        ? `Matched policy "${matchedPolicy.name}" (${matchedPolicy.enforcementMode})`
        : "No matching policy — default allow",
      metadata: input.context ?? {},
      requestedBy: input.requestedBy,
    });

    // Emit policy decision audit event
    await this.audit.emit({
      orgId: input.orgId,
      actorId: input.requestedBy,
      actorType: input.requestedBy ? "user" : "system",
      action: "policy.decision",
      resourceType: input.subjectType,
      resourceId: input.subjectId,
      metadata: {
        actionType: input.actionType,
        result: matchedResult,
        policyId: matchedPolicy?.id ?? null,
        policyDecisionId: decision.id,
      },
    });

    // If require_approval, create an approval request
    let approvalId: ApprovalId | undefined;
    if (matchedResult === "require_approval" && input.requestedBy) {
      const approval = await this.approvalRepo.create({
        orgId: input.orgId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        actionType: input.actionType,
        requestNote: `Policy "${matchedPolicy?.name}" requires approval for ${input.actionType}`,
        requestedBy: input.requestedBy,
        policyDecisionId: decision.id,
      });
      approvalId = approval.id;

      await this.audit.emit({
        orgId: input.orgId,
        actorId: input.requestedBy,
        actorType: "user",
        action: "approval.requested",
        resourceType: "approval",
        resourceId: approval.id,
        metadata: { subjectType: input.subjectType, subjectId: input.subjectId, actionType: input.actionType },
      });
    }

    return ok({
      decision: matchedResult,
      policyId: matchedPolicy?.id ?? null,
      reason: decision.reason,
      approvalId,
      policyDecisionId: decision.id,
    });
  }

  // -------------------------------------------------------------------------
  // Approvals
  // -------------------------------------------------------------------------

  async listApprovals(orgId: OrgId, filters?: { status?: string; subjectType?: string; limit?: number }): Promise<Result<Approval[]>> {
    const approvals = await this.approvalRepo.listForOrg(orgId, filters);
    return ok(approvals);
  }

  async getApproval(approvalId: ApprovalId, orgId: OrgId): Promise<Result<Approval>> {
    const approval = await this.approvalRepo.getById(approvalId, orgId);
    if (!approval) return err(AppError.notFound("Approval", approvalId));
    return ok(approval);
  }

  async approveRequest(approvalId: ApprovalId, orgId: OrgId, userId: UserId, note?: string): Promise<Result<Approval>> {
    const approval = await this.approvalRepo.decide(approvalId, orgId, {
      status: "approved",
      decidedBy: userId,
      decisionNote: note,
    });
    if (!approval) return err(AppError.notFound("Approval", approvalId));

    await this.audit.emit({
      orgId, actorId: userId, actorType: "user",
      action: "approval.approved", resourceType: "approval", resourceId: approvalId,
      metadata: { subjectType: approval.subjectType, subjectId: approval.subjectId, actionType: approval.actionType },
    });

    return ok(approval);
  }

  async denyRequest(approvalId: ApprovalId, orgId: OrgId, userId: UserId, note?: string): Promise<Result<Approval>> {
    const approval = await this.approvalRepo.decide(approvalId, orgId, {
      status: "denied",
      decidedBy: userId,
      decisionNote: note,
    });
    if (!approval) return err(AppError.notFound("Approval", approvalId));

    await this.audit.emit({
      orgId, actorId: userId, actorType: "user",
      action: "approval.denied", resourceType: "approval", resourceId: approvalId,
      metadata: { subjectType: approval.subjectType, subjectId: approval.subjectId, actionType: approval.actionType },
    });

    return ok(approval);
  }

  // -------------------------------------------------------------------------
  // Quarantine
  // -------------------------------------------------------------------------

  async listQuarantine(orgId: OrgId, filters?: { status?: string; subjectType?: string }): Promise<Result<QuarantineRecord[]>> {
    const records = await this.quarantineRepo.listForOrg(orgId, filters);
    return ok(records);
  }

  async quarantineSubject(input: {
    orgId: OrgId;
    subjectType: string;
    subjectId: string;
    reason: string;
    quarantinedBy: UserId;
    policyDecisionId?: string;
  }): Promise<Result<QuarantineRecord>> {
    // Check if already quarantined
    const existing = await this.quarantineRepo.getActiveForSubject(
      input.orgId, input.subjectType, input.subjectId,
    );
    if (existing) {
      return err(new AppError("CONFLICT", `Subject ${input.subjectType}/${input.subjectId} is already quarantined`));
    }

    const record = await this.quarantineRepo.create(input);

    await this.audit.emit({
      orgId: input.orgId,
      actorId: input.quarantinedBy,
      actorType: "user",
      action: "quarantine.entered",
      resourceType: input.subjectType,
      resourceId: input.subjectId,
      metadata: { quarantineId: record.id, reason: input.reason },
    });

    return ok(record);
  }

  async releaseFromQuarantine(
    recordId: QuarantineRecordId,
    orgId: OrgId,
    userId: UserId,
    note?: string,
  ): Promise<Result<QuarantineRecord>> {
    const record = await this.quarantineRepo.release(recordId, orgId, {
      releasedBy: userId,
      releaseNote: note,
    });
    if (!record) return err(AppError.notFound("QuarantineRecord", recordId));

    await this.audit.emit({
      orgId, actorId: userId, actorType: "user",
      action: "quarantine.released",
      resourceType: record.subjectType,
      resourceId: record.subjectId,
      metadata: { quarantineId: record.id, releaseNote: note ?? "" },
    });

    return ok(record);
  }

  async isQuarantined(orgId: OrgId, subjectType: string, subjectId: string): Promise<boolean> {
    const record = await this.quarantineRepo.getActiveForSubject(orgId, subjectType, subjectId);
    return record !== null;
  }

  // -------------------------------------------------------------------------
  // Policy decisions (read-only query)
  // -------------------------------------------------------------------------

  async listDecisions(
    orgId: OrgId,
    filters?: { result?: string; subjectType?: string; actionType?: string; limit?: number },
  ): Promise<Result<PolicyDecision[]>> {
    const decisions = await this.decisionRepo.listForOrg(orgId, filters);
    return ok(decisions);
  }

  // -------------------------------------------------------------------------
  // Secret resolution (audit-only — actual decryption delegated to caller)
  // -------------------------------------------------------------------------

  /**
   * Record that a secret was resolved at a runtime boundary.
   * This does NOT decrypt — it only creates the audit evidence.
   * The caller (connector service, worker) handles actual decryption.
   */
  async recordSecretResolution(input: {
    orgId: OrgId;
    secretType: string;
    secretRef: string;
    resolvedFor: string;
    resolvedBy?: UserId;
  }): Promise<void> {
    await this.audit.emit({
      orgId: input.orgId,
      actorType: input.resolvedBy ? "user" : "system",
      actorId: input.resolvedBy,
      action: "secret.resolved",
      resourceType: "secret",
      resourceId: input.secretRef,
      metadata: {
        secretType: input.secretType,
        resolvedFor: input.resolvedFor,
        // Never include the actual secret value
      },
    });
  }
}
