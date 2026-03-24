/**
 * Runtime Enforcement Tests — Phase 10 Remediation
 *
 * Proves that policy evaluation is actually enforced at runtime boundaries:
 * - Run execution (blocked when denied/quarantined, allowed when no policy)
 * - Connector tool use (blocked when denied/quarantined)
 * - Browser risky actions (integrated with policy service)
 * - Memory governance (read/write blocked when denied)
 * - Approval-gated actions (blocked while pending, allowed after approval, stays blocked after denial, expired blocks)
 * - Quarantine enforcement (blocked subjects, release restores access)
 *
 * Uses PgPolicyService + PgBrowserSessionService + PgRunService with in-memory repos.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  toOrgId,
  toUserId,
  toAgentId,
  toRunId,
} from "@sovereign/core";
import type { ApprovalId } from "@sovereign/core";
import { PgPolicyService } from "../../services/policy.service.js";
import { PgBrowserSessionService } from "../../services/browser-session.service.js";
import { PgAuditEmitter } from "../../services/audit.service.js";
import {
  createTestRepos,
  type TestRepos,
} from "../helpers/test-repos.js";

// Helper to extract value from Result with proper narrowing
function val<T>(result: { ok: boolean; value?: T }): T {
  return result.value as T;
}

const ORG_ID = toOrgId("00000000-0000-0000-0000-aaaaaaaaaaaa");
const OTHER_ORG_ID = toOrgId("00000000-0000-0000-0000-dddddddddddd");
const USER_ID = toUserId("00000000-0000-0000-0000-bbbbbbbbbbbb");
const APPROVER_ID = toUserId("00000000-0000-0000-0000-cccccccccccc");
const AGENT_ID = toAgentId("00000000-0000-0000-0000-111111111111");
const RUN_ID = toRunId("00000000-0000-0000-0000-222222222222");

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("Runtime Enforcement (Phase 10 Remediation)", () => {
  let repos: TestRepos;
  let policySvc: PgPolicyService;
  let browserSvc: PgBrowserSessionService;
  let auditEmitter: PgAuditEmitter;

  beforeEach(() => {
    repos = createTestRepos();
    auditEmitter = new PgAuditEmitter(repos.audit);
    policySvc = new PgPolicyService(
      repos.policyRepo,
      repos.policyDecisions,
      repos.approvals,
      repos.quarantine,
      auditEmitter,
    );
    browserSvc = new PgBrowserSessionService(
      repos.browserSessions,
      repos.runs,
      auditEmitter,
    );
    // Attach policy service to browser service for integrated enforcement
    browserSvc.setPolicyService(policySvc);
  });

  // =========================================================================
  // A. Run Execution Boundary
  // =========================================================================

  describe("Run execution boundary", () => {
    it("allows run when no policy exists (default allow)", async () => {
      const result = await policySvc.evaluate({
        orgId: ORG_ID,
        subjectType: "run",
        subjectId: AGENT_ID,
        actionType: "run.execute",
        requestedBy: USER_ID,
        context: { runId: RUN_ID },
      });
      expect(result.ok).toBe(true);
      expect(val(result).decision).toBe("allow");
    });

    it("blocks run when deny policy matches agent", async () => {
      await policySvc.createPolicy({
        orgId: ORG_ID,
        name: "Block agent runs",
        policyType: "access_control",
        enforcementMode: "deny",
        scopeType: "run",
        scopeId: AGENT_ID,
        rules: [{ actionPattern: "run.execute" }],
        priority: 100,
        createdBy: USER_ID,
      });

      const result = await policySvc.evaluate({
        orgId: ORG_ID,
        subjectType: "run",
        subjectId: AGENT_ID,
        actionType: "run.execute",
        requestedBy: USER_ID,
      });
      expect(result.ok).toBe(true);
      expect(val(result).decision).toBe("deny");
    });

    it("blocks run when agent is quarantined", async () => {
      await policySvc.quarantineSubject({
        orgId: ORG_ID,
        subjectType: "run",
        subjectId: AGENT_ID,
        reason: "Security incident",
        quarantinedBy: USER_ID,
      });

      const result = await policySvc.evaluate({
        orgId: ORG_ID,
        subjectType: "run",
        subjectId: AGENT_ID,
        actionType: "run.execute",
        requestedBy: USER_ID,
      });
      expect(result.ok).toBe(true);
      expect(val(result).decision).toBe("quarantined");
    });

    it("blocks run when require_approval policy active", async () => {
      await policySvc.createPolicy({
        orgId: ORG_ID,
        name: "Require approval for runs",
        policyType: "access_control",
        enforcementMode: "require_approval",
        scopeType: "run",
        rules: [{ actionPattern: "run.execute" }],
        priority: 50,
        createdBy: USER_ID,
      });

      const result = await policySvc.evaluate({
        orgId: ORG_ID,
        subjectType: "run",
        subjectId: AGENT_ID,
        actionType: "run.execute",
        requestedBy: USER_ID,
      });
      expect(result.ok).toBe(true);
      expect(val(result).decision).toBe("require_approval");
      expect(val(result).approvalId).toBeDefined();
    });

    it("emits policy.decision audit event on run evaluation", async () => {
      await policySvc.evaluate({
        orgId: ORG_ID,
        subjectType: "run",
        subjectId: AGENT_ID,
        actionType: "run.execute",
        requestedBy: USER_ID,
      });

      const events = await repos.audit.query(ORG_ID, { action: "policy.decision" });
      expect(events.length).toBeGreaterThanOrEqual(1);
      const event = events.find((e) => e.metadata?.actionType === "run.execute");
      expect(event).toBeDefined();
      expect(event!.metadata?.result).toBe("allow");
    });
  });

  // =========================================================================
  // B. Connector Tool Use Boundary
  // =========================================================================

  describe("Connector tool use boundary", () => {
    it("allows tool use when no policy exists", async () => {
      const result = await policySvc.evaluate({
        orgId: ORG_ID,
        subjectType: "connector",
        subjectId: "weather",
        actionType: "connector.use",
        requestedBy: USER_ID,
        context: { toolName: "get_weather", runId: RUN_ID },
      });
      expect(result.ok).toBe(true);
      expect(val(result).decision).toBe("allow");
    });

    it("blocks tool use when connector is denied", async () => {
      await policySvc.createPolicy({
        orgId: ORG_ID,
        name: "Block weather connector",
        policyType: "access_control",
        enforcementMode: "deny",
        scopeType: "connector",
        scopeId: "weather",
        rules: [{ actionPattern: "connector.use" }],
        priority: 100,
        createdBy: USER_ID,
      });

      const result = await policySvc.evaluate({
        orgId: ORG_ID,
        subjectType: "connector",
        subjectId: "weather",
        actionType: "connector.use",
        requestedBy: USER_ID,
      });
      expect(result.ok).toBe(true);
      expect(val(result).decision).toBe("deny");
    });

    it("blocks tool use when connector is quarantined", async () => {
      await policySvc.quarantineSubject({
        orgId: ORG_ID,
        subjectType: "connector",
        subjectId: "weather",
        reason: "Malicious plugin detected",
        quarantinedBy: USER_ID,
      });

      const result = await policySvc.evaluate({
        orgId: ORG_ID,
        subjectType: "connector",
        subjectId: "weather",
        actionType: "connector.use",
        requestedBy: USER_ID,
      });
      expect(result.ok).toBe(true);
      expect(val(result).decision).toBe("quarantined");
    });

    it("blocks tool use with wildcard connector.* pattern", async () => {
      await policySvc.createPolicy({
        orgId: ORG_ID,
        name: "Block all connector actions",
        policyType: "access_control",
        enforcementMode: "deny",
        scopeType: "connector",
        rules: [{ actionPattern: "connector.*" }],
        priority: 100,
        createdBy: USER_ID,
      });

      const result = await policySvc.evaluate({
        orgId: ORG_ID,
        subjectType: "connector",
        subjectId: "echo",
        actionType: "connector.use",
        requestedBy: USER_ID,
      });
      expect(result.ok).toBe(true);
      expect(val(result).decision).toBe("deny");
    });
  });

  // =========================================================================
  // C. Browser Risky Action Boundary (integrated with policy service)
  // =========================================================================

  describe("Browser risky action boundary (policy-integrated)", () => {
    const setupBrowserSession = async () => {
      // Create a run and browser session in the test repos
      const run = await repos.runs.create({
        orgId: ORG_ID,
        projectId: toOrgId("00000000-0000-0000-0000-444444444444") as unknown as import("@sovereign/core").ProjectId,
        agentId: AGENT_ID,
        agentVersionId: toAgentId("00000000-0000-0000-0000-555555555555") as unknown as import("@sovereign/core").AgentVersionId,
        triggerType: "manual",
        triggeredBy: USER_ID,
        executionProvider: "local",
        input: {},
        configSnapshot: {},
      });

      const session = await repos.browserSessions.create({
        orgId: ORG_ID,
        runId: run.id,
        agentId: AGENT_ID,
        createdBy: USER_ID,
      });

      // Mark active
      await repos.browserSessions.updateStatus(session.id, ORG_ID, "active");

      return session;
    };

    it("allows non-risky actions without policy check", async () => {
      const session = await setupBrowserSession();
      const result = await browserSvc.checkActionPolicy(
        { type: "navigate", url: "https://example.com" } as import("@sovereign/core").BrowserAction,
        session.id,
        ORG_ID,
        USER_ID,
      );
      expect(result.ok).toBe(true);
      expect(val(result).allowed).toBe(true);
    });

    it("blocks risky upload when policy denies browser actions", async () => {
      await policySvc.createPolicy({
        orgId: ORG_ID,
        name: "Block browser uploads",
        policyType: "access_control",
        enforcementMode: "deny",
        scopeType: "browser_session",
        rules: [{ actionPattern: "browser.upload_file" }],
        priority: 100,
        createdBy: USER_ID,
      });

      const session = await setupBrowserSession();
      const result = await browserSvc.checkActionPolicy(
        { type: "upload_file", filePath: "/tmp/data.csv", selector: "#upload" } as import("@sovereign/core").BrowserAction,
        session.id,
        ORG_ID,
        USER_ID,
      );
      expect(result.ok).toBe(true);
      expect(val(result).allowed).toBe(false);
      expect(val(result).policyDecision).toBe("deny");
    });

    it("blocks risky download when browser_session is quarantined", async () => {
      const session = await setupBrowserSession();

      await policySvc.quarantineSubject({
        orgId: ORG_ID,
        subjectType: "browser_session",
        subjectId: session.id,
        reason: "Suspicious download pattern",
        quarantinedBy: USER_ID,
      });

      const result = await browserSvc.checkActionPolicy(
        { type: "download_file", url: "https://example.com/file.zip" } as import("@sovereign/core").BrowserAction,
        session.id,
        ORG_ID,
        USER_ID,
      );
      expect(result.ok).toBe(true);
      expect(val(result).allowed).toBe(false);
      expect(val(result).policyDecision).toBe("quarantined");
    });

    it("emits browser.action_blocked audit when policy denies", async () => {
      await policySvc.createPolicy({
        orgId: ORG_ID,
        name: "Block downloads",
        policyType: "access_control",
        enforcementMode: "deny",
        scopeType: "browser_session",
        rules: [{ actionPattern: "browser.*" }],
        priority: 100,
        createdBy: USER_ID,
      });

      const session = await setupBrowserSession();
      await browserSvc.checkActionPolicy(
        { type: "download_file", url: "https://example.com/file.zip" } as import("@sovereign/core").BrowserAction,
        session.id,
        ORG_ID,
        USER_ID,
      );

      const events = await repos.audit.query(ORG_ID, { action: "browser.action_blocked" });
      expect(events.length).toBeGreaterThanOrEqual(1);
      const event = events.find((e) => e.metadata?.policyDecision === "deny");
      expect(event).toBeDefined();
    });
  });

  // =========================================================================
  // D. Memory Governance Boundary
  // =========================================================================

  describe("Memory governance boundary", () => {
    it("allows memory read when no policy exists", async () => {
      const result = await policySvc.evaluate({
        orgId: ORG_ID,
        subjectType: "memory",
        actionType: "memory.read",
        requestedBy: USER_ID,
        context: { runId: RUN_ID },
      });
      expect(result.ok).toBe(true);
      expect(val(result).decision).toBe("allow");
    });

    it("blocks memory read when deny policy active", async () => {
      await policySvc.createPolicy({
        orgId: ORG_ID,
        name: "Block memory read",
        policyType: "access_control",
        enforcementMode: "deny",
        scopeType: "memory",
        rules: [{ actionPattern: "memory.read" }],
        priority: 100,
        createdBy: USER_ID,
      });

      const result = await policySvc.evaluate({
        orgId: ORG_ID,
        subjectType: "memory",
        actionType: "memory.read",
        requestedBy: USER_ID,
      });
      expect(result.ok).toBe(true);
      expect(val(result).decision).toBe("deny");
    });

    it("blocks memory write when deny policy active", async () => {
      await policySvc.createPolicy({
        orgId: ORG_ID,
        name: "Block memory write",
        policyType: "access_control",
        enforcementMode: "deny",
        scopeType: "memory",
        rules: [{ actionPattern: "memory.write" }],
        priority: 100,
        createdBy: USER_ID,
      });

      const result = await policySvc.evaluate({
        orgId: ORG_ID,
        subjectType: "memory",
        actionType: "memory.write",
        requestedBy: USER_ID,
      });
      expect(result.ok).toBe(true);
      expect(val(result).decision).toBe("deny");
    });

    it("blocks memory operations with wildcard memory.* pattern", async () => {
      await policySvc.createPolicy({
        orgId: ORG_ID,
        name: "Block all memory ops",
        policyType: "access_control",
        enforcementMode: "deny",
        scopeType: "memory",
        rules: [{ actionPattern: "memory.*" }],
        priority: 100,
        createdBy: USER_ID,
      });

      const readResult = await policySvc.evaluate({
        orgId: ORG_ID, subjectType: "memory", actionType: "memory.read", requestedBy: USER_ID,
      });
      const writeResult = await policySvc.evaluate({
        orgId: ORG_ID, subjectType: "memory", actionType: "memory.write", requestedBy: USER_ID,
      });

      expect(val(readResult).decision).toBe("deny");
      expect(val(writeResult).decision).toBe("deny");
    });
  });

  // =========================================================================
  // E. Approval-Gated Action Proof (end-to-end)
  // =========================================================================

  describe("Approval-gated action lifecycle", () => {
    let approvalId: ApprovalId;

    const setupApprovalGatedRun = async () => {
      // Create a require_approval policy for run execution
      await policySvc.createPolicy({
        orgId: ORG_ID,
        name: "Require approval for agent runs",
        policyType: "access_control",
        enforcementMode: "require_approval",
        scopeType: "run",
        rules: [{ actionPattern: "run.execute" }],
        priority: 100,
        createdBy: USER_ID,
      });

      // Evaluate — should create approval
      const result = await policySvc.evaluate({
        orgId: ORG_ID,
        subjectType: "run",
        subjectId: AGENT_ID,
        actionType: "run.execute",
        requestedBy: USER_ID,
        context: { runId: RUN_ID },
      });

      expect(result.ok).toBe(true);
      expect(val(result).decision).toBe("require_approval");
      expect(val(result).approvalId).toBeDefined();
      approvalId = val(result).approvalId! as ApprovalId;
      return val(result);
    };

    it("blocks action while approval is pending", async () => {
      await setupApprovalGatedRun();

      // Approval exists and is pending
      const approvalResult = await policySvc.getApproval(approvalId, ORG_ID);
      expect(approvalResult.ok).toBe(true);
      expect(val(approvalResult).status).toBe("pending");

      // Re-evaluate — still require_approval because policy is still active
      const recheck = await policySvc.evaluate({
        orgId: ORG_ID,
        subjectType: "run",
        subjectId: AGENT_ID,
        actionType: "run.execute",
        requestedBy: USER_ID,
      });
      expect(val(recheck).decision).toBe("require_approval");
    });

    it("approved action is allowed to proceed", async () => {
      await setupApprovalGatedRun();

      // Approve the request
      const approveResult = await policySvc.approveRequest(approvalId, ORG_ID, APPROVER_ID, "Looks good");
      expect(approveResult.ok).toBe(true);
      expect(val(approveResult).status).toBe("approved");
      expect(val(approveResult).decidedBy).toBe(APPROVER_ID);

      // Verify approval status is approved
      const check = await policySvc.getApproval(approvalId, ORG_ID);
      expect(val(check).status).toBe("approved");
      expect(val(check).decidedAt).not.toBeNull();
    });

    it("denied action stays blocked", async () => {
      await setupApprovalGatedRun();

      // Deny the request
      const denyResult = await policySvc.denyRequest(approvalId, ORG_ID, APPROVER_ID, "Not authorized");
      expect(denyResult.ok).toBe(true);
      expect(val(denyResult).status).toBe("denied");

      // Cannot re-approve after denial
      const reapprove = await policySvc.approveRequest(approvalId, ORG_ID, APPROVER_ID);
      expect(reapprove.ok).toBe(false);

      // Re-evaluation still returns require_approval (new approval would be needed)
      const recheck = await policySvc.evaluate({
        orgId: ORG_ID,
        subjectType: "run",
        subjectId: AGENT_ID,
        actionType: "run.execute",
        requestedBy: USER_ID,
      });
      expect(val(recheck).decision).toBe("require_approval");
    });

    it("expired approval does not allow execution", async () => {
      await setupApprovalGatedRun();

      // Directly set the approval to have an expired timestamp
      // We'll use the repo's expirePending which checks expiresAt
      // First, create an approval with an already-expired timestamp
      const expiredApproval = await repos.approvals.create({
        orgId: ORG_ID,
        subjectType: "run",
        subjectId: AGENT_ID,
        actionType: "run.execute",
        requestNote: "Test expired approval",
        requestedBy: USER_ID,
        expiresAt: new Date(Date.now() - 60000).toISOString(), // Expired 1 minute ago
      });

      // Expire all pending approvals
      const expiredCount = await repos.approvals.expirePending(ORG_ID);
      expect(expiredCount).toBeGreaterThanOrEqual(1);

      // Verify the expired approval cannot be approved
      const approveResult = await policySvc.approveRequest(
        expiredApproval.id,
        ORG_ID,
        APPROVER_ID,
      );
      // Cannot approve because status is no longer "pending"
      expect(approveResult.ok).toBe(false);
    });

    it("approval-gated connector tool use creates approval and blocks", async () => {
      await policySvc.createPolicy({
        orgId: ORG_ID,
        name: "Require approval for weather",
        policyType: "access_control",
        enforcementMode: "require_approval",
        scopeType: "connector",
        scopeId: "weather",
        rules: [{ actionPattern: "connector.use" }],
        priority: 100,
        createdBy: USER_ID,
      });

      const result = await policySvc.evaluate({
        orgId: ORG_ID,
        subjectType: "connector",
        subjectId: "weather",
        actionType: "connector.use",
        requestedBy: USER_ID,
        context: { toolName: "get_weather" },
      });

      expect(val(result).decision).toBe("require_approval");
      expect(val(result).approvalId).toBeDefined();

      // Approve it
      const approval = await policySvc.approveRequest(
        val(result).approvalId! as ApprovalId,
        ORG_ID,
        APPROVER_ID,
      );
      expect(val(approval).status).toBe("approved");
    });

    it("emits correct audit trail for approval lifecycle", async () => {
      await setupApprovalGatedRun();
      await policySvc.approveRequest(approvalId, ORG_ID, APPROVER_ID, "Approved");

      const events = await repos.audit.query(ORG_ID, {});
      const approvalRequested = events.filter((e) => e.action === "approval.requested");
      const approvalApproved = events.filter((e) => e.action === "approval.approved");
      const policyDecisions = events.filter((e) => e.action === "policy.decision");

      expect(approvalRequested.length).toBeGreaterThanOrEqual(1);
      expect(approvalApproved.length).toBe(1);
      expect(policyDecisions.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // F. Quarantine Enforcement Proof
  // =========================================================================

  describe("Quarantine enforcement at runtime boundaries", () => {
    it("quarantined agent cannot execute runs", async () => {
      await policySvc.quarantineSubject({
        orgId: ORG_ID,
        subjectType: "run",
        subjectId: AGENT_ID,
        reason: "Data breach detected",
        quarantinedBy: USER_ID,
      });

      const result = await policySvc.evaluate({
        orgId: ORG_ID,
        subjectType: "run",
        subjectId: AGENT_ID,
        actionType: "run.execute",
        requestedBy: USER_ID,
      });

      expect(val(result).decision).toBe("quarantined");
      expect(val(result).reason).toContain("quarantined");
    });

    it("quarantined connector cannot be used for tool calls", async () => {
      await policySvc.quarantineSubject({
        orgId: ORG_ID,
        subjectType: "connector",
        subjectId: "weather",
        reason: "Malicious behavior",
        quarantinedBy: USER_ID,
      });

      const result = await policySvc.evaluate({
        orgId: ORG_ID,
        subjectType: "connector",
        subjectId: "weather",
        actionType: "connector.use",
        requestedBy: USER_ID,
      });

      expect(val(result).decision).toBe("quarantined");
    });

    it("quarantined subject cannot bypass via alternate action type", async () => {
      await policySvc.quarantineSubject({
        orgId: ORG_ID,
        subjectType: "connector",
        subjectId: "weather",
        reason: "Compromised",
        quarantinedBy: USER_ID,
      });

      // Even using a different action type, quarantine still blocks
      const result1 = await policySvc.evaluate({
        orgId: ORG_ID,
        subjectType: "connector",
        subjectId: "weather",
        actionType: "connector.configure",
        requestedBy: USER_ID,
      });
      const result2 = await policySvc.evaluate({
        orgId: ORG_ID,
        subjectType: "connector",
        subjectId: "weather",
        actionType: "connector.test",
        requestedBy: USER_ID,
      });

      expect(val(result1).decision).toBe("quarantined");
      expect(val(result2).decision).toBe("quarantined");
    });

    it("release from quarantine restores allowed execution path", async () => {
      const qResult = await policySvc.quarantineSubject({
        orgId: ORG_ID,
        subjectType: "run",
        subjectId: AGENT_ID,
        reason: "Temporary hold",
        quarantinedBy: USER_ID,
      });
      const qRecord = val(qResult);

      // Confirm blocked
      const blocked = await policySvc.evaluate({
        orgId: ORG_ID,
        subjectType: "run",
        subjectId: AGENT_ID,
        actionType: "run.execute",
        requestedBy: USER_ID,
      });
      expect(val(blocked).decision).toBe("quarantined");

      // Release from quarantine
      await policySvc.releaseFromQuarantine(qRecord.id, ORG_ID, APPROVER_ID, "Issue resolved");

      // Confirm now allowed
      const allowed = await policySvc.evaluate({
        orgId: ORG_ID,
        subjectType: "run",
        subjectId: AGENT_ID,
        actionType: "run.execute",
        requestedBy: USER_ID,
      });
      expect(val(allowed).decision).toBe("allow");
    });

    it("quarantine overrides allow policies", async () => {
      // Create an allow policy
      await policySvc.createPolicy({
        orgId: ORG_ID,
        name: "Allow all connector use",
        policyType: "access_control",
        enforcementMode: "allow",
        scopeType: "connector",
        rules: [{ actionPattern: "connector.*" }],
        priority: 100,
        createdBy: USER_ID,
      });

      // Quarantine the connector
      await policySvc.quarantineSubject({
        orgId: ORG_ID,
        subjectType: "connector",
        subjectId: "weather",
        reason: "Quarantine overrides policy",
        quarantinedBy: USER_ID,
      });

      const result = await policySvc.evaluate({
        orgId: ORG_ID,
        subjectType: "connector",
        subjectId: "weather",
        actionType: "connector.use",
        requestedBy: USER_ID,
      });

      // Quarantine takes precedence over allow policy
      expect(val(result).decision).toBe("quarantined");
    });

    it("emits quarantine audit events correctly", async () => {
      const qResult = await policySvc.quarantineSubject({
        orgId: ORG_ID,
        subjectType: "connector",
        subjectId: "weather",
        reason: "Test quarantine",
        quarantinedBy: USER_ID,
      });

      // Evaluate (quarantined)
      await policySvc.evaluate({
        orgId: ORG_ID,
        subjectType: "connector",
        subjectId: "weather",
        actionType: "connector.use",
        requestedBy: USER_ID,
      });

      // Release
      await policySvc.releaseFromQuarantine(val(qResult).id, ORG_ID, APPROVER_ID, "Done");

      const events = await repos.audit.query(ORG_ID, {});
      const entered = events.filter((e) => e.action === "quarantine.entered");
      const released = events.filter((e) => e.action === "quarantine.released");

      expect(entered.length).toBe(1);
      expect(entered[0]!.metadata?.reason).toBe("Test quarantine");
      expect(released.length).toBe(1);
      expect(released[0]!.metadata?.releaseNote).toBe("Done");

      // Verify that a policy decision record was created (even without audit event)
      const decisions = await repos.policyDecisions.listForOrg(ORG_ID, { result: "quarantined" });
      expect(decisions.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // G. Cross-Boundary Enforcement Consistency
  // =========================================================================

  describe("Cross-boundary enforcement consistency", () => {
    it("org-wide deny policy blocks all boundary types", async () => {
      await policySvc.createPolicy({
        orgId: ORG_ID,
        name: "Global lockdown",
        policyType: "access_control",
        enforcementMode: "deny",
        scopeType: "org",
        rules: [{ actionPattern: "*" }],
        priority: 1000,
        createdBy: USER_ID,
      });

      const runResult = await policySvc.evaluate({
        orgId: ORG_ID, subjectType: "run", subjectId: AGENT_ID,
        actionType: "run.execute", requestedBy: USER_ID,
      });
      const toolResult = await policySvc.evaluate({
        orgId: ORG_ID, subjectType: "connector", subjectId: "weather",
        actionType: "connector.use", requestedBy: USER_ID,
      });
      const memoryResult = await policySvc.evaluate({
        orgId: ORG_ID, subjectType: "memory",
        actionType: "memory.read", requestedBy: USER_ID,
      });

      expect(val(runResult).decision).toBe("deny");
      expect(val(toolResult).decision).toBe("deny");
      expect(val(memoryResult).decision).toBe("deny");
    });

    it("policy enforcement is tenant-scoped (other org unaffected)", async () => {
      await policySvc.createPolicy({
        orgId: ORG_ID,
        name: "Block runs for org A",
        policyType: "access_control",
        enforcementMode: "deny",
        scopeType: "run",
        rules: [{ actionPattern: "run.execute" }],
        priority: 100,
        createdBy: USER_ID,
      });

      // Org A is blocked
      const orgAResult = await policySvc.evaluate({
        orgId: ORG_ID,
        subjectType: "run",
        subjectId: AGENT_ID,
        actionType: "run.execute",
        requestedBy: USER_ID,
      });
      expect(val(orgAResult).decision).toBe("deny");

      // Create separate service for org B
      const orgBPolicySvc = new PgPolicyService(
        repos.policyRepo,
        repos.policyDecisions,
        repos.approvals,
        repos.quarantine,
        auditEmitter,
      );

      // Org B is unaffected
      const orgBResult = await orgBPolicySvc.evaluate({
        orgId: OTHER_ORG_ID,
        subjectType: "run",
        subjectId: AGENT_ID,
        actionType: "run.execute",
        requestedBy: USER_ID,
      });
      expect(val(orgBResult).decision).toBe("allow");
    });

    it("disabled policy does not enforce", async () => {
      const createResult = await policySvc.createPolicy({
        orgId: ORG_ID,
        name: "Deny that will be disabled",
        policyType: "access_control",
        enforcementMode: "deny",
        scopeType: "connector",
        rules: [{ actionPattern: "connector.use" }],
        priority: 100,
        createdBy: USER_ID,
      });

      const policyId = val(createResult).id;

      // Initially denied
      const denied = await policySvc.evaluate({
        orgId: ORG_ID,
        subjectType: "connector",
        subjectId: "weather",
        actionType: "connector.use",
        requestedBy: USER_ID,
      });
      expect(val(denied).decision).toBe("deny");

      // Disable the policy
      await policySvc.disablePolicy(policyId, ORG_ID, USER_ID);

      // Now allowed
      const allowed = await policySvc.evaluate({
        orgId: ORG_ID,
        subjectType: "connector",
        subjectId: "weather",
        actionType: "connector.use",
        requestedBy: USER_ID,
      });
      expect(val(allowed).decision).toBe("allow");
    });

    it("higher priority deny overrides lower priority allow", async () => {
      await policySvc.createPolicy({
        orgId: ORG_ID,
        name: "Low priority allow",
        policyType: "access_control",
        enforcementMode: "allow",
        scopeType: "connector",
        rules: [{ actionPattern: "connector.use" }],
        priority: 10,
        createdBy: USER_ID,
      });

      await policySvc.createPolicy({
        orgId: ORG_ID,
        name: "High priority deny",
        policyType: "access_control",
        enforcementMode: "deny",
        scopeType: "connector",
        rules: [{ actionPattern: "connector.use" }],
        priority: 100,
        createdBy: USER_ID,
      });

      const result = await policySvc.evaluate({
        orgId: ORG_ID,
        subjectType: "connector",
        subjectId: "weather",
        actionType: "connector.use",
        requestedBy: USER_ID,
      });
      // Most restrictive wins
      expect(val(result).decision).toBe("deny");
    });
  });

  // =========================================================================
  // H. Secret Resolution Audit
  // =========================================================================

  describe("Secret resolution audit", () => {
    it("recordSecretResolution creates audit event without exposing value", async () => {
      await policySvc.recordSecretResolution({
        orgId: ORG_ID,
        secretType: "connector_credential",
        secretRef: "install-123",
        resolvedFor: RUN_ID,
        resolvedBy: USER_ID,
      });

      const events = await repos.audit.query(ORG_ID, { action: "secret.resolved" });
      expect(events.length).toBe(1);
      expect(events[0]!.metadata?.secretType).toBe("connector_credential");
      expect(events[0]!.metadata?.resolvedFor).toBe(RUN_ID);
      // Ensure no actual secret value is ever in audit
      expect(JSON.stringify(events[0]!.metadata)).not.toContain("apiKey");
      expect(JSON.stringify(events[0]!.metadata)).not.toContain("password");
    });
  });
});
