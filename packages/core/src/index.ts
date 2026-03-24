/**
 * @sovereign/core
 *
 * Shared types, branded primitives, and core utilities used across
 * every package and application in the Sovereign monorepo.
 */

export type {
  OrgId,
  UserId,
  ProjectId,
  AgentId,
  AgentVersionId,
  RunId,
  ConnectorId,
  PolicyId,
  ApprovalId,
  PolicyDecisionId,
  QuarantineRecordId,
  SkillId,
  SkillVersionId,
  ConnectorInstallId,
  SkillInstallId,
  BrowserSessionId,
  MemoryId,
  MemoryLinkId,
  AlertRuleId,
  AlertEventId,
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
  TenantContext,
  Ok,
  Err,
  Result,
  ErrorCode,
  PaginationParams,
  PaginatedResult,
  ISODateString,
  HttpUrl,
  SemVer,
  AuditFields,
} from "./types.js";

export {
  // ID constructors
  toOrgId,
  toUserId,
  toProjectId,
  toAgentId,
  toAgentVersionId,
  toRunId,
  toConnectorId,
  toPolicyId,
  toSkillId,
  toSkillVersionId,
  toConnectorInstallId,
  toSkillInstallId,
  toBrowserSessionId,
  toMemoryId,
  toMemoryLinkId,
  toAlertRuleId,
  toAlertEventId,
  toApprovalId,
  toPolicyDecisionId,
  toQuarantineRecordId,
  toCrmAccountId,
  toCrmContactId,
  toCrmDealId,
  toCrmTaskId,
  toCrmNoteId,
  toOutreachDraftId,
  toCrmSyncLogId,
  toBillingAccountId,
  toUsageEventId,
  toInvoiceId,
  toSpendAlertId,
  // Result helpers
  ok,
  err,
  isOk,
  isErr,
  unwrap,
  // AppError
  AppError,
  // Pagination helpers
  paginatedResult,
  // Date helpers
  toISODateString,
} from "./types.js";

// ---------------------------------------------------------------------------
// Auth types (Phase 2)
// ---------------------------------------------------------------------------

export type {
  SessionId,
  MembershipId,
  InvitationId,
  OrgRole,
  Permission,
  Session,
  AuthMode,
  AuthUser,
  AuthProvider,
  AuthenticateParams,
  CallbackParams,
  AuthResult,
  AuthConfig,
} from "./auth.js";

export {
  toSessionId,
  toMembershipId,
  toInvitationId,
  ORG_ROLES,
  isValidRole,
  roleLevel,
  canManageRole,
  permissionsForRole,
  hasPermission,
} from "./auth.js";

// ---------------------------------------------------------------------------
// Entity types (Phase 2)
// ---------------------------------------------------------------------------

export type {
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
  ToolConfig,
  BudgetConfig,
  ApprovalRuleConfig,
  MemoryConfig,
  ScheduleConfig,
  ModelConfig,
  Run,
  RunStatus,
  RunStep,
  RunStepType,
  RunStepStatus,
  CreateRunInput,
  TriggerType,
  ExecutionProvider,
  ConnectorTrustTier,
  ConnectorAuthMode,
  ConnectorStatus,
  ConnectorTool,
  ConnectorScope,
  Connector,
  ConnectorInstall,
  CreateConnectorInstallInput,
  SkillTrustTier,
  Skill,
  SkillInstall,
  BrowserSessionStatus,
  BrowserActionType,
  BrowserSession,
  CreateBrowserSessionInput,
  BrowserAction,
  BrowserActionResult,
  MemoryScopeType,
  MemoryKind,
  MemoryStatus,
  Memory,
  CreateMemoryInput,
  UpdateMemoryInput,
  MemoryLinkType,
  MemoryLink,
  CreateMemoryLinkInput,
  AlertConditionType,
  AlertSeverity,
  AlertStatus,
  AlertRule,
  AlertEvent,
  PolicyType,
  PolicyStatus,
  EnforcementMode,
  PolicyScopeType,
  PolicyRule,
  Policy,
  PolicyDecisionResult,
  PolicyDecision,
  ApprovalStatus,
  Approval,
  QuarantineStatus,
  QuarantineRecord,
  CrmAccountStatus,
  CrmAccount,
  CrmContactStatus,
  CrmContact,
  CrmDeal,
  CrmTaskStatus,
  CrmTaskPriority,
  CrmTask,
  CrmNoteType,
  CrmNote,
  OutreachChannel,
  OutreachApprovalStatus,
  OutreachDraft,
  CrmSyncDirection,
  CrmSyncStatus,
  CrmSyncLog,
  BillingAccountStatus,
  BillingPlan,
  OveragePolicy,
  BillingAccount,
  UsageMeter,
  UsageEvent,
  InvoiceStatus,
  InvoiceLineItem,
  Invoice,
  SpendAlertStatus,
  SpendAlert,
  PlanAllowance,
  PlanDefinition,
} from "./entities.js";

export { RISKY_BROWSER_ACTIONS } from "./entities.js";

// ---------------------------------------------------------------------------
// Audit types (Phase 2)
// ---------------------------------------------------------------------------

export type {
  AuditEventId,
  AuditAction,
  ActorType,
  AuditEvent,
  EmitAuditEventInput,
  AuditEmitter,
  AuditQueryParams,
} from "./audit.js";

export { toAuditEventId } from "./audit.js";

// ---------------------------------------------------------------------------
// Service interfaces (Phase 2)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Run state machine (Phase 5)
// ---------------------------------------------------------------------------

export {
  isValidTransition,
  assertTransition,
  isTerminal,
  TERMINAL_STATES,
} from "./run-state-machine.js";

// ---------------------------------------------------------------------------
// Browser session state machine (Phase 7)
// ---------------------------------------------------------------------------

export {
  isValidBrowserTransition,
  assertBrowserTransition,
  isBrowserTerminal,
  BROWSER_TERMINAL_STATES,
} from "./browser-state-machine.js";

export type {
  AuthService,
  UserService,
  OrgService,
  MembershipService,
  InvitationService,
  ProjectService,
  AgentStudioService,
  RunService,
} from "./services.js";

// ---------------------------------------------------------------------------
// Crypto utilities (Phase 6 — credential encryption)
// ---------------------------------------------------------------------------

export { encryptSecret, decryptSecret } from "./crypto.js";
