// ---------------------------------------------------------------------------
// Auth middleware — validates session and sets tenant context
// ---------------------------------------------------------------------------

import type { FastifyRequest, FastifyReply } from "fastify";
import type { Session, OrgRole, Permission } from "@sovereign/core";
import { AppError, hasPermission } from "@sovereign/core";
import { getServices } from "../services/index.js";
import { parseSessionCookies } from "../lib/session-cookie.js";

declare module "fastify" {
  interface FastifyRequest {
    session?: Session;
  }
}

/**
 * Authenticate the request by validating the session token.
 * Sets request.session on success.
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  const cookieTokens = parseSessionCookies(request.headers.cookie);
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : cookieTokens.sessionToken;

  if (!token) {
    const error = AppError.unauthorized("Missing authentication token");
    reply.status(error.statusCode).send({
      error: { code: error.code, message: error.message },
      meta: { request_id: request.id, timestamp: new Date().toISOString() },
    });
    return;
  }

  const usingCookieAuth = !authHeader?.startsWith("Bearer ");
  if (usingCookieAuth && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const csrfHeader = request.headers["x-csrf-token"];
    const csrfToken = Array.isArray(csrfHeader) ? csrfHeader[0] : csrfHeader;
    if (!csrfToken || csrfToken !== cookieTokens.csrfToken) {
      const error = AppError.forbidden("Invalid CSRF token");
      reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
      return;
    }
  }

  const services = getServices();
  const result = await services.auth.validateSession(token);

  if (!result.ok) {
    reply.status(result.error.statusCode).send({
      error: { code: result.error.code, message: result.error.message },
      meta: { request_id: request.id, timestamp: new Date().toISOString() },
    });
    return;
  }

  request.session = result.value;
}

/**
 * Require a specific permission for the current user's role.
 */
export function requirePermission(permission: Permission) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.session) {
      const error = AppError.unauthorized();
      reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
      return;
    }

    if (!hasPermission(request.session.role, permission)) {
      const error = AppError.forbidden(`Missing required permission: ${permission}`);
      reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
      return;
    }
  };
}

/**
 * Require the requesting user to have one of the specified roles.
 */
export function requireRole(...roles: OrgRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.session) {
      const error = AppError.unauthorized();
      reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
      return;
    }

    if (!roles.includes(request.session.role)) {
      const error = AppError.forbidden(`Required role: ${roles.join(" or ")}`);
      reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
      return;
    }
  };
}

/**
 * Verify that the :orgId param matches the session's org context.
 * Prevents IDOR attacks.
 */
export async function enforceOrgScope(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.session) {
    const error = AppError.unauthorized();
    reply.status(error.statusCode).send({
      error: { code: error.code, message: error.message },
      meta: { request_id: request.id, timestamp: new Date().toISOString() },
    });
    return;
  }

  const params = request.params as Record<string, string>;
  const orgId = params.orgId;

  if (orgId && orgId !== request.session.orgId) {
    const error = AppError.forbidden("Cannot access resources in another organization");
    reply.status(error.statusCode).send({
      error: { code: error.code, message: error.message },
      meta: { request_id: request.id, timestamp: new Date().toISOString() },
    });
    return;
  }
}
