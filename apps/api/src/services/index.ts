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
import { PgBrowserSessionRepo, PgMemoryRepo, PgMemoryLinkRepo, PgAlertRuleRepo, PgAlertEventRepo, PgPolicyRepo, PgPolicyDecisionRepo, PgApprovalRepo, PgQuarantineRecordRepo, PgCrmAccountRepo, PgCrmContactRepo, PgCrmDealRepo, PgCrmTaskRepo, PgCrmNoteRepo, PgOutreachDraftRepo, PgCrmSyncLogRepo, PgBillingAccountRepo, PgUsageEventRepo, PgInvoiceRepo, PgSpendAlertRepo } from "@sovereign/db";
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
  PgConnectorRepo,
  PgConnectorInstallRepo,
  PgConnectorCredentialRepo,
  PgSkillRepo,
  PgSkillInstallRepo,
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
import { PgConnectorService } from "./connector.service.js";
import { PgSkillService } from "./skill.service.js";
import { PgBrowserSessionService } from "./browser-session.service.js";
import { PgMemoryService } from "./memory.service.js";
import { MissionControlService } from "./mission-control.service.js";
import { PgPolicyService } from "./policy.service.js";
import { PgRevenueService } from "./revenue.service.js";
import { PgBillingService } from "./billing.service.js";
import { PgOnboardingService } from "./onboarding.service.js";
import { ObjectStorageService } from "./storage.service.js";
import { WorkosAuthService } from "./workos-auth.service.js";
import { BUILTIN_CONNECTORS, BUILTIN_SKILLS } from "@sovereign/gateway-mcp";

export interface ServiceRegistry {
  auth: AuthService & { signInToOrg: PgAuthService["signInToOrg"] };
  workosAuth: WorkosAuthService;
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
  /** Get a connector service scoped to a specific org */
  connectorForOrg: (orgId: OrgId) => PgConnectorService;
  /** Get a skill service scoped to a specific org */
  skillForOrg: (orgId: OrgId) => PgSkillService;
  /** Get a browser session service scoped to a specific org */
  browserSessionForOrg: (orgId: OrgId) => PgBrowserSessionService;
  /** Get a memory service scoped to a specific org */
  memoryForOrg: (orgId: OrgId) => PgMemoryService;
  /** Get a mission control service scoped to a specific org */
  missionControlForOrg: (orgId: OrgId) => MissionControlService;
  /** Get a policy service scoped to a specific org */
  policyForOrg: (orgId: OrgId) => PgPolicyService;
  /** Get a revenue service scoped to a specific org */
  revenueForOrg: (orgId: OrgId) => PgRevenueService;
  billingForOrg: (orgId: OrgId) => PgBillingService;
  onboardingForOrg: (orgId: OrgId) => PgOnboardingService;
}

let _registry: ServiceRegistry | null = null;

/**
 * Seed the global connector and skill catalogs from BUILTIN_CONNECTORS/BUILTIN_SKILLS.
 * Upserts — only inserts if the slug doesn't already exist.
 */
async function seedCatalog(db: DatabaseClient): Promise<void> {
  const unscopedDb = db.unscoped();
  const connectorRepo = new PgConnectorRepo(unscopedDb);
  const skillRepo = new PgSkillRepo(unscopedDb);

  for (const c of BUILTIN_CONNECTORS) {
    const existing = await connectorRepo.getBySlug(c.slug);
    if (!existing) {
      await connectorRepo.create({
        slug: c.slug,
        name: c.name,
        description: c.description,
        category: c.category,
        trustTier: c.trustTier,
        authMode: c.authMode,
        status: "active",
        tools: c.tools,
        scopes: c.scopes,
        metadata: {},
      });
    }
  }

  for (const s of BUILTIN_SKILLS) {
    const existing = await skillRepo.getBySlug(s.slug);
    if (!existing) {
      await skillRepo.create({
        slug: s.slug,
        name: s.name,
        description: s.description,
        trustTier: s.trustTier,
        connectorSlugs: s.connectorSlugs,
        metadata: {},
      });
    }
  }
}

export function initServices(authConfig: AuthConfig, db: DatabaseClient): ServiceRegistry {
  const unscopedDb = db.unscoped();
  const storageService = ObjectStorageService.fromEnv();

  // Unscoped repositories (for cross-org lookups like user by email, session by token)
  const userRepo = new PgUserRepo(unscopedDb);
  const orgRepo = new PgOrgRepo(unscopedDb);
  const membershipRepo = new PgMembershipRepo(unscopedDb);
  const invitationRepo = new PgInvitationRepo(unscopedDb);
  const sessionRepo = new PgSessionRepo(unscopedDb);

  // Global catalog repos (unscoped)
  const connectorRepo = new PgConnectorRepo(unscopedDb);
  const skillRepo = new PgSkillRepo(unscopedDb);

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
    const runService = new PgRunService(runRepo, runStepRepo, agentRepo, versionRepo, auditEmitter);
    runService.setBillingService(billingForOrg(orgId));
    return runService;
  };

  // Factory for org-scoped connector service
  const connectorForOrg = (orgId: OrgId): PgConnectorService => {
    const tenantDb = db.forTenant(orgId);
    const installRepo = new PgConnectorInstallRepo(tenantDb);
    const credentialRepo = new PgConnectorCredentialRepo(tenantDb);
    const auditRepo = new PgAuditRepo(tenantDb);
    const auditEmitter = new PgAuditEmitter(auditRepo);
    const connectorService = new PgConnectorService(connectorRepo, installRepo, credentialRepo, auditEmitter);
    connectorService.setBillingService(billingForOrg(orgId));
    return connectorService;
  };

  // Factory for org-scoped skill service
  const skillForOrg = (orgId: OrgId): PgSkillService => {
    const tenantDb = db.forTenant(orgId);
    const installRepo = new PgSkillInstallRepo(tenantDb);
    const auditRepo = new PgAuditRepo(tenantDb);
    const auditEmitter = new PgAuditEmitter(auditRepo);
    return new PgSkillService(skillRepo, installRepo, auditEmitter);
  };

  // Factory for org-scoped browser session service
  const browserSessionForOrg = (orgId: OrgId): PgBrowserSessionService => {
    const tenantDb = db.forTenant(orgId);
    const sessionRepo = new PgBrowserSessionRepo(tenantDb);
    const runRepo = new PgRunRepo(tenantDb);
    const auditRepo = new PgAuditRepo(tenantDb);
    const auditEmitter = new PgAuditEmitter(auditRepo);
    const service = new PgBrowserSessionService(sessionRepo, runRepo, auditEmitter);
    // Attach policy service for runtime enforcement of browser risky actions
    service.setPolicyService(policyForOrg(orgId));
    service.setBillingService(billingForOrg(orgId));
    if (storageService) {
      service.setStorageService(storageService);
    }
    return service;
  };

  // Factory for org-scoped memory service
  const memoryForOrg = (orgId: OrgId): PgMemoryService => {
    const tenantDb = db.forTenant(orgId);
    const memoryRepo = new PgMemoryRepo(tenantDb);
    const memoryLinkRepo = new PgMemoryLinkRepo(tenantDb);
    const auditRepo = new PgAuditRepo(tenantDb);
    const auditEmitter = new PgAuditEmitter(auditRepo);
    return new PgMemoryService(memoryRepo, memoryLinkRepo, auditEmitter);
  };

  // Factory for org-scoped mission control service
  const missionControlForOrg = (orgId: OrgId): MissionControlService => {
    const tenantDb = db.forTenant(orgId);
    const runRepo = new PgRunRepo(tenantDb);
    const runStepRepo = new PgRunStepRepo(tenantDb);
    const browserSessionRepo = new PgBrowserSessionRepo(tenantDb);
    const alertRuleRepo = new PgAlertRuleRepo(tenantDb);
    const alertEventRepo = new PgAlertEventRepo(tenantDb);
    const auditRepo = new PgAuditRepo(tenantDb);
    const auditEmitter = new PgAuditEmitter(auditRepo);
    return new MissionControlService(
      runRepo, runStepRepo, browserSessionRepo,
      alertRuleRepo, alertEventRepo, auditRepo, auditEmitter,
    );
  };

  // Factory for org-scoped policy service
  const policyForOrg = (orgId: OrgId): PgPolicyService => {
    const tenantDb = db.forTenant(orgId);
    const policyRepo = new PgPolicyRepo(tenantDb);
    const decisionRepo = new PgPolicyDecisionRepo(tenantDb);
    const approvalRepo = new PgApprovalRepo(tenantDb);
    const quarantineRepo = new PgQuarantineRecordRepo(tenantDb);
    const auditRepo = new PgAuditRepo(tenantDb);
    const auditEmitter = new PgAuditEmitter(auditRepo);
    return new PgPolicyService(policyRepo, decisionRepo, approvalRepo, quarantineRepo, auditEmitter);
  };

  // Factory for org-scoped revenue service
  const revenueForOrg = (orgId: OrgId): PgRevenueService => {
    const tenantDb = db.forTenant(orgId);
    const accountRepo = new PgCrmAccountRepo(tenantDb);
    const contactRepo = new PgCrmContactRepo(tenantDb);
    const dealRepo = new PgCrmDealRepo(tenantDb);
    const taskRepo = new PgCrmTaskRepo(tenantDb);
    const noteRepo = new PgCrmNoteRepo(tenantDb);
    const draftRepo = new PgOutreachDraftRepo(tenantDb);
    const syncLogRepo = new PgCrmSyncLogRepo(tenantDb);
    const auditRepo = new PgAuditRepo(tenantDb);
    const auditEmitter = new PgAuditEmitter(auditRepo);
    const service = new PgRevenueService(accountRepo, contactRepo, dealRepo, taskRepo, noteRepo, draftRepo, syncLogRepo, auditEmitter);
    service.setPolicyService(policyForOrg(orgId));
    return service;
  };

  // Factory for org-scoped billing service
  const billingForOrg = (orgId: OrgId): PgBillingService => {
    const tenantDb = db.forTenant(orgId);
    const billingAccountRepo = new PgBillingAccountRepo(tenantDb);
    const usageEventRepo = new PgUsageEventRepo(tenantDb);
    const invoiceRepo = new PgInvoiceRepo(tenantDb);
    const spendAlertRepo = new PgSpendAlertRepo(tenantDb);
    const auditRepo = new PgAuditRepo(tenantDb);
    const auditEmitter = new PgAuditEmitter(auditRepo);
    const billingOrgRepo = new PgOrgRepo(unscopedDb);
    return new PgBillingService(billingAccountRepo, usageEventRepo, invoiceRepo, spendAlertRepo, auditEmitter, undefined, billingOrgRepo);
  };

  // Factory for org-scoped onboarding service
  const onboardingForOrg = (orgId: OrgId): PgOnboardingService => {
    const tenantDb = db.forTenant(orgId);
    const agentRepo = new PgAgentRepo(tenantDb);
    const runRepo = new PgRunRepo(tenantDb);
    const connectorInstallRepo = new PgConnectorInstallRepo(tenantDb);
    const billingAccountRepo = new PgBillingAccountRepo(tenantDb);
    const policyRepo = new PgPolicyRepo(tenantDb);
    const projectRepo = new PgProjectRepo(tenantDb);
    const alertEventRepo = new PgAlertEventRepo(tenantDb);
    const browserSessionRepo = new PgBrowserSessionRepo(tenantDb);
    const auditRepo = new PgAuditRepo(tenantDb);
    const auditEmitter = new PgAuditEmitter(auditRepo);
    const orgRepo = new PgOrgRepo(unscopedDb);
    return new PgOnboardingService(agentRepo, runRepo, connectorInstallRepo, billingAccountRepo, policyRepo, membershipRepo, projectRepo, alertEventRepo, browserSessionRepo, auditEmitter, orgRepo);
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
    async getById(_eventId) {
      // Direct lookup requires tenant context — use auditForOrg instead
      return null;
    },
  };

  const auth = new PgAuthService(authConfig, userRepo, membershipRepo, sessionRepo, routingAudit);
  const users = new PgUserService(userRepo);
  const orgs = new PgOrgService(orgRepo, membershipRepo, routingAudit);
  const memberships = new PgMembershipService(membershipRepo, routingAudit);
  const invitations = new PgInvitationService(invitationRepo, membershipRepo, userRepo, routingAudit);
  const workosAuth = new WorkosAuthService(
    authConfig,
    auth,
    orgs,
    invitations,
    userRepo,
    membershipRepo,
    orgRepo,
    invitationRepo,
  );

  _registry = {
    auth,
    workosAuth,
    users,
    orgs,
    memberships,
    invitations,
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
    connectorForOrg,
    skillForOrg,
    browserSessionForOrg,
    memoryForOrg,
    missionControlForOrg,
    policyForOrg,
    revenueForOrg,
    billingForOrg,
    onboardingForOrg,
  };

  // Seed catalog asynchronously (non-blocking, log errors)
  seedCatalog(db).catch((e) => {
    console.warn("[services] Failed to seed connector/skill catalog:", e instanceof Error ? e.message : e);
  });

  return _registry;
}

export function getServices(): ServiceRegistry {
  if (!_registry) {
    throw new Error("Services not initialized. Call initServices() first.");
  }
  return _registry;
}
