// ---------------------------------------------------------------------------
// Auth routes — POST /api/v1/auth/*
// ---------------------------------------------------------------------------

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { toOrgId } from "@sovereign/core";
import { getServices } from "../services/index.js";
import { authenticate } from "../middleware/auth.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().optional(),
  orgId: z.string().uuid().optional(),
});

const switchOrgSchema = z.object({
  orgId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// WorkOS helpers (direct REST API — no SDK dependency)
// ---------------------------------------------------------------------------

function getWorkOSAuthorizeUrl(clientId: string, redirectUri: string, state?: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    provider: "authkit",
  });
  if (state) params.set("state", state);
  return `https://api.workos.com/user_management/authorize?${params.toString()}`;
}

async function exchangeWorkOSCode(
  code: string,
  clientId: string,
  apiKey: string,
): Promise<{ user: { id: string; email: string; first_name: string | null; last_name: string | null; profile_picture_url: string | null } }> {
  const response = await fetch("https://api.workos.com/user_management/authenticate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      client_id: clientId,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`WorkOS authentication failed (${response.status}): ${text}`);
  }

  return response.json() as Promise<{ user: { id: string; email: string; first_name: string | null; last_name: string | null; profile_picture_url: string | null } }>;
}

export async function authRoutes(server: FastifyInstance): Promise<void> {
  // GET /api/v1/auth/mode — returns the current auth mode for frontend routing
  server.get("/api/v1/auth/mode", async (_request, reply) => {
    const services = getServices();
    const config = services.auth.getConfig();
    return reply.status(200).send({
      data: { mode: config.mode },
      meta: { request_id: _request.id, timestamp: new Date().toISOString() },
    });
  });

  // GET /api/v1/auth/authorize — initiate WorkOS OAuth flow (WorkOS mode only)
  server.get<{ Querystring: { redirect_to?: string } }>("/api/v1/auth/authorize", async (request, reply) => {
    const services = getServices();
    const config = services.auth.getConfig();

    if (config.mode !== "workos") {
      return reply.status(400).send({
        error: { code: "AUTH_MODE_MISMATCH", message: "WorkOS auth is not enabled. Use POST /api/v1/auth/login for local auth." },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }

    if (!config.workos?.clientId || !config.workos?.apiKey) {
      return reply.status(500).send({
        error: { code: "WORKOS_NOT_CONFIGURED", message: "WorkOS credentials are not configured" },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }

    const redirectUri = process.env.WORKOS_REDIRECT_URI;
    if (!redirectUri) {
      return reply.status(500).send({
        error: { code: "WORKOS_NOT_CONFIGURED", message: "WORKOS_REDIRECT_URI is not configured" },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }

    // Encode the frontend redirect target in state so the callback can send the user back
    const state = request.query.redirect_to
      ? Buffer.from(request.query.redirect_to).toString("base64url")
      : undefined;

    const authorizeUrl = getWorkOSAuthorizeUrl(config.workos.clientId, redirectUri, state);
    return reply.redirect(authorizeUrl);
  });

  // GET /api/v1/auth/callback — handle WorkOS OAuth callback
  server.get<{ Querystring: { code?: string; state?: string; error?: string; error_description?: string } }>(
    "/api/v1/auth/callback",
    async (request, reply) => {
      const services = getServices();
      const config = services.auth.getConfig();

      if (config.mode !== "workos") {
        return reply.status(400).send({
          error: { code: "AUTH_MODE_MISMATCH", message: "WorkOS auth is not enabled" },
          meta: { request_id: request.id, timestamp: new Date().toISOString() },
        });
      }

      // Handle WorkOS error responses
      if (request.query.error) {
        const appBaseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
        const errorMsg = encodeURIComponent(request.query.error_description ?? request.query.error);
        return reply.redirect(`${appBaseUrl}/auth/sign-in?error=${errorMsg}`);
      }

      const code = request.query.code;
      if (!code) {
        return reply.status(400).send({
          error: { code: "BAD_REQUEST", message: "Missing authorization code" },
          meta: { request_id: request.id, timestamp: new Date().toISOString() },
        });
      }

      try {
        // Exchange code for user profile
        const workosResult = await exchangeWorkOSCode(
          code,
          config.workos!.clientId,
          config.workos!.apiKey,
        );

        const workosUser = workosResult.user;
        const displayName = [workosUser.first_name, workosUser.last_name].filter(Boolean).join(" ") || workosUser.email;

        // Upsert user: find by email or create
        let userResult = await services.users.getByEmail(workosUser.email);
        if (!userResult.ok) {
          userResult = await services.users.create({
            email: workosUser.email,
            name: displayName,
            avatarUrl: workosUser.profile_picture_url ?? undefined,
            workosUserId: workosUser.id,
          });
          if (!userResult.ok) {
            const appBaseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
            return reply.redirect(`${appBaseUrl}/auth/sign-in?error=${encodeURIComponent("Failed to create user account")}`);
          }
        }

        // Sign in to create session
        const authResult = await services.auth.signIn(workosUser.email);
        if (!authResult.ok) {
          const appBaseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
          return reply.redirect(`${appBaseUrl}/auth/sign-in?error=${encodeURIComponent(authResult.error.message)}`);
        }

        // Decode redirect target from state, or default to /dashboard
        const appBaseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
        let redirectTo = "/dashboard";
        if (request.query.state) {
          try {
            redirectTo = Buffer.from(request.query.state, "base64url").toString("utf-8");
          } catch {
            // Invalid state, ignore
          }
        }

        // Redirect to frontend with session token
        const token = authResult.value.sessionToken;
        return reply.redirect(`${appBaseUrl}/auth/callback?token=${token}&redirect_to=${encodeURIComponent(redirectTo)}`);
      } catch (e) {
        server.log.error(e, "WorkOS callback failed");
        const appBaseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
        const msg = e instanceof Error ? e.message : "Authentication failed";
        return reply.redirect(`${appBaseUrl}/auth/sign-in?error=${encodeURIComponent(msg)}`);
      }
    },
  );

  // POST /api/v1/auth/login — local auth only; WorkOS mode returns authorize URL
  server.post("/api/v1/auth/login", async (request, reply) => {
    const services = getServices();
    const config = services.auth.getConfig();

    // In WorkOS mode, reject direct login and tell the client to use OAuth flow
    if (config.mode === "workos") {
      return reply.status(400).send({
        error: {
          code: "USE_WORKOS_AUTH",
          message: "Direct login is not available in WorkOS mode. Use GET /api/v1/auth/authorize to initiate SSO.",
        },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }

    const body = loginSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        error: { code: "BAD_REQUEST", message: "Invalid request body", details: body.error.issues },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }

    const result = await services.auth.signIn(body.data.email, body.data.password);

    if (!result.ok) {
      return reply.status(result.error.statusCode).send({
        error: { code: result.error.code, message: result.error.message },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }

    return reply.status(200).send({
      data: result.value,
      meta: { request_id: request.id, timestamp: new Date().toISOString() },
    });
  });

  // POST /api/v1/auth/switch-org
  server.post("/api/v1/auth/switch-org", { preHandler: [authenticate] }, async (request, reply) => {
    const body = switchOrgSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        error: { code: "BAD_REQUEST", message: "Invalid request body", details: body.error.issues },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }

    const services = getServices();
    const result = await services.auth.signInToOrg(
      request.session!.userId,
      toOrgId(body.data.orgId),
      request.ip,
      request.headers["user-agent"],
    );

    if (!result.ok) {
      return reply.status(result.error.statusCode).send({
        error: { code: result.error.code, message: result.error.message },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }

    return reply.status(200).send({
      data: result.value,
      meta: { request_id: request.id, timestamp: new Date().toISOString() },
    });
  });

  // POST /api/v1/auth/logout
  server.post("/api/v1/auth/logout", { preHandler: [authenticate] }, async (request, reply) => {
    const services = getServices();
    const result = await services.auth.signOut(request.session!.id);

    if (!result.ok) {
      return reply.status(result.error.statusCode).send({
        error: { code: result.error.code, message: result.error.message },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }

    return reply.status(200).send({
      data: { message: "Logged out successfully" },
      meta: { request_id: request.id, timestamp: new Date().toISOString() },
    });
  });

  // GET /api/v1/auth/me
  server.get("/api/v1/auth/me", { preHandler: [authenticate] }, async (request, reply) => {
    const services = getServices();
    const userResult = await services.users.getById(request.session!.userId);
    if (!userResult.ok) {
      return reply.status(userResult.error.statusCode).send({
        error: { code: userResult.error.code, message: userResult.error.message },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }

    const orgResult = await services.orgs.getById(request.session!.orgId, request.session!.userId);

    return reply.status(200).send({
      data: {
        user: userResult.value,
        org: orgResult.ok ? orgResult.value : null,
        role: request.session!.role,
        sessionId: request.session!.id,
      },
      meta: { request_id: request.id, timestamp: new Date().toISOString() },
    });
  });

  // GET /api/v1/auth/sessions
  server.get("/api/v1/auth/sessions", { preHandler: [authenticate] }, async (request, reply) => {
    const services = getServices();
    const result = await services.auth.listSessions(request.session!.orgId, request.session!.userId);

    if (!result.ok) {
      return reply.status(result.error.statusCode).send({
        error: { code: result.error.code, message: result.error.message },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }

    return reply.status(200).send({
      data: result.value,
      meta: { request_id: request.id, timestamp: new Date().toISOString() },
    });
  });

  // DELETE /api/v1/auth/sessions/:sessionId
  server.delete<{ Params: { sessionId: string } }>(
    "/api/v1/auth/sessions/:sessionId",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const services = getServices();
      const { toSessionId } = await import("@sovereign/core");
      const result = await services.auth.revokeSession(
        toSessionId(request.params.sessionId),
        request.session!.userId,
      );

      if (!result.ok) {
        return reply.status(result.error.statusCode).send({
          error: { code: result.error.code, message: result.error.message },
          meta: { request_id: request.id, timestamp: new Date().toISOString() },
        });
      }

      return reply.status(200).send({
        data: { message: "Session revoked" },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }
  );
}
