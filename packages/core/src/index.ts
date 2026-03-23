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
