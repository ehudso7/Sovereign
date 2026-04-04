import type { FastifyRequest } from "fastify";
import { isAllowedBrowserUrl, normalizeOrigin, resolveDefaultAllowedOrigin } from "./cors.js";

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  if (!value) {
    return undefined;
  }

  return value.split(",")[0]?.trim();
}

export function resolveRequestOrigin(request: FastifyRequest): string {
  const protocol = firstHeaderValue(request.headers["x-forwarded-proto"]) ?? request.protocol ?? "http";
  const host = firstHeaderValue(request.headers["x-forwarded-host"]) ?? request.headers.host;

  if (!host) {
    throw new Error("Missing Host header");
  }

  return `${protocol}://${host}`;
}

export function buildRedirectWithFragment(
  targetUrl: string,
  params: Record<string, string | undefined>,
): string {
  const url = new URL(targetUrl);
  const fragment = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value.length > 0) {
      fragment.set(key, value);
    }
  }

  url.hash = fragment.toString();
  return url.toString();
}

export function resolveAuthCallbackUrl(returnTo: string): string {
  const url = new URL(returnTo);
  url.pathname = "/auth/callback";
  url.hash = "";
  return url.toString();
}

export function isAllowedAuthCallbackUrl(returnTo: string): boolean {
  if (!isAllowedBrowserUrl(returnTo)) {
    return false;
  }

  const url = new URL(returnTo);
  return url.pathname === "/auth/callback";
}

export function resolveAllowedReturnTo(request: FastifyRequest, path = "/auth/sign-in"): string | null {
  const originHeader = typeof request.headers.origin === "string"
    ? normalizeOrigin(request.headers.origin)
    : undefined;

  if (originHeader && isAllowedBrowserUrl(originHeader)) {
    return new URL(path, originHeader).toString();
  }

  const fallbackOrigin = resolveDefaultAllowedOrigin();
  if (!fallbackOrigin) {
    return null;
  }

  return new URL(path, fallbackOrigin).toString();
}
