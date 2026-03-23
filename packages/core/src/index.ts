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
} from "./entities.js";

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
