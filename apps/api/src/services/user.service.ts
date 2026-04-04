// ---------------------------------------------------------------------------
// User service — backed by UserRepo
// ---------------------------------------------------------------------------

import { ok, err, AppError } from "@sovereign/core";
import type { UserService, User, CreateUserInput, UserId, Result } from "@sovereign/core";
import type { UserRepo } from "@sovereign/db";

export class PgUserService implements UserService {
  constructor(private readonly repo: UserRepo) {}

  async create(input: CreateUserInput): Promise<Result<User>> {
    const existing = await this.repo.getByEmail(input.email);
    if (existing) {
      return err(AppError.conflict(`User with email ${input.email} already exists`));
    }

    try {
      const user = await this.repo.create({
        email: input.email,
        name: input.name,
        avatarUrl: input.avatarUrl,
        workosUserId: input.workosUserId,
      });
      return ok(user);
    } catch (e) {
      return err(AppError.internal(e instanceof Error ? e.message : "Failed to create user"));
    }
  }

  async getById(id: UserId): Promise<Result<User>> {
    const user = await this.repo.getById(id);
    if (!user) return err(AppError.notFound("User", id));
    return ok(user);
  }

  async countUsers(): Promise<Result<number>> {
    try {
      return ok(await this.repo.countAll());
    } catch (e) {
      return err(AppError.internal(e instanceof Error ? e.message : "Failed to count users"));
    }
  }

  async getByEmail(email: string): Promise<Result<User>> {
    const user = await this.repo.getByEmail(email);
    if (!user) return err(AppError.notFound("User"));
    return ok(user);
  }

  async update(id: UserId, input: Partial<CreateUserInput>): Promise<Result<User>> {
    const user = await this.repo.update(id, input);
    if (!user) return err(AppError.notFound("User", id));
    return ok(user);
  }
}
