// ---------------------------------------------------------------------------
// Auth service — session management backed by SessionRepo
// ---------------------------------------------------------------------------

import { createHash, randomBytes } from "node:crypto";
import {
  ok,
  err,
  AppError,
  toISODateString,
} from "@sovereign/core";
import type {
  AuthService,
  AuthConfig,
  AuthResult,
  Session,
  SessionId,
  OrgId,
  UserId,
  Result,
  AuditEmitter,
} from "@sovereign/core";
import type { UserRepo, MembershipRepo, SessionRepo } from "@sovereign/db";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export class PgAuthService implements AuthService {
  private readonly config: AuthConfig;

  constructor(
    config: AuthConfig,
    private readonly userRepo: UserRepo,
    private readonly membershipRepo: MembershipRepo,
    private readonly sessionRepo: SessionRepo,
    private readonly audit: AuditEmitter,
  ) {
    this.config = config;
  }

  getConfig(): AuthConfig {
    return this.config;
  }

  async signIn(email: string, _password?: string): Promise<Result<AuthResult>> {
    const user = await this.userRepo.getByEmail(email);
    if (!user) return err(AppError.unauthorized("User not found"));

    const memberships = await this.membershipRepo.listForUser(user.id);
    if (memberships.length === 0) {
      return err(AppError.unauthorized("User has no organization memberships"));
    }

    const membership = memberships[0]!;
    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + this.config.sessionTtlMs).toISOString();

    const session = await this.sessionRepo.create({
      userId: user.id,
      orgId: membership.orgId,
      role: membership.role,
      tokenHash,
      expiresAt,
    });

    await this.audit.emit({
      orgId: membership.orgId,
      actorId: user.id,
      actorType: "user",
      action: "auth.sign_in",
      resourceType: "session",
      resourceId: session.id,
    });

    return ok({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      sessionToken: token,
      expiresAt: toISODateString(expiresAt),
    });
  }

  async signOut(sessionId: SessionId): Promise<Result<void>> {
    const session = await this.sessionRepo.getById(sessionId);
    if (!session) return err(AppError.notFound("Session", sessionId));

    await this.audit.emit({
      orgId: session.orgId,
      actorId: session.userId,
      actorType: "user",
      action: "auth.sign_out",
      resourceType: "session",
      resourceId: session.id,
    });

    await this.sessionRepo.delete(sessionId);
    return ok(undefined);
  }

  async validateSession(token: string): Promise<Result<Session>> {
    const tokenHash = hashToken(token);
    const session = await this.sessionRepo.getByTokenHash(tokenHash);

    if (!session) return err(AppError.unauthorized("Invalid session token"));

    if (new Date(session.expiresAt).getTime() < Date.now()) {
      await this.sessionRepo.delete(session.id);
      return err(AppError.unauthorized("Session expired"));
    }

    return ok(session);
  }

  async listSessions(orgId: OrgId, userId: UserId): Promise<Result<readonly Session[]>> {
    const sessions = await this.sessionRepo.listForUser(orgId, userId);
    return ok(sessions);
  }

  async revokeSession(sessionId: SessionId, actorId: UserId): Promise<Result<void>> {
    const session = await this.sessionRepo.getById(sessionId);
    if (!session) return err(AppError.notFound("Session", sessionId));

    await this.audit.emit({
      orgId: session.orgId,
      actorId,
      actorType: "user",
      action: "auth.session_revoked",
      resourceType: "session",
      resourceId: session.id,
    });

    await this.sessionRepo.delete(sessionId);
    return ok(undefined);
  }

  async signInToOrg(
    userId: UserId,
    orgId: OrgId,
    ipAddress?: string,
    userAgent?: string,
    providerSessionId?: string,
  ): Promise<Result<AuthResult>> {
    const user = await this.userRepo.getById(userId);
    if (!user) return err(AppError.unauthorized("User not found"));

    const membership = await this.membershipRepo.getForUser(orgId, userId);
    if (!membership) return err(AppError.forbidden("Not a member of this organization"));

    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + this.config.sessionTtlMs).toISOString();

    const session = await this.sessionRepo.create({
      userId,
      orgId,
      role: membership.role,
      providerSessionId,
      tokenHash,
      expiresAt,
      ipAddress,
      userAgent,
    });

    await this.audit.emit({
      orgId,
      actorId: userId,
      actorType: "user",
      action: "auth.sign_in",
      resourceType: "session",
      resourceId: session.id,
    });

    return ok({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      sessionToken: token,
      expiresAt: toISODateString(expiresAt),
    });
  }
}
