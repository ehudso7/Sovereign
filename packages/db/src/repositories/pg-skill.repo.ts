import {
  toSkillId,
  toISODateString,
} from "@sovereign/core";
import type {
  SkillId,
  Skill,
  SkillTrustTier,
} from "@sovereign/core";
import type { UnscopedDb } from "../client.js";
import type { SkillRepo } from "./types.js";

interface SkillRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  trust_tier: string;
  connector_slugs: readonly string[] | string;
  metadata: Record<string, unknown> | string;
  created_at: string;
  updated_at: string;
}

function parseJsonRequired<T>(val: T | string): T {
  if (typeof val === "string") return JSON.parse(val) as T;
  return val;
}

function toSkill(row: SkillRow): Skill {
  return {
    id: toSkillId(row.id),
    slug: row.slug,
    name: row.name,
    description: row.description ?? "",
    trustTier: row.trust_tier as SkillTrustTier,
    connectorSlugs: parseJsonRequired<readonly string[]>(row.connector_slugs),
    metadata: parseJsonRequired<Record<string, unknown>>(row.metadata),
    createdAt: toISODateString(row.created_at),
    updatedAt: toISODateString(row.updated_at),
  };
}

/**
 * Skill repo is unscoped (global catalog).
 */
export class PgSkillRepo implements SkillRepo {
  constructor(private readonly db: UnscopedDb) {}

  async create(input: {
    slug: string;
    name: string;
    description?: string;
    trustTier: string;
    connectorSlugs: readonly string[];
    metadata?: Record<string, unknown>;
  }): Promise<Skill> {
    const row = await this.db.queryOne<SkillRow>(
      `INSERT INTO skills (slug, name, description, trust_tier, connector_slugs, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.slug,
        input.name,
        input.description ?? null,
        input.trustTier,
        JSON.stringify(input.connectorSlugs),
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    if (!row) throw new Error("Failed to create skill");
    return toSkill(row);
  }

  async getById(id: SkillId): Promise<Skill | null> {
    const row = await this.db.queryOne<SkillRow>(
      "SELECT * FROM skills WHERE id = $1",
      [id],
    );
    return row ? toSkill(row) : null;
  }

  async getBySlug(slug: string): Promise<Skill | null> {
    const row = await this.db.queryOne<SkillRow>(
      "SELECT * FROM skills WHERE slug = $1",
      [slug],
    );
    return row ? toSkill(row) : null;
  }

  async listAll(filters?: { trustTier?: string }): Promise<Skill[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters?.trustTier !== undefined) {
      conditions.push(`trust_tier = $${idx++}`);
      params.push(filters.trustTier);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = await this.db.query<SkillRow>(
      `SELECT * FROM skills ${where} ORDER BY created_at`,
      params,
    );
    return rows.map(toSkill);
  }
}
