// ---------------------------------------------------------------------------
// In-memory repository implementations for unit tests
// ---------------------------------------------------------------------------

import { randomUUID } from "node:crypto";

import type {
  OrgId,
  UserId,
  ProjectId,
  SessionId,
  MembershipId,
  OrgRole,
  ISODateString,
  User,
  Organization,
  Membership,
  Invitation,
  Session,
  Project,
  AuditEvent,
  EmitAuditEventInput,
  AuditQueryParams,
} from "@sovereign/core";

import {
  toOrgId,
  toUserId,
  toProjectId,
  toSessionId,
  toMembershipId,
  toInvitationId,
  toISODateString,
  toAuditEventId,
} from "@sovereign/core";

import type {
  UserRepo,
  OrgRepo,
  MembershipRepo,
  InvitationRepo,
  SessionRepo,
  ProjectRepo,
  AuditRepo,
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
// Factory & reset helpers
// ---------------------------------------------------------------------------

export interface TestRepos {
  users: TestUserRepo;
  orgs: TestOrgRepo;
  memberships: TestMembershipRepo;
  invitations: TestInvitationRepo;
  sessions: TestSessionRepo;
  projects: TestProjectRepo;
  audit: TestAuditRepo;
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
  const audit = new TestAuditRepo();

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
    audit,
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
  repos.audit.reset();
}
