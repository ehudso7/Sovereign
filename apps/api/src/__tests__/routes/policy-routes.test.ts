/**
 * Policy Routes (service-level contract) — Phase 10 tests.
 *
 * Tests the policy engine service using in-memory repos.
 * Validates policy CRUD, evaluation logic, approval lifecycle,
 * quarantine management, permission enforcement, and audit evidence.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { toOrgId, toUserId } from "@sovereign/core";
import type { PolicyId, ApprovalId } from "@sovereign/core";
import { PgPolicyService } from "../../services/policy.service.js";
import { PgAuditEmitter } from "../../services/audit.service.js";
import {
  createTestRepos,
  type TestRepos,
} from "../helpers/test-repos.js";

const ORG_ID = toOrgId("00000000-0000-0000-0000-aaaaaaaaaaaa");
const OTHER_ORG_ID = toOrgId("00000000-0000-0000-0000-dddddddddddd");
const USER_ID = toUserId("00000000-0000-0000-0000-bbbbbbbbbbbb");

describe("Policy Routes (service-level contract)", () => {
  let repos: TestRepos;
  let svc: PgPolicyService;

  beforeEach(() => {
    repos = createTestRepos();
    const auditEmitter = new PgAuditEmitter(repos.audit);
    svc = new PgPolicyService(
      repos.policyRepo,
      repos.policyDecisions,
      repos.approvals,
      repos.quarantine,
      auditEmitter,
    );
  });

  // -------------------------------------------------------------------------
  // Policy CRUD
  // -------------------------------------------------------------------------

  describe("Policy CRUD", () => {
    it("creates a policy", async () => {
      const result = await svc.createPolicy({
        orgId: ORG_ID,
        name: "Test Policy",
        policyType: "access_control",
        enforcementMode: "deny",
        scopeType: "agent",
        createdBy: USER_ID,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.name).toBe("Test Policy");
      expect(result.value.orgId).toBe(ORG_ID);
      expect(result.value.enforcementMode).toBe("deny");
      expect(result.value.status).toBe("active");
    });

    it("lists policies with status filter", async () => {
      await svc.createPolicy({
        orgId: ORG_ID, name: "Active Policy", policyType: "access_control",
        enforcementMode: "deny", scopeType: "agent", createdBy: USER_ID,
      });

      // Manually set one to disabled via update
      const p2 = await svc.createPolicy({
        orgId: ORG_ID, name: "To Disable", policyType: "access_control",
        enforcementMode: "allow", scopeType: "agent", createdBy: USER_ID,
      });
      if (p2.ok) await svc.disablePolicy(p2.value.id, ORG_ID, USER_ID);

      const activeResult = await svc.listPolicies(ORG_ID, { status: "active" });
      expect(activeResult.ok).toBe(true);
      if (!activeResult.ok) return;
      expect(activeResult.value.length).toBe(1);
      expect(activeResult.value[0]!.name).toBe("Active Policy");
    });

    it("gets policy by ID", async () => {
      const created = await svc.createPolicy({
        orgId: ORG_ID, name: "Lookup Policy", policyType: "access_control",
        enforcementMode: "deny", scopeType: "agent", createdBy: USER_ID,
      });
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const result = await svc.getPolicy(created.value.id, ORG_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.id).toBe(created.value.id);
      expect(result.value.name).toBe("Lookup Policy");
    });

    it("returns NOT_FOUND for nonexistent policy ID", async () => {
      const result = await svc.getPolicy("nonexistent-policy-id" as PolicyId, ORG_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });

    it("updates policy", async () => {
      const created = await svc.createPolicy({
        orgId: ORG_ID, name: "Original Name", policyType: "access_control",
        enforcementMode: "deny", scopeType: "agent", createdBy: USER_ID,
      });
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const result = await svc.updatePolicy(created.value.id, ORG_ID, {
        name: "Updated Name",
        updatedBy: USER_ID,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.name).toBe("Updated Name");
    });

    it("disables a policy", async () => {
      const created = await svc.createPolicy({
        orgId: ORG_ID, name: "Enable/Disable Policy", policyType: "access_control",
        enforcementMode: "deny", scopeType: "agent", createdBy: USER_ID,
      });
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const result = await svc.disablePolicy(created.value.id, ORG_ID, USER_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.status).toBe("disabled");
    });

    it("enables a disabled policy", async () => {
      const created = await svc.createPolicy({
        orgId: ORG_ID, name: "Re-enable Policy", policyType: "access_control",
        enforcementMode: "deny", scopeType: "agent", createdBy: USER_ID,
      });
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      await svc.disablePolicy(created.value.id, ORG_ID, USER_ID);
      const result = await svc.enablePolicy(created.value.id, ORG_ID, USER_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.status).toBe("active");
    });

    it("archives a policy", async () => {
      const created = await svc.createPolicy({
        orgId: ORG_ID, name: "Archive Policy", policyType: "access_control",
        enforcementMode: "deny", scopeType: "agent", createdBy: USER_ID,
      });
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const result = await svc.archivePolicy(created.value.id, ORG_ID, USER_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.status).toBe("archived");
    });

    it("returns empty list for other org (org scoping)", async () => {
      await svc.createPolicy({
        orgId: ORG_ID, name: "Org A Policy", policyType: "access_control",
        enforcementMode: "deny", scopeType: "agent", createdBy: USER_ID,
      });

      const result = await svc.listPolicies(OTHER_ORG_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.length).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Policy Evaluation
  // -------------------------------------------------------------------------

  describe("Policy Evaluation", () => {
    it("default allow when no policies match", async () => {
      const result = await svc.evaluate({
        orgId: ORG_ID,
        subjectType: "agent",
        subjectId: "agent-123",
        actionType: "run.execute",
        requestedBy: USER_ID,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.decision).toBe("allow");
      expect(result.value.policyId).toBeNull();
    });

    it("deny policy blocks action", async () => {
      await repos.policyRepo.create({
        orgId: ORG_ID,
        name: "Deny All Runs",
        policyType: "access_control",
        enforcementMode: "deny",
        scopeType: "agent",
        rules: [{ actionPattern: "run.*" }],
        priority: 10,
        createdBy: USER_ID,
      });

      const result = await svc.evaluate({
        orgId: ORG_ID,
        subjectType: "agent",
        subjectId: "agent-123",
        actionType: "run.execute",
        requestedBy: USER_ID,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.decision).toBe("deny");
    });

    it("require_approval creates an approval request", async () => {
      await repos.policyRepo.create({
        orgId: ORG_ID,
        name: "Approval Required",
        policyType: "access_control",
        enforcementMode: "require_approval",
        scopeType: "agent",
        rules: [{ actionPattern: "connector.use" }],
        priority: 5,
        createdBy: USER_ID,
      });

      const result = await svc.evaluate({
        orgId: ORG_ID,
        subjectType: "agent",
        subjectId: "agent-abc",
        actionType: "connector.use",
        requestedBy: USER_ID,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.decision).toBe("require_approval");
      expect(result.value.approvalId).toBeDefined();

      // Verify the approval was actually created
      const approvals = await repos.approvals.listForOrg(ORG_ID, { status: "pending" });
      expect(approvals.length).toBe(1);
      expect(approvals[0]!.actionType).toBe("connector.use");
    });

    it("quarantine blocks already-quarantined subject", async () => {
      // Quarantine the subject first
      await svc.quarantineSubject({
        orgId: ORG_ID,
        subjectType: "agent",
        subjectId: "agent-quarantined",
        reason: "Suspicious activity",
        quarantinedBy: USER_ID,
      });

      const result = await svc.evaluate({
        orgId: ORG_ID,
        subjectType: "agent",
        subjectId: "agent-quarantined",
        actionType: "run.execute",
        requestedBy: USER_ID,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.decision).toBe("quarantined");
    });

    it("higher priority policy wins", async () => {
      // Lower priority: allow
      await repos.policyRepo.create({
        orgId: ORG_ID, name: "Low Priority Allow", policyType: "access_control",
        enforcementMode: "allow", scopeType: "agent",
        rules: [{ actionPattern: "*" }], priority: 1, createdBy: USER_ID,
      });
      // Higher priority: deny
      await repos.policyRepo.create({
        orgId: ORG_ID, name: "High Priority Deny", policyType: "access_control",
        enforcementMode: "deny", scopeType: "agent",
        rules: [{ actionPattern: "*" }], priority: 10, createdBy: USER_ID,
      });

      const result = await svc.evaluate({
        orgId: ORG_ID,
        subjectType: "agent",
        subjectId: "agent-x",
        actionType: "run.execute",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.decision).toBe("deny");
    });

    it("scope-specific policy matches by subjectType", async () => {
      // Policy only for connectors, not agents
      await repos.policyRepo.create({
        orgId: ORG_ID, name: "Connector Deny", policyType: "access_control",
        enforcementMode: "deny", scopeType: "connector",
        rules: [{ actionPattern: "*" }], priority: 5, createdBy: USER_ID,
      });

      const result = await svc.evaluate({
        orgId: ORG_ID,
        subjectType: "agent",
        subjectId: "agent-y",
        actionType: "run.execute",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // Agent should not be affected by connector policy
      expect(result.value.decision).toBe("allow");
    });

    it("org-wide policy applies to all subject types", async () => {
      await repos.policyRepo.create({
        orgId: ORG_ID, name: "Org Wide Deny", policyType: "access_control",
        enforcementMode: "deny", scopeType: "org",
        rules: [{ actionPattern: "run.execute" }], priority: 5, createdBy: USER_ID,
      });

      const result = await svc.evaluate({
        orgId: ORG_ID,
        subjectType: "agent",
        subjectId: "any-agent",
        actionType: "run.execute",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.decision).toBe("deny");
    });

    it("most restrictive policy wins across multiple matching policies", async () => {
      // require_approval (severity 2)
      await repos.policyRepo.create({
        orgId: ORG_ID, name: "Require Approval", policyType: "access_control",
        enforcementMode: "require_approval", scopeType: "agent",
        rules: [{ actionPattern: "*" }], priority: 5, createdBy: USER_ID,
      });
      // deny (severity 3) — should win
      await repos.policyRepo.create({
        orgId: ORG_ID, name: "Also Deny", policyType: "access_control",
        enforcementMode: "deny", scopeType: "agent",
        rules: [{ actionPattern: "run.execute" }], priority: 3, createdBy: USER_ID,
      });

      const result = await svc.evaluate({
        orgId: ORG_ID,
        subjectType: "agent",
        subjectId: "agent-z",
        actionType: "run.execute",
        requestedBy: USER_ID,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.decision).toBe("deny");
    });

    it("wildcard action pattern matches any action", async () => {
      await repos.policyRepo.create({
        orgId: ORG_ID, name: "Wildcard Deny", policyType: "access_control",
        enforcementMode: "deny", scopeType: "agent",
        rules: [{ actionPattern: "*" }], priority: 5, createdBy: USER_ID,
      });

      const result = await svc.evaluate({
        orgId: ORG_ID,
        subjectType: "agent",
        subjectId: "agent-w",
        actionType: "some.random.action",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.decision).toBe("deny");
    });
  });

  // -------------------------------------------------------------------------
  // Approvals
  // -------------------------------------------------------------------------

  describe("Approvals", () => {
    async function createPendingApproval(): Promise<ApprovalId> {
      const approval = await repos.approvals.create({
        orgId: ORG_ID,
        subjectType: "agent",
        subjectId: "agent-pending",
        actionType: "connector.use",
        requestedBy: USER_ID,
        requestNote: "Please approve this action",
      });
      return approval.id;
    }

    it("lists pending approvals", async () => {
      await createPendingApproval();
      await createPendingApproval();

      const result = await svc.listApprovals(ORG_ID, { status: "pending" });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.length).toBe(2);
    });

    it("approves a pending request", async () => {
      const approvalId = await createPendingApproval();

      const result = await svc.approveRequest(approvalId, ORG_ID, USER_ID, "Looks good");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.status).toBe("approved");
      expect(result.value.decidedBy).toBe(USER_ID);
      expect(result.value.decisionNote).toBe("Looks good");
    });

    it("denies a pending request", async () => {
      const approvalId = await createPendingApproval();

      const result = await svc.denyRequest(approvalId, ORG_ID, USER_ID, "Rejected");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.status).toBe("denied");
      expect(result.value.decidedBy).toBe(USER_ID);
    });

    it("cannot approve a non-pending (already approved) request", async () => {
      const approvalId = await createPendingApproval();
      // First approve
      await svc.approveRequest(approvalId, ORG_ID, USER_ID);
      // Try to approve again — should fail (returns null from repo)
      const result = await svc.approveRequest(approvalId, ORG_ID, USER_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });

    it("returns NOT_FOUND for nonexistent approval", async () => {
      const result = await svc.getApproval("nonexistent-approval-id" as ApprovalId, ORG_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });

    it("approval org scoping — other org cannot see approvals", async () => {
      await createPendingApproval();

      const result = await svc.listApprovals(OTHER_ORG_ID, { status: "pending" });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.length).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Quarantine
  // -------------------------------------------------------------------------

  describe("Quarantine", () => {
    it("quarantines a subject", async () => {
      const result = await svc.quarantineSubject({
        orgId: ORG_ID,
        subjectType: "agent",
        subjectId: "agent-bad",
        reason: "Violated policy",
        quarantinedBy: USER_ID,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.status).toBe("active");
      expect(result.value.subjectId).toBe("agent-bad");
      expect(result.value.reason).toBe("Violated policy");
    });

    it("cannot double-quarantine the same subject", async () => {
      await svc.quarantineSubject({
        orgId: ORG_ID, subjectType: "agent", subjectId: "agent-dup",
        reason: "First quarantine", quarantinedBy: USER_ID,
      });

      const result = await svc.quarantineSubject({
        orgId: ORG_ID, subjectType: "agent", subjectId: "agent-dup",
        reason: "Second quarantine", quarantinedBy: USER_ID,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("CONFLICT");
    });

    it("releases a quarantined subject", async () => {
      const qResult = await svc.quarantineSubject({
        orgId: ORG_ID, subjectType: "agent", subjectId: "agent-to-release",
        reason: "Temporary", quarantinedBy: USER_ID,
      });
      expect(qResult.ok).toBe(true);
      if (!qResult.ok) return;

      const release = await svc.releaseFromQuarantine(qResult.value.id, ORG_ID, USER_ID, "Cleared");
      expect(release.ok).toBe(true);
      if (!release.ok) return;
      expect(release.value.status).toBe("released");
      expect(release.value.releasedBy).toBe(USER_ID);
      expect(release.value.releaseNote).toBe("Cleared");
    });

    it("isQuarantined returns true for active quarantine", async () => {
      await svc.quarantineSubject({
        orgId: ORG_ID, subjectType: "agent", subjectId: "agent-check",
        reason: "Testing", quarantinedBy: USER_ID,
      });

      const isQ = await svc.isQuarantined(ORG_ID, "agent", "agent-check");
      expect(isQ).toBe(true);
    });

    it("isQuarantined returns false for released subject", async () => {
      const qResult = await svc.quarantineSubject({
        orgId: ORG_ID, subjectType: "agent", subjectId: "agent-released",
        reason: "Testing release", quarantinedBy: USER_ID,
      });
      expect(qResult.ok).toBe(true);
      if (!qResult.ok) return;

      await svc.releaseFromQuarantine(qResult.value.id, ORG_ID, USER_ID);
      const isQ = await svc.isQuarantined(ORG_ID, "agent", "agent-released");
      expect(isQ).toBe(false);
    });

    it("quarantine org scoping — other org cannot see records", async () => {
      await svc.quarantineSubject({
        orgId: ORG_ID, subjectType: "agent", subjectId: "agent-a-only",
        reason: "Org A only", quarantinedBy: USER_ID,
      });

      const result = await svc.listQuarantine(OTHER_ORG_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.length).toBe(0);
    });

    it("cannot release a non-active (already released) quarantine record", async () => {
      const qResult = await svc.quarantineSubject({
        orgId: ORG_ID, subjectType: "agent", subjectId: "agent-double-release",
        reason: "Testing", quarantinedBy: USER_ID,
      });
      expect(qResult.ok).toBe(true);
      if (!qResult.ok) return;

      await svc.releaseFromQuarantine(qResult.value.id, ORG_ID, USER_ID);
      // Try to release again
      const result = await svc.releaseFromQuarantine(qResult.value.id, ORG_ID, USER_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  // -------------------------------------------------------------------------
  // Permission enforcement
  // -------------------------------------------------------------------------

  describe("Permission enforcement", () => {
    it("policy:read is available to all roles", async () => {
      const { hasPermission } = await import("@sovereign/core");
      for (const role of ["org_owner", "org_admin", "org_member", "org_billing_admin", "org_security_admin"] as const) {
        expect(hasPermission(role, "policy:read")).toBe(true);
      }
    });

    it("policy:write requires org_owner, org_admin, or org_security_admin", async () => {
      const { hasPermission } = await import("@sovereign/core");
      expect(hasPermission("org_owner", "policy:write")).toBe(true);
      expect(hasPermission("org_admin", "policy:write")).toBe(true);
      expect(hasPermission("org_security_admin", "policy:write")).toBe(true);
      expect(hasPermission("org_member", "policy:write")).toBe(false);
      expect(hasPermission("org_billing_admin", "policy:write")).toBe(false);
    });

    it("approval:read is available to org_owner, org_admin, org_member, and org_security_admin", async () => {
      const { hasPermission } = await import("@sovereign/core");
      expect(hasPermission("org_owner", "approval:read")).toBe(true);
      expect(hasPermission("org_admin", "approval:read")).toBe(true);
      expect(hasPermission("org_member", "approval:read")).toBe(true);
      expect(hasPermission("org_security_admin", "approval:read")).toBe(true);
      // billing admin does not get approval:read
      expect(hasPermission("org_billing_admin", "approval:read")).toBe(false);
    });

    it("approval:decide requires org_owner, org_admin, or org_security_admin", async () => {
      const { hasPermission } = await import("@sovereign/core");
      expect(hasPermission("org_owner", "approval:decide")).toBe(true);
      expect(hasPermission("org_admin", "approval:decide")).toBe(true);
      expect(hasPermission("org_security_admin", "approval:decide")).toBe(true);
      expect(hasPermission("org_member", "approval:decide")).toBe(false);
      expect(hasPermission("org_billing_admin", "approval:decide")).toBe(false);
    });

    it("quarantine:read is available to org_owner, org_admin, org_member, and org_security_admin", async () => {
      const { hasPermission } = await import("@sovereign/core");
      expect(hasPermission("org_owner", "quarantine:read")).toBe(true);
      expect(hasPermission("org_admin", "quarantine:read")).toBe(true);
      expect(hasPermission("org_member", "quarantine:read")).toBe(true);
      expect(hasPermission("org_security_admin", "quarantine:read")).toBe(true);
      // billing admin does not get quarantine:read
      expect(hasPermission("org_billing_admin", "quarantine:read")).toBe(false);
    });

    it("quarantine:manage requires org_owner, org_admin, or org_security_admin", async () => {
      const { hasPermission } = await import("@sovereign/core");
      expect(hasPermission("org_owner", "quarantine:manage")).toBe(true);
      expect(hasPermission("org_admin", "quarantine:manage")).toBe(true);
      expect(hasPermission("org_security_admin", "quarantine:manage")).toBe(true);
      expect(hasPermission("org_member", "quarantine:manage")).toBe(false);
      expect(hasPermission("org_billing_admin", "quarantine:manage")).toBe(false);
    });

    it("audit:read is available to all roles including org_billing_admin", async () => {
      const { hasPermission } = await import("@sovereign/core");
      expect(hasPermission("org_owner", "audit:read")).toBe(true);
      expect(hasPermission("org_admin", "audit:read")).toBe(true);
      expect(hasPermission("org_security_admin", "audit:read")).toBe(true);
      expect(hasPermission("org_member", "audit:read")).toBe(true);
      expect(hasPermission("org_billing_admin", "audit:read")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Audit evidence
  // -------------------------------------------------------------------------

  describe("Audit evidence", () => {
    it("policy.created audit event is emitted on createPolicy", async () => {
      await svc.createPolicy({
        orgId: ORG_ID,
        name: "Audit Test Policy",
        policyType: "access_control",
        enforcementMode: "deny",
        scopeType: "agent",
        createdBy: USER_ID,
      });

      const events = await repos.audit.query(ORG_ID, { action: "policy.created" });
      expect(events.length).toBe(1);
      expect(events[0]!.resourceType).toBe("policy");
      expect(events[0]!.actorId).toBe(USER_ID);
    });

    it("approval.approved audit event is emitted on approveRequest", async () => {
      const approval = await repos.approvals.create({
        orgId: ORG_ID,
        subjectType: "agent",
        subjectId: "agent-audit",
        actionType: "connector.use",
        requestedBy: USER_ID,
      });

      await svc.approveRequest(approval.id, ORG_ID, USER_ID, "Approved");

      const events = await repos.audit.query(ORG_ID, { action: "approval.approved" });
      expect(events.length).toBe(1);
      expect(events[0]!.resourceType).toBe("approval");
    });

    it("quarantine.entered audit event is emitted on quarantineSubject", async () => {
      await svc.quarantineSubject({
        orgId: ORG_ID,
        subjectType: "agent",
        subjectId: "agent-audit-q",
        reason: "Audit test",
        quarantinedBy: USER_ID,
      });

      const events = await repos.audit.query(ORG_ID, { action: "quarantine.entered" });
      expect(events.length).toBe(1);
      expect(events[0]!.resourceType).toBe("agent");
      expect(events[0]!.actorId).toBe(USER_ID);
    });

    it("policy.disabled audit event is emitted on disablePolicy", async () => {
      const created = await svc.createPolicy({
        orgId: ORG_ID, name: "Audit Disable", policyType: "access_control",
        enforcementMode: "deny", scopeType: "agent", createdBy: USER_ID,
      });
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      await svc.disablePolicy(created.value.id, ORG_ID, USER_ID);

      const events = await repos.audit.query(ORG_ID, { action: "policy.disabled" });
      expect(events.length).toBe(1);
    });

    it("quarantine.released audit event is emitted on releaseFromQuarantine", async () => {
      const qResult = await svc.quarantineSubject({
        orgId: ORG_ID, subjectType: "agent", subjectId: "agent-release-audit",
        reason: "Testing audit", quarantinedBy: USER_ID,
      });
      expect(qResult.ok).toBe(true);
      if (!qResult.ok) return;

      await svc.releaseFromQuarantine(qResult.value.id, ORG_ID, USER_ID, "Cleared");

      const events = await repos.audit.query(ORG_ID, { action: "quarantine.released" });
      expect(events.length).toBe(1);
    });

    it("policy.decision audit event is emitted on evaluate", async () => {
      await svc.evaluate({
        orgId: ORG_ID,
        subjectType: "agent",
        subjectId: "agent-decision",
        actionType: "run.execute",
        requestedBy: USER_ID,
      });

      const events = await repos.audit.query(ORG_ID, { action: "policy.decision" });
      expect(events.length).toBe(1);
    });

    it("approval.denied audit event is emitted on denyRequest", async () => {
      const approval = await repos.approvals.create({
        orgId: ORG_ID,
        subjectType: "agent",
        subjectId: "agent-deny-audit",
        actionType: "connector.use",
        requestedBy: USER_ID,
      });

      await svc.denyRequest(approval.id, ORG_ID, USER_ID, "Not allowed");

      const events = await repos.audit.query(ORG_ID, { action: "approval.denied" });
      expect(events.length).toBe(1);
    });

    it("approval.requested audit event is emitted when evaluation triggers require_approval", async () => {
      await repos.policyRepo.create({
        orgId: ORG_ID, name: "Approval Policy", policyType: "access_control",
        enforcementMode: "require_approval", scopeType: "agent",
        rules: [{ actionPattern: "connector.use" }], priority: 5, createdBy: USER_ID,
      });

      await svc.evaluate({
        orgId: ORG_ID,
        subjectType: "agent",
        subjectId: "agent-req",
        actionType: "connector.use",
        requestedBy: USER_ID,
      });

      const events = await repos.audit.query(ORG_ID, { action: "approval.requested" });
      expect(events.length).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Policy decisions listing
  // -------------------------------------------------------------------------

  describe("Policy decisions", () => {
    it("lists decisions filtered by result", async () => {
      await svc.evaluate({
        orgId: ORG_ID, subjectType: "agent", subjectId: "a1",
        actionType: "run.execute", requestedBy: USER_ID,
      });

      const result = await svc.listDecisions(ORG_ID, { result: "allow" });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.length).toBe(1);
      expect(result.value[0]!.result).toBe("allow");
    });

    it("decision records are org-scoped", async () => {
      await svc.evaluate({
        orgId: ORG_ID, subjectType: "agent", subjectId: "a1",
        actionType: "run.execute", requestedBy: USER_ID,
      });

      const result = await svc.listDecisions(OTHER_ORG_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.length).toBe(0);
    });
  });
});
