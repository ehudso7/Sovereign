/**
 * Browser Session HTTP route tests.
 *
 * Tests the route handlers through the service layer using in-memory
 * test repositories. Validates status codes, response shapes,
 * auth enforcement, and state transitions.
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { OrgId, UserId, RunId } from "@sovereign/core";
import {
  toOrgId,
  toUserId,
  toRunId,
  toProjectId,
  toBrowserSessionId,
} from "@sovereign/core";
import { PgBrowserSessionService } from "../../services/browser-session.service.js";
import { PgAuditEmitter } from "../../services/audit.service.js";
import {
  createTestRepos,
  type TestRepos,
} from "../helpers/test-repos.js";

describe("Browser Session Routes (service-level contract)", () => {
  let repos: TestRepos;
  let browserService: PgBrowserSessionService;
  let orgId: OrgId;
  let userId: UserId;
  let runId: RunId;

  beforeEach(async () => {
    repos = createTestRepos();
    const auditEmitter = new PgAuditEmitter(repos.audit);
    browserService = new PgBrowserSessionService(
      repos.browserSessions,
      repos.runs,
      auditEmitter,
    );

    orgId = toOrgId("00000000-0000-0000-0000-aaaaaaaaaaaa");
    userId = toUserId("00000000-0000-0000-0000-bbbbbbbbbbbb");

    // Create prerequisite agent and run
    const agent = await repos.agents.create({
      orgId,
      projectId: toProjectId("00000000-0000-0000-0000-cccccccccccc"),
      name: "Test Agent",
      slug: "test-agent",
      createdBy: userId,
    });

    const version = await repos.agentVersions.create({
      orgId,
      agentId: agent.id,
      version: 1,
      goals: [],
      instructions: "test",
      tools: [],
      budget: null,
      approvalRules: [],
      memoryConfig: null,
      schedule: null,
      modelConfig: { provider: "local", model: "test" },
      createdBy: userId,
    });

    const run = await repos.runs.create({
      orgId,
      projectId: agent.projectId,
      agentId: agent.id,
      agentVersionId: version.id,
      triggerType: "manual",
      triggeredBy: userId,
      executionProvider: "local",
      configSnapshot: {},
    });
    runId = run.id;
  });

  describe("createSession", () => {
    it("creates a browser session (201 equivalent)", async () => {
      const result = await browserService.createSession(runId, orgId, userId);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.runId).toBe(runId);
        expect(result.value.orgId).toBe(orgId);
        expect(result.value.status).toBe("provisioning");
        expect(result.value.browserType).toBe("chromium");
      }
    });

    it("returns 404 for nonexistent run", async () => {
      const badRunId = toRunId("00000000-0000-0000-0000-ffffffffffff");
      const result = await browserService.createSession(badRunId, orgId, userId);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("getSession", () => {
    it("returns 200 for existing session", async () => {
      const create = await browserService.createSession(runId, orgId, userId);
      expect(create.ok).toBe(true);
      if (!create.ok) return;

      const result = await browserService.getSession(create.value.id, orgId);
      expect(result.ok).toBe(true);
    });

    it("returns 404 for wrong org", async () => {
      const create = await browserService.createSession(runId, orgId, userId);
      expect(create.ok).toBe(true);
      if (!create.ok) return;

      const otherOrgId = toOrgId("00000000-0000-0000-0000-dddddddddddd");
      const result = await browserService.getSession(create.value.id, otherOrgId);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("listSessions", () => {
    it("lists sessions for org", async () => {
      await browserService.createSession(runId, orgId, userId);
      await browserService.createSession(runId, orgId, userId);

      const result = await browserService.listSessions(orgId);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(2);
      }
    });

    it("filters by status", async () => {
      await browserService.createSession(runId, orgId, userId);

      const result = await browserService.listSessions(orgId, { status: "active" });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(0);
      }
    });
  });

  describe("takeover and release", () => {
    it("requestTakeover transitions active session", async () => {
      const create = await browserService.createSession(runId, orgId, userId);
      expect(create.ok).toBe(true);
      if (!create.ok) return;

      // Manually update to active state via repo
      await repos.browserSessions.updateStatus(create.value.id, orgId, "active");

      const result = await browserService.requestTakeover(create.value.id, orgId, userId);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe("human_control");
        expect(result.value.humanTakeover).toBe(true);
      }
    });

    it("releaseTakeover transitions back to active", async () => {
      const create = await browserService.createSession(runId, orgId, userId);
      expect(create.ok).toBe(true);
      if (!create.ok) return;

      await repos.browserSessions.updateStatus(create.value.id, orgId, "active");
      await browserService.requestTakeover(create.value.id, orgId, userId);

      const result = await browserService.releaseTakeover(create.value.id, orgId, userId);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe("active");
        expect(result.value.humanTakeover).toBe(false);
      }
    });
  });

  describe("closeSession", () => {
    it("closes an active session", async () => {
      const create = await browserService.createSession(runId, orgId, userId);
      expect(create.ok).toBe(true);
      if (!create.ok) return;

      await repos.browserSessions.updateStatus(create.value.id, orgId, "active");

      const result = await browserService.closeSession(create.value.id, orgId, userId);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe("closed");
      }
    });

    it("rejects close for already-closed session", async () => {
      const create = await browserService.createSession(runId, orgId, userId);
      expect(create.ok).toBe(true);
      if (!create.ok) return;

      await repos.browserSessions.updateStatus(create.value.id, orgId, "active");
      await browserService.closeSession(create.value.id, orgId, userId);

      const result = await browserService.closeSession(create.value.id, orgId, userId);
      expect(result.ok).toBe(false);
    });
  });

  describe("audit events", () => {
    it("emits browser.session_created audit event", async () => {
      await browserService.createSession(runId, orgId, userId);

      const events = await repos.audit.query(orgId, { action: "browser.session_created" });
      expect(events.length).toBe(1);
      expect(events[0]!.resourceType).toBe("browser_session");
    });

    it("emits browser.session_closed audit event", async () => {
      const create = await browserService.createSession(runId, orgId, userId);
      if (!create.ok) return;

      await repos.browserSessions.updateStatus(create.value.id, orgId, "active");
      await browserService.closeSession(create.value.id, orgId, userId);

      const events = await repos.audit.query(orgId, { action: "browser.session_closed" });
      expect(events.length).toBe(1);
    });

    it("emits takeover audit events", async () => {
      const create = await browserService.createSession(runId, orgId, userId);
      if (!create.ok) return;

      await repos.browserSessions.updateStatus(create.value.id, orgId, "active");
      await browserService.requestTakeover(create.value.id, orgId, userId);

      const requested = await repos.audit.query(orgId, { action: "browser.takeover_requested" });
      expect(requested.length).toBe(1);

      const started = await repos.audit.query(orgId, { action: "browser.takeover_started" });
      expect(started.length).toBe(1);
    });
  });

  describe("policy gating", () => {
    it("blocks risky actions by default", async () => {
      const create = await browserService.createSession(runId, orgId, userId);
      if (!create.ok) return;

      const result = await browserService.checkActionPolicy(
        { type: "download_file" },
        create.value.id,
        orgId,
        userId,
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.allowed).toBe(false);
      }
    });

    it("allows non-risky actions without policy check", async () => {
      const result = await browserService.checkActionPolicy(
        { type: "navigate", url: "https://example.com" },
        toBrowserSessionId("nonexistent"),
        orgId,
        userId,
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.allowed).toBe(true);
      }
    });
  });
});
