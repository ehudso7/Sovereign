import { describe, it, expect, beforeEach } from "vitest";
import { toOrgId, toUserId } from "@sovereign/core";
import { PgAuditEmitter } from "../../services/audit.service.js";
import { TestAuditRepo } from "../helpers/test-repos.js";

describe("AuditService", () => {
  const orgId = toOrgId("test-org-1");
  const userId = toUserId("test-user-1");
  let repo: TestAuditRepo;
  let emitter: PgAuditEmitter;

  beforeEach(() => {
    repo = new TestAuditRepo(orgId);
    emitter = new PgAuditEmitter(repo);
  });

  it("emits and queries audit events", async () => {
    await emitter.emit({
      orgId,
      actorId: userId,
      actorType: "user",
      action: "auth.sign_in",
      resourceType: "session",
      resourceId: "session-1",
    });

    await emitter.emit({
      orgId,
      actorId: userId,
      actorType: "user",
      action: "org.created",
      resourceType: "organization",
      resourceId: orgId,
    });

    const events = await emitter.query(orgId);
    expect(events.length).toBe(2);
  });

  it("filters by action", async () => {
    await emitter.emit({
      orgId,
      actorId: userId,
      actorType: "user",
      action: "auth.sign_in",
      resourceType: "session",
    });

    await emitter.emit({
      orgId,
      actorId: userId,
      actorType: "user",
      action: "org.created",
      resourceType: "organization",
    });

    const events = await emitter.query(orgId, { action: "auth.sign_in" });
    expect(events.length).toBe(1);
    expect(events[0]!.action).toBe("auth.sign_in");
  });

  it("isolates events by org", async () => {
    const otherOrgId = toOrgId("other-org");
    const otherRepo = new TestAuditRepo(otherOrgId);
    const otherEmitter = new PgAuditEmitter(otherRepo);

    await emitter.emit({
      orgId,
      actorId: userId,
      actorType: "user",
      action: "auth.sign_in",
      resourceType: "session",
    });

    await otherEmitter.emit({
      orgId: otherOrgId,
      actorId: userId,
      actorType: "user",
      action: "auth.sign_in",
      resourceType: "session",
    });

    const events = await emitter.query(orgId);
    expect(events.length).toBe(1);
    expect(events[0]!.orgId).toBe(orgId);

    const otherEvents = await otherEmitter.query(otherOrgId);
    expect(otherEvents.length).toBe(1);
    expect(otherEvents[0]!.orgId).toBe(otherOrgId);
  });

  it("includes metadata", async () => {
    await emitter.emit({
      orgId,
      actorId: userId,
      actorType: "user",
      action: "membership.role_changed",
      resourceType: "membership",
      metadata: { oldRole: "org_member", newRole: "org_admin" },
    });

    const events = await emitter.query(orgId);
    expect(events[0]!.metadata).toEqual({ oldRole: "org_member", newRole: "org_admin" });
  });
});
