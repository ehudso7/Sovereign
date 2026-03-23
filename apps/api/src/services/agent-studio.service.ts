// ---------------------------------------------------------------------------
// Agent Studio service — backed by AgentRepo + AgentVersionRepo
// ---------------------------------------------------------------------------

import { ok, err, AppError } from "@sovereign/core";
import type {
  AgentStudioService,
  Agent,
  AgentVersion,
  AgentStatus,
  CreateAgentInput,
  UpdateAgentInput,
  CreateAgentVersionInput,
  UpdateAgentVersionInput,
  OrgId,
  UserId,
  AgentId,
  AgentVersionId,
  ProjectId,
  Result,
  AuditEmitter,
} from "@sovereign/core";
import type { AgentRepo, AgentVersionRepo } from "@sovereign/db";

const DEFAULT_MODEL_CONFIG = {
  provider: "openai",
  model: "gpt-4o",
  temperature: 0.7,
  maxTokens: 4096,
} as const;

export class PgAgentStudioService implements AgentStudioService {
  constructor(
    private readonly agentRepo: AgentRepo,
    private readonly versionRepo: AgentVersionRepo,
    private readonly audit: AuditEmitter,
  ) {}

  // ---------------------------------------------------------------------------
  // Agent CRUD
  // ---------------------------------------------------------------------------

  async createAgent(input: CreateAgentInput, createdBy: UserId): Promise<Result<Agent>> {
    try {
      const agent = await this.agentRepo.create({
        orgId: input.orgId,
        projectId: input.projectId,
        name: input.name,
        slug: input.slug,
        description: input.description,
        createdBy,
      });

      await this.audit.emit({
        orgId: input.orgId,
        actorId: createdBy,
        actorType: "user",
        action: "agent.created",
        resourceType: "agent",
        resourceId: agent.id,
        metadata: { name: agent.name, slug: agent.slug, projectId: input.projectId },
      });

      return ok(agent);
    } catch (e) {
      return err(AppError.internal(e instanceof Error ? e.message : "Failed to create agent"));
    }
  }

  async getAgent(id: AgentId, orgId: OrgId): Promise<Result<Agent>> {
    const agent = await this.agentRepo.getById(id, orgId);
    if (!agent) return err(AppError.notFound("Agent", id));
    return ok(agent);
  }

  async listAgents(
    orgId: OrgId,
    filters?: { projectId?: ProjectId; status?: AgentStatus },
  ): Promise<Result<Agent[]>> {
    const agents = await this.agentRepo.listForOrg(orgId, filters);
    return ok(agents);
  }

  async updateAgent(
    id: AgentId,
    orgId: OrgId,
    input: UpdateAgentInput,
  ): Promise<Result<Agent>> {
    const agent = await this.agentRepo.getById(id, orgId);
    if (!agent) return err(AppError.notFound("Agent", id));

    if (agent.status === "archived") {
      return err(new AppError("FORBIDDEN", "Cannot update an archived agent", 403));
    }

    const updated = await this.agentRepo.update(id, orgId, {
      name: input.name,
      description: input.description,
    });
    if (!updated) return err(AppError.internal());

    await this.audit.emit({
      orgId,
      actorType: "user",
      action: "agent.updated",
      resourceType: "agent",
      resourceId: id,
      metadata: { changes: input },
    });

    return ok(updated);
  }

  async archiveAgent(id: AgentId, orgId: OrgId): Promise<Result<Agent>> {
    const agent = await this.agentRepo.getById(id, orgId);
    if (!agent) return err(AppError.notFound("Agent", id));

    // Unpublish any published versions first
    await this.versionRepo.unpublishAll(id);

    const archived = await this.agentRepo.updateStatus(id, orgId, "archived");
    if (!archived) return err(AppError.internal());

    await this.audit.emit({
      orgId,
      actorType: "user",
      action: "agent.archived",
      resourceType: "agent",
      resourceId: id,
      metadata: { name: agent.name },
    });

    return ok(archived);
  }

  // ---------------------------------------------------------------------------
  // Version management
  // ---------------------------------------------------------------------------

  async createVersion(
    input: CreateAgentVersionInput,
    createdBy: UserId,
  ): Promise<Result<AgentVersion>> {
    try {
      const latestVersion = await this.versionRepo.getLatestVersion(input.agentId);
      const nextVersion = latestVersion + 1;

      const modelConfig = input.modelConfig ?? DEFAULT_MODEL_CONFIG;

      const version = await this.versionRepo.create({
        orgId: input.orgId,
        agentId: input.agentId,
        version: nextVersion,
        goals: input.goals ?? [],
        instructions: input.instructions ?? "",
        tools: input.tools ?? [],
        budget: input.budget ?? null,
        approvalRules: input.approvalRules ?? [],
        memoryConfig: input.memoryConfig ?? null,
        schedule: input.schedule ?? null,
        modelConfig,
        createdBy,
      });

      await this.audit.emit({
        orgId: input.orgId,
        actorId: createdBy,
        actorType: "user",
        action: "agent_version.created",
        resourceType: "agent_version",
        resourceId: version.id,
        metadata: { agentId: input.agentId, version: nextVersion },
      });

      return ok(version);
    } catch (e) {
      return err(AppError.internal(e instanceof Error ? e.message : "Failed to create agent version"));
    }
  }

  async getVersion(id: AgentVersionId, orgId: OrgId): Promise<Result<AgentVersion>> {
    const version = await this.versionRepo.getById(id, orgId);
    if (!version) return err(AppError.notFound("AgentVersion", id));
    return ok(version);
  }

  async listVersions(agentId: AgentId, orgId: OrgId): Promise<Result<AgentVersion[]>> {
    // Verify agent exists and belongs to org
    const agent = await this.agentRepo.getById(agentId, orgId);
    if (!agent) return err(AppError.notFound("Agent", agentId));

    const versions = await this.versionRepo.listForAgent(agentId);
    return ok(versions);
  }

  async updateVersion(
    id: AgentVersionId,
    orgId: OrgId,
    input: UpdateAgentVersionInput,
  ): Promise<Result<AgentVersion>> {
    const version = await this.versionRepo.getById(id, orgId);
    if (!version) return err(AppError.notFound("AgentVersion", id));

    if (version.published) {
      return err(new AppError("FORBIDDEN", "Published versions are immutable", 403));
    }

    const updated = await this.versionRepo.update(id, orgId, {
      goals: input.goals,
      instructions: input.instructions,
      tools: input.tools,
      budget: input.budget,
      approvalRules: input.approvalRules,
      memoryConfig: input.memoryConfig,
      schedule: input.schedule,
      modelConfig: input.modelConfig,
    });
    if (!updated) return err(AppError.internal());

    await this.audit.emit({
      orgId,
      actorType: "user",
      action: "agent_version.updated",
      resourceType: "agent_version",
      resourceId: id,
      metadata: { changes: input },
    });

    return ok(updated);
  }

  // ---------------------------------------------------------------------------
  // Publish / Unpublish
  // ---------------------------------------------------------------------------

  async publishVersion(
    agentId: AgentId,
    versionId: AgentVersionId,
    orgId: OrgId,
  ): Promise<Result<AgentVersion>> {
    // Validate agent exists and is not archived
    const agent = await this.agentRepo.getById(agentId, orgId);
    if (!agent) return err(AppError.notFound("Agent", agentId));

    if (agent.status === "archived") {
      return err(new AppError("FORBIDDEN", "Cannot publish a version for an archived agent", 403));
    }

    // Validate version exists and belongs to agent
    const version = await this.versionRepo.getById(versionId, orgId);
    if (!version) return err(AppError.notFound("AgentVersion", versionId));

    if (version.agentId !== agentId) {
      return err(new AppError("BAD_REQUEST", "Version does not belong to this agent", 400));
    }

    // Validate version has non-empty instructions
    if (!version.instructions || version.instructions.trim().length === 0) {
      return err(new AppError("BAD_REQUEST", "Cannot publish: instructions are required", 400));
    }

    // Validate version has valid model config
    if (!version.modelConfig?.provider || !version.modelConfig?.model) {
      return err(new AppError("BAD_REQUEST", "Cannot publish: model config must include provider and model", 400));
    }

    // Unpublish any currently published version
    await this.versionRepo.unpublishAll(agentId);

    // Publish the new version
    const published = await this.versionRepo.publish(versionId, orgId);
    if (!published) return err(AppError.internal());

    // Set agent status to published
    await this.agentRepo.updateStatus(agentId, orgId, "published");

    await this.audit.emit({
      orgId,
      actorType: "user",
      action: "agent_version.published",
      resourceType: "agent_version",
      resourceId: versionId,
      metadata: { agentId, version: version.version },
    });

    return ok(published);
  }

  async unpublishAgent(agentId: AgentId, orgId: OrgId): Promise<Result<Agent>> {
    const agent = await this.agentRepo.getById(agentId, orgId);
    if (!agent) return err(AppError.notFound("Agent", agentId));

    // Unpublish all versions
    await this.versionRepo.unpublishAll(agentId);

    // Set agent status back to draft
    const updated = await this.agentRepo.updateStatus(agentId, orgId, "draft");
    if (!updated) return err(AppError.internal());

    await this.audit.emit({
      orgId,
      actorType: "user",
      action: "agent.unpublished",
      resourceType: "agent",
      resourceId: agentId,
      metadata: { name: agent.name },
    });

    return ok(updated);
  }
}
