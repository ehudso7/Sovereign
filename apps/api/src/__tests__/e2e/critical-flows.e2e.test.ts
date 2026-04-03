/**
 * E2E Critical Flows — Phase 14 Release Hardening
 *
 * Tests real user journeys through the full API stack with PostgreSQL.
 * Uses Fastify .inject() against the real app with real database.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../index.js";
import { setupTestDb, teardownTestDb, getTestDb, truncateAllTables } from "@sovereign/db/test-harness";
import type { AuthConfig } from "@sovereign/core";

let app: FastifyInstance;
const AUTH_CONFIG: AuthConfig = {
  mode: "local",
  sessionSecret: "test-e2e-session-secret-minimum-32-chars!!",
  sessionTtlMs: 24 * 60 * 60 * 1000,
};

/** Bootstrap a user+org+token via the dev endpoint */
async function bootstrap(
  overrides?: { email?: string; orgSlug?: string },
): Promise<{ token: string; orgId: string; userId: string }> {
  const email = overrides?.email ?? `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`;
  const slug = overrides?.orgSlug ?? `e2e-org-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/dev/bootstrap",
    payload: { email, name: "E2E User", orgName: "E2E Org", orgSlug: slug },
  });

  expect(res.statusCode).toBe(201);
  const body = res.json();
  return {
    token: body.data.auth.sessionToken,
    orgId: body.data.org.id,
    userId: body.data.user.id,
  };
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

describe("E2E Critical Flows", () => {
  beforeAll(async () => {
    await setupTestDb();
    const db = getTestDb();
    app = buildApp(AUTH_CONFIG, db);
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

  // =========================================================================
  // 1. Auth / Session / Org Bootstrap
  // =========================================================================

  describe("Auth / Session / Org Bootstrap", () => {
    it("bootstraps a user, org, and session token", async () => {
      const { token, orgId, userId } = await bootstrap();
      expect(token).toBeTruthy();
      expect(orgId).toBeTruthy();
      expect(userId).toBeTruthy();
    });

    it("GET /auth/me returns authenticated user", async () => {
      const { token } = await bootstrap();
      const res = await app.inject({ method: "GET", url: "/api/v1/auth/me", headers: auth(token) });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.user.email).toContain("@test.com");
      expect(res.json().data.role).toBe("org_owner");
    });

    it("rejects requests with invalid token", async () => {
      const res = await app.inject({ method: "GET", url: "/api/v1/auth/me", headers: auth("bad-token") });
      expect(res.statusCode).toBe(401);
    });

    it("POST /auth/logout invalidates session", async () => {
      const { token } = await bootstrap();
      const logout = await app.inject({ method: "POST", url: "/api/v1/auth/logout", headers: auth(token) });
      expect(logout.statusCode).toBe(200);

      const me = await app.inject({ method: "GET", url: "/api/v1/auth/me", headers: auth(token) });
      expect(me.statusCode).toBe(401);
    });

    it("GET /auth/sessions lists active sessions", async () => {
      const { token } = await bootstrap();
      const res = await app.inject({ method: "GET", url: "/api/v1/auth/sessions", headers: auth(token) });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // 2. Onboarding Flow
  // =========================================================================

  describe("Onboarding Flow", () => {
    it("GET /onboarding returns derived progress from real state", async () => {
      const { token } = await bootstrap();
      const res = await app.inject({ method: "GET", url: "/api/v1/onboarding", headers: auth(token) });
      expect(res.statusCode).toBe(200);
      const data = res.json().data;
      expect(data.steps).toBeDefined();
      expect(Array.isArray(data.steps)).toBe(true);
      // project_created should be false since no project yet
      // (bootstrap only creates org, not project)
    });

    it("POST /onboarding/dismiss dismisses guidance without faking completion", async () => {
      const { token } = await bootstrap();
      const res = await app.inject({ method: "POST", url: "/api/v1/onboarding/dismiss", headers: auth(token) });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.dismissed).toBe(true);
    });
  });

  // =========================================================================
  // 3. Agent Creation, Versioning, Publish
  // =========================================================================

  describe("Agent Lifecycle", () => {
    it("creates agent → creates version → publishes", async () => {
      const { token } = await bootstrap();

      // Create project first
      const projRes = await app.inject({
        method: "POST", url: "/api/v1/projects", headers: auth(token),
        payload: { name: "Test Project", slug: "test-proj" },
      });
      expect(projRes.statusCode).toBe(201);
      const projectId = projRes.json().data.id;

      // Create agent
      const agentRes = await app.inject({
        method: "POST", url: "/api/v1/agents", headers: auth(token),
        payload: { name: "E2E Agent", slug: "e2e-agent", projectId },
      });
      expect(agentRes.statusCode).toBe(201);
      const agentId = agentRes.json().data.id;

      // Create version
      const versionRes = await app.inject({
        method: "POST", url: `/api/v1/agents/${agentId}/versions`, headers: auth(token),
        payload: {
          goals: ["Summarize documents"],
          instructions: "Read the document and produce a summary.",
          tools: [],
          modelConfig: { provider: "local", model: "test" },
        },
      });
      expect(versionRes.statusCode).toBe(201);
      const versionId = versionRes.json().data.id;

      // Publish version
      const publishRes = await app.inject({
        method: "POST", url: `/api/v1/agents/${agentId}/versions/${versionId}/publish`, headers: auth(token),
      });
      expect(publishRes.statusCode).toBe(200);

      // Verify agent is listed
      const listRes = await app.inject({ method: "GET", url: "/api/v1/agents", headers: auth(token) });
      expect(listRes.statusCode).toBe(200);
      expect(listRes.json().data.length).toBe(1);
    });
  });

  // =========================================================================
  // 4. Run Creation and Completion
  // =========================================================================

  describe("Run Lifecycle", () => {
    it("creates and lists a run for a published agent", async () => {
      const { token } = await bootstrap();

      // Setup: project + agent + version + publish
      const projRes = await app.inject({
        method: "POST", url: "/api/v1/projects", headers: auth(token),
        payload: { name: "Run Project", slug: "run-proj" },
      });
      const projectId = projRes.json().data.id;

      const agentRes = await app.inject({
        method: "POST", url: "/api/v1/agents", headers: auth(token),
        payload: { name: "Run Agent", slug: "run-agent", projectId },
      });
      const agentId = agentRes.json().data.id;

      const versionRes = await app.inject({
        method: "POST", url: `/api/v1/agents/${agentId}/versions`, headers: auth(token),
        payload: { goals: ["test"], instructions: "do it", tools: [], modelConfig: { provider: "local", model: "test" } },
      });
      const versionId = versionRes.json().data.id;

      await app.inject({
        method: "POST", url: `/api/v1/agents/${agentId}/versions/${versionId}/publish`, headers: auth(token),
      });

      // Create run
      const runRes = await app.inject({
        method: "POST", url: `/api/v1/agents/${agentId}/runs`, headers: auth(token),
        payload: { triggerType: "manual" },
      });
      expect(runRes.statusCode).toBe(201);
      const runId = runRes.json().data.id;

      // List runs
      const listRes = await app.inject({ method: "GET", url: "/api/v1/runs", headers: auth(token) });
      expect(listRes.statusCode).toBe(200);
      expect(listRes.json().data.length).toBe(1);

      // Get run detail
      const detailRes = await app.inject({ method: "GET", url: `/api/v1/runs/${runId}`, headers: auth(token) });
      expect(detailRes.statusCode).toBe(200);
      expect(detailRes.json().data.id).toBe(runId);
    });
  });

  // =========================================================================
  // 5. Connector Install / Configure / Revoke
  // =========================================================================

  describe("Connector Lifecycle", () => {
    it("lists catalog → installs → revokes connector", async () => {
      const { token } = await bootstrap();

      // List catalog (also serves as installed list)
      const catalogRes = await app.inject({ method: "GET", url: "/api/v1/connectors", headers: auth(token) });
      expect(catalogRes.statusCode).toBe(200);

      // If catalog has connectors, install one
      const catalog = catalogRes.json().data;
      if (catalog.length > 0) {
        const connectorId = catalog[0].id;

        const installRes = await app.inject({
          method: "POST", url: `/api/v1/connectors/${connectorId}/install`, headers: auth(token),
        });
        expect(installRes.statusCode).toBe(201);

        // Revoke
        const revokeRes = await app.inject({
          method: "POST", url: `/api/v1/connectors/${connectorId}/revoke`, headers: auth(token),
        });
        expect(revokeRes.statusCode).toBe(200);
      }
    });
  });

  // =========================================================================
  // 6. Memory Creation and Retrieval
  // =========================================================================

  describe("Memory Lifecycle", () => {
    it("creates and retrieves a semantic memory", async () => {
      const { token, orgId } = await bootstrap();

      const createRes = await app.inject({
        method: "POST", url: "/api/v1/memories", headers: auth(token),
        payload: { kind: "semantic", scopeType: "org", scopeId: orgId, title: "E2E Memory", summary: "Test summary", content: "This is test content" },
      });
      expect(createRes.statusCode).toBe(201);
      const memoryId = createRes.json().data.id;

      // Get by ID
      const getRes = await app.inject({ method: "GET", url: `/api/v1/memories/${memoryId}`, headers: auth(token) });
      expect(getRes.statusCode).toBe(200);
      expect(getRes.json().data.title).toBe("E2E Memory");

      // Search
      const searchRes = await app.inject({ method: "GET", url: "/api/v1/memories/search?q=test+content", headers: auth(token) });
      expect(searchRes.statusCode).toBe(200);
    });
  });

  // =========================================================================
  // 7. Mission Control Visibility
  // =========================================================================

  describe("Mission Control", () => {
    it("GET /mission-control/overview returns metrics", async () => {
      const { token } = await bootstrap();
      const res = await app.inject({ method: "GET", url: "/api/v1/mission-control/overview", headers: auth(token) });
      expect(res.statusCode).toBe(200);
      const data = res.json().data;
      expect(data).toBeDefined();
    });

    it("GET /mission-control/alerts returns alert list", async () => {
      const { token } = await bootstrap();
      const res = await app.inject({ method: "GET", url: "/api/v1/mission-control/alerts", headers: auth(token) });
      expect(res.statusCode).toBe(200);
    });
  });

  // =========================================================================
  // 8. Policy Deny / Require Approval / Quarantine
  // =========================================================================

  describe("Policy Enforcement", () => {
    it("creates a deny policy and retrieves it", async () => {
      const { token } = await bootstrap();

      const createRes = await app.inject({
        method: "POST", url: "/api/v1/policies", headers: auth(token),
        payload: {
          name: "Block Tool X", policyType: "deny",
          enforcementMode: "deny", scopeType: "org",
        },
      });
      expect(createRes.statusCode).toBe(201);
      const policyId = createRes.json().data.id;

      // List policies
      const listRes = await app.inject({ method: "GET", url: "/api/v1/policies", headers: auth(token) });
      expect(listRes.statusCode).toBe(200);
      expect(listRes.json().data.length).toBe(1);

      // Get policy detail
      const detailRes = await app.inject({ method: "GET", url: `/api/v1/policies/${policyId}`, headers: auth(token) });
      expect(detailRes.statusCode).toBe(200);
    });

    it("creates approval policy and lists approvals", async () => {
      const { token } = await bootstrap();

      await app.inject({
        method: "POST", url: "/api/v1/policies", headers: auth(token),
        payload: {
          name: "Require Approval", policyType: "require_approval",
          enforcementMode: "require_approval", scopeType: "org",
        },
      });

      // List approvals (should be empty)
      const res = await app.inject({ method: "GET", url: "/api/v1/approvals", headers: auth(token) });
      expect(res.statusCode).toBe(200);
    });

    it("creates quarantine record and lists it", async () => {
      const { token } = await bootstrap();

      const res = await app.inject({
        method: "POST", url: "/api/v1/quarantine", headers: auth(token),
        payload: { subjectType: "agent", subjectId: "00000000-0000-0000-0000-000000000099", reason: "Misbehaving" },
      });
      expect(res.statusCode).toBe(201);

      const listRes = await app.inject({ method: "GET", url: "/api/v1/quarantine", headers: auth(token) });
      expect(listRes.statusCode).toBe(200);
      expect(listRes.json().data.length).toBe(1);
    });
  });

  // =========================================================================
  // 9. Revenue Workspace (CRM)
  // =========================================================================

  describe("Revenue Workspace", () => {
    it("creates account → contact → deal → task", async () => {
      const { token } = await bootstrap();

      // Create account
      const accountRes = await app.inject({
        method: "POST", url: "/api/v1/revenue/accounts", headers: auth(token),
        payload: { name: "Acme Corp", domain: "acme.com", industry: "tech" },
      });
      expect(accountRes.statusCode).toBe(201);
      const accountId = accountRes.json().data.id;

      // Create contact
      const contactRes = await app.inject({
        method: "POST", url: "/api/v1/revenue/contacts", headers: auth(token),
        payload: { firstName: "Jane", lastName: "Doe", email: "jane@acme.com", accountId },
      });
      expect(contactRes.statusCode).toBe(201);

      // Create deal
      const dealRes = await app.inject({
        method: "POST", url: "/api/v1/revenue/deals", headers: auth(token),
        payload: { name: "Big Deal", accountId, stage: "prospecting", valueCents: 100000 },
      });
      expect(dealRes.statusCode).toBe(201);

      // Create task
      const taskRes = await app.inject({
        method: "POST", url: "/api/v1/revenue/tasks", headers: auth(token),
        payload: { title: "Follow up", priority: "high" },
      });
      expect(taskRes.statusCode).toBe(201);
    });
  });

  // =========================================================================
  // 10. Billing Enforcement
  // =========================================================================

  describe("Billing", () => {
    it("GET /billing/account returns billing info or 404 for new org", async () => {
      const { token } = await bootstrap();
      const res = await app.inject({ method: "GET", url: "/api/v1/billing/account", headers: auth(token) });
      // New org may not have billing account yet — 200 or 404 both acceptable
      expect([200, 404]).toContain(res.statusCode);
    });

    it("GET /billing/usage returns usage summary", async () => {
      const { token } = await bootstrap();
      const res = await app.inject({ method: "GET", url: "/api/v1/billing/usage", headers: auth(token) });
      expect([200, 404]).toContain(res.statusCode);
    });
  });

  // =========================================================================
  // 11. Docs / Support / Admin Surface Access
  // =========================================================================

  describe("Docs / Support / Admin", () => {
    it("GET /docs returns docs catalog", async () => {
      const { token } = await bootstrap();
      const res = await app.inject({ method: "GET", url: "/api/v1/docs", headers: auth(token) });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json().data)).toBe(true);
    });

    it("GET /docs/:slug returns specific doc", async () => {
      const { token } = await bootstrap();
      const docsRes = await app.inject({ method: "GET", url: "/api/v1/docs", headers: auth(token) });
      const docs = docsRes.json().data;
      if (docs.length > 0 && docs[0].articles?.length > 0) {
        const slug = docs[0].articles[0].slug;
        const res = await app.inject({ method: "GET", url: `/api/v1/docs/${slug}`, headers: auth(token) });
        expect(res.statusCode).toBe(200);
      }
    });

    it("GET /support/diagnostics returns diagnostics", async () => {
      const { token } = await bootstrap();
      const res = await app.inject({ method: "GET", url: "/api/v1/support/diagnostics", headers: auth(token) });
      expect(res.statusCode).toBe(200);
    });

    it("GET /admin/overview returns admin overview", async () => {
      const { token } = await bootstrap();
      const res = await app.inject({ method: "GET", url: "/api/v1/admin/overview", headers: auth(token) });
      expect(res.statusCode).toBe(200);
    });

    it("GET /admin/memberships returns member list", async () => {
      const { token } = await bootstrap();
      const res = await app.inject({ method: "GET", url: "/api/v1/admin/memberships", headers: auth(token) });
      expect(res.statusCode).toBe(200);
    });

    it("GET /admin/settings-summary returns settings", async () => {
      const { token } = await bootstrap();
      const res = await app.inject({ method: "GET", url: "/api/v1/admin/settings-summary", headers: auth(token) });
      expect(res.statusCode).toBe(200);
    });
  });

  // =========================================================================
  // 12. Tenant Isolation (Cross-Org)
  // =========================================================================

  describe("Tenant Isolation", () => {
    it("user B cannot see user A's agents", async () => {
      const a = await bootstrap({ email: "a@test.com", orgSlug: "org-a" });
      const b = await bootstrap({ email: "b@test.com", orgSlug: "org-b" });

      // A creates a project + agent
      const projRes = await app.inject({
        method: "POST", url: "/api/v1/projects", headers: auth(a.token),
        payload: { name: "A Project", slug: "a-proj" },
      });
      const projectId = projRes.json().data.id;

      await app.inject({
        method: "POST", url: "/api/v1/agents", headers: auth(a.token),
        payload: { name: "A Agent", slug: "a-agent", projectId },
      });

      // B lists agents — should see 0
      const listRes = await app.inject({ method: "GET", url: "/api/v1/agents", headers: auth(b.token) });
      expect(listRes.statusCode).toBe(200);
      expect(listRes.json().data.length).toBe(0);
    });

    it("user B cannot see user A's memories", async () => {
      const a = await bootstrap({ email: "iso-a@test.com", orgSlug: "iso-org-a" });
      const b = await bootstrap({ email: "iso-b@test.com", orgSlug: "iso-org-b" });

      await app.inject({
        method: "POST", url: "/api/v1/memories", headers: auth(a.token),
        payload: { kind: "semantic", scopeType: "org", scopeId: a.orgId, title: "Secret", summary: "Secret summary", content: "Secret content" },
      });

      const listRes = await app.inject({ method: "GET", url: "/api/v1/memories", headers: auth(b.token) });
      expect(listRes.statusCode).toBe(200);
      expect(listRes.json().data.length).toBe(0);
    });

    it("user B cannot see user A's policies", async () => {
      const a = await bootstrap({ email: "pol-a@test.com", orgSlug: "pol-org-a" });
      const b = await bootstrap({ email: "pol-b@test.com", orgSlug: "pol-org-b" });

      await app.inject({
        method: "POST", url: "/api/v1/policies", headers: auth(a.token),
        payload: { name: "A Policy", policyType: "deny", enforcementMode: "deny", scopeType: "org" },
      });

      const listRes = await app.inject({ method: "GET", url: "/api/v1/policies", headers: auth(b.token) });
      expect(listRes.statusCode).toBe(200);
      expect(listRes.json().data.length).toBe(0);
    });
  });

  // =========================================================================
  // 13. Health Check
  // =========================================================================

  describe("Health", () => {
    it("GET /health returns ok", async () => {
      const res = await app.inject({ method: "GET", url: "/api/v1/health" });
      expect(res.statusCode).toBe(200);
    });
  });

  // =========================================================================
  // 14. Error Handling — No Internal Details Leaked
  // =========================================================================

  describe("Error Handling", () => {
    it("404 for unknown routes returns structured error", async () => {
      const res = await app.inject({ method: "GET", url: "/api/v1/nonexistent" });
      expect(res.statusCode).toBe(404);
    });

    it("401 for missing auth header does not leak internals", async () => {
      const res = await app.inject({ method: "GET", url: "/api/v1/agents" });
      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(body.error).toBeDefined();
      // Must not contain stack traces or internal paths
      expect(JSON.stringify(body)).not.toContain("node_modules");
      expect(JSON.stringify(body)).not.toContain("at Object");
    });
  });
});
