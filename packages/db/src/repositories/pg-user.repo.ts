import {
  toUserId,
  toISODateString,
} from "@sovereign/core";
import type { UserId, User } from "@sovereign/core";
import type { UnscopedDb } from "../client.js";
import type { UserRepo, UserRow } from "./types.js";

function toUser(row: UserRow): User & { passwordHash?: string } {
  return {
    id: toUserId(row.id),
    email: row.email,
    name: row.name,
    avatarUrl: row.avatar_url ?? undefined,
    workosUserId: row.workos_user_id ?? undefined,
    passwordHash: row.password_hash ?? undefined,
    createdAt: toISODateString(row.created_at),
    updatedAt: toISODateString(row.updated_at),
  };
}

export class PgUserRepo implements UserRepo {
  constructor(private readonly db: UnscopedDb) {}

  async create(input: {
    email: string;
    name: string;
    avatarUrl?: string;
    workosUserId?: string;
    passwordHash?: string;
  }): Promise<User> {
    const row = await this.db.queryOne<UserRow>(
      `INSERT INTO users (email, name, avatar_url, workos_user_id, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [input.email, input.name, input.avatarUrl ?? null, input.workosUserId ?? null, input.passwordHash ?? null],
    );
    if (!row) throw new Error("Failed to create user");
    return toUser(row);
  }

  async getById(id: UserId): Promise<User | null> {
    const row = await this.db.queryOne<UserRow>(
      "SELECT * FROM users WHERE id = $1",
      [id],
    );
    return row ? toUser(row) : null;
  }

  async getByEmail(email: string): Promise<(User & { passwordHash?: string }) | null> {
    const row = await this.db.queryOne<UserRow>(
      "SELECT * FROM users WHERE email = $1",
      [email],
    );
    return row ? toUser(row) : null;
  }

  async update(id: UserId, input: Partial<{ name: string; avatarUrl: string }>): Promise<User | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (input.name !== undefined) {
      sets.push(`name = $${idx++}`);
      params.push(input.name);
    }
    if (input.avatarUrl !== undefined) {
      sets.push(`avatar_url = $${idx++}`);
      params.push(input.avatarUrl);
    }
    if (sets.length === 0) return this.getById(id);

    sets.push(`updated_at = now()`);
    params.push(id);

    const row = await this.db.queryOne<UserRow>(
      `UPDATE users SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      params,
    );
    return row ? toUser(row) : null;
  }
}
