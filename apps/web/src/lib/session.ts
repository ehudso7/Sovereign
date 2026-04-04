"use client";

export const COOKIE_SESSION_TOKEN_MARKER = "__cookie_session__";
export const CSRF_COOKIE = "sovereign_csrf";

export function readCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const cookie = part.trim();
    if (cookie.startsWith(prefix)) {
      return decodeURIComponent(cookie.slice(prefix.length));
    }
  }

  return null;
}
