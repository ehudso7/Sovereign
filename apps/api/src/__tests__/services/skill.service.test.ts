import { describe, it, expect, beforeEach } from "vitest";
import type { OrgId, UserId, Skill } from "@sovereign/core";
import { PgSkillService } from "../../services/skill.service.js";
import { PgAuditEmitter } from "../../services/audit.service.js";
import {
  createTestRepos,
  TestSkillRepo,
  TestSkillInstallRepo,
  TestAuditRepo,
  type TestRepos,
} from "../helpers/test-repos.js";

describe("SkillService", () => {
  let repos: TestRepos;
  let skillRepo: TestSkillRepo;
  let installRepo: TestSkillInstallRepo;
  let auditRepo: TestAuditRepo;
  let service: PgSkillService;
  let orgId: OrgId;
  let userId: UserId;
  let seededSkill: Skill;

  beforeEach(async () => {
    repos = createTestRepos();
    skillRepo = repos.skills;
    installRepo = repos.skillInstalls;
    auditRepo = repos.audit;

    service = new PgSkillService(
      skillRepo,
      installRepo,
      new PgAuditEmitter(auditRepo),
    );

    // Create a test user and org
    const user = repos.users.createSync({ email: "owner@test.com", name: "Owner" });
    userId = user.id;
    const org = await repos.orgs.create({ name: "Test Org", slug: "test-org" });
    orgId = org.id;

    // Seed a skill in the catalog
    seededSkill = await skillRepo.create({
      slug: "research-assistant",
      name: "Research Assistant",
      description: "A skill that packages echo and weather tools for research tasks.",
      trustTier: "verified",
      connectorSlugs: ["echo", "weather"],
    });
  });

  // ---------------------------------------------------------------------------
  // listCatalog
  // ---------------------------------------------------------------------------

  describe("listCatalog", () => {
    it("returns seeded skills", async () => {
      const result = await service.listCatalog();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(1);
        expect(result.value[0]!.slug).toBe("research-assistant");
      }
    });
  });

  // ---------------------------------------------------------------------------
  // getSkill
  // ---------------------------------------------------------------------------

  describe("getSkill", () => {
    it("returns skill by ID", async () => {
      const result = await service.getSkill(seededSkill.id);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBe(seededSkill.id);
        expect(result.value.slug).toBe("research-assistant");
      }
    });
  });

  // ---------------------------------------------------------------------------
  // install
  // ---------------------------------------------------------------------------

  describe("install", () => {
    it("installs a skill", async () => {
      const result = await service.install(seededSkill.id, orgId, userId);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.orgId).toBe(orgId);
        expect(result.value.skillId).toBe(seededSkill.id);
        expect(result.value.skillSlug).toBe("research-assistant");
        expect(result.value.enabled).toBe(true);
      }
    });

    it("rejects duplicate install", async () => {
      const first = await service.install(seededSkill.id, orgId, userId);
      expect(first.ok).toBe(true);

      const second = await service.install(seededSkill.id, orgId, userId);
      expect(second.ok).toBe(false);
      if (!second.ok) expect(second.error.code).toBe("CONFLICT");
    });
  });

  // ---------------------------------------------------------------------------
  // uninstall
  // ---------------------------------------------------------------------------

  describe("uninstall", () => {
    it("removes installed skill", async () => {
      await service.install(seededSkill.id, orgId, userId);

      const result = await service.uninstall(seededSkill.id, orgId, userId);
      expect(result.ok).toBe(true);

      // Verify the install is gone
      const listResult = await service.listInstalled(orgId);
      expect(listResult.ok).toBe(true);
      if (listResult.ok) expect(listResult.value.length).toBe(0);
    });

    it("returns NOT_FOUND if not installed", async () => {
      const result = await service.uninstall(seededSkill.id, orgId, userId);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });
});
