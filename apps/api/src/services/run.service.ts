// ---------------------------------------------------------------------------
// Run service — backed by RunRepo + RunStepRepo + AgentRepo + AgentVersionRepo
// ---------------------------------------------------------------------------

import { ok, err, AppError, isValidTransition } from "@sovereign/core";
import type {
  RunService,
  Run,
  RunStep,
  RunStatus,
  TriggerType,
  OrgId,
  UserId,
  AgentId,
  RunId,
  ProjectId,
  Result,
  AuditEmitter,
} from "@sovereign/core";
import type { RunRepo, RunStepRepo, AgentRepo, AgentVersionRepo } from "@sovereign/db";

export class PgRunService implements RunService {
  constructor(
    private readonly runRepo: RunRepo,
    private readonly runStepRepo: RunStepRepo,
    private readonly agentRepo: AgentRepo,
    private readonly versionRepo: AgentVersionRepo,
    private readonly audit: AuditEmitter,
  ) {}

  // ---------------------------------------------------------------------------
  // createRun
  // ---------------------------------------------------------------------------

  async createRun(
    agentId: AgentId,
    orgId: OrgId,
    triggeredBy: UserId,
    input?: Record<string, unknown>,
    triggerType?: TriggerType,
  ): Promise<Result<Run>> {
    try {
      // Validate agent exists and belongs to org
      const agent = await this.agentRepo.getById(agentId, orgId);
      if (!agent) {
        return err(AppError.notFound("Agent", agentId));
      }

      // Reject draft, unpublished, and archived agents
      if (agent.status !== "published") {
        return err(
          new AppError(
            "BAD_REQUEST",
            `Cannot create a run for an agent with status "${agent.status}". Agent must be published.`,
            400,
          ),
        );
      }

      // Validate that a published version exists
      const publishedVersion = await this.versionRepo.getPublished(agentId);
      if (!publishedVersion) {
        return err(
          new AppError(
            "BAD_REQUEST",
            "Agent does not have a published version. Publish a version before creating a run.",
            400,
          ),
        );
      }

      // Build config snapshot from the published version
      const configSnapshot: Record<string, unknown> = {
        agentName: agent.name,
        version: publishedVersion.version,
        instructions: publishedVersion.instructions,
        goals: publishedVersion.goals,
        tools: publishedVersion.tools,
        modelConfig: publishedVersion.modelConfig,
        budget: publishedVersion.budget,
        approvalRules: publishedVersion.approvalRules,
        memoryConfig: publishedVersion.memoryConfig,
      };

      const run = await this.runRepo.create({
        orgId,
        projectId: agent.projectId,
        agentId,
        agentVersionId: publishedVersion.id,
        triggerType: triggerType ?? "manual",
        triggeredBy,
        executionProvider: (publishedVersion.modelConfig.provider === "openai" ? "openai" : "local") as Run["executionProvider"],
        input: input ?? {},
        configSnapshot,
      });

      await this.audit.emit({
        orgId,
        actorId: triggeredBy,
        actorType: "user",
        action: "run.created",
        resourceType: "run",
        resourceId: run.id,
        metadata: {
          agentId,
          agentVersionId: publishedVersion.id,
          triggerType: triggerType ?? "manual",
        },
      });

      return ok(run);
    } catch (e) {
      return err(
        AppError.internal(e instanceof Error ? e.message : "Failed to create run"),
      );
    }
  }

  // ---------------------------------------------------------------------------
  // getRun
  // ---------------------------------------------------------------------------

  async getRun(runId: RunId, orgId: OrgId): Promise<Result<Run>> {
    const run = await this.runRepo.getById(runId, orgId);
    if (!run) return err(AppError.notFound("Run", runId));
    return ok(run);
  }

  // ---------------------------------------------------------------------------
  // listRuns
  // ---------------------------------------------------------------------------

  async listRuns(
    orgId: OrgId,
    filters?: { agentId?: AgentId; status?: RunStatus; projectId?: ProjectId },
  ): Promise<Result<Run[]>> {
    const runs = await this.runRepo.listForOrg(orgId, filters);
    return ok(runs);
  }

  // ---------------------------------------------------------------------------
  // listRunsForAgent
  // ---------------------------------------------------------------------------

  async listRunsForAgent(agentId: AgentId, orgId: OrgId): Promise<Result<Run[]>> {
    try {
      const agent = await this.agentRepo.getById(agentId, orgId);
      if (!agent) {
        return err(AppError.notFound("Agent", agentId));
      }
      const runs = await this.runRepo.listForAgent(agentId, orgId);
      return ok(runs);
    } catch (e) {
      return err(
        AppError.internal(e instanceof Error ? e.message : "Failed to list runs for agent"),
      );
    }
  }

  // ---------------------------------------------------------------------------
  // getRunSteps
  // ---------------------------------------------------------------------------

  async getRunSteps(runId: RunId, orgId: OrgId): Promise<Result<RunStep[]>> {
    // Verify run exists and belongs to org
    const run = await this.runRepo.getById(runId, orgId);
    if (!run) return err(AppError.notFound("Run", runId));

    const steps = await this.runStepRepo.listForRun(runId);
    return ok(steps);
  }

  // ---------------------------------------------------------------------------
  // pauseRun
  // ---------------------------------------------------------------------------

  async pauseRun(runId: RunId, orgId: OrgId, actorId: UserId): Promise<Result<Run>> {
    const run = await this.runRepo.getById(runId, orgId);
    if (!run) return err(AppError.notFound("Run", runId));

    const targetStatus: RunStatus = "paused";
    if (!isValidTransition(run.status, targetStatus)) {
      return err(
        new AppError(
          "BAD_REQUEST",
          `Cannot pause a run with status "${run.status}". Run must be in "running" status.`,
          400,
        ),
      );
    }

    const updated = await this.runRepo.updateStatus(runId, orgId, targetStatus);
    if (!updated) return err(AppError.internal("Failed to pause run"));

    await this.audit.emit({
      orgId,
      actorId,
      actorType: "user",
      action: "run.paused",
      resourceType: "run",
      resourceId: runId,
      metadata: { previousStatus: run.status },
    });

    return ok(updated);
  }

  // ---------------------------------------------------------------------------
  // resumeRun
  // ---------------------------------------------------------------------------

  async resumeRun(runId: RunId, orgId: OrgId, actorId: UserId): Promise<Result<Run>> {
    const run = await this.runRepo.getById(runId, orgId);
    if (!run) return err(AppError.notFound("Run", runId));

    const targetStatus: RunStatus = "running";
    if (!isValidTransition(run.status, targetStatus)) {
      return err(
        new AppError(
          "BAD_REQUEST",
          `Cannot resume a run with status "${run.status}". Run must be in "paused" status.`,
          400,
        ),
      );
    }

    const updated = await this.runRepo.updateStatus(runId, orgId, targetStatus);
    if (!updated) return err(AppError.internal("Failed to resume run"));

    await this.audit.emit({
      orgId,
      actorId,
      actorType: "user",
      action: "run.resumed",
      resourceType: "run",
      resourceId: runId,
      metadata: { previousStatus: run.status },
    });

    return ok(updated);
  }

  // ---------------------------------------------------------------------------
  // cancelRun
  // ---------------------------------------------------------------------------

  async cancelRun(runId: RunId, orgId: OrgId, actorId: UserId): Promise<Result<Run>> {
    const run = await this.runRepo.getById(runId, orgId);
    if (!run) return err(AppError.notFound("Run", runId));

    const targetStatus: RunStatus = "cancelling";
    if (!isValidTransition(run.status, targetStatus)) {
      return err(
        new AppError(
          "BAD_REQUEST",
          `Cannot cancel a run with status "${run.status}". Run must be in "queued", "running", or "paused" status.`,
          400,
        ),
      );
    }

    const updated = await this.runRepo.updateStatus(runId, orgId, targetStatus);
    if (!updated) return err(AppError.internal("Failed to cancel run"));

    await this.audit.emit({
      orgId,
      actorId,
      actorType: "user",
      action: "run.cancelled",
      resourceType: "run",
      resourceId: runId,
      metadata: { previousStatus: run.status },
    });

    return ok(updated);
  }
}
