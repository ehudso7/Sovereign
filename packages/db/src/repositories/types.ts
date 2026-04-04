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
  PolicyId,
  PolicyDecisionId,
  ApprovalId,
  QuarantineRecordId,
  CrmAccountId,
  CrmContactId,
  CrmDealId,
  CrmTaskId,
  CrmNoteId,
  OutreachDraftId,
  CrmSyncLogId,
  BillingAccountId,
  InvoiceId,
  SpendAlertId,

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
  Policy,
  PolicyDecision,
  Approval,
  QuarantineRecord,
  CrmAccount,
  CrmContact,
  CrmDeal,
  CrmTask,
  CrmNote,
  OutreachDraft,
  CrmSyncLog,
  BillingAccount,
  UsageEvent,
  Invoice,
  SpendAlert,
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
  countAll(): Promise<number>;
  getById(id: UserId): Promise<User | null>;
  getByEmail(email: string): Promise<(User & { passwordHash?: string }) | null>;
  getByWorkosUserId(workosUserId: string): Promise<(User & { passwordHash?: string }) | null>;
  update(
    id: UserId,
    input: Partial<{ email: string; name: string; avatarUrl: string; workosUserId: string }>,
  ): Promise<User | null>;
}

// ---------------------------------------------------------------------------
// Organization repository
// ---------------------------------------------------------------------------

export interface OrgRepo {
  create(input: { name: string; slug: string }): Promise<Organization>;
  countAll(): Promise<number>;
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
  listPendingForEmail(email: string): Promise<Invitation[]>;
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
    providerSessionId?: string;
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

// ---------------------------------------------------------------------------
// Policy repositories (Phase 10)
// ---------------------------------------------------------------------------

export interface PolicyRepo {
  create(input: {
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
  }): Promise<Policy>;
  getById(id: PolicyId, orgId: OrgId): Promise<Policy | null>;
  listForOrg(orgId: OrgId, filters?: { status?: string; scopeType?: string; policyType?: string }): Promise<Policy[]>;
  update(id: PolicyId, orgId: OrgId, input: { name?: string; description?: string; rules?: unknown[]; priority?: number; status?: string; enforcementMode?: string; updatedBy: UserId }): Promise<Policy | null>;
  delete(id: PolicyId, orgId: OrgId): Promise<boolean>;
}

export interface PolicyDecisionRepo {
  create(input: {
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
  }): Promise<PolicyDecision>;
  getById(id: PolicyDecisionId, orgId: OrgId): Promise<PolicyDecision | null>;
  listForOrg(orgId: OrgId, filters?: { result?: string; subjectType?: string; actionType?: string; limit?: number }): Promise<PolicyDecision[]>;
}

export interface ApprovalRepo {
  create(input: {
    orgId: OrgId;
    subjectType: string;
    subjectId?: string;
    actionType: string;
    requestNote?: string;
    requestedBy: UserId;
    policyDecisionId?: string;
    expiresAt?: string;
  }): Promise<Approval>;
  getById(id: ApprovalId, orgId: OrgId): Promise<Approval | null>;
  listForOrg(orgId: OrgId, filters?: { status?: string; subjectType?: string; limit?: number }): Promise<Approval[]>;
  decide(id: ApprovalId, orgId: OrgId, input: { status: "approved" | "denied"; decidedBy: UserId; decisionNote?: string }): Promise<Approval | null>;
  cancel(id: ApprovalId, orgId: OrgId): Promise<Approval | null>;
  expirePending(orgId: OrgId): Promise<number>;
}

export interface QuarantineRecordRepo {
  create(input: {
    orgId: OrgId;
    subjectType: string;
    subjectId: string;
    reason: string;
    quarantinedBy: UserId;
    policyDecisionId?: string;
  }): Promise<QuarantineRecord>;
  getById(id: QuarantineRecordId, orgId: OrgId): Promise<QuarantineRecord | null>;
  listForOrg(orgId: OrgId, filters?: { status?: string; subjectType?: string }): Promise<QuarantineRecord[]>;
  getActiveForSubject(orgId: OrgId, subjectType: string, subjectId: string): Promise<QuarantineRecord | null>;
  release(id: QuarantineRecordId, orgId: OrgId, input: { releasedBy: UserId; releaseNote?: string }): Promise<QuarantineRecord | null>;
}

// ---------------------------------------------------------------------------
// CRM Account Repo (Phase 11)
// ---------------------------------------------------------------------------

export interface CrmAccountRepo {
  create(input: {
    orgId: OrgId;
    name: string;
    domain?: string;
    industry?: string;
    status?: string;
    ownerId?: UserId;
    notes?: string;
    externalCrmId?: string;
    metadata?: Record<string, unknown>;
    createdBy: UserId;
  }): Promise<CrmAccount>;
  getById(id: CrmAccountId, orgId: OrgId): Promise<CrmAccount | null>;
  listForOrg(orgId: OrgId, filters?: { status?: string; ownerId?: UserId }): Promise<CrmAccount[]>;
  update(id: CrmAccountId, orgId: OrgId, input: {
    name?: string; domain?: string; industry?: string; status?: string;
    ownerId?: UserId; notes?: string; externalCrmId?: string;
    metadata?: Record<string, unknown>; updatedBy: UserId;
  }): Promise<CrmAccount | null>;
  delete(id: CrmAccountId, orgId: OrgId): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// CRM Contact Repo (Phase 11)
// ---------------------------------------------------------------------------

export interface CrmContactRepo {
  create(input: {
    orgId: OrgId;
    accountId?: string;
    firstName: string;
    lastName: string;
    email?: string;
    title?: string;
    phone?: string;
    status?: string;
    ownerId?: UserId;
    externalCrmId?: string;
    metadata?: Record<string, unknown>;
    createdBy: UserId;
  }): Promise<CrmContact>;
  getById(id: CrmContactId, orgId: OrgId): Promise<CrmContact | null>;
  listForOrg(orgId: OrgId, filters?: { accountId?: string; ownerId?: UserId; status?: string }): Promise<CrmContact[]>;
  update(id: CrmContactId, orgId: OrgId, input: {
    accountId?: string; firstName?: string; lastName?: string;
    email?: string; title?: string; phone?: string; status?: string;
    ownerId?: UserId; externalCrmId?: string;
    metadata?: Record<string, unknown>; updatedBy: UserId;
  }): Promise<CrmContact | null>;
  delete(id: CrmContactId, orgId: OrgId): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// CRM Deal Repo (Phase 11)
// ---------------------------------------------------------------------------

export interface CrmDealRepo {
  create(input: {
    orgId: OrgId;
    accountId?: string;
    name: string;
    stage?: string;
    valueCents?: number;
    currency?: string;
    closeDate?: string;
    ownerId?: UserId;
    probability?: number;
    notes?: string;
    externalCrmId?: string;
    metadata?: Record<string, unknown>;
    createdBy: UserId;
  }): Promise<CrmDeal>;
  getById(id: CrmDealId, orgId: OrgId): Promise<CrmDeal | null>;
  listForOrg(orgId: OrgId, filters?: { accountId?: string; stage?: string; ownerId?: UserId }): Promise<CrmDeal[]>;
  update(id: CrmDealId, orgId: OrgId, input: {
    accountId?: string; name?: string; stage?: string;
    valueCents?: number; currency?: string; closeDate?: string;
    ownerId?: UserId; probability?: number; notes?: string;
    externalCrmId?: string; metadata?: Record<string, unknown>; updatedBy: UserId;
  }): Promise<CrmDeal | null>;
  delete(id: CrmDealId, orgId: OrgId): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// CRM Task Repo (Phase 11)
// ---------------------------------------------------------------------------

export interface CrmTaskRepo {
  create(input: {
    orgId: OrgId;
    title: string;
    description?: string;
    status?: string;
    priority?: string;
    dueAt?: string;
    linkedEntityType?: string;
    linkedEntityId?: string;
    ownerId?: UserId;
    metadata?: Record<string, unknown>;
    createdBy: UserId;
  }): Promise<CrmTask>;
  getById(id: CrmTaskId, orgId: OrgId): Promise<CrmTask | null>;
  listForOrg(orgId: OrgId, filters?: { status?: string; ownerId?: UserId; linkedEntityType?: string; linkedEntityId?: string }): Promise<CrmTask[]>;
  update(id: CrmTaskId, orgId: OrgId, input: {
    title?: string; description?: string; status?: string; priority?: string;
    dueAt?: string; linkedEntityType?: string; linkedEntityId?: string;
    ownerId?: UserId; metadata?: Record<string, unknown>; updatedBy: UserId;
  }): Promise<CrmTask | null>;
  delete(id: CrmTaskId, orgId: OrgId): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// CRM Note Repo (Phase 11)
// ---------------------------------------------------------------------------

export interface CrmNoteRepo {
  create(input: {
    orgId: OrgId;
    linkedEntityType: string;
    linkedEntityId: string;
    title?: string;
    content: string;
    noteType?: string;
    metadata?: Record<string, unknown>;
    createdBy: UserId;
  }): Promise<CrmNote>;
  getById(id: CrmNoteId, orgId: OrgId): Promise<CrmNote | null>;
  listForEntity(orgId: OrgId, linkedEntityType: string, linkedEntityId: string): Promise<CrmNote[]>;
  listForOrg(orgId: OrgId): Promise<CrmNote[]>;
  update(id: CrmNoteId, orgId: OrgId, input: {
    title?: string; content?: string; noteType?: string;
    metadata?: Record<string, unknown>; updatedBy: UserId;
  }): Promise<CrmNote | null>;
  delete(id: CrmNoteId, orgId: OrgId): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Outreach Draft Repo (Phase 11)
// ---------------------------------------------------------------------------

export interface OutreachDraftRepo {
  create(input: {
    orgId: OrgId;
    linkedEntityType?: string;
    linkedEntityId?: string;
    channel: string;
    subject?: string;
    body: string;
    generatedBy?: string;
    approvalStatus?: string;
    approvalId?: string;
    metadata?: Record<string, unknown>;
    createdBy: UserId;
  }): Promise<OutreachDraft>;
  getById(id: OutreachDraftId, orgId: OrgId): Promise<OutreachDraft | null>;
  listForOrg(orgId: OrgId, filters?: { approvalStatus?: string; linkedEntityType?: string; linkedEntityId?: string }): Promise<OutreachDraft[]>;
  update(id: OutreachDraftId, orgId: OrgId, input: {
    subject?: string; body?: string; approvalStatus?: string;
    approvalId?: string; metadata?: Record<string, unknown>; updatedBy: UserId;
  }): Promise<OutreachDraft | null>;
  delete(id: OutreachDraftId, orgId: OrgId): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// CRM Sync Log Repo (Phase 11)
// ---------------------------------------------------------------------------

export interface CrmSyncLogRepo {
  create(input: {
    orgId: OrgId;
    direction: string;
    entityType: string;
    entityId: string;
    externalCrmId?: string;
    status?: string;
    metadata?: Record<string, unknown>;
    createdBy: UserId;
  }): Promise<CrmSyncLog>;
  getById(id: CrmSyncLogId, orgId: OrgId): Promise<CrmSyncLog | null>;
  listForOrg(orgId: OrgId, filters?: { status?: string; entityType?: string; entityId?: string }): Promise<CrmSyncLog[]>;
  updateStatus(id: CrmSyncLogId, orgId: OrgId, status: string, extras?: { externalCrmId?: string; error?: string; completedAt?: string }): Promise<CrmSyncLog | null>;
}

// ---------------------------------------------------------------------------
// Billing Account Repo (Phase 12)
// ---------------------------------------------------------------------------

export interface BillingAccountRepo {
  create(input: {
    orgId: OrgId; plan?: string; status?: string; billingEmail?: string;
    paymentProvider?: string; providerCustomerId?: string;
    currentPeriodStart?: string; currentPeriodEnd?: string;
    trialEndsAt?: string; spendLimitCents?: number; overageAllowed?: boolean;
    metadata?: Record<string, unknown>; createdBy: UserId;
  }): Promise<BillingAccount>;
  getByOrgId(orgId: OrgId): Promise<BillingAccount | null>;
  update(orgId: OrgId, input: {
    plan?: string; status?: string; billingEmail?: string;
    paymentProvider?: string; providerCustomerId?: string;
    currentPeriodStart?: string; currentPeriodEnd?: string;
    trialEndsAt?: string; spendLimitCents?: number; overageAllowed?: boolean;
    metadata?: Record<string, unknown>; updatedBy: UserId;
  }): Promise<BillingAccount | null>;
}

// ---------------------------------------------------------------------------
// Usage Event Repo (Phase 12)
// ---------------------------------------------------------------------------

export interface UsageEventRepo {
  create(input: {
    orgId: OrgId; eventType: string; meter: string; quantity: number;
    unit: string; sourceType?: string; sourceId?: string;
    metadata?: Record<string, unknown>; occurredAt?: string;
  }): Promise<UsageEvent>;
  listForOrg(orgId: OrgId, filters?: { meter?: string; since?: string; until?: string }): Promise<UsageEvent[]>;
  aggregateByMeter(orgId: OrgId, periodStart: string, periodEnd: string): Promise<Record<string, number>>;
}

// ---------------------------------------------------------------------------
// Invoice Repo (Phase 12)
// ---------------------------------------------------------------------------

export interface InvoiceRepo {
  create(input: {
    orgId: OrgId; billingAccountId: BillingAccountId;
    providerInvoiceId?: string; status?: string;
    subtotalCents: number; overageCents: number; totalCents: number;
    currency?: string; periodStart: string; periodEnd: string;
    dueAt?: string; lineItems?: unknown[];
    metadata?: Record<string, unknown>;
  }): Promise<Invoice>;
  getById(id: InvoiceId, orgId: OrgId): Promise<Invoice | null>;
  listForOrg(orgId: OrgId, filters?: { status?: string }): Promise<Invoice[]>;
  update(id: InvoiceId, orgId: OrgId, input: {
    status?: string; providerInvoiceId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Invoice | null>;
}

// ---------------------------------------------------------------------------
// Spend Alert Repo (Phase 12)
// ---------------------------------------------------------------------------

export interface SpendAlertRepo {
  create(input: {
    orgId: OrgId; thresholdCents: number; createdBy: UserId;
  }): Promise<SpendAlert>;
  listForOrg(orgId: OrgId, filters?: { status?: string }): Promise<SpendAlert[]>;
  trigger(id: SpendAlertId, orgId: OrgId, currentSpendCents: number): Promise<SpendAlert | null>;
  acknowledge(id: SpendAlertId, orgId: OrgId, userId: UserId): Promise<SpendAlert | null>;
}
