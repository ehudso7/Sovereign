import { randomBytes } from "node:crypto";
import { parseCookieHeader, serializeCookie } from "./workos-auth.js";

export const SESSION_COOKIE = "sovereign_session";
export const CSRF_COOKIE = "sovereign_csrf";

const SESSION_COOKIE_PATH = "/";

function isProductionCookieMode(): boolean {
  return process.env.NODE_ENV === "production";
}

function cookieSameSite(): "Lax" | "None" {
  return isProductionCookieMode() ? "None" : "Lax";
}

function cookieSecure(): boolean {
  return isProductionCookieMode();
}

function maxAgeSecondsFromExpiry(expiresAt: string): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

export function createCsrfToken(): string {
  return randomBytes(24).toString("base64url");
}

export function buildSessionCookie(token: string, expiresAt: string): string {
  return serializeCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    maxAgeSeconds: maxAgeSecondsFromExpiry(expiresAt),
    path: SESSION_COOKIE_PATH,
    sameSite: cookieSameSite(),
    secure: cookieSecure(),
  });
}

export function buildCsrfCookie(token: string, expiresAt: string): string {
  return serializeCookie(CSRF_COOKIE, token, {
    httpOnly: false,
    maxAgeSeconds: maxAgeSecondsFromExpiry(expiresAt),
    path: SESSION_COOKIE_PATH,
    sameSite: cookieSameSite(),
    secure: cookieSecure(),
  });
}

export function buildClearedSessionCookie(): string {
  return serializeCookie(SESSION_COOKIE, "", {
    httpOnly: true,
    maxAgeSeconds: 0,
    path: SESSION_COOKIE_PATH,
    sameSite: cookieSameSite(),
    secure: cookieSecure(),
  });
}

export function buildClearedCsrfCookie(): string {
  return serializeCookie(CSRF_COOKIE, "", {
    httpOnly: false,
    maxAgeSeconds: 0,
    path: SESSION_COOKIE_PATH,
    sameSite: cookieSameSite(),
    secure: cookieSecure(),
  });
}

export function parseSessionCookies(cookieHeader?: string): { sessionToken?: string; csrfToken?: string } {
  const cookies = parseCookieHeader(cookieHeader);
  return {
    sessionToken: cookies[SESSION_COOKIE],
    csrfToken: cookies[CSRF_COOKIE],
  };
}
