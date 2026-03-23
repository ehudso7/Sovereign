// ---------------------------------------------------------------------------
// Memory service — Phase 8 memory engine
// ---------------------------------------------------------------------------

import { createHash } from "node:crypto";
import { ok, err, AppError, toISODateString } from "@sovereign/core";
import type {
  OrgId,
  UserId,
  MemoryId,
  MemoryKind,
  MemoryScopeType,
  MemoryStatus,
  Memory,
  MemoryLink,
  CreateMemoryInput,
  UpdateMemoryInput,
  Result,
  AuditEmitter,
} from "@sovereign/core";
import type { MemoryRepo, MemoryLinkRepo } from "@sovereign/db";

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export class PgMemoryService {
  constructor(
    private readonly memoryRepo: MemoryRepo,
    private readonly memoryLinkRepo: MemoryLinkRepo,
    private readonly audit: AuditEmitter,
  ) {}

  // ---------------------------------------------------------------------------
  // createMemory
  // ---------------------------------------------------------------------------

  async createMemory(input: CreateMemoryInput): Promise<Result<Memory>> {
    try {
      // Check for duplicate by content hash
      const contentHash = hashContent(input.content);
      const existing = await this.memoryRepo.getByContentHash(input.orgId, contentHash);
      if (existing) {
        return err(AppError.conflict("A memory with identical content already exists in this org"));
      }

      const memory = await this.memoryRepo.create(input);

      await this.audit.emit({
        orgId: input.orgId,
        actorId: input.createdBy,
        actorType: "user",
        action: "memory.created",
        resourceType: "memory",
        resourceId: memory.id,
        metadata: { kind: input.kind, scopeType: input.scopeType, scopeId: input.scopeId },
      });

      return ok(memory);
    } catch (e) {
      return err(AppError.internal(e instanceof Error ? e.message : "Failed to create memory"));
    }
  }

  // ---------------------------------------------------------------------------
  // getMemory
  // ---------------------------------------------------------------------------

  async getMemory(id: MemoryId, orgId: OrgId): Promise<Result<Memory>> {
    const memory = await this.memoryRepo.getById(id, orgId);
    if (!memory) return err(AppError.notFound("Memory", id));
    return ok(memory);
  }

  // ---------------------------------------------------------------------------
  // listMemories
  // ---------------------------------------------------------------------------

  async listMemories(
    orgId: OrgId,
    filters?: { scopeType?: MemoryScopeType; scopeId?: string; kind?: MemoryKind; status?: MemoryStatus },
  ): Promise<Result<Memory[]>> {
    const memories = await this.memoryRepo.listForOrg(orgId, filters);
    return ok(memories);
  }

  // ---------------------------------------------------------------------------
  // searchMemories
  // ---------------------------------------------------------------------------

  async searchMemories(
    orgId: OrgId,
    query: string,
    filters?: { scopeType?: MemoryScopeType; scopeId?: string; kind?: MemoryKind; maxResults?: number },
  ): Promise<Result<Memory[]>> {
    if (!query || query.trim().length === 0) {
      return err(AppError.badRequest("Search query cannot be empty"));
    }
    const memories = await this.memoryRepo.search(orgId, query, filters);
    return ok(memories);
  }

  // ---------------------------------------------------------------------------
  // updateMemory
  // ---------------------------------------------------------------------------

  async updateMemory(id: MemoryId, orgId: OrgId, input: UpdateMemoryInput): Promise<Result<Memory>> {
    const existing = await this.memoryRepo.getById(id, orgId);
    if (!existing) return err(AppError.notFound("Memory", id));
    if (existing.status !== "active") {
      return err(AppError.badRequest(`Cannot update memory with status "${existing.status}"`));
    }

    const updated = await this.memoryRepo.update(id, orgId, input);
    if (!updated) return err(AppError.internal("Failed to update memory"));

    await this.audit.emit({
      orgId,
      actorId: input.updatedBy,
      actorType: "user",
      action: "memory.updated",
      resourceType: "memory",
      resourceId: id,
      metadata: {},
    });

    return ok(updated);
  }

  // ---------------------------------------------------------------------------
  // redactMemory
  // ---------------------------------------------------------------------------

  async redactMemory(id: MemoryId, orgId: OrgId, actorId: UserId): Promise<Result<Memory>> {
    const existing = await this.memoryRepo.getById(id, orgId);
    if (!existing) return err(AppError.notFound("Memory", id));

    const updated = await this.memoryRepo.updateStatus(id, orgId, "redacted", {
      redactedAt: toISODateString(new Date()),
      content: "[REDACTED]",
      contentHash: hashContent("[REDACTED]"),
    });
    if (!updated) return err(AppError.internal("Failed to redact memory"));

    await this.audit.emit({
      orgId,
      actorId,
      actorType: "user",
      action: "memory.redacted",
      resourceType: "memory",
      resourceId: id,
      metadata: { previousStatus: existing.status },
    });

    return ok(updated);
  }

  // ---------------------------------------------------------------------------
  // expireMemory
  // ---------------------------------------------------------------------------

  async expireMemory(id: MemoryId, orgId: OrgId, actorId: UserId): Promise<Result<Memory>> {
    const existing = await this.memoryRepo.getById(id, orgId);
    if (!existing) return err(AppError.notFound("Memory", id));

    const updated = await this.memoryRepo.updateStatus(id, orgId, "expired");
    if (!updated) return err(AppError.internal("Failed to expire memory"));

    await this.audit.emit({
      orgId,
      actorId,
      actorType: "user",
      action: "memory.expired",
      resourceType: "memory",
      resourceId: id,
      metadata: { previousStatus: existing.status },
    });

    return ok(updated);
  }

  // ---------------------------------------------------------------------------
  // deleteMemory (soft delete)
  // ---------------------------------------------------------------------------

  async deleteMemory(id: MemoryId, orgId: OrgId, actorId: UserId): Promise<Result<Memory>> {
    const existing = await this.memoryRepo.getById(id, orgId);
    if (!existing) return err(AppError.notFound("Memory", id));

    const updated = await this.memoryRepo.updateStatus(id, orgId, "deleted");
    if (!updated) return err(AppError.internal("Failed to delete memory"));

    await this.audit.emit({
      orgId,
      actorId,
      actorType: "user",
      action: "memory.deleted",
      resourceType: "memory",
      resourceId: id,
      metadata: { previousStatus: existing.status },
    });

    return ok(updated);
  }

  // ---------------------------------------------------------------------------
  // promoteMemory (episodic -> procedural)
  // ---------------------------------------------------------------------------

  async promoteMemory(id: MemoryId, orgId: OrgId, actorId: UserId): Promise<Result<Memory>> {
    const existing = await this.memoryRepo.getById(id, orgId);
    if (!existing) return err(AppError.notFound("Memory", id));
    if (existing.kind !== "episodic") {
      return err(AppError.badRequest("Only episodic memories can be promoted to procedural"));
    }
    if (existing.status !== "active") {
      return err(AppError.badRequest(`Cannot promote memory with status "${existing.status}"`));
    }

    // Create a new procedural memory from the episodic one
    const promoted = await this.memoryRepo.create({
      orgId,
      scopeType: existing.scopeType,
      scopeId: existing.scopeId,
      kind: "procedural",
      title: existing.title,
      summary: existing.summary,
      content: existing.content,
      metadata: { ...existing.metadata, promotedFromId: existing.id },
      sourceRunId: existing.sourceRunId ?? undefined,
      sourceAgentId: existing.sourceAgentId ?? undefined,
      createdBy: actorId,
    });

    // Link the promoted memory back to the original
    await this.memoryLinkRepo.create({
      orgId,
      memoryId: promoted.id,
      linkedEntityType: "memory",
      linkedEntityId: existing.id,
      linkType: "promoted_from",
      metadata: {},
    });

    // Mark the original as expired
    await this.memoryRepo.updateStatus(id, orgId, "expired");

    await this.audit.emit({
      orgId,
      actorId,
      actorType: "user",
      action: "memory.promoted",
      resourceType: "memory",
      resourceId: promoted.id,
      metadata: { originalMemoryId: existing.id, fromKind: "episodic", toKind: "procedural" },
    });

    return ok(promoted);
  }

  // ---------------------------------------------------------------------------
  // retrieveForRun — runtime memory read
  // ---------------------------------------------------------------------------

  async retrieveForRun(
    orgId: OrgId,
    scopeType: MemoryScopeType,
    scopeId: string,
    memoryConfig: { allowedKinds?: readonly string[]; maxRetrievalCount?: number; readEnabled?: boolean },
    actorId: UserId,
  ): Promise<Result<Memory[]>> {
    if (memoryConfig.readEnabled === false) {
      return ok([]);
    }

    // Retrieve active memories for the given scope
    const memories = await this.memoryRepo.listForOrg(orgId, {
      scopeType,
      scopeId,
      status: "active",
    });

    // Filter by allowed kinds if specified
    const allowedKinds = memoryConfig.allowedKinds;
    let filtered = memories;
    if (allowedKinds && allowedKinds.length > 0) {
      const kindSet = new Set(allowedKinds);
      filtered = memories.filter((m) => kindSet.has(m.kind));
    }

    // Apply max retrieval count
    const maxCount = memoryConfig.maxRetrievalCount ?? 50;
    const result = filtered.slice(0, maxCount);

    await this.audit.emit({
      orgId,
      actorId,
      actorType: "system",
      action: "memory.retrieved_for_run",
      resourceType: "memory",
      resourceId: scopeId,
      metadata: { scopeType, scopeId, count: result.length },
    });

    return ok(result);
  }

  // ---------------------------------------------------------------------------
  // writeEpisodicFromRun — runtime memory write
  // ---------------------------------------------------------------------------

  async writeEpisodicFromRun(
    orgId: OrgId,
    runId: string,
    agentId: string,
    summary: string,
    content: string,
    createdBy: UserId,
  ): Promise<Result<Memory>> {
    try {
      const memory = await this.memoryRepo.create({
        orgId,
        scopeType: "agent",
        scopeId: agentId,
        kind: "episodic",
        title: `Run ${runId.slice(0, 8)} episode`,
        summary,
        content,
        sourceRunId: runId,
        sourceAgentId: agentId,
        createdBy,
      });

      // Create link to source run
      await this.memoryLinkRepo.create({
        orgId,
        memoryId: memory.id,
        linkedEntityType: "run",
        linkedEntityId: runId,
        linkType: "source_run",
        metadata: { agentId },
      });

      await this.audit.emit({
        orgId,
        actorId: createdBy,
        actorType: "system",
        action: "memory.created",
        resourceType: "memory",
        resourceId: memory.id,
        metadata: { kind: "episodic", sourceRunId: runId, sourceAgentId: agentId },
      });

      return ok(memory);
    } catch (e) {
      return err(AppError.internal(e instanceof Error ? e.message : "Failed to write episodic memory"));
    }
  }

  // ---------------------------------------------------------------------------
  // getLinksForMemory
  // ---------------------------------------------------------------------------

  async getLinksForMemory(memoryId: MemoryId, orgId: OrgId): Promise<Result<MemoryLink[]>> {
    const memory = await this.memoryRepo.getById(memoryId, orgId);
    if (!memory) return err(AppError.notFound("Memory", memoryId));

    const links = await this.memoryLinkRepo.listForMemory(memoryId, orgId);
    return ok(links);
  }
}
