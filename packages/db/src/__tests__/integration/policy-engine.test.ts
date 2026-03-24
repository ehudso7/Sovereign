/**
 * Policy Engine PostgreSQL integration tests — Phase 10.
 *
 * Proves that all policy CRUD, decision persistence, approval lifecycle,
 * and quarantine management work correctly against real PostgreSQL.
 * Verifies tenant isolation across all policy-engine queries.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  setupTestDb,
  teardownTestDb,
  getTestDb,
  truncateAllTables,
} from "./db-test-harness.js";
import { PgUserRepo } from "../../repositories/pg-user.repo.js";
import { PgOrgRepo } from "../../repositories/pg-org.repo.js";
import { PgMembershipRepo } from "../../repositories/pg-membership.repo.js";
import { PgAuditRepo } from "../../repositories/pg-audit.repo.js";
import {
  PgPolicyRepo,
  PgPolicyDecisionRepo,
  PgApprovalRepo,
  PgQuarantineRecordRepo,
} from "../../repositories/pg-policy.repo.js";
import type {
  OrgId,
  UserId,
} from "@sovereign/core";

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await setupTestDb();
}, 30_000);

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await truncateAllTables();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SeedResult {
  orgId: OrgId;
  userId: UserId;
}

async function seedOrg(suffix = ""): Promise<SeedResult> {
  const db = getTestDb();
  const userRepo = new PgUserRepo(db.unscoped());
  const orgRepo = new PgOrgRepo(db.unscoped());
  const membershipRepo = new PgMembershipRepo(db.unscoped());

  const user = await userRepo.create({
    email: `policy${suffix}@test.com`,
    name: `PolicyUser${suffix}`,
  });
  const org = await orgRepo.create({
    name: `Policy Org${suffix}`,
    slug: `policy-org${suffix}`,
  });
  await membershipRepo.create({
    orgId: org.id,
    userId: user.id,
    role: "org_owner",
    accepted: true,
  });

  return { orgId: org.id, userId: user.id };
}

// ===========================================================================
// 1. Policy CRUD
// ===========================================================================

describe("Policy CRUD", () => {
  it("creates and retrieves a policy by ID", async () => {
    const { orgId, userId } = await seedOrg("-crud1");
    const db = getTestDb();
    const policyRepo = new PgPolicyRepo(db.forTenant(orgId));

    const created = await policyRepo.create({
      orgId,
      name: "Test Policy",
      description: "A test policy",
      policyType: "access_control",
      enforcementMode: "deny",
      scopeType: "agent",
      rules: [{ actionPattern: "run.*" }],
      priority: 10,
      createdBy: userId,
    });

    expect(created.id).toBeTruthy();
    expect(created.name).toBe("Test Policy");
    expect(created.description).toBe("A test policy");
    expect(created.policyType).toBe("access_control");
    expect(created.enforcementMode).toBe("deny");
    expect(created.scopeType).toBe("agent");
    expect(created.priority).toBe(10);
    expect(created.status).toBe("active");
    expect(created.rules).toHaveLength(1);

    const fetched = await policyRepo.getById(created.id, orgId);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(created.id);
    expect(fetched!.name).toBe("Test Policy");
  });

  it("lists policies with status and scopeType filters", async () => {
    const { orgId, userId } = await seedOrg("-crud2");
    const db = getTestDb();
    const policyRepo = new PgPolicyRepo(db.forTenant(orgId));

    await policyRepo.create({
      orgId, name: "Active Agent Policy", policyType: "access_control",
      enforcementMode: "deny", scopeType: "agent", createdBy: userId,
    });
    await policyRepo.create({
      orgId, name: "Active Connector Policy", policyType: "access_control",
      enforcementMode: "allow", scopeType: "connector", createdBy: userId,
    });
    const disabled = await policyRepo.create({
      orgId, name: "Disabled Agent Policy", policyType: "access_control",
      enforcementMode: "deny", scopeType: "agent", createdBy: userId,
    });
    await policyRepo.update(disabled.id, orgId, { status: "disabled", updatedBy: userId });

    // Filter by status active
    const activeAll = await policyRepo.listForOrg(orgId, { status: "active" });
    expect(activeAll.length).toBe(2);

    // Filter by scopeType
    const agentOnly = await policyRepo.listForOrg(orgId, { scopeType: "agent" });
    expect(agentOnly.length).toBe(2); // one active, one disabled

    // Filter by status + scopeType
    const activeAgents = await policyRepo.listForOrg(orgId, { status: "active", scopeType: "agent" });
    expect(activeAgents.length).toBe(1);
    expect(activeAgents[0]!.name).toBe("Active Agent Policy");
  });

  it("updates policy fields", async () => {
    const { orgId, userId } = await seedOrg("-crud3");
    const db = getTestDb();
    const policyRepo = new PgPolicyRepo(db.forTenant(orgId));

    const created = await policyRepo.create({
      orgId, name: "Old Name", policyType: "access_control",
      enforcementMode: "deny", scopeType: "agent", priority: 5, createdBy: userId,
    });

    const updated = await policyRepo.update(created.id, orgId, {
      name: "New Name",
      description: "Updated description",
      priority: 20,
      enforcementMode: "allow",
      updatedBy: userId,
    });

    expect(updated).not.toBeNull();
    expect(updated!.name).toBe("New Name");
    expect(updated!.description).toBe("Updated description");
    expect(updated!.priority).toBe(20);
    expect(updated!.enforcementMode).toBe("allow");
    expect(updated!.updatedBy).toBe(userId);
  });

  it("deletes a policy", async () => {
    const { orgId, userId } = await seedOrg("-crud4");
    const db = getTestDb();
    const policyRepo = new PgPolicyRepo(db.forTenant(orgId));

    const created = await policyRepo.create({
      orgId, name: "To Delete", policyType: "access_control",
      enforcementMode: "deny", scopeType: "agent", createdBy: userId,
    });

    const deleted = await policyRepo.delete(created.id, orgId);
    expect(deleted).toBe(true);

    const fetched = await policyRepo.getById(created.id, orgId);
    expect(fetched).toBeNull();

    // Deleting again returns false
    const deletedAgain = await policyRepo.delete(created.id, orgId);
    expect(deletedAgain).toBe(false);
  });
});

// ===========================================================================
// 2. Policy Decision persistence
// ===========================================================================

describe("Policy Decision persistence", () => {
  it("creates and retrieves a policy decision by ID", async () => {
    const { orgId, userId } = await seedOrg("-dec1");
    const db = getTestDb();
    const decisionRepo = new PgPolicyDecisionRepo(db.forTenant(orgId));

    const created = await decisionRepo.create({
      orgId,
      subjectType: "agent",
      subjectId: "00000000-0000-0000-0000-a00000000001",
      actionType: "run.execute",
      result: "allow",
      reason: "No matching policy — default allow",
      metadata: { source: "test", priority: 1 },
      requestedBy: userId,
    });

    expect(created.id).toBeTruthy();
    expect(created.result).toBe("allow");
    expect(created.subjectType).toBe("agent");
    expect(created.subjectId).toBe("00000000-0000-0000-0000-a00000000001");
    expect(created.actionType).toBe("run.execute");
    expect(created.requestedBy).toBe(userId);

    const fetched = await decisionRepo.getById(created.id, orgId);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(created.id);
    expect(fetched!.result).toBe("allow");
  });

  it("lists policy decisions with result filter", async () => {
    const { orgId, userId } = await seedOrg("-dec2");
    const db = getTestDb();
    const decisionRepo = new PgPolicyDecisionRepo(db.forTenant(orgId));

    await decisionRepo.create({
      orgId, subjectType: "agent", subjectId: "00000000-0000-0000-0000-a10000000001", actionType: "run.execute",
      result: "allow", requestedBy: userId,
    });
    await decisionRepo.create({
      orgId, subjectType: "agent", subjectId: "00000000-0000-0000-0000-a20000000002", actionType: "connector.use",
      result: "deny", requestedBy: userId,
    });
    await decisionRepo.create({
      orgId, subjectType: "agent", subjectId: "00000000-0000-0000-0000-a30000000003", actionType: "connector.use",
      result: "deny", requestedBy: userId,
    });

    const denials = await decisionRepo.listForOrg(orgId, { result: "deny" });
    expect(denials.length).toBe(2);
    for (const d of denials) {
      expect(d.result).toBe("deny");
    }

    const allows = await decisionRepo.listForOrg(orgId, { result: "allow" });
    expect(allows.length).toBe(1);
  });

  it("persists metadata correctly", async () => {
    const { orgId } = await seedOrg("-dec3");
    const db = getTestDb();
    const decisionRepo = new PgPolicyDecisionRepo(db.forTenant(orgId));

    const metadata = { ruleId: "rule-123", contextKey: "value", nested: { flag: true } };
    const created = await decisionRepo.create({
      orgId, subjectType: "agent", subjectId: "00000000-0000-0000-0000-a10000000001",
      actionType: "run.execute", result: "allow",
      metadata,
    });

    const fetched = await decisionRepo.getById(created.id, orgId);
    expect(fetched).not.toBeNull();
    expect(fetched!.metadata).toEqual(metadata);
  });
});

// ===========================================================================
// 3. Approval lifecycle
// ===========================================================================

describe("Approval lifecycle", () => {
  it("creates and retrieves an approval", async () => {
    const { orgId, userId } = await seedOrg("-appr1");
    const db = getTestDb();
    const approvalRepo = new PgApprovalRepo(db.forTenant(orgId));

    const created = await approvalRepo.create({
      orgId,
      subjectType: "agent",
      subjectId: "00000000-0000-0000-0000-a00000000101",
      actionType: "connector.use",
      requestNote: "Please approve connector access",
      requestedBy: userId,
    });

    expect(created.id).toBeTruthy();
    expect(created.status).toBe("pending");
    expect(created.subjectType).toBe("agent");
    expect(created.actionType).toBe("connector.use");
    expect(created.requestedBy).toBe(userId);
    expect(created.requestNote).toBe("Please approve connector access");
    expect(created.decidedBy).toBeNull();
    expect(created.decidedAt).toBeNull();

    const fetched = await approvalRepo.getById(created.id, orgId);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(created.id);
    expect(fetched!.status).toBe("pending");
  });

  it("approves a pending request — status changes and decidedBy/decidedAt set", async () => {
    const { orgId, userId } = await seedOrg("-appr2");
    const db = getTestDb();
    const approvalRepo = new PgApprovalRepo(db.forTenant(orgId));

    const created = await approvalRepo.create({
      orgId, subjectType: "agent", subjectId: "00000000-0000-0000-0000-a00000000102",
      actionType: "run.execute", requestedBy: userId,
    });

    const decided = await approvalRepo.decide(created.id, orgId, {
      status: "approved",
      decidedBy: userId,
      decisionNote: "Approved after review",
    });

    expect(decided).not.toBeNull();
    expect(decided!.status).toBe("approved");
    expect(decided!.decidedBy).toBe(userId);
    expect(decided!.decidedAt).not.toBeNull();
    expect(decided!.decisionNote).toBe("Approved after review");
  });

  it("denies a pending request", async () => {
    const { orgId, userId } = await seedOrg("-appr3");
    const db = getTestDb();
    const approvalRepo = new PgApprovalRepo(db.forTenant(orgId));

    const created = await approvalRepo.create({
      orgId, subjectType: "agent", subjectId: "00000000-0000-0000-0000-a00000000103",
      actionType: "connector.use", requestedBy: userId,
    });

    const decided = await approvalRepo.decide(created.id, orgId, {
      status: "denied",
      decidedBy: userId,
      decisionNote: "Too risky",
    });

    expect(decided).not.toBeNull();
    expect(decided!.status).toBe("denied");
    expect(decided!.decidedBy).toBe(userId);
    expect(decided!.decidedAt).not.toBeNull();
  });

  it("cannot re-decide after approval is already decided", async () => {
    const { orgId, userId } = await seedOrg("-appr4");
    const db = getTestDb();
    const approvalRepo = new PgApprovalRepo(db.forTenant(orgId));

    const created = await approvalRepo.create({
      orgId, subjectType: "agent", subjectId: "00000000-0000-0000-0000-a00000000104",
      actionType: "run.execute", requestedBy: userId,
    });

    // First decide: approve
    await approvalRepo.decide(created.id, orgId, {
      status: "approved",
      decidedBy: userId,
    });

    // Second decide: should return null (status is no longer pending)
    const redecide = await approvalRepo.decide(created.id, orgId, {
      status: "denied",
      decidedBy: userId,
    });

    expect(redecide).toBeNull();

    // Verify original decision persists
    const fetched = await approvalRepo.getById(created.id, orgId);
    expect(fetched!.status).toBe("approved");
  });
});

// ===========================================================================
// 4. Quarantine lifecycle
// ===========================================================================

describe("Quarantine lifecycle", () => {
  it("creates and retrieves a quarantine record", async () => {
    const { orgId, userId } = await seedOrg("-qua1");
    const db = getTestDb();
    const quarantineRepo = new PgQuarantineRecordRepo(db.forTenant(orgId));

    const created = await quarantineRepo.create({
      orgId,
      subjectType: "agent",
      subjectId: "00000000-0000-0000-0000-bad000000001",
      reason: "Violated safety policy",
      quarantinedBy: userId,
    });

    expect(created.id).toBeTruthy();
    expect(created.status).toBe("active");
    expect(created.subjectType).toBe("agent");
    expect(created.subjectId).toBe("00000000-0000-0000-0000-bad000000001");
    expect(created.reason).toBe("Violated safety policy");
    expect(created.quarantinedBy).toBe(userId);
    expect(created.releasedBy).toBeNull();
    expect(created.releasedAt).toBeNull();

    const fetched = await quarantineRepo.getById(created.id, orgId);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(created.id);
    expect(fetched!.status).toBe("active");
  });

  it("getActiveForSubject finds the active quarantine record", async () => {
    const { orgId, userId } = await seedOrg("-qua2");
    const db = getTestDb();
    const quarantineRepo = new PgQuarantineRecordRepo(db.forTenant(orgId));

    // No quarantine yet
    const none = await quarantineRepo.getActiveForSubject(orgId, "agent", "00000000-0000-0000-0000-00a000000002");
    expect(none).toBeNull();

    // Create quarantine
    await quarantineRepo.create({
      orgId, subjectType: "agent", subjectId: "00000000-0000-0000-0000-00a000000002",
      reason: "Test quarantine", quarantinedBy: userId,
    });

    // Now it should be found
    const found = await quarantineRepo.getActiveForSubject(orgId, "agent", "00000000-0000-0000-0000-00a000000002");
    expect(found).not.toBeNull();
    expect(found!.status).toBe("active");
  });

  it("releases a quarantine record — status changes and releasedBy/releasedAt set", async () => {
    const { orgId, userId } = await seedOrg("-qua3");
    const db = getTestDb();
    const quarantineRepo = new PgQuarantineRecordRepo(db.forTenant(orgId));

    const created = await quarantineRepo.create({
      orgId, subjectType: "agent", subjectId: "00000000-0000-0000-0000-00a000000003",
      reason: "Temporary hold", quarantinedBy: userId,
    });

    const released = await quarantineRepo.release(created.id, orgId, {
      releasedBy: userId,
      releaseNote: "Investigation complete",
    });

    expect(released).not.toBeNull();
    expect(released!.status).toBe("released");
    expect(released!.releasedBy).toBe(userId);
    expect(released!.releasedAt).not.toBeNull();
    expect(released!.releaseNote).toBe("Investigation complete");

    // Verify getActiveForSubject no longer returns it
    const active = await quarantineRepo.getActiveForSubject(orgId, "agent", "00000000-0000-0000-0000-00a000000003");
    expect(active).toBeNull();
  });

  it("cannot release an already-released quarantine record", async () => {
    const { orgId, userId } = await seedOrg("-qua4");
    const db = getTestDb();
    const quarantineRepo = new PgQuarantineRecordRepo(db.forTenant(orgId));

    const created = await quarantineRepo.create({
      orgId, subjectType: "agent", subjectId: "00000000-0000-0000-0000-00a000000004",
      reason: "Test", quarantinedBy: userId,
    });

    // Release once
    await quarantineRepo.release(created.id, orgId, { releasedBy: userId });

    // Release again — should return null
    const releaseAgain = await quarantineRepo.release(created.id, orgId, {
      releasedBy: userId,
      releaseNote: "Attempt to double release",
    });

    expect(releaseAgain).toBeNull();

    // Status is still released
    const fetched = await quarantineRepo.getById(created.id, orgId);
    expect(fetched!.status).toBe("released");
  });
});

// ===========================================================================
// 5. Tenant isolation
// ===========================================================================

describe("Tenant isolation", () => {
  it("org B cannot see org A policies", async () => {
    const { orgId: orgA, userId: userA } = await seedOrg("-iso-a1");
    const { orgId: orgB } = await seedOrg("-iso-b1");
    const db = getTestDb();

    const policyRepoA = new PgPolicyRepo(db.forTenant(orgA));
    await policyRepoA.create({
      orgId: orgA, name: "Org A Policy", policyType: "access_control",
      enforcementMode: "deny", scopeType: "agent", createdBy: userA,
    });

    const policyRepoB = new PgPolicyRepo(db.forTenant(orgB));
    const orgBPolicies = await policyRepoB.listForOrg(orgB);
    expect(orgBPolicies.length).toBe(0);
  });

  it("org B cannot see org A approvals", async () => {
    const { orgId: orgA, userId: userA } = await seedOrg("-iso-a2");
    const { orgId: orgB } = await seedOrg("-iso-b2");
    const db = getTestDb();

    const approvalRepoA = new PgApprovalRepo(db.forTenant(orgA));
    await approvalRepoA.create({
      orgId: orgA, subjectType: "agent", subjectId: "00000000-0000-0000-0000-a0000000000a",
      actionType: "run.execute", requestedBy: userA,
    });

    const approvalRepoB = new PgApprovalRepo(db.forTenant(orgB));
    const orgBApprovals = await approvalRepoB.listForOrg(orgB);
    expect(orgBApprovals.length).toBe(0);
  });

  it("org B cannot see org A quarantine records", async () => {
    const { orgId: orgA, userId: userA } = await seedOrg("-iso-a3");
    const { orgId: orgB } = await seedOrg("-iso-b3");
    const db = getTestDb();

    const quarantineRepoA = new PgQuarantineRecordRepo(db.forTenant(orgA));
    await quarantineRepoA.create({
      orgId: orgA, subjectType: "agent", subjectId: "00000000-0000-0000-0000-a000000000aa",
      reason: "Org A quarantine", quarantinedBy: userA,
    });

    const quarantineRepoB = new PgQuarantineRecordRepo(db.forTenant(orgB));
    const orgBRecords = await quarantineRepoB.listForOrg(orgB);
    expect(orgBRecords.length).toBe(0);
  });

  it("org B cannot see org A policy decisions", async () => {
    const { orgId: orgA, userId: userA } = await seedOrg("-iso-a4");
    const { orgId: orgB } = await seedOrg("-iso-b4");
    const db = getTestDb();

    const decisionRepoA = new PgPolicyDecisionRepo(db.forTenant(orgA));
    await decisionRepoA.create({
      orgId: orgA, subjectType: "agent", subjectId: "00000000-0000-0000-0000-a0000000000a",
      actionType: "run.execute", result: "allow", requestedBy: userA,
    });

    const decisionRepoB = new PgPolicyDecisionRepo(db.forTenant(orgB));
    const orgBDecisions = await decisionRepoB.listForOrg(orgB);
    expect(orgBDecisions.length).toBe(0);
  });
});

// ===========================================================================
// 6. Audit evidence
// ===========================================================================

describe("Audit evidence", () => {
  it("policy audit events persist correctly", async () => {
    const { orgId, userId } = await seedOrg("-audit1");
    const db = getTestDb();
    const auditRepo = new PgAuditRepo(db.forTenant(orgId));

    // Emit a policy.created event
    await auditRepo.emit({
      orgId,
      actorId: userId,
      actorType: "user",
      action: "policy.created",
      resourceType: "policy",
      resourceId: "00000000-0000-0000-0000-b00000000001",
      metadata: { name: "Test Policy", policyType: "access_control", enforcementMode: "deny" },
    });

    // Emit a policy.updated event
    await auditRepo.emit({
      orgId,
      actorId: userId,
      actorType: "user",
      action: "policy.updated",
      resourceType: "policy",
      resourceId: "00000000-0000-0000-0000-b00000000001",
      metadata: { name: "Updated Test Policy" },
    });

    const events = await auditRepo.query(orgId, { resourceType: "policy" });
    expect(events.length).toBe(2);

    const actions = events.map((e) => e.action);
    expect(actions).toContain("policy.created");
    expect(actions).toContain("policy.updated");

    // Verify metadata is persisted
    const createdEvent = events.find((e) => e.action === "policy.created");
    expect(createdEvent?.metadata).toMatchObject({
      policyType: "access_control",
      enforcementMode: "deny",
    });
  });

  it("approval and quarantine audit events persist correctly", async () => {
    const { orgId, userId } = await seedOrg("-audit2");
    const db = getTestDb();
    const auditRepo = new PgAuditRepo(db.forTenant(orgId));

    // Emit approval.requested
    await auditRepo.emit({
      orgId, actorId: userId, actorType: "user",
      action: "approval.requested", resourceType: "approval",
      resourceId: "00000000-0000-0000-0000-c00000000001",
      metadata: { subjectType: "agent", subjectId: "00000000-0000-0000-0000-a0000000000a", actionType: "connector.use" },
    });

    // Emit approval.approved
    await auditRepo.emit({
      orgId, actorId: userId, actorType: "user",
      action: "approval.approved", resourceType: "approval",
      resourceId: "00000000-0000-0000-0000-c00000000001",
      metadata: { subjectType: "agent", subjectId: "00000000-0000-0000-0000-a0000000000a", actionType: "connector.use" },
    });

    // Emit quarantine.entered
    await auditRepo.emit({
      orgId, actorId: userId, actorType: "user",
      action: "quarantine.entered", resourceType: "agent",
      resourceId: "00000000-0000-0000-0000-a0000000000a",
      metadata: { quarantineId: "00000000-0000-0000-0000-d00000000001", reason: "Policy violation" },
    });

    // Emit quarantine.released
    await auditRepo.emit({
      orgId, actorId: userId, actorType: "user",
      action: "quarantine.released", resourceType: "agent",
      resourceId: "00000000-0000-0000-0000-a0000000000a",
      metadata: { quarantineId: "00000000-0000-0000-0000-d00000000001", releaseNote: "Cleared" },
    });

    const allEvents = await auditRepo.query(orgId, {});
    expect(allEvents.length).toBe(4);

    const approvalEvents = await auditRepo.query(orgId, { resourceType: "approval" });
    expect(approvalEvents.length).toBe(2);

    const quarantineEvents = await auditRepo.query(orgId, { resourceType: "agent" });
    expect(quarantineEvents.length).toBe(2);

    const quarantineEntered = quarantineEvents.find((e) => e.action === "quarantine.entered");
    expect(quarantineEntered?.metadata).toMatchObject({ reason: "Policy violation" });
  });
});
