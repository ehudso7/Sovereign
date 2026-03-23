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
  RunId,
  ConnectorId,
  ConnectorInstallId,
  SkillId,
  BrowserSessionId,
  AlertRuleId,
  AlertEventId,

  OrgRole,
  AgentStatus,
  RunStatus,
  RunStepStatus,
  BrowserSessionStatus,
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
  Run,
  CreateRunInput,
  RunStep,
  Connector,
  ConnectorInstall,
  CreateConnectorInstallInput,
  Skill,
  SkillInstall,
  BrowserSession,
  CreateBrowserSessionInput,
  MemoryId,
  MemoryLinkId,
  MemoryKind,
  MemoryScopeType,
  MemoryStatus,
  Memory,
  CreateMemoryInput,
  UpdateMemoryInput,
  MemoryLink,
  CreateMemoryLinkInput,
  AlertRule,
  AlertEvent,
  ISODateString,
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

// ---------------------------------------------------------------------------
// Run repository (Phase 5, tenant-scoped)
// ---------------------------------------------------------------------------

export interface RunRepo {
  create(input: CreateRunInput): Promise<Run>;
  getById(id: RunId, orgId: OrgId): Promise<Run | null>;
  listForOrg(orgId: OrgId, filters?: {
    agentId?: AgentId;
    projectId?: ProjectId;
    status?: RunStatus;
  }): Promise<Run[]>;
  listForAgent(agentId: AgentId, orgId: OrgId): Promise<Run[]>;
  updateStatus(id: RunId, orgId: OrgId, status: RunStatus, extras?: {
    output?: Record<string, unknown>;
    error?: { code: string; message: string };
    tokenUsage?: { inputTokens: number; outputTokens: number; totalTokens: number };
    costCents?: number;
    startedAt?: ISODateString;
    completedAt?: ISODateString;
  }): Promise<Run | null>;
  delete(id: RunId, orgId: OrgId): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Run step repository (Phase 5, tenant-scoped)
// ---------------------------------------------------------------------------

export interface RunStepRepo {
  create(input: {
    orgId: OrgId;
    runId: RunId;
    stepNumber: number;
    type: import("@sovereign/core").RunStepType;
    attempt?: number;
    toolName?: string;
    input?: Record<string, unknown>;
  }): Promise<RunStep>;
  getById(id: string, orgId: OrgId): Promise<RunStep | null>;
  listForRun(runId: RunId): Promise<RunStep[]>;
  updateStatus(id: string, orgId: OrgId, status: RunStepStatus, extras?: {
    output?: Record<string, unknown>;
    error?: Record<string, unknown>;
    tokenUsage?: { inputTokens: number; outputTokens: number; totalTokens: number };
    providerMetadata?: Record<string, unknown>;
    latencyMs?: number;
    startedAt?: ISODateString;
    completedAt?: ISODateString;
  }): Promise<RunStep | null>;
  getNextStepNumber(runId: RunId): Promise<number>;
}

// ---------------------------------------------------------------------------
// Connector Repo (Phase 6) — global catalog, not org-scoped
// ---------------------------------------------------------------------------

export interface ConnectorRepo {
  create(input: {
    slug: string;
    name: string;
    description?: string;
    category: string;
    trustTier: string;
    authMode: string;
    status?: string;
    tools: readonly unknown[];
    scopes: readonly unknown[];
    metadata?: Record<string, unknown>;
  }): Promise<Connector>;
  getById(id: ConnectorId): Promise<Connector | null>;
  getBySlug(slug: string): Promise<Connector | null>;
  listAll(filters?: { category?: string; trustTier?: string; status?: string }): Promise<Connector[]>;
}

// ---------------------------------------------------------------------------
// Connector Install Repo (Phase 6) — org-scoped
// ---------------------------------------------------------------------------

export interface ConnectorInstallRepo {
  create(input: CreateConnectorInstallInput): Promise<ConnectorInstall>;
  getById(id: ConnectorInstallId, orgId: OrgId): Promise<ConnectorInstall | null>;
  getByConnectorId(connectorId: ConnectorId, orgId: OrgId): Promise<ConnectorInstall | null>;
  listForOrg(orgId: OrgId, filters?: { enabled?: boolean }): Promise<ConnectorInstall[]>;
  update(id: ConnectorInstallId, orgId: OrgId, input: { enabled?: boolean; config?: Record<string, unknown>; grantedScopes?: readonly string[]; updatedBy: UserId }): Promise<ConnectorInstall | null>;
  delete(id: ConnectorInstallId, orgId: OrgId): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Connector Credential Repo (Phase 6) — org-scoped
// ---------------------------------------------------------------------------

export interface ConnectorCredentialRepo {
  upsert(input: {
    orgId: OrgId;
    connectorInstallId: ConnectorInstallId;
    credentialType: string;
    encryptedData: string;
    expiresAt?: string;
  }): Promise<{ id: string }>;
  getByInstallId(connectorInstallId: ConnectorInstallId, orgId: OrgId): Promise<{ id: string; credentialType: string; encryptedData: string; expiresAt: string | null } | null>;
  deleteByInstallId(connectorInstallId: ConnectorInstallId, orgId: OrgId): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Skill Repo (Phase 6) — global catalog
// ---------------------------------------------------------------------------

export interface SkillRepo {
  create(input: {
    slug: string;
    name: string;
    description?: string;
    trustTier: string;
    connectorSlugs: readonly string[];
    metadata?: Record<string, unknown>;
  }): Promise<Skill>;
  getById(id: SkillId): Promise<Skill | null>;
  getBySlug(slug: string): Promise<Skill | null>;
  listAll(filters?: { trustTier?: string }): Promise<Skill[]>;
}

// ---------------------------------------------------------------------------
// Skill Install Repo (Phase 6) — org-scoped
// ---------------------------------------------------------------------------

export interface SkillInstallRepo {
  create(input: {
    orgId: OrgId;
    skillId: SkillId;
    skillSlug: string;
    installedBy: UserId;
  }): Promise<SkillInstall>;
  getBySkillId(skillId: SkillId, orgId: OrgId): Promise<SkillInstall | null>;
  listForOrg(orgId: OrgId, filters?: { enabled?: boolean }): Promise<SkillInstall[]>;
  delete(skillId: SkillId, orgId: OrgId): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Browser Session Repo (Phase 7) — org-scoped
// ---------------------------------------------------------------------------

export interface BrowserSessionRepo {
  create(input: CreateBrowserSessionInput): Promise<BrowserSession>;
  getById(id: BrowserSessionId, orgId: OrgId): Promise<BrowserSession | null>;
  listForOrg(orgId: OrgId, filters?: { runId?: RunId; status?: BrowserSessionStatus }): Promise<BrowserSession[]>;
  listForRun(runId: RunId, orgId: OrgId): Promise<BrowserSession[]>;
  updateStatus(id: BrowserSessionId, orgId: OrgId, status: BrowserSessionStatus, extras?: {
    currentUrl?: string;
    humanTakeover?: boolean;
    takeoverBy?: UserId | null;
    sessionRef?: string;
    artifactKeys?: readonly string[];
    metadata?: Record<string, unknown>;
    startedAt?: ISODateString;
    lastActivityAt?: ISODateString;
    endedAt?: ISODateString;
  }): Promise<BrowserSession | null>;
  delete(id: BrowserSessionId, orgId: OrgId): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Memory Repo (Phase 8) — org-scoped
// ---------------------------------------------------------------------------

export interface MemoryRepo {
  create(input: CreateMemoryInput): Promise<Memory>;
  getById(id: MemoryId, orgId: OrgId): Promise<Memory | null>;
  listForOrg(orgId: OrgId, filters?: {
    scopeType?: MemoryScopeType;
    scopeId?: string;
    kind?: MemoryKind;
    status?: MemoryStatus;
  }): Promise<Memory[]>;
  search(orgId: OrgId, query: string, filters?: {
    scopeType?: MemoryScopeType;
    scopeId?: string;
    kind?: MemoryKind;
    maxResults?: number;
  }): Promise<Memory[]>;
  update(id: MemoryId, orgId: OrgId, input: UpdateMemoryInput): Promise<Memory | null>;
  updateStatus(id: MemoryId, orgId: OrgId, status: MemoryStatus, extras?: {
    redactedAt?: ISODateString;
    expiresAt?: ISODateString;
    content?: string;
    contentHash?: string;
  }): Promise<Memory | null>;
  getByContentHash(orgId: OrgId, contentHash: string): Promise<Memory | null>;
  delete(id: MemoryId, orgId: OrgId): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Memory Link Repo (Phase 8) — org-scoped
// ---------------------------------------------------------------------------

export interface MemoryLinkRepo {
  create(input: CreateMemoryLinkInput): Promise<MemoryLink>;
  listForMemory(memoryId: MemoryId, orgId: OrgId): Promise<MemoryLink[]>;
  listForEntity(entityType: string, entityId: string, orgId: OrgId): Promise<MemoryLink[]>;
  delete(id: MemoryLinkId, orgId: OrgId): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Phase 9 — Alert repositories
// ---------------------------------------------------------------------------

export interface AlertRuleRepo {
  create(input: {
    orgId: OrgId;
    name: string;
    description?: string;
    conditionType: string;
    thresholdMinutes?: number;
    enabled?: boolean;
    createdBy: UserId;
  }): Promise<AlertRule>;
  getById(id: AlertRuleId, orgId: OrgId): Promise<AlertRule | null>;
  listForOrg(orgId: OrgId, filters?: { conditionType?: string; enabled?: boolean }): Promise<AlertRule[]>;
  update(id: AlertRuleId, orgId: OrgId, input: { name?: string; description?: string; thresholdMinutes?: number; enabled?: boolean }): Promise<AlertRule | null>;
  delete(id: AlertRuleId, orgId: OrgId): Promise<boolean>;
}

export interface AlertEventRepo {
  create(input: {
    orgId: OrgId;
    alertRuleId?: string;
    severity: string;
    title: string;
    message?: string;
    conditionType: string;
    resourceType: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<AlertEvent>;
  getById(id: AlertEventId, orgId: OrgId): Promise<AlertEvent | null>;
  listForOrg(orgId: OrgId, filters?: {
    status?: string;
    severity?: string;
    conditionType?: string;
    limit?: number;
  }): Promise<AlertEvent[]>;
  acknowledge(id: AlertEventId, orgId: OrgId, userId: UserId): Promise<AlertEvent | null>;
  resolve(id: AlertEventId, orgId: OrgId): Promise<AlertEvent | null>;
  countByStatus(orgId: OrgId): Promise<Record<string, number>>;
}
