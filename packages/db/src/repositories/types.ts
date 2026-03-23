// ---------------------------------------------------------------------------
// Repository interfaces for Phase 2 entities
// ---------------------------------------------------------------------------

import type {
  OrgId,
  UserId,
  ProjectId,
  SessionId,
  MembershipId,
  AgentId,
  AgentVersionId,

  OrgRole,
  AgentStatus,
  User,
  Organization,
  Membership,
  Invitation,
  Session,
  Project,
  Agent,
  AgentVersion,
  ToolConfig,
  BudgetConfig,
  ApprovalRuleConfig,
  MemoryConfig,
  ScheduleConfig,
  ModelConfig,
  AuditEvent,
  EmitAuditEventInput,
  AuditQueryParams,
} from "@sovereign/core";

// ---------------------------------------------------------------------------
// User repository
// ---------------------------------------------------------------------------

export interface UserRow {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  workos_user_id: string | null;
  password_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRepo {
  create(input: {
    email: string;
    name: string;
    avatarUrl?: string;
    workosUserId?: string;
    passwordHash?: string;
  }): Promise<User>;
  getById(id: UserId): Promise<User | null>;
  getByEmail(email: string): Promise<(User & { passwordHash?: string }) | null>;
  update(id: UserId, input: Partial<{ name: string; avatarUrl: string }>): Promise<User | null>;
}

// ---------------------------------------------------------------------------
// Organization repository
// ---------------------------------------------------------------------------

export interface OrgRepo {
  create(input: { name: string; slug: string }): Promise<Organization>;
  getById(id: OrgId): Promise<Organization | null>;
  getBySlug(slug: string): Promise<Organization | null>;
  update(id: OrgId, input: { name?: string; settings?: Record<string, unknown> }): Promise<Organization | null>;
  listForUser(userId: UserId): Promise<Organization[]>;
}

// ---------------------------------------------------------------------------
// Membership repository
// ---------------------------------------------------------------------------

export interface MembershipRepo {
  create(input: {
    orgId: OrgId;
    userId: UserId;
    role: OrgRole;
    invitedBy?: UserId;
    accepted?: boolean;
  }): Promise<Membership>;
  getForUser(orgId: OrgId, userId: UserId): Promise<Membership | null>;
  listForOrg(orgId: OrgId): Promise<(Membership & { user: User })[]>;
  listForUser(userId: UserId): Promise<Membership[]>;
  updateRole(id: MembershipId, role: OrgRole): Promise<Membership | null>;
  delete(orgId: OrgId, userId: UserId): Promise<boolean>;
  countByRole(orgId: OrgId, role: OrgRole): Promise<number>;
}

// ---------------------------------------------------------------------------
// Invitation repository
// ---------------------------------------------------------------------------

export interface InvitationRepo {
  create(input: {
    orgId: OrgId;
    email: string;
    role: OrgRole;
    invitedBy: UserId;
    expiresAt: string;
  }): Promise<Invitation>;
  getById(id: string): Promise<Invitation | null>;
  listForOrg(orgId: OrgId): Promise<Invitation[]>;
  accept(id: string): Promise<Invitation | null>;
  delete(id: string): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Session repository
// ---------------------------------------------------------------------------

export interface SessionRepo {
  create(input: {
    userId: UserId;
    orgId: OrgId;
    role: OrgRole;
    tokenHash: string;
    expiresAt: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<Session>;
  getById(id: SessionId): Promise<Session | null>;
  getByTokenHash(tokenHash: string): Promise<Session | null>;
  listForUser(orgId: OrgId, userId: UserId): Promise<Session[]>;
  delete(id: SessionId): Promise<boolean>;
  deleteExpired(): Promise<number>;
}

// ---------------------------------------------------------------------------
// Project repository
// ---------------------------------------------------------------------------

export interface ProjectRepo {
  create(input: {
    orgId: OrgId;
    name: string;
    slug: string;
    description?: string;
  }): Promise<Project>;
  getById(id: ProjectId, orgId: OrgId): Promise<Project | null>;
  listForOrg(orgId: OrgId): Promise<Project[]>;
  update(id: ProjectId, orgId: OrgId, input: {
    name?: string;
    slug?: string;
    description?: string;
    settings?: Record<string, unknown>;
  }): Promise<Project | null>;
  delete(id: ProjectId, orgId: OrgId): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Audit repository
// ---------------------------------------------------------------------------

export interface AuditRepo {
  emit(input: EmitAuditEventInput): Promise<AuditEvent>;
  query(orgId: OrgId, params?: AuditQueryParams): Promise<AuditEvent[]>;
}

// ---------------------------------------------------------------------------
// Agent repository (Phase 4, tenant-scoped)
// ---------------------------------------------------------------------------

export interface AgentRepo {
  create(input: {
    orgId: OrgId;
    projectId: ProjectId;
    name: string;
    slug: string;
    description?: string;
    createdBy: UserId;
  }): Promise<Agent>;
  getById(id: AgentId, orgId: OrgId): Promise<Agent | null>;
  getBySlug(projectId: ProjectId, slug: string): Promise<Agent | null>;
  listForOrg(orgId: OrgId, filters?: { projectId?: ProjectId; status?: AgentStatus }): Promise<Agent[]>;
  update(id: AgentId, orgId: OrgId, input: { name?: string; description?: string }): Promise<Agent | null>;
  updateStatus(id: AgentId, orgId: OrgId, status: AgentStatus): Promise<Agent | null>;
  delete(id: AgentId, orgId: OrgId): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Agent version repository (Phase 4, tenant-scoped)
// ---------------------------------------------------------------------------

export interface AgentVersionRepo {
  create(input: {
    orgId: OrgId;
    agentId: AgentId;
    version: number;
    goals: readonly string[];
    instructions: string;
    tools: readonly ToolConfig[];
    budget: BudgetConfig | null;
    approvalRules: readonly ApprovalRuleConfig[];
    memoryConfig: MemoryConfig | null;
    schedule: ScheduleConfig | null;
    modelConfig: ModelConfig;
    createdBy: UserId;
  }): Promise<AgentVersion>;
  getById(id: AgentVersionId, orgId: OrgId): Promise<AgentVersion | null>;
  getByVersion(agentId: AgentId, version: number): Promise<AgentVersion | null>;
  listForAgent(agentId: AgentId): Promise<AgentVersion[]>;
  getLatestVersion(agentId: AgentId): Promise<number>;
  getPublished(agentId: AgentId): Promise<AgentVersion | null>;
  update(id: AgentVersionId, orgId: OrgId, input: {
    goals?: readonly string[];
    instructions?: string;
    tools?: readonly ToolConfig[];
    budget?: BudgetConfig | null;
    approvalRules?: readonly ApprovalRuleConfig[];
    memoryConfig?: MemoryConfig | null;
    schedule?: ScheduleConfig | null;
    modelConfig?: ModelConfig;
  }): Promise<AgentVersion | null>;
  publish(id: AgentVersionId, orgId: OrgId): Promise<AgentVersion | null>;
  unpublishAll(agentId: AgentId): Promise<number>;
}
