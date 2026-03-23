// ---------------------------------------------------------------------------
// Branded primitive types
// ---------------------------------------------------------------------------

declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

export type OrgId = Brand<string, "OrgId">;
export type UserId = Brand<string, "UserId">;
export type ProjectId = Brand<string, "ProjectId">;
export type AgentId = Brand<string, "AgentId">;
export type RunId = Brand<string, "RunId">;
export type ConnectorId = Brand<string, "ConnectorId">;
export type PolicyId = Brand<string, "PolicyId">;

/** Safe constructor helpers – use these instead of raw casts in application code. */
export const toOrgId = (id: string): OrgId => id as OrgId;
export const toUserId = (id: string): UserId => id as UserId;
export const toProjectId = (id: string): ProjectId => id as ProjectId;
export const toAgentId = (id: string): AgentId => id as AgentId;
export const toRunId = (id: string): RunId => id as RunId;
export const toConnectorId = (id: string): ConnectorId => id as ConnectorId;
export const toPolicyId = (id: string): PolicyId => id as PolicyId;

// ---------------------------------------------------------------------------
// Tenant context – threaded through every request
// ---------------------------------------------------------------------------

export interface TenantContext {
  readonly orgId: OrgId;
  readonly userId: UserId;
  /** ISO-8601 timestamp of when the context was established. */
  readonly requestedAt: string;
  /** Trace / correlation ID for distributed tracing. */
  readonly traceId: string;
  /** The active project scope, if any. */
  readonly projectId?: ProjectId;
  /** Resolved permission scopes for the current user. */
  readonly scopes: readonly string[];
}

// ---------------------------------------------------------------------------
// Result<T, E> – explicit error handling without exceptions
// ---------------------------------------------------------------------------

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E = AppError> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok === true;
}

export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return result.ok === false;
}

/**
 * Unwrap a Result, throwing the contained error on failure.
 * Prefer explicit handling over this in library code.
 */
export function unwrap<T>(result: Result<T, AppError>): T {
  if (result.ok) return result.value;
  throw result.error;
}

// ---------------------------------------------------------------------------
// AppError – structured application error
// ---------------------------------------------------------------------------

export type ErrorCode =
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "BAD_REQUEST"
  | "CONFLICT"
  | "UNPROCESSABLE_ENTITY"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "TIMEOUT";

const HTTP_STATUS_MAP: Record<ErrorCode, number> = {
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  BAD_REQUEST: 400,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  TIMEOUT: 504,
};

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = HTTP_STATUS_MAP[code];
    this.details = details;
  }

  /** Convenience factory methods */
  static notFound(resource: string, id?: string): AppError {
    const msg = id
      ? `${resource} with id '${id}' was not found`
      : `${resource} was not found`;
    return new AppError("NOT_FOUND", msg);
  }

  static unauthorized(message = "Authentication required"): AppError {
    return new AppError("UNAUTHORIZED", message);
  }

  static forbidden(message = "Insufficient permissions"): AppError {
    return new AppError("FORBIDDEN", message);
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError("BAD_REQUEST", message, details);
  }

  static conflict(message: string): AppError {
    return new AppError("CONFLICT", message);
  }

  static internal(message = "An unexpected error occurred"): AppError {
    return new AppError("INTERNAL_ERROR", message);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface PaginationParams {
  /** Number of records per page. Defaults to 20, max 100. */
  limit?: number;
  /** Opaque cursor from a previous page's `nextCursor`. */
  cursor?: string;
}

export interface PaginatedResult<T> {
  readonly data: readonly T[];
  readonly total: number;
  /** Present when there is a subsequent page. */
  readonly nextCursor?: string;
  readonly hasMore: boolean;
}

export function paginatedResult<T>(
  data: T[],
  total: number,
  nextCursor?: string
): PaginatedResult<T> {
  return {
    data,
    total,
    nextCursor,
    hasMore: nextCursor !== undefined,
  };
}

// ---------------------------------------------------------------------------
// Common value types
// ---------------------------------------------------------------------------

/** ISO-8601 date-time string. Use this as the canonical wire format. */
export type ISODateString = Brand<string, "ISODateString">;
export const toISODateString = (d: Date | string): ISODateString =>
  (typeof d === "string" ? d : d.toISOString()) as ISODateString;

/** URL string – validated at the boundaries, stored as branded string. */
export type HttpUrl = Brand<string, "HttpUrl">;

/** Semantic version string, e.g. "1.2.3". */
export type SemVer = Brand<string, "SemVer">;

// ---------------------------------------------------------------------------
// Audit metadata – attached to every persistent entity
// ---------------------------------------------------------------------------

export interface AuditFields {
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
  readonly createdBy: UserId;
  readonly updatedBy: UserId;
}
