import { describe, it, expect, beforeEach, vi } from "vitest";
import { PgBrowserSessionService } from "../../services/browser-session.service.js";
import {
  toOrgId,
  toUserId,
  toRunId,
  toAgentId,
  toAgentVersionId,
  toProjectId,
  toBrowserSessionId,
  toISODateString,
} from "@sovereign/core";
import type {
  BrowserSession,
  BrowserSessionStatus,
  Run,
  AuditEmitter,
} from "@sovereign/core";
import type { BrowserSessionRepo, RunRepo } from "@sovereign/db";
import type { ObjectStorageService } from "../../services/storage.service.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const TEST_ORG_ID = toOrgId("00000000-0000-0000-0000-000000000001");
const TEST_USER_ID = toUserId("00000000-0000-0000-0000-000000000002");
const TEST_RUN_ID = toRunId("00000000-0000-0000-0000-000000000003");
const TEST_AGENT_ID = toAgentId("00000000-0000-0000-0000-000000000004");
const TEST_SESSION_ID = toBrowserSessionId("00000000-0000-0000-0000-000000000005");

function makeSession(overrides: Partial<BrowserSession> = {}): BrowserSession {
  return {
    id: TEST_SESSION_ID,
    orgId: TEST_ORG_ID,
    runId: TEST_RUN_ID,
    agentId: TEST_AGENT_ID,
    status: "active" as BrowserSessionStatus,
    browserType: "chromium",
    currentUrl: null,
    humanTakeover: false,
    takeoverBy: null,
    sessionRef: null,
    artifactKeys: [],
    metadata: {},
    createdBy: TEST_USER_ID,
    startedAt: null,
    lastActivityAt: null,
    endedAt: null,
    createdAt: toISODateString("2026-01-01T00:00:00Z"),
    updatedAt: toISODateString("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function makeRun(): Run {
  return {
    id: TEST_RUN_ID,
    orgId: TEST_ORG_ID,
    projectId: toProjectId("00000000-0000-0000-0000-000000000006"),
    agentId: TEST_AGENT_ID,
    agentVersionId: toAgentVersionId("00000000-0000-0000-0000-000000000007"),
    status: "running",
    triggerType: "manual",
    triggeredBy: TEST_USER_ID,
    executionProvider: "local",
    input: {},
    configSnapshot: {},
    output: null,
    error: null,
    tokenUsage: null,
    costCents: null,
    attemptCount: 1,
    temporalWorkflowId: null,
    startedAt: null,
    completedAt: null,
    createdAt: toISODateString("2026-01-01T00:00:00Z"),
    updatedAt: toISODateString("2026-01-01T00:00:00Z"),
  };
}

function createMockSessionRepo(): BrowserSessionRepo {
  return {
    create: vi.fn(),
    getById: vi.fn(),
    listForOrg: vi.fn(),
    listForRun: vi.fn(),
    updateStatus: vi.fn(),
    delete: vi.fn(),
  };
}

function createMockRunRepo(): RunRepo {
  return {
    create: vi.fn(),
    getById: vi.fn(),
    listForOrg: vi.fn(),
    listForAgent: vi.fn(),
    updateStatus: vi.fn(),
    delete: vi.fn(),
  };
}

function createMockAudit(): AuditEmitter {
  return {
    emit: vi.fn(),
    query: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue(null),
  };
}

function createMockStorage(): Pick<ObjectStorageService, "putObject" | "getObject"> {
  return {
    putObject: vi.fn(),
    getObject: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PgBrowserSessionService", () => {
  let service: PgBrowserSessionService;
  let sessionRepo: ReturnType<typeof createMockSessionRepo>;
  let runRepo: ReturnType<typeof createMockRunRepo>;
  let audit: ReturnType<typeof createMockAudit>;
  let storage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    sessionRepo = createMockSessionRepo();
    runRepo = createMockRunRepo();
    audit = createMockAudit();
    storage = createMockStorage();
    service = new PgBrowserSessionService(sessionRepo, runRepo, audit);
  });

  describe("createSession", () => {
    it("creates session and emits audit event", async () => {
      const run = makeRun();
      (runRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(run);
      const session = makeSession({ status: "provisioning" });
      (sessionRepo.create as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const result = await service.createSession(TEST_RUN_ID, TEST_ORG_ID, TEST_USER_ID);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBe(TEST_SESSION_ID);
      }
      expect(audit.emit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "browser.session_created" }),
      );
    });

    it("returns NOT_FOUND when run doesn't exist", async () => {
      (runRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.createSession(TEST_RUN_ID, TEST_ORG_ID, TEST_USER_ID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("getSession", () => {
    it("returns session", async () => {
      const session = makeSession();
      (sessionRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const result = await service.getSession(TEST_SESSION_ID, TEST_ORG_ID);

      expect(result.ok).toBe(true);
    });

    it("returns NOT_FOUND when session doesn't exist", async () => {
      (sessionRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.getSession(TEST_SESSION_ID, TEST_ORG_ID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("requestTakeover", () => {
    it("transitions active session to human_control", async () => {
      const session = makeSession({ status: "active" });
      (sessionRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(session);
      const takeoverSession = makeSession({ status: "takeover_requested", humanTakeover: true });
      const controlSession = makeSession({ status: "human_control", humanTakeover: true });
      (sessionRepo.updateStatus as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(takeoverSession)
        .mockResolvedValueOnce(controlSession);

      const result = await service.requestTakeover(TEST_SESSION_ID, TEST_ORG_ID, TEST_USER_ID);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe("human_control");
      }
      expect(audit.emit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "browser.takeover_requested" }),
      );
      expect(audit.emit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "browser.takeover_started" }),
      );
    });

    it("rejects takeover for closed session", async () => {
      const session = makeSession({ status: "closed" });
      (sessionRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const result = await service.requestTakeover(TEST_SESSION_ID, TEST_ORG_ID, TEST_USER_ID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("BAD_REQUEST");
      }
    });
  });

  describe("releaseTakeover", () => {
    it("transitions human_control session back to active", async () => {
      const session = makeSession({ status: "human_control", humanTakeover: true });
      (sessionRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(session);
      const released = makeSession({ status: "active", humanTakeover: false });
      (sessionRepo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(released);

      const result = await service.releaseTakeover(TEST_SESSION_ID, TEST_ORG_ID, TEST_USER_ID);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe("active");
        expect(result.value.humanTakeover).toBe(false);
      }
      expect(audit.emit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "browser.takeover_released" }),
      );
    });

    it("rejects release for non-takeover session", async () => {
      const session = makeSession({ status: "active" });
      (sessionRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const result = await service.releaseTakeover(TEST_SESSION_ID, TEST_ORG_ID, TEST_USER_ID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("BAD_REQUEST");
      }
    });
  });

  describe("closeSession", () => {
    it("closes an active session through closing → closed", async () => {
      const session = makeSession({ status: "active" });
      (sessionRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(session);
      const closing = makeSession({ status: "closing" });
      const closed = makeSession({ status: "closed" });
      (sessionRepo.updateStatus as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(closing)
        .mockResolvedValueOnce(closed);

      const result = await service.closeSession(TEST_SESSION_ID, TEST_ORG_ID, TEST_USER_ID);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe("closed");
      }
      expect(audit.emit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "browser.session_closed" }),
      );
    });

    it("rejects close for already-closed session", async () => {
      const session = makeSession({ status: "closed" });
      (sessionRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const result = await service.closeSession(TEST_SESSION_ID, TEST_ORG_ID, TEST_USER_ID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("BAD_REQUEST");
      }
    });
  });

  describe("artifact storage", () => {
    it("uploads artifact, updates artifact keys, and emits audit event", async () => {
      const session = makeSession();
      (sessionRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(session);
      (storage.putObject as ReturnType<typeof vi.fn>).mockResolvedValue({
        key: "orgs/test/browser-sessions/session-1/test.txt",
        sizeBytes: 11,
      });
      (sessionRepo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeSession({ artifactKeys: ["orgs/test/browser-sessions/session-1/test.txt"] }),
      );
      service.setStorageService(storage as ObjectStorageService);

      const result = await service.uploadArtifact(TEST_SESSION_ID, TEST_ORG_ID, TEST_USER_ID, {
        name: "test.txt",
        mimeType: "text/plain",
        content: Buffer.from("hello world"),
      });

      expect(result.ok).toBe(true);
      expect(storage.putObject).toHaveBeenCalled();
      const updateCall = (sessionRepo.updateStatus as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(updateCall?.[0]).toBe(TEST_SESSION_ID);
      expect(updateCall?.[1]).toBe(TEST_ORG_ID);
      expect(updateCall?.[2]).toBe(session.status);
      expect(updateCall?.[3]?.artifactKeys).toHaveLength(1);
      expect(updateCall?.[3]?.artifactKeys?.[0]).toContain("test.txt");
      expect(audit.emit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "browser.uploaded" }),
      );
    });

    it("downloads artifact only when it belongs to the session", async () => {
      const key = "orgs/test/browser-sessions/session-1/test.txt";
      (sessionRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeSession({ artifactKeys: [key] }),
      );
      (storage.getObject as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: Buffer.from("hello world"),
        contentType: "text/plain",
        contentLength: 11,
      });
      service.setStorageService(storage as ObjectStorageService);

      const result = await service.downloadArtifact(TEST_SESSION_ID, TEST_ORG_ID, key);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.content.toString("utf8")).toBe("hello world");
        expect(result.value.contentType).toBe("text/plain");
      }
      expect(storage.getObject).toHaveBeenCalledWith(key);
    });
  });

  describe("checkActionPolicy", () => {
    it("allows non-risky actions", async () => {
      const result = await service.checkActionPolicy(
        { type: "navigate", url: "https://example.com" },
        TEST_SESSION_ID,
        TEST_ORG_ID,
        TEST_USER_ID,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.allowed).toBe(true);
      }
    });

    it("blocks risky actions when policy denies", async () => {
      const session = makeSession({ metadata: {} });
      (sessionRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const result = await service.checkActionPolicy(
        { type: "download_file" },
        TEST_SESSION_ID,
        TEST_ORG_ID,
        TEST_USER_ID,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.allowed).toBe(false);
      }
      expect(audit.emit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "browser.action_blocked" }),
      );
    });

    it("allows risky actions when policy allows", async () => {
      const session = makeSession({ metadata: { allowRiskyActions: true } });
      (sessionRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const result = await service.checkActionPolicy(
        { type: "upload_file", filePath: "/tmp/test.txt", selector: "input[type=file]" },
        TEST_SESSION_ID,
        TEST_ORG_ID,
        TEST_USER_ID,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.allowed).toBe(true);
      }
      expect(audit.emit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "browser.uploaded" }),
      );
    });
  });
});
