// ---------------------------------------------------------------------------
// Phase 2 domain entities — Organization, User, Membership, Project
// ---------------------------------------------------------------------------

import type {
  OrgId,
  UserId,
  ProjectId,
  AgentId,
  AgentVersionId,
  RunId,
  ConnectorId,
  ConnectorInstallId,
  SkillId,
  SkillInstallId,
  BrowserSessionId,
  MemoryId,
  MemoryLinkId,
  AlertRuleId,
  AlertEventId,
  ISODateString,
  PolicyId,
  ApprovalId,
  PolicyDecisionId,
  QuarantineRecordId,
  CrmAccountId,
  CrmContactId,
  CrmDealId,
  CrmTaskId,
  CrmNoteId,
  OutreachDraftId,
  CrmSyncLogId,
  BillingAccountId,
  UsageEventId,
  InvoiceId,
  SpendAlertId,
} from "./types.js";
import type { MembershipId, InvitationId, OrgRole } from "./auth.js";

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export interface User {
  readonly id: UserId;
  readonly email: string;
  readonly name: string;
  readonly avatarUrl?: string;
  readonly workosUserId?: string;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

export interface CreateUserInput {
  readonly email: string;
  readonly name: string;
  readonly avatarUrl?: string;
  readonly workosUserId?: string;
}

// ---------------------------------------------------------------------------
// Organization
// ---------------------------------------------------------------------------

export interface Organization {
  readonly id: OrgId;
  readonly name: string;
  readonly slug: string;
  readonly plan: string;
  readonly settings: Record<string, unknown>;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

export interface CreateOrgInput {
  readonly name: string;
  readonly slug: string;
}

export interface UpdateOrgInput {
  readonly name?: string;
  readonly settings?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Membership
// ---------------------------------------------------------------------------

export interface Membership {
  readonly id: MembershipId;
  readonly orgId: OrgId;
  readonly userId: UserId;
  readonly role: OrgRole;
  readonly invitedBy?: UserId;
  readonly acceptedAt?: ISODateString;
  readonly createdAt: ISODateString;
}

export interface CreateMembershipInput {
  readonly orgId: OrgId;
  readonly userId: UserId;
  readonly role: OrgRole;
  readonly invitedBy?: UserId;
}

// ---------------------------------------------------------------------------
// Invitation
// ---------------------------------------------------------------------------

export interface Invitation {
  readonly id: InvitationId;
  readonly orgId: OrgId;
  readonly email: string;
  readonly role: OrgRole;
  readonly invitedBy: UserId;
  readonly expiresAt: ISODateString;
  readonly acceptedAt?: ISODateString;
  readonly createdAt: ISODateString;
}

export interface CreateInvitationInput {
  readonly orgId: OrgId;
  readonly email: string;
  readonly role: OrgRole;
  readonly invitedBy: UserId;
}

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export interface Project {
  readonly id: ProjectId;
  readonly orgId: OrgId;
  readonly name: string;
  readonly slug: string;
  readonly description?: string;
  readonly settings: Record<string, unknown>;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

export interface CreateProjectInput {
  readonly orgId: OrgId;
  readonly name: string;
  readonly slug: string;
  readonly description?: string;
}

export interface UpdateProjectInput {
  readonly name?: string;
  readonly slug?: string;
  readonly description?: string;
  readonly settings?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Agent (Phase 4)
// ---------------------------------------------------------------------------

export type AgentStatus = "draft" | "published" | "archived";

export interface Agent {
  readonly id: AgentId;
  readonly orgId: OrgId;
  readonly projectId: ProjectId;
  readonly name: string;
  readonly slug: string;
  readonly description?: string;
  readonly status: AgentStatus;
  readonly createdBy: UserId;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

export interface CreateAgentInput {
  readonly orgId: OrgId;
  readonly projectId: ProjectId;
  readonly name: string;
  readonly slug: string;
  readonly description?: string;
}

export interface UpdateAgentInput {
  readonly name?: string;
  readonly description?: string;
}

// ---------------------------------------------------------------------------
// Agent Version (Phase 4)
// ---------------------------------------------------------------------------

export interface AgentVersion {
  readonly id: AgentVersionId;
  readonly orgId: OrgId;
  readonly agentId: AgentId;
  readonly version: number;
  readonly goals: readonly string[];
  readonly instructions: string;
  readonly tools: readonly ToolConfig[];
  readonly budget: BudgetConfig | null;
  readonly approvalRules: readonly ApprovalRuleConfig[];
  readonly memoryConfig: MemoryConfig | null;
  readonly schedule: ScheduleConfig | null;
  readonly modelConfig: ModelConfig;
  readonly published: boolean;
  readonly publishedAt?: ISODateString;
  readonly createdBy: UserId;
  readonly createdAt: ISODateString;
}

export interface ToolConfig {
  readonly name: string;
  readonly connectorId?: string;
  readonly parameters?: Record<string, unknown>;
}

export interface BudgetConfig {
  readonly maxTokens?: number;
  readonly maxCostCents?: number;
  readonly maxRunsPerDay?: number;
}

export interface ApprovalRuleConfig {
  readonly action: string;
  readonly requireApproval: boolean;
  readonly approverRoles?: readonly string[];
}

export interface MemoryConfig {
  readonly mode: "none" | "session" | "persistent";
  readonly lanes?: readonly string[];
  readonly readEnabled?: boolean;
  readonly writeEnabled?: boolean;
  readonly allowedScopes?: readonly MemoryScopeType[];
  readonly allowedKinds?: readonly MemoryKind[];
  readonly maxRetrievalCount?: number;
  readonly autoWriteEpisodic?: boolean;
}

export interface ScheduleConfig {
  readonly enabled: boolean;
  readonly cron?: string;
  readonly timezone?: string;
}

export interface ModelConfig {
  readonly provider: string;
  readonly model: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly topP?: number;
}

export interface CreateAgentVersionInput {
  readonly agentId: AgentId;
  readonly orgId: OrgId;
  readonly goals?: readonly string[];
  readonly instructions?: string;
  readonly tools?: readonly ToolConfig[];
  readonly budget?: BudgetConfig | null;
  readonly approvalRules?: readonly ApprovalRuleConfig[];
  readonly memoryConfig?: MemoryConfig | null;
  readonly schedule?: ScheduleConfig | null;
  readonly modelConfig?: ModelConfig;
}

export interface UpdateAgentVersionInput {
  readonly goals?: readonly string[];
  readonly instructions?: string;
  readonly tools?: readonly ToolConfig[];
  readonly budget?: BudgetConfig | null;
  readonly approvalRules?: readonly ApprovalRuleConfig[];
  readonly memoryConfig?: MemoryConfig | null;
  readonly schedule?: ScheduleConfig | null;
  readonly modelConfig?: ModelConfig;
}

// ---------------------------------------------------------------------------
// Run (Phase 5)
// ---------------------------------------------------------------------------

export type RunStatus =
  | "queued"
  | "starting"
  | "running"
  | "paused"
  | "cancelling"
  | "cancelled"
  | "failed"
  | "completed";

export type TriggerType = "manual" | "api" | "schedule" | "webhook";

export type ExecutionProvider = "local" | "openai";

export interface Run {
  readonly id: RunId;
  readonly orgId: OrgId;
  readonly projectId: ProjectId;
  readonly agentId: AgentId;
  readonly agentVersionId: AgentVersionId;
  readonly status: RunStatus;
  readonly triggerType: TriggerType;
  readonly triggeredBy: UserId;
  readonly executionProvider: ExecutionProvider;
  readonly input: Record<string, unknown>;
  readonly configSnapshot: Record<string, unknown>;
  readonly output: Record<string, unknown> | null;
  readonly error: { code: string; message: string } | null;
  readonly tokenUsage: { inputTokens: number; outputTokens: number; totalTokens: number } | null;
  readonly costCents: number | null;
  readonly attemptCount: number;
  readonly temporalWorkflowId: string | null;
  readonly startedAt: ISODateString | null;
  readonly completedAt: ISODateString | null;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

export interface CreateRunInput {
  readonly orgId: OrgId;
  readonly projectId: ProjectId;
  readonly agentId: AgentId;
  readonly agentVersionId: AgentVersionId;
  readonly triggerType: TriggerType;
  readonly triggeredBy: UserId;
  readonly executionProvider: ExecutionProvider;
  readonly input?: Record<string, unknown>;
  readonly configSnapshot: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Run Step (Phase 5)
// ---------------------------------------------------------------------------

export type RunStepType = "llm_call" | "tool_call" | "system" | "error";
export type RunStepStatus = "pending" | "running" | "completed" | "failed";

export interface RunStep {
  readonly id: string;
  readonly orgId: OrgId;
  readonly runId: RunId;
  readonly stepNumber: number;
  readonly type: RunStepType;
  readonly status: RunStepStatus;
  readonly attempt: number;
  readonly toolName: string | null;
  readonly input: Record<string, unknown> | null;
  readonly output: Record<string, unknown> | null;
  readonly error: Record<string, unknown> | null;
  readonly tokenUsage: { inputTokens: number; outputTokens: number; totalTokens: number } | null;
  readonly providerMetadata: Record<string, unknown> | null;
  readonly latencyMs: number | null;
  readonly startedAt: ISODateString | null;
  readonly completedAt: ISODateString | null;
  readonly createdAt: ISODateString;
}

// ---------------------------------------------------------------------------
// Connector (Phase 6)
// ---------------------------------------------------------------------------

export type ConnectorTrustTier = "verified" | "internal" | "untrusted";
export type ConnectorAuthMode = "none" | "api_key" | "oauth2";
export type ConnectorStatus = "active" | "disabled" | "deprecated";

export interface ConnectorTool {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}

export interface ConnectorScope {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

export interface Connector {
  readonly id: ConnectorId;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly trustTier: ConnectorTrustTier;
  readonly authMode: ConnectorAuthMode;
  readonly status: ConnectorStatus;
  readonly tools: readonly ConnectorTool[];
  readonly scopes: readonly ConnectorScope[];
  readonly metadata: Record<string, unknown>;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

export interface ConnectorInstall {
  readonly id: ConnectorInstallId;
  readonly orgId: OrgId;
  readonly connectorId: ConnectorId;
  readonly connectorSlug: string;
  readonly enabled: boolean;
  readonly config: Record<string, unknown>;
  readonly grantedScopes: readonly string[];
  readonly installedBy: UserId;
  readonly updatedBy: UserId | null;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

export interface CreateConnectorInstallInput {
  readonly orgId: OrgId;
  readonly connectorId: ConnectorId;
  readonly connectorSlug: string;
  readonly config?: Record<string, unknown>;
  readonly grantedScopes?: readonly string[];
  readonly installedBy: UserId;
}

// ---------------------------------------------------------------------------
// Skill (Phase 6)
// ---------------------------------------------------------------------------

export type SkillTrustTier = "verified" | "internal" | "untrusted";

export interface Skill {
  readonly id: SkillId;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly trustTier: SkillTrustTier;
  readonly connectorSlugs: readonly string[];
  readonly metadata: Record<string, unknown>;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

export interface SkillInstall {
  readonly id: SkillInstallId;
  readonly orgId: OrgId;
  readonly skillId: SkillId;
  readonly skillSlug: string;
  readonly enabled: boolean;
  readonly installedBy: UserId;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

// ---------------------------------------------------------------------------
// Browser Session (Phase 7)
// ---------------------------------------------------------------------------

export type BrowserSessionStatus =
  | "provisioning"
  | "ready"
  | "active"
  | "takeover_requested"
  | "human_control"
  | "closing"
  | "closed"
  | "failed";

export type BrowserActionType =
  | "navigate"
  | "click"
  | "type"
  | "select"
  | "wait_for_selector"
  | "extract_text"
  | "screenshot"
  | "upload_file"
  | "download_file";

/** Actions considered risky and requiring policy gate checks. */
export const RISKY_BROWSER_ACTIONS: readonly BrowserActionType[] = [
  "upload_file",
  "download_file",
];

export interface BrowserSession {
  readonly id: BrowserSessionId;
  readonly orgId: OrgId;
  readonly runId: RunId;
  readonly agentId: AgentId;
  readonly status: BrowserSessionStatus;
  readonly browserType: string;
  readonly currentUrl: string | null;
  readonly humanTakeover: boolean;
  readonly takeoverBy: UserId | null;
  readonly sessionRef: string | null;
  readonly artifactKeys: readonly string[];
  readonly metadata: Record<string, unknown>;
  readonly createdBy: UserId;
  readonly startedAt: ISODateString | null;
  readonly lastActivityAt: ISODateString | null;
  readonly endedAt: ISODateString | null;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

export interface CreateBrowserSessionInput {
  readonly orgId: OrgId;
  readonly runId: RunId;
  readonly agentId: AgentId;
  readonly browserType?: string;
  readonly createdBy: UserId;
}

export interface BrowserAction {
  readonly type: BrowserActionType;
  readonly selector?: string;
  readonly value?: string;
  readonly url?: string;
  readonly filePath?: string;
  readonly timeout?: number;
}

export interface BrowserActionResult {
  readonly success: boolean;
  readonly actionType: BrowserActionType;
  readonly output: Record<string, unknown>;
  readonly screenshotKey?: string;
  readonly artifactKey?: string;
  readonly error?: string;
  readonly latencyMs: number;
}

// ---------------------------------------------------------------------------
// Memory (Phase 8)
// ---------------------------------------------------------------------------

export type MemoryScopeType = "org" | "project" | "agent" | "user";
export type MemoryKind = "semantic" | "episodic" | "procedural";
export type MemoryStatus = "active" | "redacted" | "expired" | "deleted";

export interface Memory {
  readonly id: MemoryId;
  readonly orgId: OrgId;
  readonly scopeType: MemoryScopeType;
  readonly scopeId: string;
  readonly kind: MemoryKind;
  readonly status: MemoryStatus;
  readonly title: string;
  readonly summary: string;
  readonly content: string;
  readonly contentHash: string;
  readonly metadata: Record<string, unknown>;
  readonly sourceRunId: string | null;
  readonly sourceAgentId: string | null;
  readonly createdBy: UserId;
  readonly updatedBy: UserId;
  readonly expiresAt: ISODateString | null;
  readonly redactedAt: ISODateString | null;
  readonly lastAccessedAt: ISODateString | null;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

export interface CreateMemoryInput {
  readonly orgId: OrgId;
  readonly scopeType: MemoryScopeType;
  readonly scopeId: string;
  readonly kind: MemoryKind;
  readonly title: string;
  readonly summary: string;
  readonly content: string;
  readonly metadata?: Record<string, unknown>;
  readonly sourceRunId?: string;
  readonly sourceAgentId?: string;
  readonly createdBy: UserId;
  readonly expiresAt?: string;
}

export interface UpdateMemoryInput {
  readonly title?: string;
  readonly summary?: string;
  readonly content?: string;
  readonly metadata?: Record<string, unknown>;
  readonly updatedBy: UserId;
}

export type MemoryLinkType = "source_run" | "source_step" | "source_agent" | "promoted_from" | "related";

export interface MemoryLink {
  readonly id: MemoryLinkId;
  readonly orgId: OrgId;
  readonly memoryId: MemoryId;
  readonly linkedEntityType: string;
  readonly linkedEntityId: string;
  readonly linkType: MemoryLinkType;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: ISODateString;
}

export interface CreateMemoryLinkInput {
  readonly orgId: OrgId;
  readonly memoryId: MemoryId;
  readonly linkedEntityType: string;
  readonly linkedEntityId: string;
  readonly linkType: MemoryLinkType;
  readonly metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Phase 9 — Alert entities
// ---------------------------------------------------------------------------

export type AlertConditionType = "run_failed" | "run_stuck" | "browser_failed" | "connector_failed";
export type AlertSeverity = "info" | "warning" | "critical";
export type AlertStatus = "open" | "acknowledged" | "resolved";

export interface AlertRule {
  readonly id: AlertRuleId;
  readonly orgId: OrgId;
  readonly name: string;
  readonly description: string;
  readonly conditionType: AlertConditionType;
  readonly thresholdMinutes: number | null;
  readonly enabled: boolean;
  readonly createdBy: UserId;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

export interface AlertEvent {
  readonly id: AlertEventId;
  readonly orgId: OrgId;
  readonly alertRuleId: AlertRuleId | null;
  readonly severity: AlertSeverity;
  readonly title: string;
  readonly message: string;
  readonly conditionType: AlertConditionType;
  readonly resourceType: string;
  readonly resourceId: string | null;
  readonly status: AlertStatus;
  readonly acknowledgedBy: UserId | null;
  readonly acknowledgedAt: ISODateString | null;
  readonly resolvedAt: ISODateString | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

// ---------------------------------------------------------------------------
// Policy entities (Phase 10)
// ---------------------------------------------------------------------------

export type PolicyType = "access_control" | "deny" | "require_approval" | "quarantine" | "budget_cap" | "content_filter";
export type PolicyStatus = "active" | "disabled" | "archived";
export type EnforcementMode = "allow" | "deny" | "require_approval" | "quarantine";
export type PolicyScopeType = "org" | "project" | "agent" | "connector" | "browser" | "memory" | "run";

export interface PolicyRule {
  readonly actionPattern: string;  // e.g., "connector.use", "browser.risky_action", "memory.redact"
  readonly conditions?: Record<string, unknown>;
}

export interface Policy {
  readonly id: PolicyId;
  readonly orgId: OrgId;
  readonly name: string;
  readonly description: string;
  readonly policyType: PolicyType;
  readonly status: PolicyStatus;
  readonly enforcementMode: EnforcementMode;
  readonly scopeType: PolicyScopeType;
  readonly scopeId: string | null;
  readonly rules: readonly PolicyRule[];
  readonly priority: number;
  readonly createdBy: UserId;
  readonly updatedBy: UserId | null;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

export type PolicyDecisionResult = "allow" | "deny" | "require_approval" | "quarantined";

export interface PolicyDecision {
  readonly id: PolicyDecisionId;
  readonly orgId: OrgId;
  readonly policyId: PolicyId | null;
  readonly subjectType: string;
  readonly subjectId: string | null;
  readonly actionType: string;
  readonly result: PolicyDecisionResult;
  readonly reason: string;
  readonly metadata: Record<string, unknown>;
  readonly requestedBy: UserId | null;
  readonly approvalId: ApprovalId | null;
  readonly evaluatedAt: ISODateString;
}

// ---------------------------------------------------------------------------
// Approval entities (Phase 10)
// ---------------------------------------------------------------------------

export type ApprovalStatus = "pending" | "approved" | "denied" | "expired" | "cancelled";

export interface Approval {
  readonly id: ApprovalId;
  readonly orgId: OrgId;
  readonly subjectType: string;
  readonly subjectId: string | null;
  readonly actionType: string;
  readonly status: ApprovalStatus;
  readonly requestNote: string;
  readonly decisionNote: string;
  readonly requestedBy: UserId;
  readonly decidedBy: UserId | null;
  readonly policyDecisionId: PolicyDecisionId | null;
  readonly expiresAt: ISODateString | null;
  readonly decidedAt: ISODateString | null;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

// ---------------------------------------------------------------------------
// Quarantine entities (Phase 10)
// ---------------------------------------------------------------------------

export type QuarantineStatus = "active" | "released";

export interface QuarantineRecord {
  readonly id: QuarantineRecordId;
  readonly orgId: OrgId;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly reason: string;
  readonly status: QuarantineStatus;
  readonly policyDecisionId: PolicyDecisionId | null;
  readonly quarantinedBy: UserId;
  readonly releasedBy: UserId | null;
  readonly releasedAt: ISODateString | null;
  readonly releaseNote: string;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

// ---------------------------------------------------------------------------
// CRM Account (Phase 11)
// ---------------------------------------------------------------------------

export type CrmAccountStatus = "active" | "inactive" | "churned";

export interface CrmAccount {
  readonly id: CrmAccountId;
  readonly orgId: OrgId;
  readonly name: string;
  readonly domain: string | null;
  readonly industry: string | null;
  readonly status: CrmAccountStatus;
  readonly ownerId: UserId | null;
  readonly notes: string | null;
  readonly externalCrmId: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdBy: UserId;
  readonly updatedBy: UserId;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

// ---------------------------------------------------------------------------
// CRM Contact (Phase 11)
// ---------------------------------------------------------------------------

export type CrmContactStatus = "active" | "inactive";

export interface CrmContact {
  readonly id: CrmContactId;
  readonly orgId: OrgId;
  readonly accountId: CrmAccountId | null;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string | null;
  readonly title: string | null;
  readonly phone: string | null;
  readonly status: CrmContactStatus;
  readonly ownerId: UserId | null;
  readonly externalCrmId: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdBy: UserId;
  readonly updatedBy: UserId;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

// ---------------------------------------------------------------------------
// CRM Deal (Phase 11)
// ---------------------------------------------------------------------------

export interface CrmDeal {
  readonly id: CrmDealId;
  readonly orgId: OrgId;
  readonly accountId: CrmAccountId | null;
  readonly name: string;
  readonly stage: string;
  readonly valueCents: number | null;
  readonly currency: string;
  readonly closeDate: string | null;
  readonly ownerId: UserId | null;
  readonly probability: number | null;
  readonly notes: string | null;
  readonly externalCrmId: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdBy: UserId;
  readonly updatedBy: UserId;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

// ---------------------------------------------------------------------------
// CRM Task (Phase 11)
// ---------------------------------------------------------------------------

export type CrmTaskStatus = "open" | "in_progress" | "completed" | "cancelled";
export type CrmTaskPriority = "low" | "medium" | "high" | "urgent";

export interface CrmTask {
  readonly id: CrmTaskId;
  readonly orgId: OrgId;
  readonly title: string;
  readonly description: string | null;
  readonly status: CrmTaskStatus;
  readonly priority: CrmTaskPriority;
  readonly dueAt: ISODateString | null;
  readonly linkedEntityType: string | null;
  readonly linkedEntityId: string | null;
  readonly ownerId: UserId | null;
  readonly metadata: Record<string, unknown>;
  readonly createdBy: UserId;
  readonly updatedBy: UserId;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

// ---------------------------------------------------------------------------
// CRM Note (Phase 11)
// ---------------------------------------------------------------------------

export type CrmNoteType = "general" | "meeting" | "call" | "email";

export interface CrmNote {
  readonly id: CrmNoteId;
  readonly orgId: OrgId;
  readonly linkedEntityType: string;
  readonly linkedEntityId: string;
  readonly title: string | null;
  readonly content: string;
  readonly noteType: CrmNoteType;
  readonly metadata: Record<string, unknown>;
  readonly createdBy: UserId;
  readonly updatedBy: UserId;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

// ---------------------------------------------------------------------------
// Outreach Draft (Phase 11)
// ---------------------------------------------------------------------------

export type OutreachChannel = "email" | "linkedin" | "phone";
export type OutreachApprovalStatus = "draft" | "pending_approval" | "approved" | "denied" | "sent";

export interface OutreachDraft {
  readonly id: OutreachDraftId;
  readonly orgId: OrgId;
  readonly linkedEntityType: string | null;
  readonly linkedEntityId: string | null;
  readonly channel: OutreachChannel;
  readonly subject: string | null;
  readonly body: string;
  readonly generatedBy: string;
  readonly approvalStatus: OutreachApprovalStatus;
  readonly approvalId: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdBy: UserId;
  readonly updatedBy: UserId;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

// ---------------------------------------------------------------------------
// CRM Sync Log (Phase 11)
// ---------------------------------------------------------------------------

export type CrmSyncDirection = "push" | "pull";
export type CrmSyncStatus = "pending" | "completed" | "failed";

export interface CrmSyncLog {
  readonly id: CrmSyncLogId;
  readonly orgId: OrgId;
  readonly direction: CrmSyncDirection;
  readonly entityType: string;
  readonly entityId: string;
  readonly externalCrmId: string | null;
  readonly status: CrmSyncStatus;
  readonly error: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdBy: UserId;
  readonly createdAt: ISODateString;
  readonly completedAt: ISODateString | null;
}

// ---------------------------------------------------------------------------
// Billing Account (Phase 12)
// ---------------------------------------------------------------------------

export type BillingAccountStatus = "active" | "past_due" | "canceled" | "suspended";
export type BillingPlan = "free" | "team" | "enterprise";
export type OveragePolicy = "block" | "allow_overage";

export interface BillingAccount {
  readonly id: BillingAccountId;
  readonly orgId: OrgId;
  readonly plan: BillingPlan;
  readonly status: BillingAccountStatus;
  readonly billingEmail: string | null;
  readonly paymentProvider: string;
  readonly providerCustomerId: string | null;
  readonly currentPeriodStart: ISODateString;
  readonly currentPeriodEnd: ISODateString;
  readonly trialEndsAt: ISODateString | null;
  readonly spendLimitCents: number | null;
  readonly overageAllowed: boolean;
  readonly metadata: Record<string, unknown>;
  readonly createdBy: UserId;
  readonly updatedBy: UserId;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

// ---------------------------------------------------------------------------
// Usage Event (Phase 12)
// ---------------------------------------------------------------------------

export type UsageMeter = "agent_runs" | "llm_tokens" | "connector_calls" | "browser_sessions" | "storage_bytes";

export interface UsageEvent {
  readonly id: UsageEventId;
  readonly orgId: OrgId;
  readonly eventType: string;
  readonly meter: UsageMeter;
  readonly quantity: number;
  readonly unit: string;
  readonly sourceType: string | null;
  readonly sourceId: string | null;
  readonly metadata: Record<string, unknown>;
  readonly occurredAt: ISODateString;
  readonly createdAt: ISODateString;
}

// ---------------------------------------------------------------------------
// Invoice (Phase 12)
// ---------------------------------------------------------------------------

export type InvoiceStatus = "draft" | "open" | "paid" | "void";

export interface InvoiceLineItem {
  readonly description: string;
  readonly meter: string;
  readonly quantity: number;
  readonly unitPriceCents: number;
  readonly totalCents: number;
}

export interface Invoice {
  readonly id: InvoiceId;
  readonly orgId: OrgId;
  readonly billingAccountId: BillingAccountId;
  readonly providerInvoiceId: string | null;
  readonly status: InvoiceStatus;
  readonly subtotalCents: number;
  readonly overageCents: number;
  readonly totalCents: number;
  readonly currency: string;
  readonly periodStart: ISODateString;
  readonly periodEnd: ISODateString;
  readonly dueAt: ISODateString | null;
  readonly lineItems: readonly InvoiceLineItem[];
  readonly metadata: Record<string, unknown>;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

// ---------------------------------------------------------------------------
// Spend Alert (Phase 12)
// ---------------------------------------------------------------------------

export type SpendAlertStatus = "active" | "triggered" | "acknowledged";

export interface SpendAlert {
  readonly id: SpendAlertId;
  readonly orgId: OrgId;
  readonly thresholdCents: number;
  readonly currentSpendCents: number;
  readonly status: SpendAlertStatus;
  readonly triggeredAt: ISODateString | null;
  readonly acknowledgedBy: UserId | null;
  readonly acknowledgedAt: ISODateString | null;
  readonly metadata: Record<string, unknown>;
  readonly createdBy: UserId;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

// ---------------------------------------------------------------------------
// Plan Catalog (Phase 12)
// ---------------------------------------------------------------------------

export interface PlanAllowance {
  readonly meter: UsageMeter;
  readonly included: number;
  readonly overageUnitPriceCents: number;
}

export interface PlanDefinition {
  readonly id: BillingPlan;
  readonly name: string;
  readonly description: string;
  readonly basePriceCents: number;
  readonly interval: "monthly";
  readonly allowances: readonly PlanAllowance[];
  readonly overageAllowed: boolean;
  readonly isPublic: boolean;
}
