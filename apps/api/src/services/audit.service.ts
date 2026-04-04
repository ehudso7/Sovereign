// ---------------------------------------------------------------------------
// Audit service — backed by AuditRepo
// ---------------------------------------------------------------------------

import type { AuditEmitter, EmitAuditEventInput, AuditEvent, AuditQueryParams, OrgId } from "@sovereign/core";
import type { AuditRepo } from "@sovereign/db";

export class PgAuditEmitter implements AuditEmitter {
  constructor(private readonly repo: AuditRepo) {}

  async emit(input: EmitAuditEventInput): Promise<void> {
    await this.repo.emit(input);
  }

  async query(orgId: OrgId, params?: AuditQueryParams): Promise<readonly AuditEvent[]> {
    return this.repo.query(orgId, params);
  }

  async getById(eventId: string): Promise<AuditEvent | null> {
    return this.repo.getById(eventId);
  }
}
