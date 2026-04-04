// ---------------------------------------------------------------------------
// Auth routes — POST /api/v1/auth/*
// ---------------------------------------------------------------------------

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { toOrgId } from "@sovereign/core";
import { getServices } from "../services/index.js";
import { authenticate } from "../middleware/auth.js";
import {
  resolveAllowedReturnTo,
  resolveRequestOrigin,
} from "../lib/urls.js";
import {
  buildClearedCsrfCookie,
  buildClearedSessionCookie,
  buildCsrfCookie,
  buildSessionCookie,
  createCsrfToken,
} from "../lib/session-cookie.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().optional(),
  orgId: z.string().uuid().optional(),
});

const bootstrapSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1),
  orgName: z.string().trim().min(1),
  orgSlug: z.string().trim().regex(/^[a-z0-9-]+$/),
});

const workosBootstrapSchema = z.object({
  token: z.string().min(1),
  orgName: z.string().trim().min(1),
  orgSlug: z.string().trim().regex(/^[a-z0-9-]+$/),
});

const switchOrgSchema = z.object({
  orgId: z.string().uuid(),
});

const sessionTokenSchema = z.object({
  token: z.string().min(1),
});

function normalizeRedirectTarget(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    return undefined;
  }

  return value;
}

function setAuthCookies(reply: { header: (name: string, value: string | readonly string[]) => unknown }, sessionToken: string, expiresAt: string): void {
  const csrfToken = createCsrfToken();
  reply.header("Set-Cookie", [
    buildSessionCookie(sessionToken, expiresAt),
    buildCsrfCookie(csrfToken, expiresAt),
  ]);
}

function clearAuthCookies(reply: { header: (name: string, value: string | readonly string[]) => unknown }): void {
  reply.header("Set-Cookie", [
    buildClearedSessionCookie(),
    buildClearedCsrfCookie(),
  ]);
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

    const returnTo = resolveAllowedReturnTo(request, "/auth/callback");
    if (!returnTo) {
      return reply.status(500).send({
        error: { code: "WORKOS_NOT_CONFIGURED", message: "No allowed auth callback origin is configured" },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }

    const callbackUrl = new URL(returnTo);
    const redirectTarget = normalizeRedirectTarget(request.query.redirect_to);
    if (redirectTarget) {
      callbackUrl.searchParams.set("redirect_to", redirectTarget);
    }

    const result = await services.workosAuth.beginLogin({
      apiOrigin: resolveRequestOrigin(request),
      returnTo: callbackUrl.toString(),
    });

    if (!result.ok) {
      return reply.status(result.error.statusCode).send({
        error: { code: result.error.code, message: result.error.message },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }

    reply.header("Set-Cookie", result.value.stateCookie);
    return reply.redirect(result.value.authorizationUrl);
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

      const redirectUrl = await services.workosAuth.handleCallback({
        code: request.query.code,
        state: request.query.state,
        error: request.query.error,
        errorDescription: request.query.error_description,
        cookieHeader: request.headers.cookie,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      });

      const fallbackOrigin = resolveAllowedReturnTo(request, "/auth/sign-in") ?? resolveRequestOrigin(request);
      const target = new URL(redirectUrl, fallbackOrigin);
      const fragment = new URLSearchParams(target.hash.replace(/^#/, ""));
      const sessionToken = fragment.get("session_token");
      const expiresAt = fragment.get("expires_at");

      const cookies = [services.workosAuth.clearLoginStateCookie()];
      if (sessionToken && expiresAt) {
        cookies.push(buildSessionCookie(sessionToken, expiresAt));
        cookies.push(buildCsrfCookie(createCsrfToken(), expiresAt));
        fragment.delete("session_token");
        fragment.delete("expires_at");
        target.hash = fragment.toString();
      }

      reply.header("Set-Cookie", cookies);
      return reply.redirect(target.toString());
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

    setAuthCookies(reply, result.value.sessionToken, result.value.expiresAt);
    return reply.status(200).send({
      data: result.value,
      meta: { request_id: request.id, timestamp: new Date().toISOString() },
    });
  });

  // POST /api/v1/auth/bootstrap
  server.post("/api/v1/auth/bootstrap", async (request, reply) => {
    const services = getServices();
    if (services.auth.getConfig().mode === "workos") {
      return reply.status(405).send({
        error: {
          code: "METHOD_NOT_ALLOWED",
          message: "Direct bootstrap is disabled when AUTH_MODE=workos. Complete setup through the WorkOS callback flow.",
        },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }

    const body = bootstrapSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        error: { code: "BAD_REQUEST", message: "Invalid request body", details: body.error.issues },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }

    const userCountResult = await services.users.countUsers();
    if (!userCountResult.ok) {
      return reply.status(userCountResult.error.statusCode).send({
        error: { code: userCountResult.error.code, message: userCountResult.error.message },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }

    if (userCountResult.value > 0) {
      return reply.status(409).send({
        error: {
          code: "BOOTSTRAP_NOT_ALLOWED",
          message: "Bootstrap is only allowed on an empty installation.",
        },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }

    const userResult = await services.users.create({
      email: body.data.email,
      name: body.data.name,
    });

    if (!userResult.ok) {
      return reply.status(userResult.error.statusCode).send({
        error: { code: userResult.error.code, message: userResult.error.message },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }

    const user = userResult.value;
    const orgResult = await services.orgs.create(
      { name: body.data.orgName, slug: body.data.orgSlug },
      user.id,
    );

    if (!orgResult.ok) {
      return reply.status(orgResult.error.statusCode).send({
        error: { code: orgResult.error.code, message: orgResult.error.message },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }

    const authResult = await services.auth.signIn(user.email);
    if (!authResult.ok) {
      return reply.status(authResult.error.statusCode).send({
        error: { code: authResult.error.code, message: authResult.error.message },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }

    setAuthCookies(reply, authResult.value.sessionToken, authResult.value.expiresAt);
    return reply.status(201).send({
      data: {
        user,
        org: orgResult.value,
        auth: authResult.value,
      },
      meta: { request_id: request.id, timestamp: new Date().toISOString() },
    });
  });

  // POST /api/v1/auth/workos/bootstrap
  server.post("/api/v1/auth/workos/bootstrap", async (request, reply) => {
    const services = getServices();
    if (services.auth.getConfig().mode !== "workos") {
      return reply.status(405).send({
        error: {
          code: "METHOD_NOT_ALLOWED",
          message: "WorkOS bootstrap is only available when AUTH_MODE=workos.",
        },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }

    const body = workosBootstrapSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        error: { code: "BAD_REQUEST", message: "Invalid request body", details: body.error.issues },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }

    const result = await services.workosAuth.completeBootstrap({
      token: body.data.token,
      orgName: body.data.orgName,
      orgSlug: body.data.orgSlug,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    if (!result.ok) {
      return reply.status(result.error.statusCode).send({
        error: { code: result.error.code, message: result.error.message },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }

    setAuthCookies(reply, result.value.sessionToken, result.value.expiresAt);
    return reply.status(201).send({
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

    setAuthCookies(reply, result.value.sessionToken, result.value.expiresAt);
    return reply.status(200).send({
      data: result.value,
      meta: { request_id: request.id, timestamp: new Date().toISOString() },
    });
  });

  // POST /api/v1/auth/session — exchange a session token into secure cookies
  server.post("/api/v1/auth/session", async (request, reply) => {
    const body = sessionTokenSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        error: { code: "BAD_REQUEST", message: "Invalid request body", details: body.error.issues },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }

    const services = getServices();
    const result = await services.auth.validateSession(body.data.token);

    if (!result.ok) {
      return reply.status(result.error.statusCode).send({
        error: { code: result.error.code, message: result.error.message },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }

    setAuthCookies(reply, body.data.token, result.value.expiresAt);
    return reply.status(200).send({
      data: { expiresAt: result.value.expiresAt },
      meta: { request_id: request.id, timestamp: new Date().toISOString() },
    });
  });

  // POST /api/v1/auth/logout
  server.post("/api/v1/auth/logout", { preHandler: [authenticate] }, async (request, reply) => {
    const services = getServices();
    const logoutUrl = services.auth.getConfig().mode === "workos"
      ? services.workosAuth.buildLogoutUrl(
          request.session!.providerSessionId,
          resolveAllowedReturnTo(request, "/auth/sign-in") ?? "",
        )
      : null;
    const result = await services.auth.signOut(request.session!.id);

    if (!result.ok) {
      return reply.status(result.error.statusCode).send({
        error: { code: result.error.code, message: result.error.message },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }

    clearAuthCookies(reply);
    return reply.status(200).send({
      data: { message: "Logged out successfully", logoutUrl },
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
