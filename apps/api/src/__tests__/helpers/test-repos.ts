// ---------------------------------------------------------------------------
// In-memory repository implementations for unit tests
// ---------------------------------------------------------------------------

import { randomUUID, createHash } from "node:crypto";

import type {
  OrgId,
  UserId,
  ProjectId,
  AgentId,
  AgentVersionId,
  RunId,
  SessionId,
  MembershipId,
  ConnectorId,
  ConnectorInstallId,
  SkillId,
  BrowserSessionId,
  OrgRole,
  ISODateString,
  User,
  Organization,
  Membership,
  Invitation,
  Session,
  Project,
  Agent,
  AgentStatus,
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
  RunStatus,
  RunStep,
  RunStepType,
  RunStepStatus,
  Connector,
  ConnectorInstall,
  CreateConnectorInstallInput,
  Skill,
  SkillInstall,
  BrowserSession,
  BrowserSessionStatus,
  CreateBrowserSessionInput,
  Memory,
  MemoryKind,
  MemoryScopeType,
  MemoryStatus,
  CreateMemoryInput,
  UpdateMemoryInput,
  MemoryLink,
  CreateMemoryLinkInput,
  MemoryId,
  MemoryLinkId,
  AlertRule,
  AlertEvent,
  AlertRuleId,
  AlertEventId,
  AlertConditionType,
  AlertSeverity,
  AlertStatus,
  Policy,
  PolicyDecision,
  Approval,
  QuarantineRecord,
  PolicyId,
  PolicyDecisionId,
  ApprovalId,
  QuarantineRecordId,
} from "@sovereign/core";

import {
  toOrgId,
  toUserId,
  toProjectId,
  toAgentId,
  toAgentVersionId,
  toRunId,
  toSessionId,
  toMembershipId,
  toInvitationId,
  toISODateString,
  toAuditEventId,
  toConnectorId,
  toConnectorInstallId,
  toSkillId,
  toSkillInstallId,
  toBrowserSessionId,
  toMemoryId,
  toMemoryLinkId,
  toAlertRuleId,
  toAlertEventId,
  toPolicyId,
  toPolicyDecisionId,
  toApprovalId,
  toQuarantineRecordId,
} from "@sovereign/core";

import type {
  UserRepo,
  OrgRepo,
  MembershipRepo,
  InvitationRepo,
  PolicyRepo,
  PolicyDecisionRepo,
  ApprovalRepo,
  QuarantineRecordRepo,
  SessionRepo,
  ProjectRepo,
  AuditRepo,
  AgentRepo,
  AgentVersionRepo,
  RunRepo,
  RunStepRepo,
  ConnectorRepo,
  ConnectorInstallRepo,
  ConnectorCredentialRepo,
  SkillRepo,
  SkillInstallRepo,
  BrowserSessionRepo,
  MemoryRepo,
  MemoryLinkRepo,
  AlertRuleRepo,
  AlertEventRepo,
} from "@sovereign/db";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function now(): ISODateString {
  return toISODateString(new Date());
}

// ---------------------------------------------------------------------------
// TestUserRepo
// ---------------------------------------------------------------------------

export class TestUserRepo implements UserRepo {
  private readonly store = new Map<string, User & { passwordHash?: string }>();

  async create(input: {
    email: string;
    name: string;
    avatarUrl?: string;
    workosUserId?: string;
    passwordHash?: string;
  }): Promise<User> {
    const ts = now();
    const user: User & { passwordHash?: string } = {
      id: toUserId(randomUUID()),
      email: input.email,
      name: input.name,
      avatarUrl: input.avatarUrl,
      workosUserId: input.workosUserId,
      createdAt: ts,
      updatedAt: ts,
      passwordHash: input.passwordHash,
    };
    this.store.set(user.id, user);
    return user;
  }

  async getById(id: UserId): Promise<User | null> {
    return this.store.get(id) ?? null;
  }

  async getByEmail(email: string): Promise<(User & { passwordHash?: string }) | null> {
    for (const u of this.store.values()) {
      if (u.email === email) return u;
    }
    return null;
  }

  async update(
    id: UserId,
    input: Partial<{ name: string; avatarUrl: string }>,
  ): Promise<User | null> {
    const existing = this.store.get(id);
    if (!existing) return null;
    const updated: User & { passwordHash?: string } = {
      ...existing,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      updatedAt: now(),
    };
    this.store.set(id, updated);
    return updated;
  }

  /** Synchronous user creation for test setup convenience */
  createSync(input: {
    email: string;
    name: string;
    avatarUrl?: string;
    workosUserId?: string;
    passwordHash?: string;
  }): User {
    const ts = now();
    const user: User & { passwordHash?: string } = {
      id: toUserId(randomUUID()),
      email: input.email,
      name: input.name,
      avatarUrl: input.avatarUrl,
      workosUserId: input.workosUserId,
      createdAt: ts,
      updatedAt: ts,
      passwordHash: input.passwordHash,
    };
    this.store.set(user.id, user);
    return user;
  }

  /** Test-only: reset all data */
  reset(): void {
    this.store.clear();
  }
}

// ---------------------------------------------------------------------------
// TestOrgRepo
// ---------------------------------------------------------------------------

export class TestOrgRepo implements OrgRepo {
  private readonly store = new Map<string, Organization>();

  async create(input: { name: string; slug: string }): Promise<Organization> {
    const ts = now();
    const org: Organization = {
      id: toOrgId(randomUUID()),
      name: input.name,
      slug: input.slug,
      plan: "free",
      settings: {},
      createdAt: ts,
      updatedAt: ts,
    };
    this.store.set(org.id, org);
    return org;
  }

  async getById(id: OrgId): Promise<Organization | null> {
    return this.store.get(id) ?? null;
  }

  async getBySlug(slug: string): Promise<Organization | null> {
    for (const o of this.store.values()) {
      if (o.slug === slug) return o;
    }
    return null;
  }

  async update(
    id: OrgId,
    input: { name?: string; settings?: Record<string, unknown> },
  ): Promise<Organization | null> {
    const existing = this.store.get(id);
    if (!existing) return null;
    const updated: Organization = {
      ...existing,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.settings !== undefined ? { settings: input.settings } : {}),
      updatedAt: now(),
    };
    this.store.set(id, updated);
    return updated;
  }

  async listForUser(_userId: UserId): Promise<Organization[]> {
    // Default: returns all orgs. Overridden by _setMembershipRepo to be
    // membership-aware when wired via createTestRepos().
    return [...this.store.values()];
  }

  /** Provide membership-aware listForUser when wired with a membership repo */
  _setMembershipRepo(membershipRepo: TestMembershipRepo): void {
    this.listForUser = async (userId: UserId): Promise<Organization[]> => {
      const memberships = await membershipRepo.listForUser(userId);
      const orgIds = new Set(memberships.map((m) => m.orgId as string));
      return [...this.store.values()].filter((o) => orgIds.has(o.id as string));
    };
  }

  reset(): void {
    this.store.clear();
  }
}

// ---------------------------------------------------------------------------
// TestMembershipRepo
// ---------------------------------------------------------------------------

export class TestMembershipRepo implements MembershipRepo {
  private readonly store = new Map<string, Membership>();
  private userRepo: TestUserRepo | null = null;

  _setUserRepo(userRepo: TestUserRepo): void {
    this.userRepo = userRepo;
  }

  async create(input: {
    orgId: OrgId;
    userId: UserId;
    role: OrgRole;
    invitedBy?: UserId;
    accepted?: boolean;
  }): Promise<Membership> {
    const membership: Membership = {
      id: toMembershipId(randomUUID()),
      orgId: input.orgId,
      userId: input.userId,
      role: input.role,
      invitedBy: input.invitedBy,
      acceptedAt: input.accepted !== false ? now() : undefined,
      createdAt: now(),
    };
    this.store.set(membership.id, membership);
    return membership;
  }

  async getForUser(orgId: OrgId, userId: UserId): Promise<Membership | null> {
    for (const m of this.store.values()) {
      if (m.orgId === orgId && m.userId === userId) return m;
    }
    return null;
  }

  async listForOrg(orgId: OrgId): Promise<(Membership & { user: User })[]> {
    const results: (Membership & { user: User })[] = [];
    for (const m of this.store.values()) {
      if (m.orgId === orgId) {
        const user = this.userRepo ? await this.userRepo.getById(m.userId) : null;
        if (user) {
          results.push({ ...m, user });
        }
      }
    }
    return results;
  }

  async listForUser(userId: UserId): Promise<Membership[]> {
    return [...this.store.values()].filter((m) => m.userId === userId);
  }

  async updateRole(id: MembershipId, role: OrgRole): Promise<Membership | null> {
    const existing = this.store.get(id);
    if (!existing) return null;
    const updated: Membership = { ...existing, role };
    this.store.set(id, updated);
    return updated;
  }

  async delete(orgId: OrgId, userId: UserId): Promise<boolean> {
    for (const [key, m] of this.store.entries()) {
      if (m.orgId === orgId && m.userId === userId) {
        this.store.delete(key);
        return true;
      }
    }
    return false;
  }

  async countByRole(orgId: OrgId, role: OrgRole): Promise<number> {
    let count = 0;
    for (const m of this.store.values()) {
      if (m.orgId === orgId && m.role === role) count++;
    }
    return count;
  }

  reset(): void {
    this.store.clear();
  }
}

// ---------------------------------------------------------------------------
// TestInvitationRepo
// ---------------------------------------------------------------------------

export class TestInvitationRepo implements InvitationRepo {
  private readonly store = new Map<string, Invitation>();

  async create(input: {
    orgId: OrgId;
    email: string;
    role: OrgRole;
    invitedBy: UserId;
    expiresAt: string;
  }): Promise<Invitation> {
    const invitation: Invitation = {
      id: toInvitationId(randomUUID()),
      orgId: input.orgId,
      email: input.email,
      role: input.role,
      invitedBy: input.invitedBy,
      expiresAt: toISODateString(input.expiresAt),
      createdAt: now(),
    };
    this.store.set(invitation.id, invitation);
    return invitation;
  }

  async getById(id: string): Promise<Invitation | null> {
    return this.store.get(id) ?? null;
  }

  async listForOrg(orgId: OrgId): Promise<Invitation[]> {
    return [...this.store.values()].filter((i) => i.orgId === orgId);
  }

  async accept(id: string): Promise<Invitation | null> {
    const existing = this.store.get(id);
    if (!existing) return null;
    const updated: Invitation = { ...existing, acceptedAt: now() };
    this.store.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }

  reset(): void {
    this.store.clear();
  }
}

// ---------------------------------------------------------------------------
// TestSessionRepo
// ---------------------------------------------------------------------------

export class TestSessionRepo implements SessionRepo {
  private readonly store = new Map<string, Session & { tokenHash: string }>();

  async create(input: {
    userId: UserId;
    orgId: OrgId;
    role: OrgRole;
    tokenHash: string;
    expiresAt: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<Session> {
    const session: Session = {
      id: toSessionId(randomUUID()),
      userId: input.userId,
      orgId: input.orgId,
      role: input.role,
      expiresAt: toISODateString(input.expiresAt),
      createdAt: now(),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    };
    this.store.set(session.id, { ...session, tokenHash: input.tokenHash });
    return session;
  }

  async getById(id: SessionId): Promise<Session | null> {
    const entry = this.store.get(id);
    if (!entry) return null;
    const { tokenHash: _tokenHash, ...session } = entry;
    return session;
  }

  async getByTokenHash(tokenHash: string): Promise<Session | null> {
    for (const entry of this.store.values()) {
      if (entry.tokenHash === tokenHash) {
        const { tokenHash: _tokenHash, ...session } = entry;
        return session;
      }
    }
    return null;
  }

  async listForUser(orgId: OrgId, userId: UserId): Promise<Session[]> {
    return [...this.store.values()]
      .filter((s) => s.orgId === orgId && s.userId === userId)
      .map(({ tokenHash: _tokenHash, ...session }) => session);
  }

  async delete(id: SessionId): Promise<boolean> {
    return this.store.delete(id);
  }

  async deleteExpired(): Promise<number> {
    const nowMs = Date.now();
    let count = 0;
    for (const [key, s] of this.store.entries()) {
      if (new Date(s.expiresAt).getTime() < nowMs) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  reset(): void {
    this.store.clear();
  }
}

// ---------------------------------------------------------------------------
// TestProjectRepo
// ---------------------------------------------------------------------------

export class TestProjectRepo implements ProjectRepo {
  private readonly store = new Map<string, Project>();
  readonly scopedOrgId?: OrgId;

  constructor(orgId?: OrgId) {
    this.scopedOrgId = orgId;
  }

  async create(input: {
    orgId: OrgId;
    name: string;
    slug: string;
    description?: string;
  }): Promise<Project> {
    const ts = now();
    const project: Project = {
      id: toProjectId(randomUUID()),
      orgId: input.orgId,
      name: input.name,
      slug: input.slug,
      description: input.description,
      settings: {},
      createdAt: ts,
      updatedAt: ts,
    };
    this.store.set(project.id, project);
    return project;
  }

  async getById(id: ProjectId, orgId: OrgId): Promise<Project | null> {
    const project = this.store.get(id);
    if (!project || project.orgId !== orgId) return null;
    return project;
  }

  async listForOrg(orgId: OrgId): Promise<Project[]> {
    return [...this.store.values()].filter((p) => p.orgId === orgId);
  }

  async update(
    id: ProjectId,
    orgId: OrgId,
    input: {
      name?: string;
      slug?: string;
      description?: string;
      settings?: Record<string, unknown>;
    },
  ): Promise<Project | null> {
    const existing = this.store.get(id);
    if (!existing || existing.orgId !== orgId) return null;
    const updated: Project = {
      ...existing,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.settings !== undefined ? { settings: input.settings } : {}),
      updatedAt: now(),
    };
    this.store.set(id, updated);
    return updated;
  }

  async delete(id: ProjectId, orgId: OrgId): Promise<boolean> {
    const existing = this.store.get(id);
    if (!existing || existing.orgId !== orgId) return false;
    return this.store.delete(id);
  }

  reset(): void {
    this.store.clear();
  }
}

// ---------------------------------------------------------------------------
// TestAuditRepo
// ---------------------------------------------------------------------------

export class TestAuditRepo implements AuditRepo {
  private readonly store: AuditEvent[] = [];
  readonly scopedOrgId?: OrgId;

  constructor(orgId?: OrgId) {
    this.scopedOrgId = orgId;
  }

  async emit(input: EmitAuditEventInput): Promise<AuditEvent> {
    const event: AuditEvent = {
      id: toAuditEventId(randomUUID()),
      orgId: input.orgId,
      actorId: input.actorId,
      actorType: input.actorType,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      metadata: input.metadata ?? {},
      ipAddress: input.ipAddress,
      createdAt: now(),
    };
    this.store.push(event);
    return event;
  }

  async query(orgId: OrgId, params?: AuditQueryParams): Promise<AuditEvent[]> {
    let results = this.store.filter((e) => e.orgId === orgId);

    if (params?.action) {
      results = results.filter((e) => e.action === params.action);
    }
    if (params?.resourceType) {
      results = results.filter((e) => e.resourceType === params.resourceType);
    }
    if (params?.resourceId) {
      results = results.filter((e) => e.resourceId === params.resourceId);
    }
    if (params?.actorId) {
      results = results.filter((e) => e.actorId === params.actorId);
    }
    if (params?.since) {
      const sinceMs = new Date(params.since).getTime();
      results = results.filter((e) => new Date(e.createdAt).getTime() >= sinceMs);
    }

    // Most recent first
    results.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    if (params?.limit) {
      results = results.slice(0, params.limit);
    }

    return results;
  }

  reset(): void {
    this.store.length = 0;
  }
}

// ---------------------------------------------------------------------------
// TestAgentRepo
// ---------------------------------------------------------------------------

export class TestAgentRepo implements AgentRepo {
  private readonly store = new Map<string, Agent>();
  readonly scopedOrgId?: OrgId;

  constructor(orgId?: OrgId) {
    this.scopedOrgId = orgId;
  }

  async create(input: {
    orgId: OrgId;
    projectId: ProjectId;
    name: string;
    slug: string;
    description?: string;
    createdBy: UserId;
  }): Promise<Agent> {
    const ts = now();
    const agent: Agent = {
      id: toAgentId(randomUUID()),
      orgId: input.orgId,
      projectId: input.projectId,
      name: input.name,
      slug: input.slug,
      description: input.description,
      status: "draft",
      createdBy: input.createdBy,
      createdAt: ts,
      updatedAt: ts,
    };
    this.store.set(agent.id, agent);
    return agent;
  }

  async getById(id: AgentId, orgId: OrgId): Promise<Agent | null> {
    const agent = this.store.get(id);
    if (!agent || agent.orgId !== orgId) return null;
    return agent;
  }

  async getBySlug(projectId: ProjectId, slug: string): Promise<Agent | null> {
    for (const a of this.store.values()) {
      if (a.projectId === projectId && a.slug === slug) return a;
    }
    return null;
  }

  async listForOrg(orgId: OrgId, filters?: { projectId?: ProjectId; status?: AgentStatus }): Promise<Agent[]> {
    let results = [...this.store.values()].filter((a) => a.orgId === orgId);
    if (filters?.projectId) results = results.filter((a) => a.projectId === filters.projectId);
    if (filters?.status) results = results.filter((a) => a.status === filters.status);
    return results;
  }

  async update(id: AgentId, orgId: OrgId, input: { name?: string; description?: string }): Promise<Agent | null> {
    const existing = this.store.get(id);
    if (!existing || existing.orgId !== orgId) return null;
    const updated: Agent = {
      ...existing,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      updatedAt: now(),
    };
    this.store.set(id, updated);
    return updated;
  }

  async updateStatus(id: AgentId, orgId: OrgId, status: AgentStatus): Promise<Agent | null> {
    const existing = this.store.get(id);
    if (!existing || existing.orgId !== orgId) return null;
    const updated: Agent = { ...existing, status, updatedAt: now() };
    this.store.set(id, updated);
    return updated;
  }

  async delete(id: AgentId, orgId: OrgId): Promise<boolean> {
    const existing = this.store.get(id);
    if (!existing || existing.orgId !== orgId) return false;
    return this.store.delete(id);
  }

  reset(): void {
    this.store.clear();
  }
}

// ---------------------------------------------------------------------------
// TestAgentVersionRepo
// ---------------------------------------------------------------------------

export class TestAgentVersionRepo implements AgentVersionRepo {
  private readonly store = new Map<string, AgentVersion>();
  readonly scopedOrgId?: OrgId;

  constructor(orgId?: OrgId) {
    this.scopedOrgId = orgId;
  }

  async create(input: {
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
  }): Promise<AgentVersion> {
    const ts = now();
    const version: AgentVersion = {
      id: toAgentVersionId(randomUUID()),
      orgId: input.orgId,
      agentId: input.agentId,
      version: input.version,
      goals: input.goals,
      instructions: input.instructions,
      tools: input.tools,
      budget: input.budget,
      approvalRules: input.approvalRules,
      memoryConfig: input.memoryConfig,
      schedule: input.schedule,
      modelConfig: input.modelConfig,
      published: false,
      createdBy: input.createdBy,
      createdAt: ts,
    };
    this.store.set(version.id, version);
    return version;
  }

  async getById(id: AgentVersionId, orgId: OrgId): Promise<AgentVersion | null> {
    const v = this.store.get(id);
    if (!v || v.orgId !== orgId) return null;
    return v;
  }

  async getByVersion(agentId: AgentId, version: number): Promise<AgentVersion | null> {
    for (const v of this.store.values()) {
      if (v.agentId === agentId && v.version === version) return v;
    }
    return null;
  }

  async listForAgent(agentId: AgentId): Promise<AgentVersion[]> {
    return [...this.store.values()]
      .filter((v) => v.agentId === agentId)
      .sort((a, b) => b.version - a.version);
  }

  async getLatestVersion(agentId: AgentId): Promise<number> {
    let max = 0;
    for (const v of this.store.values()) {
      if (v.agentId === agentId && v.version > max) max = v.version;
    }
    return max;
  }

  async getPublished(agentId: AgentId): Promise<AgentVersion | null> {
    for (const v of this.store.values()) {
      if (v.agentId === agentId && v.published) return v;
    }
    return null;
  }

  async update(id: AgentVersionId, orgId: OrgId, input: {
    goals?: readonly string[];
    instructions?: string;
    tools?: readonly ToolConfig[];
    budget?: BudgetConfig | null;
    approvalRules?: readonly ApprovalRuleConfig[];
    memoryConfig?: MemoryConfig | null;
    schedule?: ScheduleConfig | null;
    modelConfig?: ModelConfig;
  }): Promise<AgentVersion | null> {
    const existing = this.store.get(id);
    if (!existing || existing.orgId !== orgId) return null;
    const updated: AgentVersion = {
      ...existing,
      ...(input.goals !== undefined ? { goals: input.goals } : {}),
      ...(input.instructions !== undefined ? { instructions: input.instructions } : {}),
      ...(input.tools !== undefined ? { tools: input.tools } : {}),
      ...(input.budget !== undefined ? { budget: input.budget } : {}),
      ...(input.approvalRules !== undefined ? { approvalRules: input.approvalRules } : {}),
      ...(input.memoryConfig !== undefined ? { memoryConfig: input.memoryConfig } : {}),
      ...(input.schedule !== undefined ? { schedule: input.schedule } : {}),
      ...(input.modelConfig !== undefined ? { modelConfig: input.modelConfig } : {}),
    };
    this.store.set(id, updated);
    return updated;
  }

  async publish(id: AgentVersionId, orgId: OrgId): Promise<AgentVersion | null> {
    const existing = this.store.get(id);
    if (!existing || existing.orgId !== orgId) return null;
    const published: AgentVersion = {
      ...existing,
      published: true,
      publishedAt: now(),
    };
    this.store.set(id, published);
    return published;
  }

  async unpublishAll(agentId: AgentId): Promise<number> {
    let count = 0;
    for (const [key, v] of this.store.entries()) {
      if (v.agentId === agentId && v.published) {
        this.store.set(key, { ...v, published: false, publishedAt: undefined });
        count++;
      }
    }
    return count;
  }

  reset(): void {
    this.store.clear();
  }
}

// ---------------------------------------------------------------------------
// TestRunRepo
// ---------------------------------------------------------------------------

export class TestRunRepo implements RunRepo {
  private readonly store = new Map<string, Run>();
  readonly scopedOrgId?: OrgId;

  constructor(orgId?: OrgId) {
    this.scopedOrgId = orgId;
  }

  async create(input: CreateRunInput): Promise<Run> {
    const ts = now();
    const run: Run = {
      id: toRunId(randomUUID()),
      orgId: input.orgId,
      projectId: input.projectId,
      agentId: input.agentId,
      agentVersionId: input.agentVersionId,
      status: "queued",
      triggerType: input.triggerType,
      triggeredBy: input.triggeredBy,
      executionProvider: input.executionProvider,
      input: input.input ?? {},
      configSnapshot: input.configSnapshot,
      output: null,
      error: null,
      tokenUsage: null,
      costCents: null,
      attemptCount: 1,
      temporalWorkflowId: null,
      startedAt: null,
      completedAt: null,
      createdAt: ts,
      updatedAt: ts,
    };
    this.store.set(run.id, run);
    return run;
  }

  async getById(id: RunId, orgId: OrgId): Promise<Run | null> {
    const run = this.store.get(id);
    if (!run || run.orgId !== orgId) return null;
    return run;
  }

  async listForOrg(
    orgId: OrgId,
    filters?: { agentId?: AgentId; projectId?: ProjectId; status?: RunStatus },
  ): Promise<Run[]> {
    let results = [...this.store.values()].filter((r) => r.orgId === orgId);
    if (filters?.agentId) results = results.filter((r) => r.agentId === filters.agentId);
    if (filters?.projectId) results = results.filter((r) => r.projectId === filters.projectId);
    if (filters?.status) results = results.filter((r) => r.status === filters.status);
    return results;
  }

  async listForAgent(agentId: AgentId, orgId: OrgId): Promise<Run[]> {
    return [...this.store.values()].filter(
      (r) => r.agentId === agentId && r.orgId === orgId,
    );
  }

  async updateStatus(
    id: RunId,
    orgId: OrgId,
    status: RunStatus,
    extras?: {
      output?: Record<string, unknown>;
      error?: { code: string; message: string };
      tokenUsage?: { inputTokens: number; outputTokens: number; totalTokens: number };
      costCents?: number;
      startedAt?: ISODateString;
      completedAt?: ISODateString;
    },
  ): Promise<Run | null> {
    const existing = this.store.get(id);
    if (!existing || existing.orgId !== orgId) return null;
    const updated: Run = {
      ...existing,
      status,
      ...(extras?.output !== undefined ? { output: extras.output } : {}),
      ...(extras?.error !== undefined ? { error: extras.error } : {}),
      ...(extras?.tokenUsage !== undefined ? { tokenUsage: extras.tokenUsage } : {}),
      ...(extras?.costCents !== undefined ? { costCents: extras.costCents } : {}),
      ...(extras?.startedAt !== undefined ? { startedAt: extras.startedAt } : {}),
      ...(extras?.completedAt !== undefined ? { completedAt: extras.completedAt } : {}),
      updatedAt: now(),
    };
    this.store.set(id, updated);
    return updated;
  }

  async delete(id: RunId, orgId: OrgId): Promise<boolean> {
    const existing = this.store.get(id);
    if (!existing || existing.orgId !== orgId) return false;
    return this.store.delete(id);
  }

  reset(): void {
    this.store.clear();
  }
}

// ---------------------------------------------------------------------------
// TestRunStepRepo
// ---------------------------------------------------------------------------

export class TestRunStepRepo implements RunStepRepo {
  private readonly store = new Map<string, RunStep>();
  readonly scopedOrgId?: OrgId;

  constructor(orgId?: OrgId) {
    this.scopedOrgId = orgId;
  }

  async create(input: {
    orgId: OrgId;
    runId: RunId;
    stepNumber: number;
    type: RunStepType;
    attempt?: number;
    toolName?: string;
    input?: Record<string, unknown>;
  }): Promise<RunStep> {
    const ts = now();
    const id = randomUUID();
    const step: RunStep = {
      id,
      orgId: input.orgId,
      runId: input.runId,
      stepNumber: input.stepNumber,
      type: input.type,
      status: "pending",
      attempt: input.attempt ?? 1,
      toolName: input.toolName ?? null,
      input: input.input ?? null,
      output: null,
      error: null,
      tokenUsage: null,
      providerMetadata: null,
      latencyMs: null,
      startedAt: null,
      completedAt: null,
      createdAt: ts,
    };
    this.store.set(id, step);
    return step;
  }

  async getById(id: string, orgId: OrgId): Promise<RunStep | null> {
    const step = this.store.get(id);
    if (!step || step.orgId !== orgId) return null;
    return step;
  }

  async listForRun(runId: RunId): Promise<RunStep[]> {
    return [...this.store.values()]
      .filter((s) => s.runId === runId)
      .sort((a, b) => a.stepNumber - b.stepNumber);
  }

  async updateStatus(
    id: string,
    orgId: OrgId,
    status: RunStepStatus,
    extras?: {
      output?: Record<string, unknown>;
      error?: Record<string, unknown>;
      tokenUsage?: { inputTokens: number; outputTokens: number; totalTokens: number };
      providerMetadata?: Record<string, unknown>;
      latencyMs?: number;
      startedAt?: ISODateString;
      completedAt?: ISODateString;
    },
  ): Promise<RunStep | null> {
    const existing = this.store.get(id);
    if (!existing || existing.orgId !== orgId) return null;
    const updated: RunStep = {
      ...existing,
      status,
      ...(extras?.output !== undefined ? { output: extras.output } : {}),
      ...(extras?.error !== undefined ? { error: extras.error } : {}),
      ...(extras?.tokenUsage !== undefined ? { tokenUsage: extras.tokenUsage } : {}),
      ...(extras?.providerMetadata !== undefined ? { providerMetadata: extras.providerMetadata } : {}),
      ...(extras?.latencyMs !== undefined ? { latencyMs: extras.latencyMs } : {}),
      ...(extras?.startedAt !== undefined ? { startedAt: extras.startedAt } : {}),
      ...(extras?.completedAt !== undefined ? { completedAt: extras.completedAt } : {}),
    };
    this.store.set(id, updated);
    return updated;
  }

  async getNextStepNumber(runId: RunId): Promise<number> {
    let max = 0;
    for (const s of this.store.values()) {
      if (s.runId === runId && s.stepNumber > max) max = s.stepNumber;
    }
    return max + 1;
  }

  reset(): void {
    this.store.clear();
  }
}

// ---------------------------------------------------------------------------
// TestConnectorRepo (global catalog, not org-scoped)
// ---------------------------------------------------------------------------

export class TestConnectorRepo implements ConnectorRepo {
  private readonly store = new Map<string, Connector>();

  async create(input: {
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
  }): Promise<Connector> {
    const ts = now();
    const connector: Connector = {
      id: toConnectorId(randomUUID()),
      slug: input.slug,
      name: input.name,
      description: input.description ?? "",
      category: input.category,
      trustTier: input.trustTier as Connector["trustTier"],
      authMode: input.authMode as Connector["authMode"],
      status: (input.status ?? "active") as Connector["status"],
      tools: input.tools as Connector["tools"],
      scopes: input.scopes as Connector["scopes"],
      metadata: input.metadata ?? {},
      createdAt: ts,
      updatedAt: ts,
    };
    this.store.set(connector.id, connector);
    return connector;
  }

  async getById(id: ConnectorId): Promise<Connector | null> {
    return this.store.get(id) ?? null;
  }

  async getBySlug(slug: string): Promise<Connector | null> {
    for (const c of this.store.values()) {
      if (c.slug === slug) return c;
    }
    return null;
  }

  async listAll(filters?: { category?: string; trustTier?: string; status?: string }): Promise<Connector[]> {
    let results = [...this.store.values()];
    if (filters?.category) results = results.filter((c) => c.category === filters.category);
    if (filters?.trustTier) results = results.filter((c) => c.trustTier === filters.trustTier);
    if (filters?.status) results = results.filter((c) => c.status === filters.status);
    return results;
  }

  reset(): void {
    this.store.clear();
  }
}

// ---------------------------------------------------------------------------
// TestConnectorInstallRepo (org-scoped)
// ---------------------------------------------------------------------------

export class TestConnectorInstallRepo implements ConnectorInstallRepo {
  private readonly store = new Map<string, ConnectorInstall>();

  async create(input: CreateConnectorInstallInput): Promise<ConnectorInstall> {
    const ts = now();
    const install: ConnectorInstall = {
      id: toConnectorInstallId(randomUUID()),
      orgId: input.orgId,
      connectorId: input.connectorId,
      connectorSlug: input.connectorSlug,
      enabled: true,
      config: input.config ?? {},
      grantedScopes: input.grantedScopes ?? [],
      installedBy: input.installedBy,
      updatedBy: null,
      createdAt: ts,
      updatedAt: ts,
    };
    this.store.set(install.id, install);
    return install;
  }

  async getById(id: ConnectorInstallId, orgId: OrgId): Promise<ConnectorInstall | null> {
    const install = this.store.get(id);
    if (!install || install.orgId !== orgId) return null;
    return install;
  }

  async getByConnectorId(connectorId: ConnectorId, orgId: OrgId): Promise<ConnectorInstall | null> {
    for (const i of this.store.values()) {
      if (i.connectorId === connectorId && i.orgId === orgId) return i;
    }
    return null;
  }

  async listForOrg(orgId: OrgId, filters?: { enabled?: boolean }): Promise<ConnectorInstall[]> {
    let results = [...this.store.values()].filter((i) => i.orgId === orgId);
    if (filters?.enabled !== undefined) results = results.filter((i) => i.enabled === filters.enabled);
    return results;
  }

  async update(
    id: ConnectorInstallId,
    orgId: OrgId,
    input: { enabled?: boolean; config?: Record<string, unknown>; grantedScopes?: readonly string[]; updatedBy: UserId },
  ): Promise<ConnectorInstall | null> {
    const existing = this.store.get(id);
    if (!existing || existing.orgId !== orgId) return null;
    const updated: ConnectorInstall = {
      ...existing,
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.config !== undefined ? { config: input.config } : {}),
      ...(input.grantedScopes !== undefined ? { grantedScopes: input.grantedScopes } : {}),
      updatedBy: input.updatedBy,
      updatedAt: now(),
    };
    this.store.set(id, updated);
    return updated;
  }

  async delete(id: ConnectorInstallId, orgId: OrgId): Promise<boolean> {
    const existing = this.store.get(id);
    if (!existing || existing.orgId !== orgId) return false;
    return this.store.delete(id);
  }

  reset(): void {
    this.store.clear();
  }
}

// ---------------------------------------------------------------------------
// TestConnectorCredentialRepo
// ---------------------------------------------------------------------------

export class TestConnectorCredentialRepo implements ConnectorCredentialRepo {
  private readonly store = new Map<string, { id: string; orgId: OrgId; connectorInstallId: ConnectorInstallId; credentialType: string; encryptedData: string; expiresAt: string | null }>();

  async upsert(input: {
    orgId: OrgId;
    connectorInstallId: ConnectorInstallId;
    credentialType: string;
    encryptedData: string;
    expiresAt?: string;
  }): Promise<{ id: string }> {
    // Check for existing credential for this install
    for (const [key, c] of this.store.entries()) {
      if (c.connectorInstallId === input.connectorInstallId && c.orgId === input.orgId) {
        const updated = {
          ...c,
          credentialType: input.credentialType,
          encryptedData: input.encryptedData,
          expiresAt: input.expiresAt ?? null,
        };
        this.store.set(key, updated);
        return { id: c.id };
      }
    }
    const id = randomUUID();
    this.store.set(id, {
      id,
      orgId: input.orgId,
      connectorInstallId: input.connectorInstallId,
      credentialType: input.credentialType,
      encryptedData: input.encryptedData,
      expiresAt: input.expiresAt ?? null,
    });
    return { id };
  }

  async getByInstallId(
    connectorInstallId: ConnectorInstallId,
    orgId: OrgId,
  ): Promise<{ id: string; credentialType: string; encryptedData: string; expiresAt: string | null } | null> {
    for (const c of this.store.values()) {
      if (c.connectorInstallId === connectorInstallId && c.orgId === orgId) {
        return { id: c.id, credentialType: c.credentialType, encryptedData: c.encryptedData, expiresAt: c.expiresAt };
      }
    }
    return null;
  }

  async deleteByInstallId(connectorInstallId: ConnectorInstallId, orgId: OrgId): Promise<boolean> {
    for (const [key, c] of this.store.entries()) {
      if (c.connectorInstallId === connectorInstallId && c.orgId === orgId) {
        this.store.delete(key);
        return true;
      }
    }
    return false;
  }

  reset(): void {
    this.store.clear();
  }
}

// ---------------------------------------------------------------------------
// TestSkillRepo (global catalog, not org-scoped)
// ---------------------------------------------------------------------------

export class TestSkillRepo implements SkillRepo {
  private readonly store = new Map<string, Skill>();

  async create(input: {
    slug: string;
    name: string;
    description?: string;
    trustTier: string;
    connectorSlugs: readonly string[];
    metadata?: Record<string, unknown>;
  }): Promise<Skill> {
    const ts = now();
    const skill: Skill = {
      id: toSkillId(randomUUID()),
      slug: input.slug,
      name: input.name,
      description: input.description ?? "",
      trustTier: input.trustTier as Skill["trustTier"],
      connectorSlugs: input.connectorSlugs,
      metadata: input.metadata ?? {},
      createdAt: ts,
      updatedAt: ts,
    };
    this.store.set(skill.id, skill);
    return skill;
  }

  async getById(id: SkillId): Promise<Skill | null> {
    return this.store.get(id) ?? null;
  }

  async getBySlug(slug: string): Promise<Skill | null> {
    for (const s of this.store.values()) {
      if (s.slug === slug) return s;
    }
    return null;
  }

  async listAll(filters?: { trustTier?: string }): Promise<Skill[]> {
    let results = [...this.store.values()];
    if (filters?.trustTier) results = results.filter((s) => s.trustTier === filters.trustTier);
    return results;
  }

  reset(): void {
    this.store.clear();
  }
}

// ---------------------------------------------------------------------------
// TestSkillInstallRepo (org-scoped)
// ---------------------------------------------------------------------------

export class TestSkillInstallRepo implements SkillInstallRepo {
  private readonly store = new Map<string, SkillInstall>();

  async create(input: {
    orgId: OrgId;
    skillId: SkillId;
    skillSlug: string;
    installedBy: UserId;
  }): Promise<SkillInstall> {
    const ts = now();
    const install: SkillInstall = {
      id: toSkillInstallId(randomUUID()),
      orgId: input.orgId,
      skillId: input.skillId,
      skillSlug: input.skillSlug,
      enabled: true,
      installedBy: input.installedBy,
      createdAt: ts,
      updatedAt: ts,
    };
    this.store.set(install.id, install);
    return install;
  }

  async getBySkillId(skillId: SkillId, orgId: OrgId): Promise<SkillInstall | null> {
    for (const i of this.store.values()) {
      if (i.skillId === skillId && i.orgId === orgId) return i;
    }
    return null;
  }

  async listForOrg(orgId: OrgId, _filters?: { enabled?: boolean }): Promise<SkillInstall[]> {
    let results = [...this.store.values()].filter((i) => i.orgId === orgId);
    if (_filters?.enabled !== undefined) results = results.filter((i) => i.enabled === _filters.enabled);
    return results;
  }

  async delete(skillId: SkillId, orgId: OrgId): Promise<boolean> {
    for (const [key, i] of this.store.entries()) {
      if (i.skillId === skillId && i.orgId === orgId) {
        this.store.delete(key);
        return true;
      }
    }
    return false;
  }

  reset(): void {
    this.store.clear();
  }
}

// ---------------------------------------------------------------------------
// Factory & reset helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// TestBrowserSessionRepo
// ---------------------------------------------------------------------------

export class TestBrowserSessionRepo implements BrowserSessionRepo {
  private readonly store = new Map<string, BrowserSession>();

  async create(input: CreateBrowserSessionInput): Promise<BrowserSession> {
    const session: BrowserSession = {
      id: toBrowserSessionId(randomUUID()),
      orgId: input.orgId,
      runId: input.runId,
      agentId: input.agentId,
      status: "provisioning",
      browserType: input.browserType ?? "chromium",
      currentUrl: null,
      humanTakeover: false,
      takeoverBy: null,
      sessionRef: null,
      artifactKeys: [],
      metadata: {},
      createdBy: input.createdBy,
      startedAt: null,
      lastActivityAt: null,
      endedAt: null,
      createdAt: now(),
      updatedAt: now(),
    };
    this.store.set(session.id, session);
    return session;
  }

  async getById(id: BrowserSessionId, orgId: OrgId): Promise<BrowserSession | null> {
    const s = this.store.get(id);
    return s && s.orgId === orgId ? s : null;
  }

  async listForOrg(orgId: OrgId, filters?: { runId?: RunId; status?: BrowserSessionStatus }): Promise<BrowserSession[]> {
    return [...this.store.values()].filter((s) => {
      if (s.orgId !== orgId) return false;
      if (filters?.runId && s.runId !== filters.runId) return false;
      if (filters?.status && s.status !== filters.status) return false;
      return true;
    });
  }

  async listForRun(runId: RunId, orgId: OrgId): Promise<BrowserSession[]> {
    return [...this.store.values()].filter((s) => s.runId === runId && s.orgId === orgId);
  }

  async updateStatus(
    id: BrowserSessionId,
    orgId: OrgId,
    status: BrowserSessionStatus,
    extras?: {
      currentUrl?: string;
      humanTakeover?: boolean;
      takeoverBy?: UserId | null;
      sessionRef?: string;
      artifactKeys?: readonly string[];
      metadata?: Record<string, unknown>;
      startedAt?: ISODateString;
      lastActivityAt?: ISODateString;
      endedAt?: ISODateString;
    },
  ): Promise<BrowserSession | null> {
    const existing = this.store.get(id);
    if (!existing || existing.orgId !== orgId) return null;
    const updated: BrowserSession = {
      ...existing,
      status,
      currentUrl: extras?.currentUrl ?? existing.currentUrl,
      humanTakeover: extras?.humanTakeover ?? existing.humanTakeover,
      takeoverBy: extras?.takeoverBy !== undefined ? extras.takeoverBy : existing.takeoverBy,
      sessionRef: extras?.sessionRef ?? existing.sessionRef,
      artifactKeys: extras?.artifactKeys ?? existing.artifactKeys,
      metadata: extras?.metadata ?? existing.metadata,
      startedAt: extras?.startedAt ?? existing.startedAt,
      lastActivityAt: extras?.lastActivityAt ?? existing.lastActivityAt,
      endedAt: extras?.endedAt ?? existing.endedAt,
      updatedAt: now(),
    };
    this.store.set(id, updated);
    return updated;
  }

  async delete(id: BrowserSessionId, orgId: OrgId): Promise<boolean> {
    const existing = this.store.get(id);
    if (!existing || existing.orgId !== orgId) return false;
    return this.store.delete(id);
  }

  reset(): void {
    this.store.clear();
  }
}

// ---------------------------------------------------------------------------
// TestMemoryRepo
// ---------------------------------------------------------------------------

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export class TestMemoryRepo implements MemoryRepo {
  private readonly store = new Map<string, Memory>();

  async create(input: CreateMemoryInput): Promise<Memory> {
    const memory: Memory = {
      id: toMemoryId(randomUUID()),
      orgId: input.orgId,
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      kind: input.kind,
      status: "active",
      title: input.title,
      summary: input.summary ?? "",
      content: input.content,
      contentHash: hashContent(input.content),
      metadata: input.metadata ?? {},
      sourceRunId: input.sourceRunId ?? null,
      sourceAgentId: input.sourceAgentId ?? null,
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
      expiresAt: input.expiresAt ? toISODateString(input.expiresAt) : null,
      redactedAt: null,
      lastAccessedAt: null,
      createdAt: now(),
      updatedAt: now(),
    };
    this.store.set(memory.id, memory);
    return memory;
  }

  async getById(id: MemoryId, orgId: OrgId): Promise<Memory | null> {
    const m = this.store.get(id);
    return m && m.orgId === orgId ? m : null;
  }

  async listForOrg(orgId: OrgId, filters?: { scopeType?: MemoryScopeType; scopeId?: string; kind?: MemoryKind; status?: MemoryStatus }): Promise<Memory[]> {
    return [...this.store.values()].filter((m) => {
      if (m.orgId !== orgId) return false;
      if (filters?.scopeType && m.scopeType !== filters.scopeType) return false;
      if (filters?.scopeId && m.scopeId !== filters.scopeId) return false;
      if (filters?.kind && m.kind !== filters.kind) return false;
      if (filters?.status && m.status !== filters.status) return false;
      return true;
    });
  }

  async search(orgId: OrgId, query: string, filters?: { scopeType?: MemoryScopeType; scopeId?: string; kind?: MemoryKind; maxResults?: number }): Promise<Memory[]> {
    const q = query.toLowerCase();
    const results = [...this.store.values()].filter((m) => {
      if (m.orgId !== orgId) return false;
      if (m.status !== "active") return false;
      if (filters?.scopeType && m.scopeType !== filters.scopeType) return false;
      if (filters?.scopeId && m.scopeId !== filters.scopeId) return false;
      if (filters?.kind && m.kind !== filters.kind) return false;
      if (q && !m.title.toLowerCase().includes(q) && !m.summary.toLowerCase().includes(q) && !m.content.toLowerCase().includes(q)) return false;
      return true;
    });
    return results.slice(0, filters?.maxResults ?? 50);
  }

  async update(id: MemoryId, orgId: OrgId, input: UpdateMemoryInput): Promise<Memory | null> {
    const existing = this.store.get(id);
    if (!existing || existing.orgId !== orgId) return null;
    const updated: Memory = {
      ...existing,
      title: input.title ?? existing.title,
      summary: input.summary ?? existing.summary,
      content: input.content ?? existing.content,
      contentHash: input.content ? hashContent(input.content) : existing.contentHash,
      metadata: input.metadata ?? existing.metadata,
      updatedBy: input.updatedBy,
      updatedAt: now(),
    };
    this.store.set(id, updated);
    return updated;
  }

  async updateStatus(id: MemoryId, orgId: OrgId, status: MemoryStatus, extras?: { redactedAt?: ISODateString; expiresAt?: ISODateString; content?: string; contentHash?: string }): Promise<Memory | null> {
    const existing = this.store.get(id);
    if (!existing || existing.orgId !== orgId) return null;
    const updated: Memory = {
      ...existing,
      status,
      redactedAt: extras?.redactedAt ?? existing.redactedAt,
      expiresAt: extras?.expiresAt ?? existing.expiresAt,
      content: extras?.content ?? existing.content,
      contentHash: extras?.contentHash ?? existing.contentHash,
      updatedAt: now(),
    };
    this.store.set(id, updated);
    return updated;
  }

  async getByContentHash(orgId: OrgId, contentHash: string): Promise<Memory | null> {
    return [...this.store.values()].find((m) => m.orgId === orgId && m.contentHash === contentHash && m.status === "active") ?? null;
  }

  async delete(id: MemoryId, orgId: OrgId): Promise<boolean> {
    const existing = this.store.get(id);
    if (!existing || existing.orgId !== orgId) return false;
    return this.store.delete(id);
  }

  reset(): void { this.store.clear(); }
}

// ---------------------------------------------------------------------------
// TestMemoryLinkRepo
// ---------------------------------------------------------------------------

export class TestMemoryLinkRepo implements MemoryLinkRepo {
  private readonly store = new Map<string, MemoryLink>();

  async create(input: CreateMemoryLinkInput): Promise<MemoryLink> {
    const link: MemoryLink = {
      id: toMemoryLinkId(randomUUID()),
      orgId: input.orgId,
      memoryId: input.memoryId,
      linkedEntityType: input.linkedEntityType,
      linkedEntityId: input.linkedEntityId,
      linkType: input.linkType,
      metadata: input.metadata ?? {},
      createdAt: now(),
    };
    this.store.set(link.id, link);
    return link;
  }

  async listForMemory(memoryId: MemoryId, orgId: OrgId): Promise<MemoryLink[]> {
    return [...this.store.values()].filter((l) => l.memoryId === memoryId && l.orgId === orgId);
  }

  async listForEntity(entityType: string, entityId: string, orgId: OrgId): Promise<MemoryLink[]> {
    return [...this.store.values()].filter((l) => l.linkedEntityType === entityType && l.linkedEntityId === entityId && l.orgId === orgId);
  }

  async delete(id: MemoryLinkId, orgId: OrgId): Promise<boolean> {
    const existing = this.store.get(id);
    if (!existing || existing.orgId !== orgId) return false;
    return this.store.delete(id);
  }

  reset(): void { this.store.clear(); }
}

// ---------------------------------------------------------------------------
// TestAlertRuleRepo
// ---------------------------------------------------------------------------

export class TestAlertRuleRepo implements AlertRuleRepo {
  private readonly store = new Map<string, AlertRule>();

  async create(input: {
    orgId: OrgId;
    name: string;
    description?: string;
    conditionType: string;
    thresholdMinutes?: number;
    enabled?: boolean;
    createdBy: UserId;
  }): Promise<AlertRule> {
    const ts = now();
    const rule: AlertRule = {
      id: toAlertRuleId(randomUUID()),
      orgId: input.orgId,
      name: input.name,
      description: input.description ?? "",
      conditionType: input.conditionType as AlertConditionType,
      thresholdMinutes: input.thresholdMinutes ?? null,
      enabled: input.enabled ?? true,
      createdBy: input.createdBy,
      createdAt: ts,
      updatedAt: ts,
    };
    this.store.set(rule.id, rule);
    return rule;
  }

  async getById(id: AlertRuleId, orgId: OrgId): Promise<AlertRule | null> {
    const r = this.store.get(id);
    return r && r.orgId === orgId ? r : null;
  }

  async listForOrg(orgId: OrgId, filters?: { conditionType?: string; enabled?: boolean }): Promise<AlertRule[]> {
    return [...this.store.values()].filter((r) => {
      if (r.orgId !== orgId) return false;
      if (filters?.conditionType !== undefined && r.conditionType !== filters.conditionType) return false;
      if (filters?.enabled !== undefined && r.enabled !== filters.enabled) return false;
      return true;
    });
  }

  async update(id: AlertRuleId, orgId: OrgId, input: { name?: string; description?: string; thresholdMinutes?: number; enabled?: boolean }): Promise<AlertRule | null> {
    const existing = this.store.get(id);
    if (!existing || existing.orgId !== orgId) return null;
    const updated: AlertRule = {
      ...existing,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.thresholdMinutes !== undefined ? { thresholdMinutes: input.thresholdMinutes } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      updatedAt: now(),
    };
    this.store.set(id, updated);
    return updated;
  }

  async delete(id: AlertRuleId, orgId: OrgId): Promise<boolean> {
    const existing = this.store.get(id);
    if (!existing || existing.orgId !== orgId) return false;
    return this.store.delete(id);
  }

  reset(): void { this.store.clear(); }
}

// ---------------------------------------------------------------------------
// TestAlertEventRepo
// ---------------------------------------------------------------------------

export class TestAlertEventRepo implements AlertEventRepo {
  private readonly store = new Map<string, AlertEvent>();

  async create(input: {
    orgId: OrgId;
    alertRuleId?: string;
    severity: string;
    title: string;
    message?: string;
    conditionType: string;
    resourceType: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<AlertEvent> {
    const ts = now();
    const event: AlertEvent = {
      id: toAlertEventId(randomUUID()),
      orgId: input.orgId,
      alertRuleId: input.alertRuleId ? toAlertRuleId(input.alertRuleId) : null,
      severity: input.severity as AlertSeverity,
      title: input.title,
      message: input.message ?? "",
      conditionType: input.conditionType as AlertConditionType,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      status: "open" as AlertStatus,
      acknowledgedBy: null,
      acknowledgedAt: null,
      resolvedAt: null,
      metadata: input.metadata ?? {},
      createdAt: ts,
      updatedAt: ts,
    };
    this.store.set(event.id, event);
    return event;
  }

  async getById(id: AlertEventId, orgId: OrgId): Promise<AlertEvent | null> {
    const e = this.store.get(id);
    return e && e.orgId === orgId ? e : null;
  }

  async listForOrg(orgId: OrgId, filters?: { status?: string; severity?: string; conditionType?: string; limit?: number }): Promise<AlertEvent[]> {
    const results = [...this.store.values()].filter((e) => {
      if (e.orgId !== orgId) return false;
      if (filters?.status !== undefined && e.status !== filters.status) return false;
      if (filters?.severity !== undefined && e.severity !== filters.severity) return false;
      if (filters?.conditionType !== undefined && e.conditionType !== filters.conditionType) return false;
      return true;
    });
    if (filters?.limit !== undefined) return results.slice(0, filters.limit);
    return results;
  }

  async acknowledge(id: AlertEventId, orgId: OrgId, userId: UserId): Promise<AlertEvent | null> {
    const existing = this.store.get(id);
    if (!existing || existing.orgId !== orgId) return null;
    const updated: AlertEvent = {
      ...existing,
      status: "acknowledged" as AlertStatus,
      acknowledgedBy: userId,
      acknowledgedAt: now(),
      updatedAt: now(),
    };
    this.store.set(id, updated);
    return updated;
  }

  async resolve(id: AlertEventId, orgId: OrgId): Promise<AlertEvent | null> {
    const existing = this.store.get(id);
    if (!existing || existing.orgId !== orgId) return null;
    const updated: AlertEvent = {
      ...existing,
      status: "resolved" as AlertStatus,
      resolvedAt: now(),
      updatedAt: now(),
    };
    this.store.set(id, updated);
    return updated;
  }

  async countByStatus(orgId: OrgId): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const e of this.store.values()) {
      if (e.orgId !== orgId) continue;
      counts[e.status] = (counts[e.status] ?? 0) + 1;
    }
    return counts;
  }

  reset(): void { this.store.clear(); }
}

// ---------------------------------------------------------------------------
// TestPolicyRepo
// ---------------------------------------------------------------------------

export class TestPolicyRepo implements PolicyRepo {
  private readonly store = new Map<string, Policy>();

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
    const ts = now();
    const policy: Policy = {
      id: toPolicyId(randomUUID()),
      orgId: input.orgId,
      name: input.name,
      description: input.description ?? "",
      policyType: input.policyType as Policy["policyType"],
      status: "active" as Policy["status"],
      enforcementMode: input.enforcementMode as Policy["enforcementMode"],
      scopeType: input.scopeType as Policy["scopeType"],
      scopeId: input.scopeId ?? null,
      rules: (input.rules ?? []) as Policy["rules"],
      priority: input.priority ?? 0,
      createdBy: input.createdBy,
      updatedBy: null,
      createdAt: ts,
      updatedAt: ts,
    };
    this.store.set(policy.id, policy);
    return policy;
  }

  async getById(id: PolicyId, orgId: OrgId): Promise<Policy | null> {
    const p = this.store.get(id);
    return p && p.orgId === orgId ? p : null;
  }

  async listForOrg(
    orgId: OrgId,
    filters?: { status?: string; scopeType?: string; policyType?: string },
  ): Promise<Policy[]> {
    return [...this.store.values()].filter((p) => {
      if (p.orgId !== orgId) return false;
      if (filters?.status !== undefined && p.status !== filters.status) return false;
      if (filters?.scopeType !== undefined && p.scopeType !== filters.scopeType) return false;
      if (filters?.policyType !== undefined && p.policyType !== filters.policyType) return false;
      return true;
    }).sort((a, b) => b.priority - a.priority);
  }

  async update(
    id: PolicyId,
    orgId: OrgId,
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
    const existing = this.store.get(id);
    if (!existing || existing.orgId !== orgId) return null;
    const updated: Policy = {
      ...existing,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.rules !== undefined ? { rules: input.rules as Policy["rules"] } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.status !== undefined ? { status: input.status as Policy["status"] } : {}),
      ...(input.enforcementMode !== undefined ? { enforcementMode: input.enforcementMode as Policy["enforcementMode"] } : {}),
      updatedBy: input.updatedBy,
      updatedAt: now(),
    };
    this.store.set(id, updated);
    return updated;
  }

  async delete(id: PolicyId, orgId: OrgId): Promise<boolean> {
    const existing = this.store.get(id);
    if (!existing || existing.orgId !== orgId) return false;
    return this.store.delete(id);
  }

  reset(): void { this.store.clear(); }
}

// ---------------------------------------------------------------------------
// TestPolicyDecisionRepo
// ---------------------------------------------------------------------------

export class TestPolicyDecisionRepo implements PolicyDecisionRepo {
  private readonly store = new Map<string, PolicyDecision>();

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
    const decision: PolicyDecision = {
      id: toPolicyDecisionId(randomUUID()),
      orgId: input.orgId,
      policyId: input.policyId ? toPolicyId(input.policyId) : null,
      subjectType: input.subjectType,
      subjectId: input.subjectId ?? null,
      actionType: input.actionType,
      result: input.result as PolicyDecision["result"],
      reason: input.reason ?? "",
      metadata: input.metadata ?? {},
      requestedBy: input.requestedBy ? toUserId(input.requestedBy) : null,
      approvalId: input.approvalId ? toApprovalId(input.approvalId) : null,
      evaluatedAt: now(),
    };
    this.store.set(decision.id, decision);
    return decision;
  }

  async getById(id: PolicyDecisionId, orgId: OrgId): Promise<PolicyDecision | null> {
    const d = this.store.get(id);
    return d && d.orgId === orgId ? d : null;
  }

  async listForOrg(
    orgId: OrgId,
    filters?: { result?: string; subjectType?: string; actionType?: string; limit?: number },
  ): Promise<PolicyDecision[]> {
    let results = [...this.store.values()].filter((d) => {
      if (d.orgId !== orgId) return false;
      if (filters?.result !== undefined && d.result !== filters.result) return false;
      if (filters?.subjectType !== undefined && d.subjectType !== filters.subjectType) return false;
      if (filters?.actionType !== undefined && d.actionType !== filters.actionType) return false;
      return true;
    });
    if (filters?.limit !== undefined) results = results.slice(0, filters.limit);
    return results;
  }

  reset(): void { this.store.clear(); }
}

// ---------------------------------------------------------------------------
// TestApprovalRepo
// ---------------------------------------------------------------------------

export class TestApprovalRepo implements ApprovalRepo {
  private readonly store = new Map<string, Approval>();

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
    const ts = now();
    const approval: Approval = {
      id: toApprovalId(randomUUID()),
      orgId: input.orgId,
      subjectType: input.subjectType,
      subjectId: input.subjectId ?? null,
      actionType: input.actionType,
      status: "pending" as Approval["status"],
      requestNote: input.requestNote ?? "",
      decisionNote: "",
      requestedBy: input.requestedBy,
      decidedBy: null,
      policyDecisionId: input.policyDecisionId ? toPolicyDecisionId(input.policyDecisionId) : null,
      expiresAt: input.expiresAt ? toISODateString(input.expiresAt) : null,
      decidedAt: null,
      createdAt: ts,
      updatedAt: ts,
    };
    this.store.set(approval.id, approval);
    return approval;
  }

  async getById(id: ApprovalId, orgId: OrgId): Promise<Approval | null> {
    const a = this.store.get(id);
    return a && a.orgId === orgId ? a : null;
  }

  async listForOrg(
    orgId: OrgId,
    filters?: { status?: string; subjectType?: string; limit?: number },
  ): Promise<Approval[]> {
    let results = [...this.store.values()].filter((a) => {
      if (a.orgId !== orgId) return false;
      if (filters?.status !== undefined && a.status !== filters.status) return false;
      if (filters?.subjectType !== undefined && a.subjectType !== filters.subjectType) return false;
      return true;
    });
    if (filters?.limit !== undefined) results = results.slice(0, filters.limit);
    return results;
  }

  async decide(
    id: ApprovalId,
    orgId: OrgId,
    input: { status: "approved" | "denied"; decidedBy: UserId; decisionNote?: string },
  ): Promise<Approval | null> {
    const existing = this.store.get(id);
    if (!existing || existing.orgId !== orgId || existing.status !== "pending") return null;
    const updated: Approval = {
      ...existing,
      status: input.status,
      decidedBy: input.decidedBy,
      decisionNote: input.decisionNote ?? "",
      decidedAt: now(),
      updatedAt: now(),
    };
    this.store.set(id, updated);
    return updated;
  }

  async cancel(id: ApprovalId, orgId: OrgId): Promise<Approval | null> {
    const existing = this.store.get(id);
    if (!existing || existing.orgId !== orgId || existing.status !== "pending") return null;
    const updated: Approval = {
      ...existing,
      status: "cancelled" as Approval["status"],
      updatedAt: now(),
    };
    this.store.set(id, updated);
    return updated;
  }

  async expirePending(orgId: OrgId): Promise<number> {
    const nowMs = Date.now();
    let count = 0;
    for (const [key, a] of this.store.entries()) {
      if (a.orgId === orgId && a.status === "pending" && a.expiresAt && new Date(a.expiresAt).getTime() < nowMs) {
        this.store.set(key, { ...a, status: "expired" as Approval["status"], updatedAt: now() });
        count++;
      }
    }
    return count;
  }

  reset(): void { this.store.clear(); }
}

// ---------------------------------------------------------------------------
// TestQuarantineRecordRepo
// ---------------------------------------------------------------------------

export class TestQuarantineRecordRepo implements QuarantineRecordRepo {
  private readonly store = new Map<string, QuarantineRecord>();

  async create(input: {
    orgId: OrgId;
    subjectType: string;
    subjectId: string;
    reason: string;
    quarantinedBy: UserId;
    policyDecisionId?: string;
  }): Promise<QuarantineRecord> {
    const ts = now();
    const record: QuarantineRecord = {
      id: toQuarantineRecordId(randomUUID()),
      orgId: input.orgId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      reason: input.reason,
      status: "active" as QuarantineRecord["status"],
      policyDecisionId: input.policyDecisionId ? toPolicyDecisionId(input.policyDecisionId) : null,
      quarantinedBy: input.quarantinedBy,
      releasedBy: null,
      releasedAt: null,
      releaseNote: "",
      createdAt: ts,
      updatedAt: ts,
    };
    this.store.set(record.id, record);
    return record;
  }

  async getById(id: QuarantineRecordId, orgId: OrgId): Promise<QuarantineRecord | null> {
    const r = this.store.get(id);
    return r && r.orgId === orgId ? r : null;
  }

  async listForOrg(
    orgId: OrgId,
    filters?: { status?: string; subjectType?: string },
  ): Promise<QuarantineRecord[]> {
    return [...this.store.values()].filter((r) => {
      if (r.orgId !== orgId) return false;
      if (filters?.status !== undefined && r.status !== filters.status) return false;
      if (filters?.subjectType !== undefined && r.subjectType !== filters.subjectType) return false;
      return true;
    });
  }

  async getActiveForSubject(
    orgId: OrgId,
    subjectType: string,
    subjectId: string,
  ): Promise<QuarantineRecord | null> {
    for (const r of this.store.values()) {
      if (r.orgId === orgId && r.subjectType === subjectType && r.subjectId === subjectId && r.status === "active") {
        return r;
      }
    }
    return null;
  }

  async release(
    id: QuarantineRecordId,
    orgId: OrgId,
    input: { releasedBy: UserId; releaseNote?: string },
  ): Promise<QuarantineRecord | null> {
    const existing = this.store.get(id);
    if (!existing || existing.orgId !== orgId || existing.status !== "active") return null;
    const updated: QuarantineRecord = {
      ...existing,
      status: "released" as QuarantineRecord["status"],
      releasedBy: input.releasedBy,
      releasedAt: now(),
      releaseNote: input.releaseNote ?? "",
      updatedAt: now(),
    };
    this.store.set(id, updated);
    return updated;
  }

  reset(): void { this.store.clear(); }
}

export interface TestRepos {
  users: TestUserRepo;
  orgs: TestOrgRepo;
  memberships: TestMembershipRepo;
  invitations: TestInvitationRepo;
  sessions: TestSessionRepo;
  projects: TestProjectRepo;
  agents: TestAgentRepo;
  agentVersions: TestAgentVersionRepo;
  runs: TestRunRepo;
  runSteps: TestRunStepRepo;
  audit: TestAuditRepo;
  connectors: TestConnectorRepo;
  connectorInstalls: TestConnectorInstallRepo;
  connectorCredentials: TestConnectorCredentialRepo;
  skills: TestSkillRepo;
  skillInstalls: TestSkillInstallRepo;
  browserSessions: TestBrowserSessionRepo;
  memories: TestMemoryRepo;
  memoryLinks: TestMemoryLinkRepo;
  alertRules: TestAlertRuleRepo;
  alertEvents: TestAlertEventRepo;
  policyRepo: TestPolicyRepo;
  policyDecisions: TestPolicyDecisionRepo;
  approvals: TestApprovalRepo;
  quarantine: TestQuarantineRecordRepo;
}

/**
 * Create a complete set of wired-up in-memory repos for unit tests.
 */
export function createTestRepos(): TestRepos {
  const users = new TestUserRepo();
  const orgs = new TestOrgRepo();
  const memberships = new TestMembershipRepo();
  const invitations = new TestInvitationRepo();
  const sessions = new TestSessionRepo();
  const projects = new TestProjectRepo();
  const agents = new TestAgentRepo();
  const agentVersions = new TestAgentVersionRepo();
  const runs = new TestRunRepo();
  const runSteps = new TestRunStepRepo();
  const audit = new TestAuditRepo();
  const connectors = new TestConnectorRepo();
  const connectorInstalls = new TestConnectorInstallRepo();
  const connectorCredentials = new TestConnectorCredentialRepo();
  const skills = new TestSkillRepo();
  const skillInstalls = new TestSkillInstallRepo();
  const browserSessions = new TestBrowserSessionRepo();
  const memories = new TestMemoryRepo();
  const memoryLinks = new TestMemoryLinkRepo();
  const alertRules = new TestAlertRuleRepo();
  const alertEvents = new TestAlertEventRepo();
  const policyRepo = new TestPolicyRepo();
  const policyDecisions = new TestPolicyDecisionRepo();
  const approvals = new TestApprovalRepo();
  const quarantine = new TestQuarantineRecordRepo();

  // Wire cross-repo references
  memberships._setUserRepo(users);
  orgs._setMembershipRepo(memberships);

  return {
    users,
    orgs,
    memberships,
    invitations,
    sessions,
    projects,
    agents,
    agentVersions,
    runs,
    runSteps,
    audit,
    connectors,
    connectorInstalls,
    connectorCredentials,
    skills,
    skillInstalls,
    browserSessions,
    memories,
    memoryLinks,
    alertRules,
    alertEvents,
    policyRepo,
    policyDecisions,
    approvals,
    quarantine,
  };
}

/**
 * Reset all repos in a TestRepos set. Call in `beforeEach` or `afterEach`.
 */
export function resetAllRepos(repos: TestRepos): void {
  repos.users.reset();
  repos.orgs.reset();
  repos.memberships.reset();
  repos.invitations.reset();
  repos.sessions.reset();
  repos.projects.reset();
  repos.agents.reset();
  repos.agentVersions.reset();
  repos.runs.reset();
  repos.runSteps.reset();
  repos.audit.reset();
  repos.connectors.reset();
  repos.connectorInstalls.reset();
  repos.connectorCredentials.reset();
  repos.skills.reset();
  repos.skillInstalls.reset();
  repos.browserSessions.reset();
  repos.memories.reset();
  repos.memoryLinks.reset();
  repos.alertRules.reset();
  repos.alertEvents.reset();
  repos.policyRepo.reset();
  repos.policyDecisions.reset();
  repos.approvals.reset();
  repos.quarantine.reset();
}
