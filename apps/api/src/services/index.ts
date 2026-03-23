// ---------------------------------------------------------------------------
// Service registry — wires repositories to services
// ---------------------------------------------------------------------------

import type {
  AuthService,
  UserService,
  OrgService,
  MembershipService,
  InvitationService,
  ProjectService,
  AgentStudioService,
  RunService,
  AuditEmitter,
  AuthConfig,
  OrgId,
} from "@sovereign/core";
import {
  type DatabaseClient,
  PgUserRepo,
  PgOrgRepo,
  PgMembershipRepo,
  PgInvitationRepo,
  PgSessionRepo,
  PgProjectRepo,
  PgAuditRepo,
  PgAgentRepo,
  PgAgentVersionRepo,
  PgRunRepo,
  PgRunStepRepo,
} from "@sovereign/db";
import { PgAuthService } from "./auth.service.js";
import { PgUserService } from "./user.service.js";
import { PgOrgService } from "./org.service.js";
import { PgMembershipService } from "./membership.service.js";
import { PgInvitationService } from "./invitation.service.js";
import { PgProjectService } from "./project.service.js";
import { PgAuditEmitter } from "./audit.service.js";
import { PgAgentStudioService } from "./agent-studio.service.js";
import { PgRunService } from "./run.service.js";

export interface ServiceRegistry {
  auth: AuthService & { signInToOrg: PgAuthService["signInToOrg"] };
  users: UserService;
  orgs: OrgService;
  memberships: MembershipService;
  invitations: InvitationService;
  projects: ProjectService;
  agentStudio: AgentStudioService;
  audit: AuditEmitter;
  /** Get a project service scoped to a specific org */
  projectsForOrg: (orgId: OrgId) => ProjectService;
  /** Get an audit emitter scoped to a specific org */
  auditForOrg: (orgId: OrgId) => AuditEmitter;
  /** Get an agent studio service scoped to a specific org */
  agentStudioForOrg: (orgId: OrgId) => AgentStudioService;
  /** Get a run service scoped to a specific org */
  runForOrg: (orgId: OrgId) => RunService;
}

let _registry: ServiceRegistry | null = null;

export function initServices(authConfig: AuthConfig, db: DatabaseClient): ServiceRegistry {
  const unscopedDb = db.unscoped();

  // Unscoped repositories (for cross-org lookups like user by email, session by token)
  const userRepo = new PgUserRepo(unscopedDb);
  const orgRepo = new PgOrgRepo(unscopedDb);
  const membershipRepo = new PgMembershipRepo(unscopedDb);
  const invitationRepo = new PgInvitationRepo(unscopedDb);
  const sessionRepo = new PgSessionRepo(unscopedDb);

  // Factory functions for tenant-scoped repos
  const projectsForOrg = (orgId: OrgId): ProjectService => {
    const tenantDb = db.forTenant(orgId);
    const projectRepo = new PgProjectRepo(tenantDb);
    const auditRepo = new PgAuditRepo(tenantDb);
    const auditEmitter = new PgAuditEmitter(auditRepo);
    return new PgProjectService(projectRepo, auditEmitter);
  };

  const auditForOrg = (orgId: OrgId): AuditEmitter => {
    const tenantDb = db.forTenant(orgId);
    const auditRepo = new PgAuditRepo(tenantDb);
    return new PgAuditEmitter(auditRepo);
  };

  // Factory for org-scoped agent studio service
  const agentStudioForOrg = (orgId: OrgId): AgentStudioService => {
    const tenantDb = db.forTenant(orgId);
    const agentRepo = new PgAgentRepo(tenantDb);
    const versionRepo = new PgAgentVersionRepo(tenantDb);
    const auditRepo = new PgAuditRepo(tenantDb);
    const auditEmitter = new PgAuditEmitter(auditRepo);
    return new PgAgentStudioService(agentRepo, versionRepo, auditEmitter);
  };

  // Factory for org-scoped run service
  const runForOrg = (orgId: OrgId): RunService => {
    const tenantDb = db.forTenant(orgId);
    const runRepo = new PgRunRepo(tenantDb);
    const runStepRepo = new PgRunStepRepo(tenantDb);
    const agentRepo = new PgAgentRepo(tenantDb);
    const versionRepo = new PgAgentVersionRepo(tenantDb);
    const auditRepo = new PgAuditRepo(tenantDb);
    const auditEmitter = new PgAuditEmitter(auditRepo);
    return new PgRunService(runRepo, runStepRepo, agentRepo, versionRepo, auditEmitter);
  };

  // Default audit emitter uses unscoped DB for cross-org operations (like org.created)
  // Services that need org-scoped audit will use auditForOrg
  const defaultAuditRepo = new PgAuditRepo(db.forTenant("00000000-0000-0000-0000-000000000000" as OrgId));
  const defaultAudit = new PgAuditEmitter(defaultAuditRepo);

  // Create a wrapping audit emitter that routes to the correct org
  const routingAudit: AuditEmitter = {
    async emit(input) {
      const tenantDb = db.forTenant(input.orgId);
      const repo = new PgAuditRepo(tenantDb);
      await repo.emit(input);
    },
    async query(orgId, params) {
      const tenantDb = db.forTenant(orgId);
      const repo = new PgAuditRepo(tenantDb);
      return repo.query(orgId, params);
    },
  };

  _registry = {
    auth: new PgAuthService(authConfig, userRepo, membershipRepo, sessionRepo, routingAudit),
    users: new PgUserService(userRepo),
    orgs: new PgOrgService(orgRepo, membershipRepo, routingAudit),
    memberships: new PgMembershipService(membershipRepo, routingAudit),
    invitations: new PgInvitationService(invitationRepo, membershipRepo, userRepo, routingAudit),
    projects: new PgProjectService(
      new PgProjectRepo(db.forTenant("00000000-0000-0000-0000-000000000000" as OrgId)),
      defaultAudit,
    ),
    agentStudio: agentStudioForOrg("00000000-0000-0000-0000-000000000000" as OrgId),
    audit: routingAudit,
    projectsForOrg,
    auditForOrg,
    agentStudioForOrg,
    runForOrg,
  };

  return _registry;
}

export function getServices(): ServiceRegistry {
  if (!_registry) {
    throw new Error("Services not initialized. Call initServices() first.");
  }
  return _registry;
}
