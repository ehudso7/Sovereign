/**
 * Terminal Session route tests (service-level contract) — Phase 15c.
 *
 * Tests the TerminalSessionService directly (in-memory, no DB repos needed).
 * Validates create, list, get, close, resize, audit events, and tenant isolation.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  toOrgId,
  toUserId,
  toTerminalSessionId,
} from "@sovereign/core";
import { TerminalSessionService } from "../../services/terminal-session.service.js";
import { PgAuditEmitter } from "../../services/audit.service.js";
import {
  createTestRepos,
  type TestRepos,
} from "../helpers/test-repos.js";

const ORG_A = toOrgId("00000000-0000-0000-0000-aaaaaaaaaaaa");
const ORG_B = toOrgId("00000000-0000-0000-0000-bbbbbbbbbbbb");
const USER_A = toUserId("00000000-0000-0000-0000-cccccccccccc");
const USER_B = toUserId("00000000-0000-0000-0000-dddddddddddd");

describe("Terminal Session Routes (service-level contract)", () => {
  let repos: TestRepos;
  let svcA: TerminalSessionService;
  let svcB: TerminalSessionService;

  beforeEach(() => {
    repos = createTestRepos();
    const auditEmitter = new PgAuditEmitter(repos.audit);
    svcA = new TerminalSessionService(ORG_A, auditEmitter);
    svcB = new TerminalSessionService(ORG_B, auditEmitter);
  });

  // =========================================================================
  // POST create session
  // =========================================================================

  describe("POST create session", () => {
    it("creates a session with correct defaults", async () => {
      const result = await svcA.createSession({
        orgId: ORG_A,
        userId: USER_A,
        metadata: {},
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.orgId).toBe(ORG_A);
      expect(result.value.userId).toBe(USER_A);
      expect(result.value.status).toBe("active");
      expect(result.value.startedAt).toBeDefined();
      expect(result.value.lastActive).toBeDefined();
      expect(result.value.closedAt).toBeNull();
      expect(result.value.containerId).toBeNull();
      expect(result.value.id).toBeDefined();
    });

    it("returns active status on creation", async () => {
      const result = await svcA.createSession({
        orgId: ORG_A,
        userId: USER_A,
        metadata: { shell: "/bin/bash" },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.status).toBe("active");
    });

    it("preserves metadata on creation", async () => {
      const result = await svcA.createSession({
        orgId: ORG_A,
        userId: USER_A,
        metadata: { shell: "/bin/zsh", cols: 120, rows: 40 },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.metadata).toEqual({ shell: "/bin/zsh", cols: 120, rows: 40 });
    });
  });

  // =========================================================================
  // GET list sessions
  // =========================================================================

  describe("GET list sessions", () => {
    it("returns user's sessions", async () => {
      await svcA.createSession({ orgId: ORG_A, userId: USER_A, metadata: {} });
      await svcA.createSession({ orgId: ORG_A, userId: USER_A, metadata: {} });

      const result = await svcA.listSessions({ userId: USER_A });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.length).toBe(2);
    });

    it("does not return other user's sessions", async () => {
      await svcA.createSession({ orgId: ORG_A, userId: USER_A, metadata: {} });
      await svcA.createSession({ orgId: ORG_A, userId: USER_B, metadata: {} });

      const result = await svcA.listSessions({ userId: USER_A });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.length).toBe(1);
      expect(result.value[0]!.userId).toBe(USER_A);
    });

    it("filters by status", async () => {
      const createResult = await svcA.createSession({ orgId: ORG_A, userId: USER_A, metadata: {} });
      await svcA.createSession({ orgId: ORG_A, userId: USER_A, metadata: {} });

      // Close the first session
      if (createResult.ok) {
        await svcA.closeSession(createResult.value.id);
      }

      const activeResult = await svcA.listSessions({ userId: USER_A, status: "active" });
      expect(activeResult.ok).toBe(true);
      if (!activeResult.ok) return;
      expect(activeResult.value.length).toBe(1);

      const closedResult = await svcA.listSessions({ userId: USER_A, status: "closed" });
      expect(closedResult.ok).toBe(true);
      if (!closedResult.ok) return;
      expect(closedResult.value.length).toBe(1);
    });
  });

  // =========================================================================
  // GET session by ID
  // =========================================================================

  describe("GET session by ID", () => {
    it("returns session detail", async () => {
      const createResult = await svcA.createSession({
        orgId: ORG_A,
        userId: USER_A,
        metadata: { shell: "/bin/bash" },
      });

      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      const result = await svcA.getSession(createResult.value.id);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.id).toBe(createResult.value.id);
      expect(result.value.metadata).toEqual({ shell: "/bin/bash" });
    });

    it("returns not-found for invalid ID", async () => {
      const result = await svcA.getSession(
        toTerminalSessionId("00000000-0000-0000-0000-ffffffffffff"),
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  // =========================================================================
  // POST close session
  // =========================================================================

  describe("POST close session", () => {
    it("transitions to closed status", async () => {
      const createResult = await svcA.createSession({
        orgId: ORG_A,
        userId: USER_A,
        metadata: {},
      });
      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      const closeResult = await svcA.closeSession(createResult.value.id);
      expect(closeResult.ok).toBe(true);
      if (!closeResult.ok) return;
      expect(closeResult.value.status).toBe("closed");
      expect(closeResult.value.closedAt).toBeDefined();
      expect(closeResult.value.closedAt).not.toBeNull();
    });

    it("emits audit event on close", async () => {
      const createResult = await svcA.createSession({
        orgId: ORG_A,
        userId: USER_A,
        metadata: {},
      });
      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      await svcA.closeSession(createResult.value.id);

      const events = await repos.audit.query(ORG_A, {
        action: "terminal.session_closed" as never,
      });
      expect(events.length).toBe(1);
      expect(events[0]!.resourceType).toBe("terminal_session");
    });

    it("returns not-found when closing invalid session", async () => {
      const result = await svcA.closeSession(
        toTerminalSessionId("00000000-0000-0000-0000-ffffffffffff"),
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  // =========================================================================
  // POST resize
  // =========================================================================

  describe("POST resize", () => {
    it("updates metadata with cols/rows", async () => {
      const createResult = await svcA.createSession({
        orgId: ORG_A,
        userId: USER_A,
        metadata: {},
      });
      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      const resizeResult = await svcA.updateSessionMetadata(
        createResult.value.id,
        { cols: 120, rows: 40 },
      );
      expect(resizeResult.ok).toBe(true);
      if (!resizeResult.ok) return;
      expect(resizeResult.value.metadata).toEqual({ cols: 120, rows: 40 });
    });

    it("merges metadata with existing values", async () => {
      const createResult = await svcA.createSession({
        orgId: ORG_A,
        userId: USER_A,
        metadata: { shell: "/bin/bash" },
      });
      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      const resizeResult = await svcA.updateSessionMetadata(
        createResult.value.id,
        { cols: 80, rows: 24 },
      );
      expect(resizeResult.ok).toBe(true);
      if (!resizeResult.ok) return;
      expect(resizeResult.value.metadata).toEqual({
        shell: "/bin/bash",
        cols: 80,
        rows: 24,
      });
    });

    it("returns not-found for invalid session", async () => {
      const result = await svcA.updateSessionMetadata(
        toTerminalSessionId("00000000-0000-0000-0000-ffffffffffff"),
        { cols: 80, rows: 24 },
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  // =========================================================================
  // Audit events
  // =========================================================================

  describe("audit events", () => {
    it("emits terminal.session_created on create", async () => {
      await svcA.createSession({ orgId: ORG_A, userId: USER_A, metadata: {} });

      const events = await repos.audit.query(ORG_A, {
        action: "terminal.session_created" as never,
      });
      expect(events.length).toBe(1);
      expect(events[0]!.resourceType).toBe("terminal_session");
    });
  });

  // =========================================================================
  // Tenant isolation
  // =========================================================================

  describe("tenant isolation", () => {
    it("org B cannot see org A sessions", async () => {
      const createResult = await svcA.createSession({
        orgId: ORG_A,
        userId: USER_A,
        metadata: {},
      });
      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      // Org B service cannot get the session by ID
      const getResult = await svcB.getSession(createResult.value.id);
      expect(getResult.ok).toBe(false);
      if (getResult.ok) return;
      expect(getResult.error.code).toBe("NOT_FOUND");
    });

    it("org B list does not include org A sessions", async () => {
      await svcA.createSession({ orgId: ORG_A, userId: USER_A, metadata: {} });
      await svcB.createSession({ orgId: ORG_B, userId: USER_A, metadata: {} });

      const resultA = await svcA.listSessions({ userId: USER_A });
      const resultB = await svcB.listSessions({ userId: USER_A });

      expect(resultA.ok).toBe(true);
      expect(resultB.ok).toBe(true);
      if (!resultA.ok || !resultB.ok) return;

      expect(resultA.value.length).toBe(1);
      expect(resultA.value[0]!.orgId).toBe(ORG_A);

      expect(resultB.value.length).toBe(1);
      expect(resultB.value[0]!.orgId).toBe(ORG_B);
    });

    it("org B cannot close org A session", async () => {
      const createResult = await svcA.createSession({
        orgId: ORG_A,
        userId: USER_A,
        metadata: {},
      });
      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      const closeResult = await svcB.closeSession(createResult.value.id);
      expect(closeResult.ok).toBe(false);
      if (closeResult.ok) return;
      expect(closeResult.error.code).toBe("NOT_FOUND");
    });
  });
});
