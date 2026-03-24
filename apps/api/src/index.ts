import Fastify from "fastify";
import { initDb } from "@sovereign/db";
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

const server = Fastify({ logger: true });

// ---------------------------------------------------------------------------
// Initialize database and services
// ---------------------------------------------------------------------------

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

initServices(authConfig, db);

// ---------------------------------------------------------------------------
// Register routes
// ---------------------------------------------------------------------------

server.register(healthRoutes);
server.register(authRoutes);
server.register(orgRoutes);
server.register(memberRoutes);
server.register(invitationRoutes);
server.register(projectRoutes);
server.register(agentRoutes);
server.register(runRoutes);
server.register(connectorRoutes);
server.register(skillRoutes);
server.register(browserSessionRoutes);
server.register(memoryRoutes);
server.register(missionControlRoutes);
server.register(policyRoutes);
server.register(revenueRoutes);
server.register(billingRoutes);
server.register(onboardingRoutes);

// Dev-only routes
if (process.env.NODE_ENV !== "production") {
  server.register(devRoutes);
}

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const start = async () => {
  const port = parseInt(process.env.PORT || "3002", 10);
  const host = process.env.HOST || "0.0.0.0";

  // Health check the database
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

export { server };

start();
