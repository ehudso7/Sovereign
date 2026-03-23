// ---------------------------------------------------------------------------
// Organization service — backed by OrgRepo and MembershipRepo
// ---------------------------------------------------------------------------

import { ok, err, AppError, paginatedResult } from "@sovereign/core";
import type {
  OrgService,
  Organization,
  CreateOrgInput,
  UpdateOrgInput,
  OrgId,
  UserId,
  Result,
  PaginatedResult,
  PaginationParams,
  AuditEmitter,
} from "@sovereign/core";
import type { OrgRepo, MembershipRepo } from "@sovereign/db";

export class PgOrgService implements OrgService {
  constructor(
    private readonly orgRepo: OrgRepo,
    private readonly membershipRepo: MembershipRepo,
    private readonly audit: AuditEmitter,
  ) {}

  async create(input: CreateOrgInput, creatorId: UserId): Promise<Result<Organization>> {
    const existing = await this.orgRepo.getBySlug(input.slug);
    if (existing) {
      return err(AppError.conflict(`Organization with slug '${input.slug}' already exists`));
    }

    try {
      const org = await this.orgRepo.create({ name: input.name, slug: input.slug });

      await this.membershipRepo.create({
        orgId: org.id,
        userId: creatorId,
        role: "org_owner",
        accepted: true,
      });

      await this.audit.emit({
        orgId: org.id,
        actorId: creatorId,
        actorType: "user",
        action: "org.created",
        resourceType: "organization",
        resourceId: org.id,
        metadata: { name: org.name, slug: org.slug },
      });

      return ok(org);
    } catch (e) {
      return err(AppError.internal(e instanceof Error ? e.message : "Failed to create organization"));
    }
  }

  async getById(orgId: OrgId, userId: UserId): Promise<Result<Organization>> {
    const membership = await this.membershipRepo.getForUser(orgId, userId);
    if (!membership) return err(AppError.notFound("Organization", orgId));

    const org = await this.orgRepo.getById(orgId);
    if (!org) return err(AppError.notFound("Organization", orgId));

    return ok(org);
  }

  async update(orgId: OrgId, userId: UserId, input: UpdateOrgInput): Promise<Result<Organization>> {
    const membership = await this.membershipRepo.getForUser(orgId, userId);
    if (!membership) return err(AppError.notFound("Organization", orgId));

    const org = await this.orgRepo.update(orgId, input);
    if (!org) return err(AppError.notFound("Organization", orgId));

    await this.audit.emit({
      orgId,
      actorId: userId,
      actorType: "user",
      action: "org.updated",
      resourceType: "organization",
      resourceId: orgId,
      metadata: { changes: input },
    });

    return ok(org);
  }

  async listForUser(userId: UserId, pagination?: PaginationParams): Promise<Result<PaginatedResult<Organization>>> {
    const orgs = await this.orgRepo.listForUser(userId);
    const limit = Math.min(pagination?.limit ?? 20, 100);
    const startIdx = pagination?.cursor ? parseInt(pagination.cursor, 10) : 0;
    const slice = orgs.slice(startIdx, startIdx + limit);
    const nextCursor = startIdx + limit < orgs.length ? String(startIdx + limit) : undefined;
    return ok(paginatedResult(slice, orgs.length, nextCursor));
  }

  async checkSlugAvailable(slug: string): Promise<Result<boolean>> {
    const existing = await this.orgRepo.getBySlug(slug);
    return ok(!existing);
  }
}
