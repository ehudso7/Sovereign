// ---------------------------------------------------------------------------
// Audit event types — emitted for auth-sensitive actions
// ---------------------------------------------------------------------------

import type { OrgId, UserId, ISODateString } from "./types.js";

// ---------------------------------------------------------------------------
// Branded audit event ID
// ---------------------------------------------------------------------------

declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

export type AuditEventId = Brand<string, "AuditEventId">;
export const toAuditEventId = (id: string): AuditEventId => id as AuditEventId;

// ---------------------------------------------------------------------------
// Audit action catalogue (Phase 2 scope)
// ---------------------------------------------------------------------------

export type AuditAction =
  | "auth.sign_in"
  | "auth.sign_out"
  | "auth.session_revoked"
  | "org.created"
  | "org.updated"
  | "org.deleted"
  | "membership.added"
  | "membership.removed"
  | "membership.role_changed"
  | "invitation.created"
  | "invitation.accepted"
  | "project.created"
  | "project.updated"
  | "project.deleted"
  | "agent.created"
  | "agent.updated"
  | "agent.archived"
  | "agent_version.created"
  | "agent_version.updated"
  | "agent_version.published"
  | "agent.unpublished";

// ---------------------------------------------------------------------------
// Audit actor types
// ---------------------------------------------------------------------------

export type ActorType = "user" | "system" | "api_key";

// ---------------------------------------------------------------------------
// Audit event
// ---------------------------------------------------------------------------

export interface AuditEvent {
  readonly id: AuditEventId;
  readonly orgId: OrgId;
  readonly actorId?: UserId;
  readonly actorType: ActorType;
  readonly action: AuditAction;
  readonly resourceType: string;
  readonly resourceId?: string;
  readonly metadata: Record<string, unknown>;
  readonly ipAddress?: string;
  readonly createdAt: ISODateString;
}

export interface EmitAuditEventInput {
  readonly orgId: OrgId;
  readonly actorId?: UserId;
  readonly actorType: ActorType;
  readonly action: AuditAction;
  readonly resourceType: string;
  readonly resourceId?: string;
  readonly metadata?: Record<string, unknown>;
  readonly ipAddress?: string;
}

// ---------------------------------------------------------------------------
// Audit emitter interface
// ---------------------------------------------------------------------------

export interface AuditEmitter {
  emit(event: EmitAuditEventInput): Promise<void>;
  query(orgId: OrgId, params?: AuditQueryParams): Promise<readonly AuditEvent[]>;
}

export interface AuditQueryParams {
  readonly action?: AuditAction;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly actorId?: UserId;
  readonly since?: ISODateString;
  readonly limit?: number;
}
