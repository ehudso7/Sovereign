/**
 * @sovereign/policies
 *
 * Policy engine types for access control, data governance, and
 * compliance rule definitions in the Sovereign platform.
 */

import type {
  PolicyId,
  OrgId,
  UserId,
  AgentId,
  TenantContext,
  Result,
  AuditFields,
  ISODateString,
} from "@sovereign/core";

export type { PolicyId } from "@sovereign/core";

// ---------------------------------------------------------------------------
// Policy categories
// ---------------------------------------------------------------------------

export type PolicyType =
  | "access_control"
  | "data_retention"
  | "rate_limit"
  | "content_filter"
  | "pii_redaction"
  | "audit_log"
  | "budget_cap"
  | "geo_restriction"
  | "custom";

export type PolicyEffect = "allow" | "deny";

export type PolicyStatus = "active" | "inactive" | "draft";

// ---------------------------------------------------------------------------
// Policy condition / expression DSL
// ---------------------------------------------------------------------------

export type ConditionOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "not_in"
  | "contains"
  | "starts_with"
  | "ends_with"
  | "matches_regex"
  | "is_null"
  | "is_not_null";

export interface PolicyCondition {
  readonly field: string;
  readonly operator: ConditionOperator;
  readonly value?: unknown;
}

export type LogicalOperator = "AND" | "OR" | "NOT";

export interface PolicyRule {
  readonly id: string;
  readonly description?: string;
  readonly logic: LogicalOperator;
  readonly conditions: readonly PolicyCondition[];
  readonly effect: PolicyEffect;
  readonly priority: number;
}

// ---------------------------------------------------------------------------
// Policy entity
// ---------------------------------------------------------------------------

export interface Policy extends AuditFields {
  readonly id: PolicyId;
  readonly orgId: OrgId;
  readonly name: string;
  readonly description: string;
  readonly type: PolicyType;
  readonly status: PolicyStatus;
  readonly rules: readonly PolicyRule[];
  readonly appliesTo: PolicyScope;
  readonly enforcedAt: ISODateString;
  readonly expiresAt?: ISODateString;
  readonly version: number;
  readonly tags: readonly string[];
}

// ---------------------------------------------------------------------------
// Policy scope – defines what entities a policy governs
// ---------------------------------------------------------------------------

export type PolicyScopeTarget = "all" | "specific";

export interface PolicyScope {
  /** Whether the policy applies to all agents or specific ones. */
  readonly agents: PolicyScopeTarget;
  readonly agentIds?: readonly AgentId[];
  /** Whether the policy applies to all users or specific ones. */
  readonly users: PolicyScopeTarget;
  readonly userIds?: readonly UserId[];
}

// ---------------------------------------------------------------------------
// Policy evaluation
// ---------------------------------------------------------------------------

export type EvaluationDecision = "allow" | "deny" | "not_applicable";

export interface PolicyEvaluationRequest {
  readonly tenantContext: TenantContext;
  readonly resourceType: string;
  readonly resourceId?: string;
  readonly action: string;
  readonly attributes?: Record<string, unknown>;
}

export interface PolicyEvaluationResult {
  readonly decision: EvaluationDecision;
  readonly matchedPolicyId?: PolicyId;
  readonly matchedRuleId?: string;
  readonly reason?: string;
  readonly evaluatedAt: ISODateString;
}

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

export interface PolicyService {
  get(ctx: TenantContext, id: PolicyId): Promise<Result<Policy>>;
  list(ctx: TenantContext): Promise<Result<readonly Policy[]>>;
  create(ctx: TenantContext, input: CreatePolicyInput): Promise<Result<Policy>>;
  update(ctx: TenantContext, id: PolicyId, input: UpdatePolicyInput): Promise<Result<Policy>>;
  delete(ctx: TenantContext, id: PolicyId): Promise<Result<void>>;
  evaluate(request: PolicyEvaluationRequest): Promise<PolicyEvaluationResult>;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreatePolicyInput {
  readonly name: string;
  readonly description: string;
  readonly type: PolicyType;
  readonly rules: readonly Omit<PolicyRule, "id">[];
  readonly appliesTo: PolicyScope;
  readonly expiresAt?: ISODateString;
  readonly tags?: readonly string[];
}

export type UpdatePolicyInput = Partial<CreatePolicyInput> & {
  readonly status?: PolicyStatus;
};
