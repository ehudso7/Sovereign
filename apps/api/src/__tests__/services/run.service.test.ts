import { describe, it, expect, beforeEach } from "vitest";
import type { OrgId, UserId, ProjectId, AgentId } from "@sovereign/core";
import { PgRunService } from "../../services/run.service.js";
import { PgOrgService } from "../../services/org.service.js";
import { PgProjectService } from "../../services/project.service.js";
import { PgAgentStudioService } from "../../services/agent-studio.service.js";
import { PgAuditEmitter } from "../../services/audit.service.js";
import {
  createTestRepos,
  TestAgentRepo,
  TestAgentVersionRepo,
  TestRunRepo,
  TestRunStepRepo,
  TestAuditRepo,
  TestProjectRepo,
  type TestRepos,
} from "../helpers/test-repos.js";

describe("RunService", () => {
  let repos: TestRepos;
  let ownerId: UserId;
  let orgId: OrgId;
  let projectId: ProjectId;
  let publishedAgentId: AgentId;

  // Shared repos that the agent studio and run service both use
  let sharedAgentRepo: TestAgentRepo;
  let sharedVersionRepo: TestAgentVersionRepo;
  let sharedRunRepo: TestRunRepo;
  let sharedStepRepo: TestRunStepRepo;
  let sharedAuditRepo: TestAuditRepo;
  let studio: PgAgentStudioService;
  let runService: PgRunService;

  beforeEach(async () => {
    repos = createTestRepos();
    const audit = new PgAuditEmitter(repos.audit);
    const orgService = new PgOrgService(repos.orgs, repos.memberships, audit);

    const owner = repos.users.createSync({ email: "owner@example.com", name: "Owner" });
    ownerId = owner.id;

    const orgResult = await orgService.create({ name: "Test Org", slug: "test-org" }, ownerId);
    expect(orgResult.ok).toBe(true);
    if (orgResult.ok) orgId = orgResult.value.id;

    const projectService = new PgProjectService(
      new TestProjectRepo(orgId),
      new PgAuditEmitter(new TestAuditRepo(orgId)),
    );
    const projectResult = await projectService.create(
      { orgId, name: "Test Project", slug: "test-project" },
      ownerId,
    );
    expect(projectResult.ok).toBe(true);
    if (projectResult.ok) projectId = projectResult.value.id;

    // Create shared repos that both studio and run service will use
    sharedAgentRepo = new TestAgentRepo();
    sharedVersionRepo = new TestAgentVersionRepo();
    sharedRunRepo = new TestRunRepo();
    sharedStepRepo = new TestRunStepRepo();
    sharedAuditRepo = new TestAuditRepo();

    studio = new PgAgentStudioService(
      sharedAgentRepo,
      sharedVersionRepo,
      new PgAuditEmitter(sharedAuditRepo),
    );
    runService = new PgRunService(
      sharedRunRepo,
      sharedStepRepo,
      sharedAgentRepo,
      sharedVersionRepo,
      new PgAuditEmitter(sharedAuditRepo),
    );

    // Create and publish an agent for use in run tests
    const agentResult = await studio.createAgent(
      { orgId, projectId, name: "Test Agent", slug: "test-agent" },
      ownerId,
    );
    expect(agentResult.ok).toBe(true);
    if (!agentResult.ok) return;
    publishedAgentId = agentResult.value.id;

    const versionResult = await studio.createVersion(
      {
        agentId: publishedAgentId,
        orgId,
        instructions: "Do useful work",
        modelConfig: { provider: "openai", model: "gpt-4o" },
      },
      ownerId,
    );
    expect(versionResult.ok).toBe(true);
    if (!versionResult.ok) return;

    const publishResult = await studio.publishVersion(
      publishedAgentId,
      versionResult.value.id,
      orgId,
    );
    expect(publishResult.ok).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // createRun
  // ---------------------------------------------------------------------------

  describe("createRun", () => {
    it("creates a run from a published agent version", async () => {
      const result = await runService.createRun(publishedAgentId, orgId, ownerId, { prompt: "hello" });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.orgId).toBe(orgId);
        expect(result.value.agentId).toBe(publishedAgentId);
        expect(result.value.status).toBe("queued");
        expect(result.value.triggerType).toBe("manual");
        expect(result.value.triggeredBy).toBe(ownerId);
        expect(result.value.input).toEqual({ prompt: "hello" });
        expect(result.value.configSnapshot).toBeDefined();
      }
    });

    it("rejects when agent not found", async () => {
      const result = await runService.createRun("nonexistent" as AgentId, orgId, ownerId);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });

    it("rejects when no published version exists (draft-only)", async () => {
      // Create a draft agent with no published version
      const draftAgent = await studio.createAgent(
        { orgId, projectId, name: "Draft Agent", slug: "draft-agent" },
        ownerId,
      );
      expect(draftAgent.ok).toBe(true);
      if (!draftAgent.ok) return;

      const result = await runService.createRun(draftAgent.value.id, orgId, ownerId);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("BAD_REQUEST");
    });

    it("rejects when agent is archived", async () => {
      // Archive the published agent
      await studio.archiveAgent(publishedAgentId, orgId);

      const result = await runService.createRun(publishedAgentId, orgId, ownerId);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("BAD_REQUEST");
    });
  });

  // ---------------------------------------------------------------------------
  // getRun
  // ---------------------------------------------------------------------------

  describe("getRun", () => {
    it("returns run by id", async () => {
      const created = await runService.createRun(publishedAgentId, orgId, ownerId);
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const result = await runService.getRun(created.value.id, orgId);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.id).toBe(created.value.id);
    });

    it("returns NOT_FOUND for wrong org", async () => {
      const created = await runService.createRun(publishedAgentId, orgId, ownerId);
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      // Create another org
      const otherUser = repos.users.createSync({ email: "other@example.com", name: "Other" });
      const audit = new PgAuditEmitter(repos.audit);
      const orgService = new PgOrgService(repos.orgs, repos.memberships, audit);
      const otherOrgResult = await orgService.create({ name: "Other Org", slug: "other-org" }, otherUser.id);
      expect(otherOrgResult.ok).toBe(true);
      if (!otherOrgResult.ok) return;

      const result = await runService.getRun(created.value.id, otherOrgResult.value.id);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  // ---------------------------------------------------------------------------
  // listRuns
  // ---------------------------------------------------------------------------

  describe("listRuns", () => {
    it("lists runs for org", async () => {
      await runService.createRun(publishedAgentId, orgId, ownerId);
      await runService.createRun(publishedAgentId, orgId, ownerId);

      const result = await runService.listRuns(orgId);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.length).toBe(2);
    });

    it("filters by agentId", async () => {
      await runService.createRun(publishedAgentId, orgId, ownerId);

      // Create another published agent using the shared studio
      const agent2 = await studio.createAgent(
        { orgId, projectId, name: "Agent 2", slug: "agent-2" },
        ownerId,
      );
      expect(agent2.ok).toBe(true);
      if (!agent2.ok) return;

      const v2 = await studio.createVersion(
        {
          agentId: agent2.value.id,
          orgId,
          instructions: "Agent 2 instructions",
          modelConfig: { provider: "openai", model: "gpt-4o" },
        },
        ownerId,
      );
      expect(v2.ok).toBe(true);
      if (!v2.ok) return;
      await studio.publishVersion(agent2.value.id, v2.value.id, orgId);
      await runService.createRun(agent2.value.id, orgId, ownerId);

      const result = await runService.listRuns(orgId, { agentId: publishedAgentId });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.length).toBe(1);
    });

    it("filters by status", async () => {
      await runService.createRun(publishedAgentId, orgId, ownerId);
      await runService.createRun(publishedAgentId, orgId, ownerId);

      // All runs start as queued
      const queuedResult = await runService.listRuns(orgId, { status: "queued" });
      expect(queuedResult.ok).toBe(true);
      if (queuedResult.ok) expect(queuedResult.value.length).toBe(2);

      const runningResult = await runService.listRuns(orgId, { status: "running" });
      expect(runningResult.ok).toBe(true);
      if (runningResult.ok) expect(runningResult.value.length).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // listRunsForAgent
  // ---------------------------------------------------------------------------

  describe("listRunsForAgent", () => {
    it("lists runs scoped to a specific agent", async () => {
      await runService.createRun(publishedAgentId, orgId, ownerId);
      await runService.createRun(publishedAgentId, orgId, ownerId);

      const result = await runService.listRunsForAgent(publishedAgentId, orgId);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.length).toBe(2);
    });

    it("returns NOT_FOUND for non-existent agent", async () => {
      const fakeAgentId = "00000000-0000-0000-0000-000000000099" as AgentId;
      const result = await runService.listRunsForAgent(fakeAgentId, orgId);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  // ---------------------------------------------------------------------------
  // pauseRun
  // ---------------------------------------------------------------------------

  describe("pauseRun", () => {
    it("pauses a running run", async () => {
      const created = await runService.createRun(publishedAgentId, orgId, ownerId);
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      // Transition to running via the repo directly: queued → starting → running
      await sharedRunRepo.updateStatus(created.value.id, orgId, "starting");
      await sharedRunRepo.updateStatus(created.value.id, orgId, "running");

      const result = await runService.pauseRun(created.value.id, orgId, ownerId);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.status).toBe("paused");
    });

    it("rejects when run is not running", async () => {
      const created = await runService.createRun(publishedAgentId, orgId, ownerId);
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      // Run is in "queued" status — cannot pause
      const result = await runService.pauseRun(created.value.id, orgId, ownerId);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("BAD_REQUEST");
    });
  });

  // ---------------------------------------------------------------------------
  // resumeRun
  // ---------------------------------------------------------------------------

  describe("resumeRun", () => {
    it("resumes a paused run", async () => {
      const created = await runService.createRun(publishedAgentId, orgId, ownerId);
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      // Transition to paused: queued → starting → running → paused
      await sharedRunRepo.updateStatus(created.value.id, orgId, "starting");
      await sharedRunRepo.updateStatus(created.value.id, orgId, "running");
      await sharedRunRepo.updateStatus(created.value.id, orgId, "paused");

      const result = await runService.resumeRun(created.value.id, orgId, ownerId);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.status).toBe("running");
    });

    it("rejects when run is not paused", async () => {
      const created = await runService.createRun(publishedAgentId, orgId, ownerId);
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      // Run is in "queued" status — cannot resume
      const result = await runService.resumeRun(created.value.id, orgId, ownerId);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("BAD_REQUEST");
    });
  });

  // ---------------------------------------------------------------------------
  // cancelRun
  // ---------------------------------------------------------------------------

  describe("cancelRun", () => {
    it("cancels a queued run (no workflow = immediate cancelled)", async () => {
      const created = await runService.createRun(publishedAgentId, orgId, ownerId);
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const result = await runService.cancelRun(created.value.id, orgId, ownerId);
      expect(result.ok).toBe(true);
      // Runs without a Temporal workflow go directly to "cancelled"
      if (result.ok) expect(result.value.status).toBe("cancelled");
    });

    it("cancels a running run (no workflow = immediate cancelled)", async () => {
      const created = await runService.createRun(publishedAgentId, orgId, ownerId);
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      // Transition to running
      await sharedRunRepo.updateStatus(created.value.id, orgId, "starting");
      await sharedRunRepo.updateStatus(created.value.id, orgId, "running");

      const result = await runService.cancelRun(created.value.id, orgId, ownerId);
      expect(result.ok).toBe(true);
      // Runs without a Temporal workflow go directly to "cancelled"
      if (result.ok) expect(result.value.status).toBe("cancelled");
    });

    it("rejects when run is already completed", async () => {
      const created = await runService.createRun(publishedAgentId, orgId, ownerId);
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      // Transition to completed: queued → starting → running → completed
      await sharedRunRepo.updateStatus(created.value.id, orgId, "starting");
      await sharedRunRepo.updateStatus(created.value.id, orgId, "running");
      await sharedRunRepo.updateStatus(created.value.id, orgId, "completed");

      const result = await runService.cancelRun(created.value.id, orgId, ownerId);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("BAD_REQUEST");
    });
  });
});
