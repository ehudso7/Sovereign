import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../index.js";
import { getTestDb, setupTestDb, teardownTestDb, truncateAllTables } from "@sovereign/db/test-harness";
import type { AuthConfig } from "@sovereign/core";

let app: FastifyInstance;

const AUTH_CONFIG: AuthConfig = {
  mode: "local",
  sessionSecret: "test-e2e-session-secret-minimum-32-chars!!",
  sessionTtlMs: 24 * 60 * 60 * 1000,
};

describe("Auth Bootstrap", () => {
  beforeAll(async () => {
    await setupTestDb();
    app = buildApp(AUTH_CONFIG, getTestDb());
    await app.ready();
  }, 60_000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await teardownTestDb();
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  it("bootstraps the first user on an empty installation", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/bootstrap",
      payload: {
        email: "founder@test.com",
        name: "Founder",
        orgName: "Founding Org",
        orgSlug: "founding-org",
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.user.email).toBe("founder@test.com");
    expect(res.json().data.org.slug).toBe("founding-org");
    expect(res.json().data.auth.sessionToken).toBeTruthy();
  });

  it("rejects bootstrap once the installation already has users", async () => {
    const first = await app.inject({
      method: "POST",
      url: "/api/v1/auth/bootstrap",
      payload: {
        email: "owner@test.com",
        name: "Owner",
        orgName: "Owner Org",
        orgSlug: "owner-org",
      },
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: "POST",
      url: "/api/v1/auth/bootstrap",
      payload: {
        email: "second@test.com",
        name: "Second",
        orgName: "Second Org",
        orgSlug: "second-org",
      },
    });

    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toBe("BOOTSTRAP_NOT_ALLOWED");
  });
});
