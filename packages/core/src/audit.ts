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
  | "agent.unpublished"
  | "run.created"
  | "run.started"
  | "run.paused"
  | "run.resumed"
  | "run.cancelled"
  | "run.completed"
  | "run.failed"
  | "connector.installed"
  | "connector.configured"
  | "connector.tested"
  | "connector.revoked"
  | "skill.installed"
  | "skill.uninstalled"
  | "run.tool_used"
  | "browser.session_created"
  | "browser.takeover_requested"
  | "browser.takeover_started"
  | "browser.takeover_released"
  | "browser.session_closed"
  | "browser.action_blocked"
  | "browser.downloaded"
  | "browser.uploaded"
  | "memory.created"
  | "memory.updated"
  | "memory.redacted"
  | "memory.expired"
  | "memory.deleted"
  | "memory.promoted"
  | "memory.retrieved_for_run"
  | "alert.acknowledged"
  | "policy.created"
  | "policy.updated"
  | "policy.disabled"
  | "policy.enabled"
  | "policy.archived"
  | "policy.decision"
  | "approval.requested"
  | "approval.approved"
  | "approval.denied"
  | "approval.expired"
  | "approval.cancelled"
  | "quarantine.entered"
  | "quarantine.released"
  | "secret.resolved";

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
