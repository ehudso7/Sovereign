/**
 * Connector Hub PostgreSQL integration tests.
 *
 * Covers connector/skill catalog CRUD, install/revoke persistence,
 * credential encryption, tenant isolation, audit events, and
 * end-to-end connector-enabled run proof.
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
import { PgConnectorRepo } from "../../repositories/pg-connector.repo.js";
import { PgConnectorInstallRepo } from "../../repositories/pg-connector-install.repo.js";
import { PgConnectorCredentialRepo } from "../../repositories/pg-connector-credential.repo.js";
import { PgSkillRepo } from "../../repositories/pg-skill.repo.js";
import { PgSkillInstallRepo } from "../../repositories/pg-skill-install.repo.js";
import { encryptSecret, decryptSecret, toISODateString } from "@sovereign/core";
import type {
  OrgId,
  UserId,
  ProjectId,
  ConnectorId,
} from "@sovereign/core";

// ---------------------------------------------------------------------------
// AES-256-GCM encryption requires SOVEREIGN_SECRET_KEY
// ---------------------------------------------------------------------------

process.env.SOVEREIGN_SECRET_KEY = "test-secret-key-for-integration-tests-minimum-32";

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
}

async function seedOrg(): Promise<SeedResult> {
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

  return { orgId: org.id, userId: user.id, projectId: project.id };
}

async function seedConnector(): Promise<{ connectorId: ConnectorId; slug: string }> {
  const db = getTestDb();
  const connectorRepo = new PgConnectorRepo(db.unscoped());

  const connector = await connectorRepo.create({
    slug: "echo",
    name: "Echo & Utilities",
    description: "A simple utility connector for testing.",
    category: "utility",
    trustTier: "verified",
    authMode: "none",
    status: "active",
    tools: [
      { name: "echo", description: "Echoes back the input", parameters: {} },
      { name: "current_time", description: "Returns the current time", parameters: {} },
    ],
    scopes: [
      { id: "echo:read", name: "Echo Read", description: "Echo messages and read time" },
    ],
  });

  return { connectorId: connector.id, slug: connector.slug };
}

// ---------------------------------------------------------------------------
// 1. Connector catalog (PostgreSQL)
// ---------------------------------------------------------------------------

describe("Connector catalog (PostgreSQL)", () => {
  it("creates a connector in the catalog", async () => {
    const db = getTestDb();
    const connectorRepo = new PgConnectorRepo(db.unscoped());

    const connector = await connectorRepo.create({
      slug: "echo",
      name: "Echo",
      description: "Echo connector",
      category: "utility",
      trustTier: "verified",
      authMode: "none",
      status: "active",
      tools: [{ name: "echo", description: "Echoes input", parameters: {} }],
      scopes: [{ id: "echo:read", name: "Read", description: "Read access" }],
    });

    expect(connector.id).toBeTruthy();
    expect(connector.slug).toBe("echo");
    expect(connector.name).toBe("Echo");
    expect(connector.trustTier).toBe("verified");
    expect(connector.authMode).toBe("none");
    expect(connector.status).toBe("active");
    expect(connector.tools).toHaveLength(1);
    expect(connector.scopes).toHaveLength(1);
  });

  it("lists connectors with filters", async () => {
    const db = getTestDb();
    const connectorRepo = new PgConnectorRepo(db.unscoped());

    await connectorRepo.create({
      slug: "echo",
      name: "Echo",
      category: "utility",
      trustTier: "verified",
      authMode: "none",
      status: "active",
      tools: [],
      scopes: [],
    });
    await connectorRepo.create({
      slug: "weather",
      name: "Weather",
      category: "data",
      trustTier: "verified",
      authMode: "api_key",
      status: "active",
      tools: [],
      scopes: [],
    });

    const all = await connectorRepo.listAll();
    expect(all).toHaveLength(2);

    const utility = await connectorRepo.listAll({ category: "utility" });
    expect(utility).toHaveLength(1);
    expect(utility[0]!.slug).toBe("echo");

    const data = await connectorRepo.listAll({ category: "data" });
    expect(data).toHaveLength(1);
    expect(data[0]!.slug).toBe("weather");
  });

  it("gets connector by slug", async () => {
    const db = getTestDb();
    const connectorRepo = new PgConnectorRepo(db.unscoped());

    await connectorRepo.create({
      slug: "echo",
      name: "Echo",
      category: "utility",
      trustTier: "verified",
      authMode: "none",
      status: "active",
      tools: [],
      scopes: [],
    });

    const found = await connectorRepo.getBySlug("echo");
    expect(found).not.toBeNull();
    expect(found!.slug).toBe("echo");

    const missing = await connectorRepo.getBySlug("nonexistent");
    expect(missing).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. Connector install persistence (PostgreSQL)
// ---------------------------------------------------------------------------

describe("Connector install persistence (PostgreSQL)", () => {
  it("installs a connector for org", async () => {
    const { orgId, userId } = await seedOrg();
    const { connectorId } = await seedConnector();
    const db = getTestDb();
    const installRepo = new PgConnectorInstallRepo(db.forTenant(orgId));

    const install = await installRepo.create({
      orgId,
      connectorId,
      connectorSlug: "echo",
      config: { setting: "value" },
      grantedScopes: ["echo:read"],
      installedBy: userId,
    });

    expect(install.id).toBeTruthy();
    expect(install.orgId).toBe(orgId);
    expect(install.connectorId).toBe(connectorId);
    expect(install.connectorSlug).toBe("echo");
    expect(install.enabled).toBe(true);
    expect(install.config).toEqual({ setting: "value" });
    expect(install.grantedScopes).toEqual(["echo:read"]);
  });

  it("prevents duplicate install for same org", async () => {
    const { orgId, userId } = await seedOrg();
    const { connectorId } = await seedConnector();
    const db = getTestDb();
    const installRepo = new PgConnectorInstallRepo(db.forTenant(orgId));

    await installRepo.create({
      orgId,
      connectorId,
      connectorSlug: "echo",
      config: {},
      grantedScopes: [],
      installedBy: userId,
    });

    // Second install should fail due to unique constraint
    await expect(
      installRepo.create({
        orgId,
        connectorId,
        connectorSlug: "echo",
        config: {},
        grantedScopes: [],
        installedBy: userId,
      }),
    ).rejects.toThrow();
  });

  it("lists installed connectors for org", async () => {
    const { orgId, userId } = await seedOrg();
    const { connectorId } = await seedConnector();
    const db = getTestDb();
    const installRepo = new PgConnectorInstallRepo(db.forTenant(orgId));

    await installRepo.create({
      orgId,
      connectorId,
      connectorSlug: "echo",
      config: {},
      grantedScopes: [],
      installedBy: userId,
    });

    const installs = await installRepo.listForOrg(orgId);
    expect(installs).toHaveLength(1);
    expect(installs[0]!.connectorSlug).toBe("echo");
  });

  it("updates install config", async () => {
    const { orgId, userId } = await seedOrg();
    const { connectorId } = await seedConnector();
    const db = getTestDb();
    const installRepo = new PgConnectorInstallRepo(db.forTenant(orgId));

    const install = await installRepo.create({
      orgId,
      connectorId,
      connectorSlug: "echo",
      config: { old: true },
      grantedScopes: [],
      installedBy: userId,
    });

    const updated = await installRepo.update(install.id, orgId, {
      config: { new: true },
      updatedBy: userId,
    });

    expect(updated).not.toBeNull();
    expect(updated!.config).toEqual({ new: true });
  });

  it("deletes install (revoke)", async () => {
    const { orgId, userId } = await seedOrg();
    const { connectorId } = await seedConnector();
    const db = getTestDb();
    const installRepo = new PgConnectorInstallRepo(db.forTenant(orgId));

    const install = await installRepo.create({
      orgId,
      connectorId,
      connectorSlug: "echo",
      config: {},
      grantedScopes: [],
      installedBy: userId,
    });

    const deleted = await installRepo.delete(install.id, orgId);
    expect(deleted).toBe(true);

    const found = await installRepo.getById(install.id, orgId);
    expect(found).toBeNull();

    const list = await installRepo.listForOrg(orgId);
    expect(list).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Connector credential persistence (PostgreSQL)
// ---------------------------------------------------------------------------

describe("Connector credential persistence (PostgreSQL)", () => {
  it("stores encrypted credentials for install", async () => {
    const { orgId, userId } = await seedOrg();
    const { connectorId } = await seedConnector();
    const db = getTestDb();
    const installRepo = new PgConnectorInstallRepo(db.forTenant(orgId));
    const credentialRepo = new PgConnectorCredentialRepo(db.forTenant(orgId));

    const install = await installRepo.create({
      orgId,
      connectorId,
      connectorSlug: "echo",
      config: {},
      grantedScopes: [],
      installedBy: userId,
    });

    const encrypted = encryptSecret("my-super-secret-api-key");
    await credentialRepo.upsert({
      orgId,
      connectorInstallId: install.id,
      credentialType: "api_key",
      encryptedData: encrypted,
    });

    const cred = await credentialRepo.getByInstallId(install.id, orgId);
    expect(cred).not.toBeNull();
    expect(cred!.credentialType).toBe("api_key");
    // The stored data should be encrypted, not plaintext
    expect(cred!.encryptedData).not.toBe("my-super-secret-api-key");
    // Decryption should recover the original value
    expect(decryptSecret(cred!.encryptedData)).toBe("my-super-secret-api-key");
  });

  it("retrieves credentials by install id", async () => {
    const { orgId, userId } = await seedOrg();
    const { connectorId } = await seedConnector();
    const db = getTestDb();
    const installRepo = new PgConnectorInstallRepo(db.forTenant(orgId));
    const credentialRepo = new PgConnectorCredentialRepo(db.forTenant(orgId));

    const install = await installRepo.create({
      orgId,
      connectorId,
      connectorSlug: "echo",
      config: {},
      grantedScopes: [],
      installedBy: userId,
    });

    const encrypted = encryptSecret("secret-123");
    await credentialRepo.upsert({
      orgId,
      connectorInstallId: install.id,
      credentialType: "oauth_token",
      encryptedData: encrypted,
    });

    const cred = await credentialRepo.getByInstallId(install.id, orgId);
    expect(cred).not.toBeNull();
    expect(cred!.credentialType).toBe("oauth_token");
    expect(decryptSecret(cred!.encryptedData)).toBe("secret-123");
  });

  it("upserts credentials (update existing)", async () => {
    const { orgId, userId } = await seedOrg();
    const { connectorId } = await seedConnector();
    const db = getTestDb();
    const installRepo = new PgConnectorInstallRepo(db.forTenant(orgId));
    const credentialRepo = new PgConnectorCredentialRepo(db.forTenant(orgId));

    const install = await installRepo.create({
      orgId,
      connectorId,
      connectorSlug: "echo",
      config: {},
      grantedScopes: [],
      installedBy: userId,
    });

    // First upsert
    const encrypted1 = encryptSecret("original-key");
    await credentialRepo.upsert({
      orgId,
      connectorInstallId: install.id,
      credentialType: "api_key",
      encryptedData: encrypted1,
    });

    // Second upsert (update)
    const encrypted2 = encryptSecret("updated-key");
    await credentialRepo.upsert({
      orgId,
      connectorInstallId: install.id,
      credentialType: "api_key",
      encryptedData: encrypted2,
    });

    const cred = await credentialRepo.getByInstallId(install.id, orgId);
    expect(cred).not.toBeNull();
    expect(decryptSecret(cred!.encryptedData)).toBe("updated-key");
  });

  it("deletes credentials on revoke", async () => {
    const { orgId, userId } = await seedOrg();
    const { connectorId } = await seedConnector();
    const db = getTestDb();
    const installRepo = new PgConnectorInstallRepo(db.forTenant(orgId));
    const credentialRepo = new PgConnectorCredentialRepo(db.forTenant(orgId));

    const install = await installRepo.create({
      orgId,
      connectorId,
      connectorSlug: "echo",
      config: {},
      grantedScopes: [],
      installedBy: userId,
    });

    const encrypted = encryptSecret("delete-me");
    await credentialRepo.upsert({
      orgId,
      connectorInstallId: install.id,
      credentialType: "api_key",
      encryptedData: encrypted,
    });

    const deleted = await credentialRepo.deleteByInstallId(install.id, orgId);
    expect(deleted).toBe(true);

    const cred = await credentialRepo.getByInstallId(install.id, orgId);
    expect(cred).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. Skill catalog and install persistence (PostgreSQL)
// ---------------------------------------------------------------------------

describe("Skill catalog and install persistence (PostgreSQL)", () => {
  it("creates a skill in the catalog", async () => {
    const db = getTestDb();
    const skillRepo = new PgSkillRepo(db.unscoped());

    const skill = await skillRepo.create({
      slug: "research-assistant",
      name: "Research Assistant",
      description: "Bundles echo and weather connectors",
      trustTier: "verified",
      connectorSlugs: ["echo", "weather"],
    });

    expect(skill.id).toBeTruthy();
    expect(skill.slug).toBe("research-assistant");
    expect(skill.trustTier).toBe("verified");
    expect(skill.connectorSlugs).toEqual(["echo", "weather"]);
  });

  it("installs a skill for org", async () => {
    const { orgId, userId } = await seedOrg();
    const db = getTestDb();
    const skillRepo = new PgSkillRepo(db.unscoped());
    const installRepo = new PgSkillInstallRepo(db.forTenant(orgId));

    const skill = await skillRepo.create({
      slug: "research-assistant",
      name: "Research Assistant",
      trustTier: "verified",
      connectorSlugs: ["echo"],
    });

    const install = await installRepo.create({
      orgId,
      skillId: skill.id,
      skillSlug: skill.slug,
      installedBy: userId,
    });

    expect(install.id).toBeTruthy();
    expect(install.orgId).toBe(orgId);
    expect(install.skillId).toBe(skill.id);
    expect(install.skillSlug).toBe("research-assistant");
    expect(install.enabled).toBe(true);
  });

  it("prevents duplicate skill install", async () => {
    const { orgId, userId } = await seedOrg();
    const db = getTestDb();
    const skillRepo = new PgSkillRepo(db.unscoped());
    const installRepo = new PgSkillInstallRepo(db.forTenant(orgId));

    const skill = await skillRepo.create({
      slug: "research-assistant",
      name: "Research Assistant",
      trustTier: "verified",
      connectorSlugs: ["echo"],
    });

    await installRepo.create({
      orgId,
      skillId: skill.id,
      skillSlug: skill.slug,
      installedBy: userId,
    });

    // Second install should fail
    await expect(
      installRepo.create({
        orgId,
        skillId: skill.id,
        skillSlug: skill.slug,
        installedBy: userId,
      }),
    ).rejects.toThrow();
  });

  it("uninstalls a skill", async () => {
    const { orgId, userId } = await seedOrg();
    const db = getTestDb();
    const skillRepo = new PgSkillRepo(db.unscoped());
    const installRepo = new PgSkillInstallRepo(db.forTenant(orgId));

    const skill = await skillRepo.create({
      slug: "research-assistant",
      name: "Research Assistant",
      trustTier: "verified",
      connectorSlugs: ["echo"],
    });

    await installRepo.create({
      orgId,
      skillId: skill.id,
      skillSlug: skill.slug,
      installedBy: userId,
    });

    const deleted = await installRepo.delete(skill.id, orgId);
    expect(deleted).toBe(true);

    const found = await installRepo.getBySkillId(skill.id, orgId);
    expect(found).toBeNull();
  });

  it("lists installed skills", async () => {
    const { orgId, userId } = await seedOrg();
    const db = getTestDb();
    const skillRepo = new PgSkillRepo(db.unscoped());
    const installRepo = new PgSkillInstallRepo(db.forTenant(orgId));

    const skill1 = await skillRepo.create({
      slug: "research-assistant",
      name: "Research Assistant",
      trustTier: "verified",
      connectorSlugs: ["echo"],
    });

    const skill2 = await skillRepo.create({
      slug: "data-analyzer",
      name: "Data Analyzer",
      trustTier: "internal",
      connectorSlugs: ["weather"],
    });

    await installRepo.create({ orgId, skillId: skill1.id, skillSlug: skill1.slug, installedBy: userId });
    await installRepo.create({ orgId, skillId: skill2.id, skillSlug: skill2.slug, installedBy: userId });

    const installs = await installRepo.listForOrg(orgId);
    expect(installs).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// 5. Tenant isolation for connector/skill installs (PostgreSQL)
// ---------------------------------------------------------------------------

describe("Tenant isolation for connector/skill installs (PostgreSQL)", () => {
  it("org B cannot see org A's connector installs", async () => {
    const db = getTestDb();
    const userRepo = new PgUserRepo(db.unscoped());
    const orgRepo = new PgOrgRepo(db.unscoped());
    const membershipRepo = new PgMembershipRepo(db.unscoped());

    // Org A
    const userA = await userRepo.create({ email: "alice@a.com", name: "Alice" });
    const orgA = await orgRepo.create({ name: "Org A", slug: "org-a" });
    await membershipRepo.create({ orgId: orgA.id, userId: userA.id, role: "org_owner", accepted: true });

    // Org B
    const userB = await userRepo.create({ email: "bob@b.com", name: "Bob" });
    const orgB = await orgRepo.create({ name: "Org B", slug: "org-b" });
    await membershipRepo.create({ orgId: orgB.id, userId: userB.id, role: "org_owner", accepted: true });

    const { connectorId } = await seedConnector();

    // Install for Org A
    const installRepoA = new PgConnectorInstallRepo(db.forTenant(orgA.id));
    await installRepoA.create({
      orgId: orgA.id,
      connectorId,
      connectorSlug: "echo",
      config: {},
      grantedScopes: [],
      installedBy: userA.id,
    });

    // Org B should see no installs
    const installRepoB = new PgConnectorInstallRepo(db.forTenant(orgB.id));
    const installs = await installRepoB.listForOrg(orgB.id);
    expect(installs).toHaveLength(0);
  });

  it("org B cannot see org A's skill installs", async () => {
    const db = getTestDb();
    const userRepo = new PgUserRepo(db.unscoped());
    const orgRepo = new PgOrgRepo(db.unscoped());
    const membershipRepo = new PgMembershipRepo(db.unscoped());

    const userA = await userRepo.create({ email: "alice@a.com", name: "Alice" });
    const orgA = await orgRepo.create({ name: "Org A", slug: "org-a" });
    await membershipRepo.create({ orgId: orgA.id, userId: userA.id, role: "org_owner", accepted: true });

    const userB = await userRepo.create({ email: "bob@b.com", name: "Bob" });
    const orgB = await orgRepo.create({ name: "Org B", slug: "org-b" });
    await membershipRepo.create({ orgId: orgB.id, userId: userB.id, role: "org_owner", accepted: true });

    const skillRepo = new PgSkillRepo(db.unscoped());
    const skill = await skillRepo.create({
      slug: "research-assistant",
      name: "Research Assistant",
      trustTier: "verified",
      connectorSlugs: ["echo"],
    });

    // Install for Org A
    const skillInstallRepoA = new PgSkillInstallRepo(db.forTenant(orgA.id));
    await skillInstallRepoA.create({
      orgId: orgA.id,
      skillId: skill.id,
      skillSlug: skill.slug,
      installedBy: userA.id,
    });

    // Org B should see no skill installs
    const skillInstallRepoB = new PgSkillInstallRepo(db.forTenant(orgB.id));
    const installs = await skillInstallRepoB.listForOrg(orgB.id);
    expect(installs).toHaveLength(0);
  });

  it("org B cannot see org A's credentials", async () => {
    const db = getTestDb();
    const userRepo = new PgUserRepo(db.unscoped());
    const orgRepo = new PgOrgRepo(db.unscoped());
    const membershipRepo = new PgMembershipRepo(db.unscoped());

    const userA = await userRepo.create({ email: "alice@a.com", name: "Alice" });
    const orgA = await orgRepo.create({ name: "Org A", slug: "org-a" });
    await membershipRepo.create({ orgId: orgA.id, userId: userA.id, role: "org_owner", accepted: true });

    const userB = await userRepo.create({ email: "bob@b.com", name: "Bob" });
    const orgB = await orgRepo.create({ name: "Org B", slug: "org-b" });
    await membershipRepo.create({ orgId: orgB.id, userId: userB.id, role: "org_owner", accepted: true });

    const { connectorId } = await seedConnector();

    // Install and store credentials for Org A
    const installRepoA = new PgConnectorInstallRepo(db.forTenant(orgA.id));
    const installA = await installRepoA.create({
      orgId: orgA.id,
      connectorId,
      connectorSlug: "echo",
      config: {},
      grantedScopes: [],
      installedBy: userA.id,
    });

    const credRepoA = new PgConnectorCredentialRepo(db.forTenant(orgA.id));
    const encrypted = encryptSecret("org-a-secret");
    await credRepoA.upsert({
      orgId: orgA.id,
      connectorInstallId: installA.id,
      credentialType: "api_key",
      encryptedData: encrypted,
    });

    // Org B should not be able to retrieve Org A's credentials
    const credRepoB = new PgConnectorCredentialRepo(db.forTenant(orgB.id));
    const cred = await credRepoB.getByInstallId(installA.id, orgB.id);
    expect(cred).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 6. Connector audit event persistence (PostgreSQL)
// ---------------------------------------------------------------------------

describe("Connector audit event persistence (PostgreSQL)", () => {
  it("persists connector.installed audit event", async () => {
    const { orgId, userId } = await seedOrg();
    const db = getTestDb();
    const auditRepo = new PgAuditRepo(db.forTenant(orgId));

    const event = await auditRepo.emit({
      orgId,
      actorId: userId,
      actorType: "user",
      action: "connector.installed",
      resourceType: "connector",
      resourceId: "00000000-0000-0000-0000-000000000080",
      metadata: { connectorSlug: "echo" },
    });

    expect(event.id).toBeTruthy();
    expect(event.action).toBe("connector.installed");

    const events = await auditRepo.query(orgId, { action: "connector.installed" });
    expect(events).toHaveLength(1);
    expect(events[0]!.metadata).toEqual({ connectorSlug: "echo" });
  });

  it("persists connector.configured audit event", async () => {
    const { orgId, userId } = await seedOrg();
    const db = getTestDb();
    const auditRepo = new PgAuditRepo(db.forTenant(orgId));

    await auditRepo.emit({
      orgId,
      actorId: userId,
      actorType: "user",
      action: "connector.configured",
      resourceType: "connector",
      resourceId: "00000000-0000-0000-0000-000000000081",
      metadata: { hasCredentials: true },
    });

    const events = await auditRepo.query(orgId, { action: "connector.configured" });
    expect(events).toHaveLength(1);
  });

  it("persists connector.revoked audit event", async () => {
    const { orgId, userId } = await seedOrg();
    const db = getTestDb();
    const auditRepo = new PgAuditRepo(db.forTenant(orgId));

    await auditRepo.emit({
      orgId,
      actorId: userId,
      actorType: "user",
      action: "connector.revoked",
      resourceType: "connector",
      resourceId: "00000000-0000-0000-0000-000000000082",
      metadata: { connectorSlug: "echo" },
    });

    const events = await auditRepo.query(orgId, { action: "connector.revoked" });
    expect(events).toHaveLength(1);
  });

  it("persists skill.installed audit event", async () => {
    const { orgId, userId } = await seedOrg();
    const db = getTestDb();
    const auditRepo = new PgAuditRepo(db.forTenant(orgId));

    await auditRepo.emit({
      orgId,
      actorId: userId,
      actorType: "user",
      action: "skill.installed",
      resourceType: "skill",
      resourceId: "00000000-0000-0000-0000-000000000083",
      metadata: { skillSlug: "research-assistant" },
    });

    const events = await auditRepo.query(orgId, { action: "skill.installed" });
    expect(events).toHaveLength(1);
  });

  it("persists run.tool_used audit event", async () => {
    const { orgId } = await seedOrg();
    const db = getTestDb();
    const auditRepo = new PgAuditRepo(db.forTenant(orgId));

    await auditRepo.emit({
      orgId,
      actorType: "system",
      action: "run.tool_used",
      resourceType: "run",
      resourceId: "00000000-0000-0000-0000-000000000084",
      metadata: { toolName: "echo", connectorSlug: "echo", stepNumber: 2 },
    });

    const events = await auditRepo.query(orgId, { action: "run.tool_used" });
    expect(events).toHaveLength(1);
    expect(events[0]!.actorType).toBe("system");
    expect(events[0]!.metadata).toEqual({ toolName: "echo", connectorSlug: "echo", stepNumber: 2 });
  });
});

// ---------------------------------------------------------------------------
// 7. End-to-end connector-enabled run proof (PostgreSQL)
// ---------------------------------------------------------------------------

describe("End-to-end connector-enabled run proof (PostgreSQL)", () => {
  it("proves full connector-enabled run chain", async () => {
    const { orgId, userId, projectId } = await seedOrg();
    const { connectorId, slug: connectorSlug } = await seedConnector();
    const db = getTestDb();
    const tenantDb = db.forTenant(orgId);

    // Install connector for org
    const installRepo = new PgConnectorInstallRepo(tenantDb);
    const install = await installRepo.create({
      orgId,
      connectorId,
      connectorSlug,
      config: {},
      grantedScopes: ["echo:read"],
      installedBy: userId,
    });
    expect(install.id).toBeTruthy();

    // Create agent with tools referencing the installed connector
    const agentRepo = new PgAgentRepo(tenantDb);
    const agent = await agentRepo.create({
      orgId,
      projectId,
      name: "Tool-Enabled Agent",
      slug: "tool-agent",
      createdBy: userId,
    });

    const versionRepo = new PgAgentVersionRepo(tenantDb);
    const version = await versionRepo.create({
      orgId,
      agentId: agent.id,
      version: 1,
      goals: ["Use echo tool"],
      instructions: "Use the echo tool to echo the user message",
      tools: [{ name: "echo", connectorId: connectorSlug }],
      budget: { maxTokens: 10000 },
      approvalRules: [],
      memoryConfig: null,
      schedule: null,
      modelConfig: { provider: "openai", model: "gpt-4o", temperature: 0.7 },
      createdBy: userId,
    });

    // Publish the version
    await versionRepo.publish(version.id, orgId);
    const published = await versionRepo.getPublished(agent.id);
    expect(published).not.toBeNull();
    expect(published!.id).toBe(version.id);

    // Create a run with the published version
    const runRepo = new PgRunRepo(tenantDb);
    const run = await runRepo.create({
      orgId,
      projectId,
      agentId: agent.id,
      agentVersionId: version.id,
      triggerType: "manual",
      triggeredBy: userId,
      executionProvider: "local",
      input: { message: "Hello" },
      configSnapshot: {
        model: "gpt-4o",
        tools: [{ name: "echo", connectorId: connectorSlug }],
      },
    });
    expect(run.id).toBeTruthy();
    expect(run.status).toBe("queued");

    // Simulate tool execution by creating a tool_call run step
    const stepRepo = new PgRunStepRepo(tenantDb);

    // Step 1: LLM call
    const llmStep = await stepRepo.create({
      orgId,
      runId: run.id,
      stepNumber: 1,
      type: "llm_call",
      input: { instructions: "Use the echo tool", model: "gpt-4o" },
    });
    await stepRepo.updateStatus(llmStep.id, orgId, "completed", {
      output: { response: "I'll use the echo tool" },
      tokenUsage: { inputTokens: 50, outputTokens: 25, totalTokens: 75 },
      latencyMs: 100,
      startedAt: toISODateString(new Date()),
      completedAt: toISODateString(new Date()),
    });

    // Step 2: Tool call
    const toolStep = await stepRepo.create({
      orgId,
      runId: run.id,
      stepNumber: 2,
      type: "tool_call",
      toolName: "echo",
      input: { toolName: "echo", args: { message: "Hello" } },
    });
    await stepRepo.updateStatus(toolStep.id, orgId, "completed", {
      output: { echoed: "Hello" },
      providerMetadata: { connectorSlug: "echo" },
      latencyMs: 50,
      startedAt: toISODateString(new Date()),
      completedAt: toISODateString(new Date()),
    });

    // Verify run steps persist with tool evidence
    const steps = await stepRepo.listForRun(run.id);
    expect(steps).toHaveLength(2);
    expect(steps[0]!.type).toBe("llm_call");
    expect(steps[1]!.type).toBe("tool_call");
    expect(steps[1]!.toolName).toBe("echo");
    expect(steps[1]!.output).toEqual({ echoed: "Hello" });
    expect(steps[1]!.providerMetadata).toEqual({ connectorSlug: "echo" });

    // Complete the run
    await runRepo.updateStatus(run.id, orgId, "starting");
    await runRepo.updateStatus(run.id, orgId, "running");
    await runRepo.updateStatus(run.id, orgId, "completed", {
      output: { response: "Done", tool_echo: { echoed: "Hello" } },
      tokenUsage: { inputTokens: 50, outputTokens: 25, totalTokens: 75 },
      completedAt: toISODateString(new Date()),
    });

    const completedRun = await runRepo.getById(run.id, orgId);
    expect(completedRun).not.toBeNull();
    expect(completedRun!.status).toBe("completed");
    expect(completedRun!.output).toEqual({ response: "Done", tool_echo: { echoed: "Hello" } });

    // Revoke connector
    await installRepo.delete(install.id, orgId);

    // Verify connector is no longer installed
    const afterRevoke = await installRepo.listForOrg(orgId);
    expect(afterRevoke).toHaveLength(0);

    // Verify a new lookup for installed connectors finds nothing
    const noInstall = await installRepo.getByConnectorId(connectorId, orgId);
    expect(noInstall).toBeNull();
  });
});
