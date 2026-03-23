import {
  toConnectorId,
  toISODateString,
} from "@sovereign/core";
import type {
  ConnectorId,
  Connector,
  ConnectorTrustTier,
  ConnectorAuthMode,
  ConnectorStatus,
  ConnectorTool,
  ConnectorScope,
} from "@sovereign/core";
import type { UnscopedDb } from "../client.js";
import type { ConnectorRepo } from "./types.js";

interface ConnectorRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  trust_tier: string;
  auth_mode: string;
  status: string;
  tools: readonly ConnectorTool[] | string;
  scopes: readonly ConnectorScope[] | string;
  metadata: Record<string, unknown> | string;
  created_at: string;
  updated_at: string;
}

function parseJsonRequired<T>(val: T | string): T {
  if (typeof val === "string") return JSON.parse(val) as T;
  return val;
}

function toConnector(row: ConnectorRow): Connector {
  return {
    id: toConnectorId(row.id),
    slug: row.slug,
    name: row.name,
    description: row.description ?? "",
    category: row.category,
    trustTier: row.trust_tier as ConnectorTrustTier,
    authMode: row.auth_mode as ConnectorAuthMode,
    status: row.status as ConnectorStatus,
    tools: parseJsonRequired<readonly ConnectorTool[]>(row.tools),
    scopes: parseJsonRequired<readonly ConnectorScope[]>(row.scopes),
    metadata: parseJsonRequired<Record<string, unknown>>(row.metadata),
    createdAt: toISODateString(row.created_at),
    updatedAt: toISODateString(row.updated_at),
  };
}

/**
 * Connector repo is unscoped (global catalog).
 */
export class PgConnectorRepo implements ConnectorRepo {
  constructor(private readonly db: UnscopedDb) {}

  async create(input: {
    slug: string;
    name: string;
    description?: string;
    category: string;
    trustTier: string;
    authMode: string;
    status?: string;
    tools: readonly unknown[];
    scopes: readonly unknown[];
    metadata?: Record<string, unknown>;
  }): Promise<Connector> {
    const row = await this.db.queryOne<ConnectorRow>(
      `INSERT INTO connectors (slug, name, description, category, trust_tier, auth_mode, status, tools, scopes, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        input.slug,
        input.name,
        input.description ?? null,
        input.category,
        input.trustTier,
        input.authMode,
        input.status ?? "active",
        JSON.stringify(input.tools),
        JSON.stringify(input.scopes),
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    if (!row) throw new Error("Failed to create connector");
    return toConnector(row);
  }

  async getById(id: ConnectorId): Promise<Connector | null> {
    const row = await this.db.queryOne<ConnectorRow>(
      "SELECT * FROM connectors WHERE id = $1",
      [id],
    );
    return row ? toConnector(row) : null;
  }

  async getBySlug(slug: string): Promise<Connector | null> {
    const row = await this.db.queryOne<ConnectorRow>(
      "SELECT * FROM connectors WHERE slug = $1",
      [slug],
    );
    return row ? toConnector(row) : null;
  }

  async listAll(filters?: { category?: string; trustTier?: string; status?: string }): Promise<Connector[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters?.category !== undefined) {
      conditions.push(`category = $${idx++}`);
      params.push(filters.category);
    }
    if (filters?.trustTier !== undefined) {
      conditions.push(`trust_tier = $${idx++}`);
      params.push(filters.trustTier);
    }
    if (filters?.status !== undefined) {
      conditions.push(`status = $${idx++}`);
      params.push(filters.status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = await this.db.query<ConnectorRow>(
      `SELECT * FROM connectors ${where} ORDER BY created_at`,
      params,
    );
    return rows.map(toConnector);
  }
}
