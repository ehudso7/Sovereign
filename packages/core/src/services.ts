// ---------------------------------------------------------------------------
// Service interfaces for Phase 2 — Identity, Orgs, Tenancy
// ---------------------------------------------------------------------------

import type { OrgId, UserId, ProjectId, AgentId, AgentVersionId, RunId, Result, PaginatedResult, PaginationParams } from "./types.js";
import type { SessionId, OrgRole, Session, AuthConfig, AuthResult } from "./auth.js";
import type {
  User,
  CreateUserInput,
  Organization,
  CreateOrgInput,
  UpdateOrgInput,
  Membership,
  CreateMembershipInput,
  Invitation,
  CreateInvitationInput,
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  Agent,
  AgentStatus,
  AgentVersion,
  CreateAgentInput,
  UpdateAgentInput,
  CreateAgentVersionInput,
  UpdateAgentVersionInput,
  Run,
  RunStatus,
  RunStep,
  TriggerType,
} from "./entities.js";
// ---------------------------------------------------------------------------
// Auth service
// ---------------------------------------------------------------------------

export interface AuthService {
  /** Authenticate a user and create a session. */
  signIn(email: string, password?: string): Promise<Result<AuthResult>>;

  /** End a session. */
  signOut(sessionId: SessionId): Promise<Result<void>>;

  /** Validate a session token, returning the session if valid. */
  validateSession(token: string): Promise<Result<Session>>;

  /** Get all active sessions for a user in an org. */
  listSessions(orgId: OrgId, userId: UserId): Promise<Result<readonly Session[]>>;

  /** Revoke a specific session. */
  revokeSession(sessionId: SessionId, actorId: UserId): Promise<Result<void>>;

  /** Get current auth configuration mode. */
  getConfig(): AuthConfig;
}

// ---------------------------------------------------------------------------
// User service
// ---------------------------------------------------------------------------

export interface UserService {
  create(input: CreateUserInput): Promise<Result<User>>;
  countUsers(): Promise<Result<number>>;
  getById(id: UserId): Promise<Result<User>>;
  getByEmail(email: string): Promise<Result<User>>;
  update(id: UserId, input: Partial<CreateUserInput>): Promise<Result<User>>;
}

// ---------------------------------------------------------------------------
// Organization service
// ---------------------------------------------------------------------------

export interface OrgService {
  create(input: CreateOrgInput, creatorId: UserId): Promise<Result<Organization>>;
  getById(orgId: OrgId, userId: UserId): Promise<Result<Organization>>;
  update(orgId: OrgId, userId: UserId, input: UpdateOrgInput): Promise<Result<Organization>>;
  listForUser(userId: UserId, pagination?: PaginationParams): Promise<Result<PaginatedResult<Organization>>>;
  checkSlugAvailable(slug: string): Promise<Result<boolean>>;
}

// ---------------------------------------------------------------------------
// Membership service
// ---------------------------------------------------------------------------

export interface MembershipService {
  add(input: CreateMembershipInput): Promise<Result<Membership>>;
  remove(orgId: OrgId, userId: UserId, actorId: UserId): Promise<Result<void>>;
  changeRole(orgId: OrgId, userId: UserId, newRole: OrgRole, actorId: UserId): Promise<Result<Membership>>;
  getForUser(orgId: OrgId, userId: UserId): Promise<Result<Membership>>;
  listForOrg(orgId: OrgId, pagination?: PaginationParams): Promise<Result<PaginatedResult<Membership & { user: User }>>>;
  listOrgsForUser(userId: UserId): Promise<Result<readonly Membership[]>>;
}

// ---------------------------------------------------------------------------
// Invitation service
// ---------------------------------------------------------------------------

export interface InvitationService {
  create(input: CreateInvitationInput): Promise<Result<Invitation>>;
  accept(invitationId: string, userId: UserId): Promise<Result<Membership>>;
  listForOrg(orgId: OrgId): Promise<Result<readonly Invitation[]>>;
  revoke(invitationId: string, orgId: OrgId): Promise<Result<void>>;
}

// ---------------------------------------------------------------------------
// Project service
// ---------------------------------------------------------------------------

export interface ProjectService {
  create(input: CreateProjectInput, creatorId: UserId): Promise<Result<Project>>;
  getById(projectId: ProjectId, orgId: OrgId): Promise<Result<Project>>;
  update(projectId: ProjectId, orgId: OrgId, input: UpdateProjectInput): Promise<Result<Project>>;
  listForOrg(orgId: OrgId, pagination?: PaginationParams): Promise<Result<PaginatedResult<Project>>>;
  delete(projectId: ProjectId, orgId: OrgId): Promise<Result<void>>;
}

// ---------------------------------------------------------------------------
// Agent Studio service (Phase 4)
// ---------------------------------------------------------------------------

export interface AgentStudioService {
  // Agent CRUD
  createAgent(input: CreateAgentInput, createdBy: UserId): Promise<Result<Agent>>;
  getAgent(id: AgentId, orgId: OrgId): Promise<Result<Agent>>;
  listAgents(orgId: OrgId, filters?: { projectId?: ProjectId; status?: AgentStatus }): Promise<Result<Agent[]>>;
  updateAgent(id: AgentId, orgId: OrgId, input: UpdateAgentInput): Promise<Result<Agent>>;
  archiveAgent(id: AgentId, orgId: OrgId): Promise<Result<Agent>>;

  // Version management
  createVersion(input: CreateAgentVersionInput, createdBy: UserId): Promise<Result<AgentVersion>>;
  getVersion(id: AgentVersionId, orgId: OrgId): Promise<Result<AgentVersion>>;
  listVersions(agentId: AgentId, orgId: OrgId): Promise<Result<AgentVersion[]>>;
  updateVersion(id: AgentVersionId, orgId: OrgId, input: UpdateAgentVersionInput): Promise<Result<AgentVersion>>;

  // Publish/unpublish
  publishVersion(agentId: AgentId, versionId: AgentVersionId, orgId: OrgId): Promise<Result<AgentVersion>>;
  unpublishAgent(agentId: AgentId, orgId: OrgId): Promise<Result<Agent>>;
}

// ---------------------------------------------------------------------------
// Run service (Phase 5)
// ---------------------------------------------------------------------------

export interface RunService {
  createRun(
    agentId: AgentId,
    orgId: OrgId,
    triggeredBy: UserId,
    input?: Record<string, unknown>,
    triggerType?: TriggerType,
  ): Promise<Result<Run>>;

  getRun(runId: RunId, orgId: OrgId): Promise<Result<Run>>;

  listRuns(
    orgId: OrgId,
    filters?: { agentId?: AgentId; status?: RunStatus; projectId?: ProjectId },
  ): Promise<Result<Run[]>>;

  listRunsForAgent(agentId: AgentId, orgId: OrgId): Promise<Result<Run[]>>;

  getRunSteps(runId: RunId, orgId: OrgId): Promise<Result<RunStep[]>>;

  pauseRun(runId: RunId, orgId: OrgId, actorId: UserId): Promise<Result<Run>>;
  resumeRun(runId: RunId, orgId: OrgId, actorId: UserId): Promise<Result<Run>>;
  cancelRun(runId: RunId, orgId: OrgId, actorId: UserId): Promise<Result<Run>>;
}
