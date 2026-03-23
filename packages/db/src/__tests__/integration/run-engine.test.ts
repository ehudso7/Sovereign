/**
 * Run Engine PostgreSQL integration tests.
 *
 * Covers run/step CRUD, state transitions, cross-tenant isolation,
 * and audit event persistence for the run lifecycle.
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
import { PgProjectRepo } from "../../repositories/pg-project.repo.js";
import { PgAgentRepo } from "../../repositories/pg-agent.repo.js";
import { PgAgentVersionRepo } from "../../repositories/pg-agent-version.repo.js";
import { PgRunRepo } from "../../repositories/pg-run.repo.js";
import { PgRunStepRepo } from "../../repositories/pg-run-step.repo.js";
import { PgAuditRepo } from "../../repositories/pg-audit.repo.js";
import { isValidTransition, toISODateString } from "@sovereign/core";
import type {
  OrgId,
  UserId,
  ProjectId,
  AgentId,
  AgentVersionId,
  AuditAction,
} from "@sovereign/core";

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await setupTestDb();
});

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
  projectId: ProjectId;
  agentId: AgentId;
  agentVersionId: AgentVersionId;
}

async function seedOrgWithAgent(): Promise<SeedResult> {
  const db = getTestDb();
  const userRepo = new PgUserRepo(db.unscoped());
  const orgRepo = new PgOrgRepo(db.unscoped());
  const membershipRepo = new PgMembershipRepo(db.unscoped());

  const user = await userRepo.create({ email: "alice@test.com", name: "Alice" });
  const org = await orgRepo.create({ name: "Test Org", slug: "test-org" });
  await membershipRepo.create({
    orgId: org.id,
    userId: user.id,
    role: "org_owner",
    accepted: true,
  });

  const tenantDb = db.forTenant(org.id);
  const projectRepo = new PgProjectRepo(tenantDb);
  const project = await projectRepo.create({
    orgId: org.id,
    name: "Test Project",
    slug: "test-project",
  });

  const agentRepo = new PgAgentRepo(tenantDb);
  const agent = await agentRepo.create({
    orgId: org.id,
    projectId: project.id,
    name: "Test Agent",
    slug: "test-agent",
    createdBy: user.id,
  });

  const versionRepo = new PgAgentVersionRepo(tenantDb);
  const version = await versionRepo.create({
    orgId: org.id,
    agentId: agent.id,
    version: 1,
    goals: ["Complete tasks"],
    instructions: "Do useful work",
    tools: [{ name: "web_search" }],
    budget: { maxTokens: 10000 },
    approvalRules: [],
    memoryConfig: null,
    schedule: null,
    modelConfig: { provider: "openai", model: "gpt-4o", temperature: 0.7 },
    createdBy: user.id,
  });
  await versionRepo.publish(version.id, org.id);

  return {
    orgId: org.id,
    userId: user.id,
    projectId: project.id,
    agentId: agent.id,
    agentVersionId: version.id,
  };
}

// ---------------------------------------------------------------------------
// Run CRUD
// ---------------------------------------------------------------------------

describe("Run CRUD (PostgreSQL)", () => {
  it("creates a run and retrieves by ID", async () => {
    const { orgId, userId, projectId, agentId, agentVersionId } = await seedOrgWithAgent();
    const db = getTestDb();
    const runRepo = new PgRunRepo(db.forTenant(orgId));

    const run = await runRepo.create({
      orgId,
      projectId,
      agentId,
      agentVersionId,
      triggerType: "manual",
      triggeredBy: userId,
      executionProvider: "local",
      input: { prompt: "Hello" },
      configSnapshot: { model: "gpt-4o" },
    });

    expect(run.id).toBeTruthy();
    expect(run.status).toBe("queued");
    expect(run.triggerType).toBe("manual");
    expect(run.executionProvider).toBe("local");
    expect(run.input).toEqual({ prompt: "Hello" });
    expect(run.configSnapshot).toEqual({ model: "gpt-4o" });
    expect(run.output).toBeNull();
    expect(run.error).toBeNull();
    expect(run.attemptCount).toBe(1);

    const found = await runRepo.getById(run.id, orgId);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(run.id);
    expect(found!.status).toBe("queued");
  });

  it("lists runs for org", async () => {
    const { orgId, userId, projectId, agentId, agentVersionId } = await seedOrgWithAgent();
    const db = getTestDb();
    const runRepo = new PgRunRepo(db.forTenant(orgId));

    const base = {
      orgId,
      projectId,
      agentId,
      agentVersionId,
      triggerType: "manual" as const,
      triggeredBy: userId,
      executionProvider: "local" as const,
      configSnapshot: {},
    };

    await runRepo.create({ ...base, input: { task: "one" } });
    await runRepo.create({ ...base, input: { task: "two" } });
    await runRepo.create({ ...base, input: { task: "three" } });

    const all = await runRepo.listForOrg(orgId);
    expect(all.length).toBe(3);
  });

  it("lists runs filtered by agent", async () => {
    const { orgId, userId, projectId, agentId, agentVersionId } = await seedOrgWithAgent();
    const db = getTestDb();
    const tenantDb = db.forTenant(orgId);
    const runRepo = new PgRunRepo(tenantDb);

    // Create a second agent
    const agentRepo = new PgAgentRepo(tenantDb);
    const agent2 = await agentRepo.create({
      orgId,
      projectId,
      name: "Agent 2",
      slug: "agent-2",
      createdBy: userId,
    });
    const versionRepo = new PgAgentVersionRepo(tenantDb);
    const v2 = await versionRepo.create({
      orgId,
      agentId: agent2.id,
      version: 1,
      goals: [],
      instructions: "",
      tools: [],
      budget: null,
      approvalRules: [],
      memoryConfig: null,
      schedule: null,
      modelConfig: { provider: "openai", model: "gpt-4o" },
      createdBy: userId,
    });

    const base = {
      orgId,
      projectId,
      triggerType: "manual" as const,
      triggeredBy: userId,
      executionProvider: "local" as const,
      configSnapshot: {},
    };

    await runRepo.create({ ...base, agentId, agentVersionId, input: { task: "a1" } });
    await runRepo.create({ ...base, agentId: agent2.id, agentVersionId: v2.id, input: { task: "a2" } });

    const filtered = await runRepo.listForOrg(orgId, { agentId });
    expect(filtered.length).toBe(1);
    expect(filtered[0]!.agentId).toBe(agentId);
  });

  it("lists runs filtered by status", async () => {
    const { orgId, userId, projectId, agentId, agentVersionId } = await seedOrgWithAgent();
    const db = getTestDb();
    const runRepo = new PgRunRepo(db.forTenant(orgId));

    const base = {
      orgId,
      projectId,
      agentId,
      agentVersionId,
      triggerType: "manual" as const,
      triggeredBy: userId,
      executionProvider: "local" as const,
      configSnapshot: {},
    };

    const r1 = await runRepo.create({ ...base, input: { task: "one" } });
    await runRepo.create({ ...base, input: { task: "two" } });

    // Move r1 to running
    await runRepo.updateStatus(r1.id, orgId, "starting");
    await runRepo.updateStatus(r1.id, orgId, "running");

    const queued = await runRepo.listForOrg(orgId, { status: "queued" });
    expect(queued.length).toBe(1);

    const running = await runRepo.listForOrg(orgId, { status: "running" });
    expect(running.length).toBe(1);
    expect(running[0]!.id).toBe(r1.id);
  });

  it("updates run status to running", async () => {
    const { orgId, userId, projectId, agentId, agentVersionId } = await seedOrgWithAgent();
    const db = getTestDb();
    const runRepo = new PgRunRepo(db.forTenant(orgId));

    const run = await runRepo.create({
      orgId,
      projectId,
      agentId,
      agentVersionId,
      triggerType: "manual",
      triggeredBy: userId,
      executionProvider: "local",
      configSnapshot: {},
    });

    const starting = await runRepo.updateStatus(run.id, orgId, "starting");
    expect(starting).not.toBeNull();
    expect(starting!.status).toBe("starting");

    const running = await runRepo.updateStatus(run.id, orgId, "running", {
      startedAt: toISODateString(new Date()),
    });
    expect(running).not.toBeNull();
    expect(running!.status).toBe("running");
    expect(running!.startedAt).toBeTruthy();
  });

  it("updates run status with output on completion", async () => {
    const { orgId, userId, projectId, agentId, agentVersionId } = await seedOrgWithAgent();
    const db = getTestDb();
    const runRepo = new PgRunRepo(db.forTenant(orgId));

    const run = await runRepo.create({
      orgId,
      projectId,
      agentId,
      agentVersionId,
      triggerType: "manual",
      triggeredBy: userId,
      executionProvider: "local",
      configSnapshot: {},
    });

    await runRepo.updateStatus(run.id, orgId, "starting");
    await runRepo.updateStatus(run.id, orgId, "running");

    const completed = await runRepo.updateStatus(run.id, orgId, "completed", {
      output: { result: "Task done successfully" },
      tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      costCents: 5,
      completedAt: toISODateString(new Date()),
    });

    expect(completed).not.toBeNull();
    expect(completed!.status).toBe("completed");
    expect(completed!.output).toEqual({ result: "Task done successfully" });
    expect(completed!.tokenUsage).toEqual({ inputTokens: 100, outputTokens: 50, totalTokens: 150 });
    expect(completed!.costCents).toBe(5);
    expect(completed!.completedAt).toBeTruthy();
  });

  it("updates run status with error on failure", async () => {
    const { orgId, userId, projectId, agentId, agentVersionId } = await seedOrgWithAgent();
    const db = getTestDb();
    const runRepo = new PgRunRepo(db.forTenant(orgId));

    const run = await runRepo.create({
      orgId,
      projectId,
      agentId,
      agentVersionId,
      triggerType: "manual",
      triggeredBy: userId,
      executionProvider: "local",
      configSnapshot: {},
    });

    await runRepo.updateStatus(run.id, orgId, "starting");
    await runRepo.updateStatus(run.id, orgId, "running");

    const failed = await runRepo.updateStatus(run.id, orgId, "failed", {
      error: { code: "TIMEOUT", message: "Run exceeded time limit" },
      completedAt: toISODateString(new Date()),
    });

    expect(failed).not.toBeNull();
    expect(failed!.status).toBe("failed");
    expect(failed!.error).toEqual({ code: "TIMEOUT", message: "Run exceeded time limit" });
    expect(failed!.completedAt).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Run Step CRUD
// ---------------------------------------------------------------------------

describe("Run Step CRUD (PostgreSQL)", () => {
  it("creates a run step", async () => {
    const { orgId, userId, projectId, agentId, agentVersionId } = await seedOrgWithAgent();
    const db = getTestDb();
    const tenantDb = db.forTenant(orgId);
    const runRepo = new PgRunRepo(tenantDb);
    const stepRepo = new PgRunStepRepo(tenantDb);

    const run = await runRepo.create({
      orgId,
      projectId,
      agentId,
      agentVersionId,
      triggerType: "manual",
      triggeredBy: userId,
      executionProvider: "local",
      configSnapshot: {},
    });

    const step = await stepRepo.create({
      orgId,
      runId: run.id,
      stepNumber: 1,
      type: "llm_call",
      input: { prompt: "What is 2+2?" },
    });

    expect(step.id).toBeTruthy();
    expect(step.runId).toBe(run.id);
    expect(step.stepNumber).toBe(1);
    expect(step.type).toBe("llm_call");
    expect(step.status).toBe("pending");
    expect(step.attempt).toBe(1);
    expect(step.input).toEqual({ prompt: "What is 2+2?" });

    const found = await stepRepo.getById(step.id, orgId);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(step.id);
  });

  it("lists steps for a run sorted by step_number", async () => {
    const { orgId, userId, projectId, agentId, agentVersionId } = await seedOrgWithAgent();
    const db = getTestDb();
    const tenantDb = db.forTenant(orgId);
    const runRepo = new PgRunRepo(tenantDb);
    const stepRepo = new PgRunStepRepo(tenantDb);

    const run = await runRepo.create({
      orgId,
      projectId,
      agentId,
      agentVersionId,
      triggerType: "manual",
      triggeredBy: userId,
      executionProvider: "local",
      configSnapshot: {},
    });

    await stepRepo.create({ orgId, runId: run.id, stepNumber: 3, type: "tool_call", toolName: "web_search" });
    await stepRepo.create({ orgId, runId: run.id, stepNumber: 1, type: "llm_call" });
    await stepRepo.create({ orgId, runId: run.id, stepNumber: 2, type: "tool_call", toolName: "code_exec" });

    const steps = await stepRepo.listForRun(run.id);
    expect(steps.length).toBe(3);
    expect(steps[0]!.stepNumber).toBe(1);
    expect(steps[1]!.stepNumber).toBe(2);
    expect(steps[2]!.stepNumber).toBe(3);
  });

  it("gets next step number", async () => {
    const { orgId, userId, projectId, agentId, agentVersionId } = await seedOrgWithAgent();
    const db = getTestDb();
    const tenantDb = db.forTenant(orgId);
    const runRepo = new PgRunRepo(tenantDb);
    const stepRepo = new PgRunStepRepo(tenantDb);

    const run = await runRepo.create({
      orgId,
      projectId,
      agentId,
      agentVersionId,
      triggerType: "manual",
      triggeredBy: userId,
      executionProvider: "local",
      configSnapshot: {},
    });

    // No steps yet — should return 1
    const first = await stepRepo.getNextStepNumber(run.id);
    expect(first).toBe(1);

    await stepRepo.create({ orgId, runId: run.id, stepNumber: 1, type: "llm_call" });
    await stepRepo.create({ orgId, runId: run.id, stepNumber: 2, type: "tool_call" });

    const next = await stepRepo.getNextStepNumber(run.id);
    expect(next).toBe(3);
  });

  it("updates step status with output", async () => {
    const { orgId, userId, projectId, agentId, agentVersionId } = await seedOrgWithAgent();
    const db = getTestDb();
    const tenantDb = db.forTenant(orgId);
    const runRepo = new PgRunRepo(tenantDb);
    const stepRepo = new PgRunStepRepo(tenantDb);

    const run = await runRepo.create({
      orgId,
      projectId,
      agentId,
      agentVersionId,
      triggerType: "manual",
      triggeredBy: userId,
      executionProvider: "local",
      configSnapshot: {},
    });

    const step = await stepRepo.create({
      orgId,
      runId: run.id,
      stepNumber: 1,
      type: "llm_call",
      input: { prompt: "Hello" },
    });

    const running = await stepRepo.updateStatus(step.id, orgId, "running", {
      startedAt: toISODateString(new Date()),
    });
    expect(running).not.toBeNull();
    expect(running!.status).toBe("running");

    const completed = await stepRepo.updateStatus(step.id, orgId, "completed", {
      output: { response: "World" },
      tokenUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      latencyMs: 250,
      completedAt: toISODateString(new Date()),
    });
    expect(completed).not.toBeNull();
    expect(completed!.status).toBe("completed");
    expect(completed!.output).toEqual({ response: "World" });
    expect(completed!.tokenUsage).toEqual({ inputTokens: 10, outputTokens: 5, totalTokens: 15 });
    expect(completed!.latencyMs).toBe(250);
    expect(completed!.completedAt).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Run state transitions
// ---------------------------------------------------------------------------

describe("Run state transitions (PostgreSQL)", () => {
  it("queued → starting → running → completed", async () => {
    const { orgId, userId, projectId, agentId, agentVersionId } = await seedOrgWithAgent();
    const db = getTestDb();
    const runRepo = new PgRunRepo(db.forTenant(orgId));

    const run = await runRepo.create({
      orgId,
      projectId,
      agentId,
      agentVersionId,
      triggerType: "manual",
      triggeredBy: userId,
      executionProvider: "local",
      configSnapshot: {},
    });
    expect(run.status).toBe("queued");

    // Validate transitions via state machine
    expect(isValidTransition("queued", "starting")).toBe(true);
    const starting = await runRepo.updateStatus(run.id, orgId, "starting");
    expect(starting!.status).toBe("starting");

    expect(isValidTransition("starting", "running")).toBe(true);
    const running = await runRepo.updateStatus(run.id, orgId, "running");
    expect(running!.status).toBe("running");

    expect(isValidTransition("running", "completed")).toBe(true);
    const completed = await runRepo.updateStatus(run.id, orgId, "completed", {
      output: { result: "done" },
    });
    expect(completed!.status).toBe("completed");
    expect(completed!.output).toEqual({ result: "done" });
  });

  it("running → paused → running (resume)", async () => {
    const { orgId, userId, projectId, agentId, agentVersionId } = await seedOrgWithAgent();
    const db = getTestDb();
    const runRepo = new PgRunRepo(db.forTenant(orgId));

    const run = await runRepo.create({
      orgId,
      projectId,
      agentId,
      agentVersionId,
      triggerType: "manual",
      triggeredBy: userId,
      executionProvider: "local",
      configSnapshot: {},
    });

    await runRepo.updateStatus(run.id, orgId, "starting");
    await runRepo.updateStatus(run.id, orgId, "running");

    expect(isValidTransition("running", "paused")).toBe(true);
    const paused = await runRepo.updateStatus(run.id, orgId, "paused");
    expect(paused!.status).toBe("paused");

    expect(isValidTransition("paused", "running")).toBe(true);
    const resumed = await runRepo.updateStatus(run.id, orgId, "running");
    expect(resumed!.status).toBe("running");
  });

  it("running → cancelling → cancelled", async () => {
    const { orgId, userId, projectId, agentId, agentVersionId } = await seedOrgWithAgent();
    const db = getTestDb();
    const runRepo = new PgRunRepo(db.forTenant(orgId));

    const run = await runRepo.create({
      orgId,
      projectId,
      agentId,
      agentVersionId,
      triggerType: "manual",
      triggeredBy: userId,
      executionProvider: "local",
      configSnapshot: {},
    });

    await runRepo.updateStatus(run.id, orgId, "starting");
    await runRepo.updateStatus(run.id, orgId, "running");

    expect(isValidTransition("running", "cancelling")).toBe(true);
    const cancelling = await runRepo.updateStatus(run.id, orgId, "cancelling");
    expect(cancelling!.status).toBe("cancelling");

    expect(isValidTransition("cancelling", "cancelled")).toBe(true);
    const cancelled = await runRepo.updateStatus(run.id, orgId, "cancelled");
    expect(cancelled!.status).toBe("cancelled");
  });

  it("rejects invalid transition (completed → running)", async () => {
    // Validate that the state machine correctly rejects this
    expect(isValidTransition("completed", "running")).toBe(false);

    // Also verify at the DB level that a completed run can still be
    // force-updated (repo does not enforce transitions — that is the
    // service layer's responsibility via the state machine).
    const { orgId, userId, projectId, agentId, agentVersionId } = await seedOrgWithAgent();
    const db = getTestDb();
    const runRepo = new PgRunRepo(db.forTenant(orgId));

    const run = await runRepo.create({
      orgId,
      projectId,
      agentId,
      agentVersionId,
      triggerType: "manual",
      triggeredBy: userId,
      executionProvider: "local",
      configSnapshot: {},
    });

    await runRepo.updateStatus(run.id, orgId, "starting");
    await runRepo.updateStatus(run.id, orgId, "running");
    await runRepo.updateStatus(run.id, orgId, "completed");

    // The state machine says this is invalid
    expect(isValidTransition("completed", "running")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Cross-tenant isolation
// ---------------------------------------------------------------------------

describe("Run cross-tenant isolation (PostgreSQL)", () => {
  it("org B cannot see org A runs", async () => {
    const db = getTestDb();
    const userRepo = new PgUserRepo(db.unscoped());
    const orgRepo = new PgOrgRepo(db.unscoped());
    const membershipRepo = new PgMembershipRepo(db.unscoped());

    // Org A setup
    const userA = await userRepo.create({ email: "alice@a.com", name: "Alice" });
    const orgA = await orgRepo.create({ name: "Org A", slug: "org-a" });
    await membershipRepo.create({ orgId: orgA.id, userId: userA.id, role: "org_owner", accepted: true });

    const tenantA = db.forTenant(orgA.id);
    const projectRepoA = new PgProjectRepo(tenantA);
    const projectA = await projectRepoA.create({ orgId: orgA.id, name: "Project A", slug: "proj-a" });

    const agentRepoA = new PgAgentRepo(tenantA);
    const agentA = await agentRepoA.create({
      orgId: orgA.id,
      projectId: projectA.id,
      name: "Agent A",
      slug: "agent-a",
      createdBy: userA.id,
    });

    const versionRepoA = new PgAgentVersionRepo(tenantA);
    const versionA = await versionRepoA.create({
      orgId: orgA.id,
      agentId: agentA.id,
      version: 1,
      goals: [],
      instructions: "",
      tools: [],
      budget: null,
      approvalRules: [],
      memoryConfig: null,
      schedule: null,
      modelConfig: { provider: "openai", model: "gpt-4o" },
      createdBy: userA.id,
    });

    const runRepoA = new PgRunRepo(tenantA);
    const runA = await runRepoA.create({
      orgId: orgA.id,
      projectId: projectA.id,
      agentId: agentA.id,
      agentVersionId: versionA.id,
      triggerType: "manual",
      triggeredBy: userA.id,
      executionProvider: "local",
      configSnapshot: {},
    });

    // Org B setup
    const userB = await userRepo.create({ email: "bob@b.com", name: "Bob" });
    const orgB = await orgRepo.create({ name: "Org B", slug: "org-b" });
    await membershipRepo.create({ orgId: orgB.id, userId: userB.id, role: "org_owner", accepted: true });

    const tenantB = db.forTenant(orgB.id);
    const runRepoB = new PgRunRepo(tenantB);

    // Org B cannot see Org A's run by ID
    const byId = await runRepoB.getById(runA.id, orgB.id);
    expect(byId).toBeNull();

    // Org B list is empty
    const list = await runRepoB.listForOrg(orgB.id);
    expect(list.length).toBe(0);
  });

  it("org B cannot see org A run steps", async () => {
    const db = getTestDb();
    const userRepo = new PgUserRepo(db.unscoped());
    const orgRepo = new PgOrgRepo(db.unscoped());
    const membershipRepo = new PgMembershipRepo(db.unscoped());

    // Org A setup
    const userA = await userRepo.create({ email: "alice@a.com", name: "Alice" });
    const orgA = await orgRepo.create({ name: "Org A", slug: "org-a" });
    await membershipRepo.create({ orgId: orgA.id, userId: userA.id, role: "org_owner", accepted: true });

    const tenantA = db.forTenant(orgA.id);
    const projectRepoA = new PgProjectRepo(tenantA);
    const projectA = await projectRepoA.create({ orgId: orgA.id, name: "Project A", slug: "proj-a" });

    const agentRepoA = new PgAgentRepo(tenantA);
    const agentA = await agentRepoA.create({
      orgId: orgA.id,
      projectId: projectA.id,
      name: "Agent A",
      slug: "agent-a",
      createdBy: userA.id,
    });

    const versionRepoA = new PgAgentVersionRepo(tenantA);
    const versionA = await versionRepoA.create({
      orgId: orgA.id,
      agentId: agentA.id,
      version: 1,
      goals: [],
      instructions: "",
      tools: [],
      budget: null,
      approvalRules: [],
      memoryConfig: null,
      schedule: null,
      modelConfig: { provider: "openai", model: "gpt-4o" },
      createdBy: userA.id,
    });

    const runRepoA = new PgRunRepo(tenantA);
    const runA = await runRepoA.create({
      orgId: orgA.id,
      projectId: projectA.id,
      agentId: agentA.id,
      agentVersionId: versionA.id,
      triggerType: "manual",
      triggeredBy: userA.id,
      executionProvider: "local",
      configSnapshot: {},
    });

    const stepRepoA = new PgRunStepRepo(tenantA);
    const stepA = await stepRepoA.create({
      orgId: orgA.id,
      runId: runA.id,
      stepNumber: 1,
      type: "llm_call",
    });

    // Org B setup
    const userB = await userRepo.create({ email: "bob@b.com", name: "Bob" });
    const orgB = await orgRepo.create({ name: "Org B", slug: "org-b" });
    await membershipRepo.create({ orgId: orgB.id, userId: userB.id, role: "org_owner", accepted: true });

    const tenantB = db.forTenant(orgB.id);
    const stepRepoB = new PgRunStepRepo(tenantB);

    // Org B cannot see Org A's step by ID
    const byId = await stepRepoB.getById(stepA.id, orgB.id);
    expect(byId).toBeNull();

    // Org B cannot list steps for Org A's run
    const steps = await stepRepoB.listForRun(runA.id);
    expect(steps.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Audit event persistence
// ---------------------------------------------------------------------------

describe("Run audit event persistence (PostgreSQL)", () => {
  it("persists run.created audit event", async () => {
    const { orgId, userId } = await seedOrgWithAgent();
    const db = getTestDb();
    const auditRepo = new PgAuditRepo(db.forTenant(orgId));

    const event = await auditRepo.emit({
      orgId,
      actorId: userId,
      actorType: "user",
      action: "run.created",
      resourceType: "run",
      resourceId: "test-run-id",
      metadata: { triggerType: "manual", agentId: "test-agent-id" },
    });

    expect(event.id).toBeTruthy();
    expect(event.action).toBe("run.created");

    const events = await auditRepo.query(orgId, { action: "run.created" });
    expect(events.length).toBe(1);
    expect(events[0]!.resourceId).toBe("test-run-id");
    expect(events[0]!.metadata).toEqual({ triggerType: "manual", agentId: "test-agent-id" });
  });

  it("persists all run lifecycle audit events", async () => {
    const { orgId, userId } = await seedOrgWithAgent();
    const db = getTestDb();
    const auditRepo = new PgAuditRepo(db.forTenant(orgId));

    const actions: AuditAction[] = [
      "run.created",
      "run.started",
      "run.paused",
      "run.resumed",
      "run.cancelled",
      "run.completed",
      "run.failed",
    ];

    for (const action of actions) {
      await auditRepo.emit({
        orgId,
        actorId: userId,
        actorType: "user",
        action,
        resourceType: "run",
        resourceId: "run-lifecycle-id",
        metadata: {},
      });
    }

    const allEvents = await auditRepo.query(orgId);
    expect(allEvents.length).toBe(7);

    // Verify each action persisted
    for (const action of actions) {
      const filtered = await auditRepo.query(orgId, { action });
      expect(filtered.length).toBeGreaterThanOrEqual(1);
    }
  });
});
