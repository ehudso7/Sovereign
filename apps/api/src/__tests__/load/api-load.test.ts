/**
 * Load / Stress Verification — Phase 14 Release Hardening
 *
 * Practical load verification for CI. Tests API health under concurrent
 * requests and key query paths under pressure.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../index.js";
import { setupTestDb, teardownTestDb, getTestDb, truncateAllTables } from "@sovereign/db/test-harness";
import type { AuthConfig } from "@sovereign/core";

let app: FastifyInstance;

const AUTH_CONFIG: AuthConfig = {
  mode: "local",
  sessionSecret: "test-load-session-secret-minimum-32-chars!!",
  sessionTtlMs: 24 * 60 * 60 * 1000,
};

async function bootstrap(): Promise<{ token: string; orgId: string }> {
  const email = `load-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`;
  const slug = `load-org-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/dev/bootstrap",
    payload: { email, name: "Load User", orgName: "Load Org", orgSlug: slug },
  });
  const body = res.json();
  return { token: body.data.auth.sessionToken, orgId: body.data.org.id };
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

describe("Load / Stress Verification", () => {
  beforeAll(async () => {
    await setupTestDb();
    app = buildApp(AUTH_CONFIG, getTestDb());
    await app.ready();
  }, 60_000);

  afterAll(async () => {
    await app.close();
    await teardownTestDb();
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  // =========================================================================
  // Health endpoint under concurrent load
  // =========================================================================

  it("handles 50 concurrent health checks", async () => {
    const requests = Array.from({ length: 50 }, () =>
      app.inject({ method: "GET", url: "/api/v1/health" }),
    );
    const responses = await Promise.all(requests);
    const ok = responses.filter((r) => r.statusCode === 200);
    expect(ok.length).toBe(50);
  }, 15_000);

  // =========================================================================
  // Auth endpoint under concurrent load
  // =========================================================================

  it("handles 20 concurrent bootstrap requests", async () => {
    const requests = Array.from({ length: 20 }, (_, i) =>
      app.inject({
        method: "POST",
        url: "/api/v1/dev/bootstrap",
        payload: {
          email: `concurrent-${i}-${Date.now()}@test.com`,
          name: `User ${i}`,
          orgName: `Org ${i}`,
          orgSlug: `concurrent-org-${i}-${Date.now()}`,
        },
      }),
    );
    const responses = await Promise.all(requests);
    const ok = responses.filter((r) => r.statusCode === 201);
    expect(ok.length).toBe(20);
  }, 30_000);

  // =========================================================================
  // Run creation + listing pressure
  // =========================================================================

  it("handles 10 sequential run creations then concurrent listing", async () => {
    const { token } = await bootstrap();

    // Create project + agent + version + publish
    const projRes = await app.inject({
      method: "POST", url: "/api/v1/projects", headers: auth(token),
      payload: { name: "Load Project", slug: "load-proj" },
    });
    const projectId = projRes.json().data.id;

    const agentRes = await app.inject({
      method: "POST", url: "/api/v1/agents", headers: auth(token),
      payload: { name: "Load Agent", slug: "load-agent", projectId },
    });
    const agentId = agentRes.json().data.id;

    const versionRes = await app.inject({
      method: "POST", url: `/api/v1/agents/${agentId}/versions`, headers: auth(token),
      payload: { goals: ["test"], instructions: "load", tools: [], modelConfig: { provider: "local", model: "test" } },
    });
    const versionId = versionRes.json().data.id;

    await app.inject({
      method: "POST", url: `/api/v1/agents/${agentId}/versions/${versionId}/publish`, headers: auth(token),
    });

    // Create 10 runs
    for (let i = 0; i < 10; i++) {
      const res = await app.inject({
        method: "POST", url: `/api/v1/agents/${agentId}/runs`, headers: auth(token),
        payload: { triggerType: "manual" },
      });
      expect(res.statusCode).toBe(201);
    }

    // 10 concurrent list requests
    const listRequests = Array.from({ length: 10 }, () =>
      app.inject({ method: "GET", url: "/api/v1/runs", headers: auth(token) }),
    );
    const listResponses = await Promise.all(listRequests);
    for (const r of listResponses) {
      expect(r.statusCode).toBe(200);
      expect(r.json().data.length).toBe(10);
    }
  }, 30_000);

  // =========================================================================
  // Mission control overview under pressure
  // =========================================================================

  it("handles 10 concurrent mission-control/overview requests", async () => {
    const { token } = await bootstrap();
    const requests = Array.from({ length: 10 }, () =>
      app.inject({ method: "GET", url: "/api/v1/mission-control/overview", headers: auth(token) }),
    );
    const responses = await Promise.all(requests);
    const ok = responses.filter((r) => r.statusCode === 200);
    expect(ok.length).toBe(10);
  }, 15_000);

  // =========================================================================
  // Memory creation + search pressure
  // =========================================================================

  it("handles 20 memory creations then concurrent search", async () => {
    const { token } = await bootstrap();

    for (let i = 0; i < 20; i++) {
      await app.inject({
        method: "POST", url: "/api/v1/memories", headers: auth(token),
        payload: { kind: "semantic", scopeType: "org", title: `Mem ${i}`, content: `Content ${i} searchable` },
      });
    }

    // 5 concurrent searches
    const searches = Array.from({ length: 5 }, () =>
      app.inject({ method: "GET", url: "/api/v1/memories/search?q=searchable", headers: auth(token) }),
    );
    const results = await Promise.all(searches);
    for (const r of results) {
      expect(r.statusCode).toBe(200);
    }
  }, 30_000);

  // =========================================================================
  // Billing/usage aggregation pressure
  // =========================================================================

  it("handles concurrent billing reads", async () => {
    const { token } = await bootstrap();
    const requests = Array.from({ length: 10 }, () =>
      app.inject({ method: "GET", url: "/api/v1/billing/usage", headers: auth(token) }),
    );
    const responses = await Promise.all(requests);
    // 200 or 404 (no billing account) are both acceptable
    for (const r of responses) {
      expect([200, 404]).toContain(r.statusCode);
    }
  }, 15_000);
});
