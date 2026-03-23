// ---------------------------------------------------------------------------
// Invitation service — backed by InvitationRepo
// ---------------------------------------------------------------------------

import { ok, err, AppError } from "@sovereign/core";
import type {
  InvitationService,
  Invitation,
  CreateInvitationInput,
  Membership,
  OrgId,
  UserId,
  Result,
  AuditEmitter,
} from "@sovereign/core";
import type { InvitationRepo, MembershipRepo, UserRepo } from "@sovereign/db";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export class PgInvitationService implements InvitationService {
  constructor(
    private readonly invitationRepo: InvitationRepo,
    private readonly membershipRepo: MembershipRepo,
    private readonly userRepo: UserRepo,
    private readonly audit: AuditEmitter,
  ) {}

  async create(input: CreateInvitationInput): Promise<Result<Invitation>> {
    const existingUser = await this.userRepo.getByEmail(input.email);
    if (existingUser) {
      const existingMembership = await this.membershipRepo.getForUser(input.orgId, existingUser.id);
      if (existingMembership) {
        return err(AppError.conflict("User is already a member of this organization"));
      }
    }

    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS).toISOString();
    try {
      const invitation = await this.invitationRepo.create({
        orgId: input.orgId,
        email: input.email,
        role: input.role,
        invitedBy: input.invitedBy,
        expiresAt,
      });

      await this.audit.emit({
        orgId: input.orgId,
        actorId: input.invitedBy,
        actorType: "user",
        action: "invitation.created",
        resourceType: "invitation",
        resourceId: invitation.id,
        metadata: { email: input.email, role: input.role },
      });

      return ok(invitation);
    } catch (e) {
      return err(AppError.internal(e instanceof Error ? e.message : "Failed to create invitation"));
    }
  }

  async accept(invitationId: string, userId: UserId): Promise<Result<Membership>> {
    const invitation = await this.invitationRepo.getById(invitationId);
    if (!invitation) return err(AppError.notFound("Invitation", invitationId));

    if (invitation.acceptedAt) return err(AppError.conflict("Invitation already accepted"));

    if (new Date(invitation.expiresAt).getTime() < Date.now()) {
      return err(AppError.badRequest("Invitation has expired"));
    }

    const user = await this.userRepo.getById(userId);
    if (!user || user.email !== invitation.email) {
      return err(AppError.forbidden("This invitation is not for your email address"));
    }

    await this.invitationRepo.accept(invitationId);

    const membership = await this.membershipRepo.create({
      orgId: invitation.orgId,
      userId,
      role: invitation.role,
      invitedBy: invitation.invitedBy,
      accepted: true,
    });

    await this.audit.emit({
      orgId: invitation.orgId,
      actorId: userId,
      actorType: "user",
      action: "invitation.accepted",
      resourceType: "invitation",
      resourceId: invitation.id,
      metadata: { membershipId: membership.id },
    });

    return ok(membership);
  }

  async listForOrg(orgId: OrgId): Promise<Result<readonly Invitation[]>> {
    const invitations = await this.invitationRepo.listForOrg(orgId);
    return ok(invitations);
  }

  async revoke(invitationId: string, orgId: OrgId): Promise<Result<void>> {
    const invitation = await this.invitationRepo.getById(invitationId);
    if (!invitation || invitation.orgId !== orgId) {
      return err(AppError.notFound("Invitation", invitationId));
    }
    await this.invitationRepo.delete(invitationId);
    return ok(undefined);
  }
}
