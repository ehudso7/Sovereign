import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { AuthConfig } from "@sovereign/core";
import { buildApp } from "../../index.js";
import { getTestDb, setupTestDb, teardownTestDb, truncateAllTables } from "@sovereign/db/test-harness";

const AUTH_CONFIG: AuthConfig = {
  mode: "local",
  sessionSecret: "test-e2e-session-secret-minimum-32-chars!!",
  sessionTtlMs: 24 * 60 * 60 * 1000,
};

function toCookieHeader(setCookie: string[]): string {
  return setCookie.map((value) => value.split(";")[0]).join("; ");
}

function getCookieValue(setCookie: string[], name: string): string | null {
  for (const entry of setCookie) {
    const [pair] = entry.split(";");
    if (!pair) continue;
    const [cookieName, rawValue = ""] = pair.split("=");
    if (cookieName === name) {
      return decodeURIComponent(rawValue);
    }
  }
  return null;
}

describe("Auth session cookies", () => {
  let app: FastifyInstance;

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

  it("sets secure session cookies on bootstrap and authenticates with cookies", async () => {
    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/v1/auth/bootstrap",
      payload: {
        email: "founder@test.com",
        name: "Founder",
        orgName: "Founding Org",
        orgSlug: "founding-org",
      },
    });

    expect(bootstrap.statusCode).toBe(201);
    const setCookie = bootstrap.headers["set-cookie"];
    expect(Array.isArray(setCookie)).toBe(true);
    expect(getCookieValue(setCookie as string[], "sovereign_session")).toBeTruthy();
    expect(getCookieValue(setCookie as string[], "sovereign_csrf")).toBeTruthy();

    const me = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: {
        cookie: toCookieHeader(setCookie as string[]),
      },
    });

    expect(me.statusCode).toBe(200);
    expect(me.json().data.user.email).toBe("founder@test.com");
  });

  it("requires a matching csrf token for cookie-authenticated mutations", async () => {
    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/v1/auth/bootstrap",
      payload: {
        email: "owner@test.com",
        name: "Owner",
        orgName: "Owner Org",
        orgSlug: "owner-org",
      },
    });

    const setCookie = bootstrap.headers["set-cookie"] as string[];
    const csrf = getCookieValue(setCookie, "sovereign_csrf");
    expect(csrf).toBeTruthy();

    const missingCsrf = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: {
        cookie: toCookieHeader(setCookie),
      },
    });
    expect(missingCsrf.statusCode).toBe(403);

    const logout = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: {
        cookie: toCookieHeader(setCookie),
        "x-csrf-token": csrf!,
      },
    });
    expect(logout.statusCode).toBe(200);
  });

  it("exchanges a bearer token for cookie-backed session state", async () => {
    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/v1/auth/bootstrap",
      payload: {
        email: "exchange@test.com",
        name: "Exchange",
        orgName: "Exchange Org",
        orgSlug: "exchange-org",
      },
    });

    const token = bootstrap.json().data.auth.sessionToken as string;
    const exchange = await app.inject({
      method: "POST",
      url: "/api/v1/auth/session",
      payload: { token },
    });

    expect(exchange.statusCode).toBe(200);
    const setCookie = exchange.headers["set-cookie"] as string[];
    expect(getCookieValue(setCookie, "sovereign_session")).toBe(token);
    expect(getCookieValue(setCookie, "sovereign_csrf")).toBeTruthy();
  });
});
