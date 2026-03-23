import { describe, it, expect, beforeEach } from "vitest";
import type { OrgId, UserId, ProjectId, AgentId } from "@sovereign/core";
import { PgAgentStudioService } from "../../services/agent-studio.service.js";
import { PgOrgService } from "../../services/org.service.js";
import { PgProjectService } from "../../services/project.service.js";
import { PgAuditEmitter } from "../../services/audit.service.js";
import {
  createTestRepos,
  TestAgentRepo,
  TestAgentVersionRepo,
  TestAuditRepo,
  TestProjectRepo,
  type TestRepos,
} from "../helpers/test-repos.js";

describe("AgentStudioService", () => {
  let repos: TestRepos;
  let ownerId: UserId;
  let orgId: OrgId;
  let projectId: ProjectId;

  function agentStudioForOrg(id: OrgId): PgAgentStudioService {
    const agentRepo = new TestAgentRepo(id);
    const versionRepo = new TestAgentVersionRepo(id);
    const auditRepo = new TestAuditRepo(id);
    return new PgAgentStudioService(agentRepo, versionRepo, new PgAuditEmitter(auditRepo));
  }

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
  });

  // ---------------------------------------------------------------------------
  // Agent CRUD
  // ---------------------------------------------------------------------------

  describe("createAgent", () => {
    it("creates an agent in draft status", async () => {
      const service = agentStudioForOrg(orgId);
      const result = await service.createAgent(
        { orgId, projectId, name: "My Agent", slug: "my-agent", description: "A test agent" },
        ownerId,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBe("My Agent");
        expect(result.value.slug).toBe("my-agent");
        expect(result.value.status).toBe("draft");
        expect(result.value.orgId).toBe(orgId);
        expect(result.value.projectId).toBe(projectId);
        expect(result.value.createdBy).toBe(ownerId);
      }
    });
  });

  describe("getAgent", () => {
    it("returns agent by id", async () => {
      const service = agentStudioForOrg(orgId);
      const created = await service.createAgent(
        { orgId, projectId, name: "Agent", slug: "agent" },
        ownerId,
      );
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const result = await service.getAgent(created.value.id, orgId);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.id).toBe(created.value.id);
    });

    it("returns NOT_FOUND for wrong org (cross-tenant protection)", async () => {
      const service = agentStudioForOrg(orgId);
      const created = await service.createAgent(
        { orgId, projectId, name: "Agent", slug: "agent" },
        ownerId,
      );
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const otherUser = repos.users.createSync({ email: "other@example.com", name: "Other" });
      const audit = new PgAuditEmitter(repos.audit);
      const orgService = new PgOrgService(repos.orgs, repos.memberships, audit);
      const otherOrgResult = await orgService.create({ name: "Other Org", slug: "other-org" }, otherUser.id);
      expect(otherOrgResult.ok).toBe(true);
      if (!otherOrgResult.ok) return;

      const otherService = agentStudioForOrg(otherOrgResult.value.id);
      const result = await otherService.getAgent(created.value.id, otherOrgResult.value.id);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("listAgents", () => {
    it("returns agents for org", async () => {
      const service = agentStudioForOrg(orgId);
      await service.createAgent({ orgId, projectId, name: "Agent 1", slug: "a1" }, ownerId);
      await service.createAgent({ orgId, projectId, name: "Agent 2", slug: "a2" }, ownerId);

      const result = await service.listAgents(orgId);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.length).toBe(2);
    });

    it("filters by status", async () => {
      const service = agentStudioForOrg(orgId);
      await service.createAgent({ orgId, projectId, name: "Agent 1", slug: "a1" }, ownerId);
      const created = await service.createAgent({ orgId, projectId, name: "Agent 2", slug: "a2" }, ownerId);
      expect(created.ok).toBe(true);
      if (created.ok) await service.archiveAgent(created.value.id, orgId);

      const result = await service.listAgents(orgId, { status: "draft" });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.length).toBe(1);
    });
  });

  describe("updateAgent", () => {
    it("updates agent name and description", async () => {
      const service = agentStudioForOrg(orgId);
      const created = await service.createAgent(
        { orgId, projectId, name: "Agent", slug: "agent" },
        ownerId,
      );
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const result = await service.updateAgent(created.value.id, orgId, {
        name: "Updated Agent",
        description: "New description",
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBe("Updated Agent");
        expect(result.value.description).toBe("New description");
      }
    });

    it("rejects updates to archived agents", async () => {
      const service = agentStudioForOrg(orgId);
      const created = await service.createAgent(
        { orgId, projectId, name: "Agent", slug: "agent" },
        ownerId,
      );
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      await service.archiveAgent(created.value.id, orgId);

      const result = await service.updateAgent(created.value.id, orgId, { name: "New Name" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    });
  });

  describe("archiveAgent", () => {
    it("archives an agent", async () => {
      const service = agentStudioForOrg(orgId);
      const created = await service.createAgent(
        { orgId, projectId, name: "Agent", slug: "agent" },
        ownerId,
      );
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const result = await service.archiveAgent(created.value.id, orgId);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.status).toBe("archived");
    });
  });

  // ---------------------------------------------------------------------------
  // Version management
  // ---------------------------------------------------------------------------

  describe("createVersion", () => {
    it("creates version 1 by default", async () => {
      const service = agentStudioForOrg(orgId);
      const agent = await service.createAgent(
        { orgId, projectId, name: "Agent", slug: "agent" },
        ownerId,
      );
      expect(agent.ok).toBe(true);
      if (!agent.ok) return;

      const result = await service.createVersion(
        { agentId: agent.value.id, orgId, instructions: "Do stuff" },
        ownerId,
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.version).toBe(1);
        expect(result.value.instructions).toBe("Do stuff");
        expect(result.value.published).toBe(false);
      }
    });

    it("auto-increments version number", async () => {
      const service = agentStudioForOrg(orgId);
      const agent = await service.createAgent(
        { orgId, projectId, name: "Agent", slug: "agent" },
        ownerId,
      );
      expect(agent.ok).toBe(true);
      if (!agent.ok) return;

      await service.createVersion({ agentId: agent.value.id, orgId }, ownerId);
      const result = await service.createVersion({ agentId: agent.value.id, orgId }, ownerId);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.version).toBe(2);
    });
  });

  describe("listVersions", () => {
    it("lists versions for an agent", async () => {
      const service = agentStudioForOrg(orgId);
      const agent = await service.createAgent(
        { orgId, projectId, name: "Agent", slug: "agent" },
        ownerId,
      );
      expect(agent.ok).toBe(true);
      if (!agent.ok) return;

      await service.createVersion({ agentId: agent.value.id, orgId }, ownerId);
      await service.createVersion({ agentId: agent.value.id, orgId }, ownerId);

      const result = await service.listVersions(agent.value.id, orgId);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.length).toBe(2);
    });

    it("returns NOT_FOUND for nonexistent agent", async () => {
      const service = agentStudioForOrg(orgId);
      const result = await service.listVersions("nonexistent" as AgentId, orgId);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("updateVersion", () => {
    it("updates a draft version", async () => {
      const service = agentStudioForOrg(orgId);
      const agent = await service.createAgent(
        { orgId, projectId, name: "Agent", slug: "agent" },
        ownerId,
      );
      expect(agent.ok).toBe(true);
      if (!agent.ok) return;

      const version = await service.createVersion(
        { agentId: agent.value.id, orgId, instructions: "v1" },
        ownerId,
      );
      expect(version.ok).toBe(true);
      if (!version.ok) return;

      const result = await service.updateVersion(version.value.id, orgId, {
        instructions: "updated instructions",
        goals: ["goal1"],
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.instructions).toBe("updated instructions");
        expect(result.value.goals).toEqual(["goal1"]);
      }
    });

    it("rejects updates to published versions", async () => {
      const service = agentStudioForOrg(orgId);
      const agent = await service.createAgent(
        { orgId, projectId, name: "Agent", slug: "agent" },
        ownerId,
      );
      expect(agent.ok).toBe(true);
      if (!agent.ok) return;

      const version = await service.createVersion(
        {
          agentId: agent.value.id,
          orgId,
          instructions: "Do stuff",
          modelConfig: { provider: "openai", model: "gpt-4o" },
        },
        ownerId,
      );
      expect(version.ok).toBe(true);
      if (!version.ok) return;

      await service.publishVersion(agent.value.id, version.value.id, orgId);

      const result = await service.updateVersion(version.value.id, orgId, {
        instructions: "changed",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    });
  });

  // ---------------------------------------------------------------------------
  // Publish / Unpublish
  // ---------------------------------------------------------------------------

  describe("publishVersion", () => {
    it("publishes a version and updates agent status", async () => {
      const service = agentStudioForOrg(orgId);
      const agent = await service.createAgent(
        { orgId, projectId, name: "Agent", slug: "agent" },
        ownerId,
      );
      expect(agent.ok).toBe(true);
      if (!agent.ok) return;

      const version = await service.createVersion(
        {
          agentId: agent.value.id,
          orgId,
          instructions: "Do something useful",
          modelConfig: { provider: "openai", model: "gpt-4o" },
        },
        ownerId,
      );
      expect(version.ok).toBe(true);
      if (!version.ok) return;

      const result = await service.publishVersion(agent.value.id, version.value.id, orgId);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.published).toBe(true);
        expect(result.value.publishedAt).toBeDefined();
      }

      // Agent status should be "published"
      const agentResult = await service.getAgent(agent.value.id, orgId);
      expect(agentResult.ok).toBe(true);
      if (agentResult.ok) expect(agentResult.value.status).toBe("published");
    });

    it("rejects publishing without instructions", async () => {
      const service = agentStudioForOrg(orgId);
      const agent = await service.createAgent(
        { orgId, projectId, name: "Agent", slug: "agent" },
        ownerId,
      );
      expect(agent.ok).toBe(true);
      if (!agent.ok) return;

      const version = await service.createVersion(
        { agentId: agent.value.id, orgId },
        ownerId,
      );
      expect(version.ok).toBe(true);
      if (!version.ok) return;

      const result = await service.publishVersion(agent.value.id, version.value.id, orgId);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("BAD_REQUEST");
    });

    it("rejects publishing for archived agent", async () => {
      const service = agentStudioForOrg(orgId);
      const agent = await service.createAgent(
        { orgId, projectId, name: "Agent", slug: "agent" },
        ownerId,
      );
      expect(agent.ok).toBe(true);
      if (!agent.ok) return;

      const version = await service.createVersion(
        {
          agentId: agent.value.id,
          orgId,
          instructions: "Do stuff",
          modelConfig: { provider: "openai", model: "gpt-4o" },
        },
        ownerId,
      );
      expect(version.ok).toBe(true);
      if (!version.ok) return;

      await service.archiveAgent(agent.value.id, orgId);

      const result = await service.publishVersion(agent.value.id, version.value.id, orgId);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    });

    it("unpublishes previous version when publishing a new one", async () => {
      const service = agentStudioForOrg(orgId);
      const agent = await service.createAgent(
        { orgId, projectId, name: "Agent", slug: "agent" },
        ownerId,
      );
      expect(agent.ok).toBe(true);
      if (!agent.ok) return;

      const v1 = await service.createVersion(
        {
          agentId: agent.value.id,
          orgId,
          instructions: "Version 1",
          modelConfig: { provider: "openai", model: "gpt-4o" },
        },
        ownerId,
      );
      expect(v1.ok).toBe(true);
      if (!v1.ok) return;

      await service.publishVersion(agent.value.id, v1.value.id, orgId);

      const v2 = await service.createVersion(
        {
          agentId: agent.value.id,
          orgId,
          instructions: "Version 2",
          modelConfig: { provider: "openai", model: "gpt-4o" },
        },
        ownerId,
      );
      expect(v2.ok).toBe(true);
      if (!v2.ok) return;

      await service.publishVersion(agent.value.id, v2.value.id, orgId);

      // v1 should be unpublished
      const v1Result = await service.getVersion(v1.value.id, orgId);
      expect(v1Result.ok).toBe(true);
      if (v1Result.ok) expect(v1Result.value.published).toBe(false);

      // v2 should be published
      const v2Result = await service.getVersion(v2.value.id, orgId);
      expect(v2Result.ok).toBe(true);
      if (v2Result.ok) expect(v2Result.value.published).toBe(true);
    });
  });

  describe("unpublishAgent", () => {
    it("unpublishes and sets agent status to draft", async () => {
      const service = agentStudioForOrg(orgId);
      const agent = await service.createAgent(
        { orgId, projectId, name: "Agent", slug: "agent" },
        ownerId,
      );
      expect(agent.ok).toBe(true);
      if (!agent.ok) return;

      const version = await service.createVersion(
        {
          agentId: agent.value.id,
          orgId,
          instructions: "Do stuff",
          modelConfig: { provider: "openai", model: "gpt-4o" },
        },
        ownerId,
      );
      expect(version.ok).toBe(true);
      if (!version.ok) return;

      await service.publishVersion(agent.value.id, version.value.id, orgId);

      const result = await service.unpublishAgent(agent.value.id, orgId);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.status).toBe("draft");

      // Version should be unpublished
      const vResult = await service.getVersion(version.value.id, orgId);
      expect(vResult.ok).toBe(true);
      if (vResult.ok) expect(vResult.value.published).toBe(false);
    });
  });
});
