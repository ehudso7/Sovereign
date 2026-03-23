// ---------------------------------------------------------------------------
// Skill service — catalog, install, uninstall
// ---------------------------------------------------------------------------

import { ok, err, AppError } from "@sovereign/core";
import type {
  Skill,
  SkillInstall,
  SkillId,
  OrgId,
  UserId,
  Result,
  AuditEmitter,
} from "@sovereign/core";
import type { SkillRepo, SkillInstallRepo } from "@sovereign/db";

export class PgSkillService {
  constructor(
    private readonly skillRepo: SkillRepo,
    private readonly installRepo: SkillInstallRepo,
    private readonly audit: AuditEmitter,
  ) {}

  async listCatalog(filters?: { trustTier?: string }): Promise<Result<Skill[]>> {
    const skills = await this.skillRepo.listAll(filters);
    return ok(skills);
  }

  async getSkill(skillId: SkillId): Promise<Result<Skill>> {
    const skill = await this.skillRepo.getById(skillId);
    if (!skill) return err(AppError.notFound("Skill", skillId));
    return ok(skill);
  }

  async listInstalled(orgId: OrgId): Promise<Result<SkillInstall[]>> {
    const installs = await this.installRepo.listForOrg(orgId);
    return ok(installs);
  }

  async install(
    skillId: SkillId,
    orgId: OrgId,
    userId: UserId,
  ): Promise<Result<SkillInstall>> {
    try {
      const skill = await this.skillRepo.getById(skillId);
      if (!skill) return err(AppError.notFound("Skill", skillId));

      const existing = await this.installRepo.getBySkillId(skillId, orgId);
      if (existing) {
        return err(new AppError("CONFLICT", `Skill "${skill.name}" is already installed`, 409));
      }

      const install = await this.installRepo.create({
        orgId,
        skillId,
        skillSlug: skill.slug,
        installedBy: userId,
      });

      await this.audit.emit({
        orgId,
        actorId: userId,
        actorType: "user",
        action: "skill.installed",
        resourceType: "skill",
        resourceId: skillId,
        metadata: { skillSlug: skill.slug },
      });

      return ok(install);
    } catch (e) {
      return err(AppError.internal(e instanceof Error ? e.message : "Failed to install skill"));
    }
  }

  async uninstall(
    skillId: SkillId,
    orgId: OrgId,
    userId: UserId,
  ): Promise<Result<void>> {
    try {
      const skill = await this.skillRepo.getById(skillId);
      if (!skill) return err(AppError.notFound("Skill", skillId));

      const existing = await this.installRepo.getBySkillId(skillId, orgId);
      if (!existing) {
        return err(new AppError("NOT_FOUND", "Skill is not installed", 404));
      }

      await this.installRepo.delete(skillId, orgId);

      await this.audit.emit({
        orgId,
        actorId: userId,
        actorType: "user",
        action: "skill.uninstalled",
        resourceType: "skill",
        resourceId: skillId,
        metadata: { skillSlug: skill.slug },
      });

      return ok(undefined);
    } catch (e) {
      return err(AppError.internal(e instanceof Error ? e.message : "Failed to uninstall skill"));
    }
  }
}
