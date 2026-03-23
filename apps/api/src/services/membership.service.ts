// ---------------------------------------------------------------------------
// Membership service — backed by MembershipRepo
// ---------------------------------------------------------------------------

import { ok, err, AppError, paginatedResult, hasPermission, canManageRole } from "@sovereign/core";
import type {
  MembershipService,
  Membership,
  CreateMembershipInput,
  User,
  OrgId,
  UserId,
  OrgRole,
  Result,
  PaginatedResult,
  PaginationParams,
  AuditEmitter,
} from "@sovereign/core";
import type { MembershipRepo } from "@sovereign/db";

export class PgMembershipService implements MembershipService {
  constructor(
    private readonly repo: MembershipRepo,
    private readonly audit: AuditEmitter,
  ) {}

  async add(input: CreateMembershipInput): Promise<Result<Membership>> {
    const existing = await this.repo.getForUser(input.orgId, input.userId);
    if (existing) {
      return err(AppError.conflict("User is already a member of this organization"));
    }

    try {
      const membership = await this.repo.create({
        orgId: input.orgId,
        userId: input.userId,
        role: input.role,
        invitedBy: input.invitedBy,
        accepted: true,
      });

      await this.audit.emit({
        orgId: input.orgId,
        actorId: input.invitedBy,
        actorType: "user",
        action: "membership.added",
        resourceType: "membership",
        resourceId: membership.id,
        metadata: { userId: input.userId, role: input.role },
      });

      return ok(membership);
    } catch (e) {
      return err(AppError.internal(e instanceof Error ? e.message : "Failed to add membership"));
    }
  }

  async remove(orgId: OrgId, userId: UserId, actorId: UserId): Promise<Result<void>> {
    const membership = await this.repo.getForUser(orgId, userId);
    if (!membership) return err(AppError.notFound("Membership"));

    if (membership.role === "org_owner") {
      const ownerCount = await this.repo.countByRole(orgId, "org_owner");
      if (ownerCount <= 1) {
        return err(AppError.badRequest("Cannot remove the last organization owner"));
      }
    }

    await this.repo.delete(orgId, userId);

    await this.audit.emit({
      orgId,
      actorId,
      actorType: "user",
      action: "membership.removed",
      resourceType: "membership",
      resourceId: membership.id,
      metadata: { removedUserId: userId },
    });

    return ok(undefined);
  }

  async changeRole(orgId: OrgId, userId: UserId, newRole: OrgRole, actorId: UserId): Promise<Result<Membership>> {
    const membership = await this.repo.getForUser(orgId, userId);
    if (!membership) return err(AppError.notFound("Membership"));

    const actorMembership = await this.repo.getForUser(orgId, actorId);
    if (!actorMembership) return err(AppError.forbidden());

    if (!hasPermission(actorMembership.role, "org:manage_roles") && actorMembership.role !== "org_admin") {
      return err(AppError.forbidden("Insufficient permissions to change roles"));
    }

    if (!canManageRole(actorMembership.role, newRole)) {
      return err(AppError.forbidden("Cannot assign a role equal to or above your own"));
    }

    if (membership.role === "org_owner" && newRole !== "org_owner") {
      const ownerCount = await this.repo.countByRole(orgId, "org_owner");
      if (ownerCount <= 1) {
        return err(AppError.badRequest("Cannot demote the last organization owner"));
      }
    }

    const oldRole = membership.role;
    const updated = await this.repo.updateRole(membership.id, newRole);
    if (!updated) return err(AppError.internal());

    await this.audit.emit({
      orgId,
      actorId,
      actorType: "user",
      action: "membership.role_changed",
      resourceType: "membership",
      resourceId: membership.id,
      metadata: { userId, oldRole, newRole },
    });

    return ok(updated);
  }

  async getForUser(orgId: OrgId, userId: UserId): Promise<Result<Membership>> {
    const membership = await this.repo.getForUser(orgId, userId);
    if (!membership) return err(AppError.notFound("Membership"));
    return ok(membership);
  }

  async listForOrg(orgId: OrgId, pagination?: PaginationParams): Promise<Result<PaginatedResult<Membership & { user: User }>>> {
    const memberships = await this.repo.listForOrg(orgId);
    const limit = Math.min(pagination?.limit ?? 20, 100);
    const startIdx = pagination?.cursor ? parseInt(pagination.cursor, 10) : 0;
    const slice = memberships.slice(startIdx, startIdx + limit);
    const nextCursor = startIdx + limit < memberships.length ? String(startIdx + limit) : undefined;
    return ok(paginatedResult(slice, memberships.length, nextCursor));
  }

  async listOrgsForUser(userId: UserId): Promise<Result<readonly Membership[]>> {
    const memberships = await this.repo.listForUser(userId);
    return ok(memberships);
  }
}
