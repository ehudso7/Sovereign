import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { initDb, type DatabaseClient } from "@sovereign/db";
import { initServices } from "./services/index.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { orgRoutes } from "./routes/orgs.js";
import { memberRoutes } from "./routes/members.js";
import { invitationRoutes } from "./routes/invitations.js";
import { projectRoutes } from "./routes/projects.js";
import { agentRoutes } from "./routes/agents.js";
import { runRoutes } from "./routes/runs.js";
import { connectorRoutes } from "./routes/connectors.js";
import { skillRoutes } from "./routes/skills.js";
import { browserSessionRoutes } from "./routes/browser-sessions.js";
import { memoryRoutes } from "./routes/memories.js";
import { missionControlRoutes } from "./routes/mission-control.js";
import { policyRoutes } from "./routes/policies.js";
import { revenueRoutes } from "./routes/revenue.js";
import { billingRoutes } from "./routes/billing.js";
import { onboardingRoutes } from "./routes/onboarding.js";
import { devRoutes } from "./routes/dev.js";
import type { AuthConfig } from "@sovereign/core";

// ---------------------------------------------------------------------------
// App builder — used by both production start and E2E tests
// ---------------------------------------------------------------------------

export function buildApp(authConfig: AuthConfig, db: DatabaseClient, opts?: { logger?: boolean }): FastifyInstance {
  const app = Fastify({ logger: opts?.logger ?? false });

  // Security headers
  app.addHook("onSend", async (_request, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("X-XSS-Protection", "0");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    reply.header("Cache-Control", "no-store");
    if (process.env.NODE_ENV === "production") {
      reply.header("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    }
  });

  initServices(authConfig, db);

  app.register(healthRoutes);
  app.register(authRoutes);
  app.register(orgRoutes);
  app.register(memberRoutes);
  app.register(invitationRoutes);
  app.register(projectRoutes);
  app.register(agentRoutes);
  app.register(runRoutes);
  app.register(connectorRoutes);
  app.register(skillRoutes);
  app.register(browserSessionRoutes);
  app.register(memoryRoutes);
  app.register(missionControlRoutes);
  app.register(policyRoutes);
  app.register(revenueRoutes);
  app.register(billingRoutes);
  app.register(onboardingRoutes);

  if (process.env.NODE_ENV !== "production") {
    app.register(devRoutes);
  }

  return app;
}

// ---------------------------------------------------------------------------
// Production startup (only when run directly, not imported for tests)
// ---------------------------------------------------------------------------

const isDirectRun = process.argv[1]?.endsWith("index.js") || process.argv[1]?.endsWith("index.ts");

if (isDirectRun) {
  const databaseUrl = process.env.DATABASE_URL ?? "postgresql://sovereign:sovereign_dev@localhost:5432/sovereign";

  const db = initDb({
    url: databaseUrl,
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS ?? "10", 10),
    debug: process.env.DB_DEBUG === "true",
  });

  const authMode = (process.env.AUTH_MODE ?? "local") as "local" | "workos";
  const authConfig: AuthConfig = {
    mode: authMode,
    sessionSecret: process.env.SESSION_SECRET ?? "dev-session-secret-min-32-chars-long!!",
    sessionTtlMs: parseInt(process.env.SESSION_TTL_MS ?? String(24 * 60 * 60 * 1000), 10),
    ...(authMode === "workos"
      ? {
          workos: {
            apiKey: process.env.WORKOS_API_KEY ?? "",
            clientId: process.env.WORKOS_CLIENT_ID ?? "",
          },
        }
      : {}),
  };

  const server = buildApp(authConfig, db, { logger: true });

  const start = async () => {
    const port = parseInt(process.env.PORT || "3002", 10);
    const host = process.env.HOST || "0.0.0.0";

    const health = await db.healthCheck();
    if (!health.ok) {
      server.log.error("Database health check failed — is PostgreSQL running?");
    } else {
      server.log.info(`Database connected (${health.latencyMs}ms)`);
    }

    try {
      await server.listen({ port, host });
      server.log.info(`API server running on ${host}:${port} (auth: ${authMode})`);
    } catch (err) {
      server.log.error(err);
      process.exit(1);
    }
  };

  const shutdown = async () => {
    await server.close();
    await db.destroy();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  start();
}
