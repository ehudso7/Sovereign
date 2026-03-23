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
  ISODateString,
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
