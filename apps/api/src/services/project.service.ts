// ---------------------------------------------------------------------------
// Project service — backed by ProjectRepo
// ---------------------------------------------------------------------------

import { ok, err, AppError, paginatedResult } from "@sovereign/core";
import type {
  ProjectService,
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  OrgId,
  UserId,
  ProjectId,
  Result,
  PaginatedResult,
  PaginationParams,
  AuditEmitter,
} from "@sovereign/core";
import type { ProjectRepo } from "@sovereign/db";

export class PgProjectService implements ProjectService {
  constructor(
    private readonly repo: ProjectRepo,
    private readonly audit: AuditEmitter,
  ) {}

  async create(input: CreateProjectInput, creatorId: UserId): Promise<Result<Project>> {
    const existing = (await this.repo.listForOrg(input.orgId)).find(
      (p) => p.slug === input.slug,
    );
    if (existing) {
      return err(AppError.conflict(`Project with slug '${input.slug}' already exists in this organization`));
    }

    try {
      const project = await this.repo.create({
        orgId: input.orgId,
        name: input.name,
        slug: input.slug,
        description: input.description,
      });

      await this.audit.emit({
        orgId: input.orgId,
        actorId: creatorId,
        actorType: "user",
        action: "project.created",
        resourceType: "project",
        resourceId: project.id,
        metadata: { name: project.name, slug: project.slug },
      });

      return ok(project);
    } catch (e) {
      return err(AppError.internal(e instanceof Error ? e.message : "Failed to create project"));
    }
  }

  async getById(projectId: ProjectId, orgId: OrgId): Promise<Result<Project>> {
    const project = await this.repo.getById(projectId, orgId);
    if (!project) return err(AppError.notFound("Project", projectId));
    return ok(project);
  }

  async update(projectId: ProjectId, orgId: OrgId, input: UpdateProjectInput): Promise<Result<Project>> {
    const project = await this.repo.getById(projectId, orgId);
    if (!project) return err(AppError.notFound("Project", projectId));

    if (input.slug && input.slug !== project.slug) {
      const existing = (await this.repo.listForOrg(orgId)).find(
        (p) => p.slug === input.slug && p.id !== projectId,
      );
      if (existing) {
        return err(AppError.conflict(`Project with slug '${input.slug}' already exists`));
      }
    }

    const updated = await this.repo.update(projectId, orgId, input);
    if (!updated) return err(AppError.internal());

    await this.audit.emit({
      orgId,
      actorType: "user",
      action: "project.updated",
      resourceType: "project",
      resourceId: projectId,
      metadata: { changes: input },
    });

    return ok(updated);
  }

  async listForOrg(orgId: OrgId, pagination?: PaginationParams): Promise<Result<PaginatedResult<Project>>> {
    const projects = await this.repo.listForOrg(orgId);
    const limit = Math.min(pagination?.limit ?? 20, 100);
    const startIdx = pagination?.cursor ? parseInt(pagination.cursor, 10) : 0;
    const slice = projects.slice(startIdx, startIdx + limit);
    const nextCursor = startIdx + limit < projects.length ? String(startIdx + limit) : undefined;
    return ok(paginatedResult(slice, projects.length, nextCursor));
  }

  async delete(projectId: ProjectId, orgId: OrgId): Promise<Result<void>> {
    const project = await this.repo.getById(projectId, orgId);
    if (!project) return err(AppError.notFound("Project", projectId));

    await this.repo.delete(projectId, orgId);

    await this.audit.emit({
      orgId,
      actorType: "user",
      action: "project.deleted",
      resourceType: "project",
      resourceId: projectId,
      metadata: { name: project.name },
    });

    return ok(undefined);
  }
}
