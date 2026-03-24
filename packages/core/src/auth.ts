// ---------------------------------------------------------------------------
// Auth types — provider abstraction, sessions, roles, permissions
// ---------------------------------------------------------------------------

import type { OrgId, UserId, ISODateString } from "./types.js";

// ---------------------------------------------------------------------------
// Branded IDs for auth-specific entities
// ---------------------------------------------------------------------------

declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

export type SessionId = Brand<string, "SessionId">;
export type MembershipId = Brand<string, "MembershipId">;
export type InvitationId = Brand<string, "InvitationId">;

export const toSessionId = (id: string): SessionId => id as SessionId;
export const toMembershipId = (id: string): MembershipId => id as MembershipId;
export const toInvitationId = (id: string): InvitationId => id as InvitationId;

// ---------------------------------------------------------------------------
// Roles (locked for Phase 2)
// ---------------------------------------------------------------------------

export const ORG_ROLES = [
  "org_owner",
  "org_admin",
  "org_member",
  "org_billing_admin",
  "org_security_admin",
] as const;

export type OrgRole = (typeof ORG_ROLES)[number];

export function isValidRole(role: string): role is OrgRole {
  return (ORG_ROLES as readonly string[]).includes(role);
}

// ---------------------------------------------------------------------------
// Role hierarchy — higher index = more privileged
// ---------------------------------------------------------------------------

const ROLE_LEVEL: Record<OrgRole, number> = {
  org_member: 0,
  org_billing_admin: 1,
  org_security_admin: 1,
  org_admin: 2,
  org_owner: 3,
};

export function roleLevel(role: OrgRole): number {
  return ROLE_LEVEL[role];
}

export function canManageRole(actorRole: OrgRole, targetRole: OrgRole): boolean {
  return ROLE_LEVEL[actorRole] > ROLE_LEVEL[targetRole];
}

// ---------------------------------------------------------------------------
// Permissions per role
// ---------------------------------------------------------------------------

export type Permission =
  | "org:read"
  | "org:update"
  | "org:delete"
  | "org:manage_members"
  | "org:manage_roles"
  | "org:manage_billing"
  | "org:manage_security"
  | "org:view_audit"
  | "project:create"
  | "project:read"
  | "project:update"
  | "project:delete"
  | "agent:create"
  | "agent:read"
  | "agent:update"
  | "agent:publish"
  | "agent:archive"
  | "run:read"
  | "run:create"
  | "run:control"
  | "connector:read"
  | "connector:install"
  | "connector:configure"
  | "connector:test"
  | "connector:revoke"
  | "skill:read"
  | "skill:install"
  | "skill:uninstall"
  | "browser:read"
  | "browser:control"
  | "browser:takeover"
  | "memory:read"
  | "memory:write"
  | "memory:review"
  | "memory:redact"
  | "memory:delete"
  | "observability:read"
  | "observability:alerts"
  | "policy:read"
  | "policy:write"
  | "approval:read"
  | "approval:decide"
  | "audit:read"
  | "quarantine:read"
  | "quarantine:manage"
  | "revenue:read"
  | "revenue:write"
  | "revenue:sync"
  | "outreach:generate"
  | "outreach:approve"
  | "billing:read"
  | "billing:write"
  | "billing:manage_plan"
  | "billing:sync";

const ROLE_PERMISSIONS: Record<OrgRole, readonly Permission[]> = {
  org_owner: [
    "org:read",
    "org:update",
    "org:delete",
    "org:manage_members",
    "org:manage_roles",
    "org:manage_billing",
    "org:manage_security",
    "org:view_audit",
    "project:create",
    "project:read",
    "project:update",
    "project:delete",
    "agent:create",
    "agent:read",
    "agent:update",
    "agent:publish",
    "agent:archive",
    "run:read",
    "run:create",
    "run:control",
    "connector:read",
    "connector:install",
    "connector:configure",
    "connector:test",
    "connector:revoke",
    "skill:read",
    "skill:install",
    "skill:uninstall",
    "browser:read",
    "browser:control",
    "browser:takeover",
    "memory:read",
    "memory:write",
    "memory:review",
    "memory:redact",
    "memory:delete",
    "observability:read",
    "observability:alerts",
    "policy:read",
    "policy:write",
    "approval:read",
    "approval:decide",
    "audit:read",
    "quarantine:read",
    "quarantine:manage",
    "revenue:read",
    "revenue:write",
    "revenue:sync",
    "outreach:generate",
    "outreach:approve",
    "billing:read",
    "billing:write",
    "billing:manage_plan",
    "billing:sync",
  ],
  org_admin: [
    "org:read",
    "org:update",
    "org:manage_members",
    "org:view_audit",
    "project:create",
    "project:read",
    "project:update",
    "project:delete",
    "agent:create",
    "agent:read",
    "agent:update",
    "agent:publish",
    "agent:archive",
    "run:read",
    "run:create",
    "run:control",
    "connector:read",
    "connector:install",
    "connector:configure",
    "connector:test",
    "connector:revoke",
    "skill:read",
    "skill:install",
    "skill:uninstall",
    "browser:read",
    "browser:control",
    "browser:takeover",
    "memory:read",
    "memory:write",
    "memory:review",
    "memory:redact",
    "memory:delete",
    "observability:read",
    "observability:alerts",
    "policy:read",
    "policy:write",
    "approval:read",
    "approval:decide",
    "audit:read",
    "quarantine:read",
    "quarantine:manage",
    "revenue:read",
    "revenue:write",
    "revenue:sync",
    "outreach:generate",
    "outreach:approve",
    "billing:read",
    "billing:write",
  ],
  org_member: [
    "org:read",
    "project:read",
    "agent:read",
    "run:read",
    "run:create",
    "connector:read",
    "skill:read",
    "browser:read",
    "memory:read",
    "memory:write",
    "observability:read",
    "policy:read",
    "approval:read",
    "audit:read",
    "quarantine:read",
    "revenue:read",
    "revenue:write",
    "outreach:generate",
    "billing:read",
  ],
  org_billing_admin: [
    "org:read",
    "org:manage_billing",
    "project:read",
    "agent:read",
    "run:read",
    "connector:read",
    "skill:read",
    "browser:read",
    "memory:read",
    "observability:read",
    "policy:read",
    "audit:read",
    "revenue:read",
    "billing:read",
    "billing:write",
    "billing:manage_plan",
    "billing:sync",
  ],
  org_security_admin: [
    "org:read",
    "org:manage_security",
    "org:view_audit",
    "project:read",
    "agent:read",
    "run:read",
    "connector:read",
    "skill:read",
    "browser:read",
    "memory:read",
    "memory:review",
    "observability:read",
    "observability:alerts",
    "policy:read",
    "policy:write",
    "approval:read",
    "approval:decide",
    "audit:read",
    "quarantine:read",
    "quarantine:manage",
    "revenue:read",
    "outreach:approve",
    "billing:read",
  ],
};

export function permissionsForRole(role: OrgRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(role: OrgRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export interface Session {
  readonly id: SessionId;
  readonly userId: UserId;
  readonly orgId: OrgId;
  readonly role: OrgRole;
  readonly expiresAt: ISODateString;
  readonly createdAt: ISODateString;
  readonly ipAddress?: string;
  readonly userAgent?: string;
}

// ---------------------------------------------------------------------------
// Auth provider abstraction
// ---------------------------------------------------------------------------

export type AuthMode = "local" | "workos";

export interface AuthUser {
  readonly id: UserId;
  readonly email: string;
  readonly name: string;
  readonly avatarUrl?: string;
  readonly providerUserId?: string;
}

export interface AuthProvider {
  readonly mode: AuthMode;

  /**
   * Authenticate with credentials (local mode) or initiate OAuth flow (WorkOS).
   * Returns the authenticated user or an error.
   */
  authenticate(params: AuthenticateParams): Promise<AuthResult>;

  /**
   * Handle OAuth/SSO callback (WorkOS mode).
   * No-op in local mode.
   */
  handleCallback(params: CallbackParams): Promise<AuthResult>;

  /**
   * Validate a session token and return the associated user info.
   */
  validateToken(token: string): Promise<AuthUser | null>;

  /**
   * Revoke a session/token.
   */
  revokeSession(sessionId: SessionId): Promise<void>;
}

export interface AuthenticateParams {
  readonly email: string;
  readonly password?: string;
  readonly redirectUrl?: string;
}

export interface CallbackParams {
  readonly code: string;
  readonly state?: string;
}

export interface AuthResult {
  readonly user: AuthUser;
  readonly sessionToken: string;
  readonly expiresAt: ISODateString;
}

// ---------------------------------------------------------------------------
// Auth mode configuration
// ---------------------------------------------------------------------------

export interface AuthConfig {
  readonly mode: AuthMode;
  readonly sessionSecret: string;
  readonly sessionTtlMs: number;
  /** WorkOS settings — required when mode === "workos" */
  readonly workos?: {
    readonly apiKey: string;
    readonly clientId: string;
  };
}
