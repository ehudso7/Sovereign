import { createHmac, timingSafeEqual } from "node:crypto";

export const WORKOS_LOGIN_COOKIE = "sovereign_workos_login";
const WORKOS_LOGIN_TOKEN_TYPE = "workos_login";
const WORKOS_BOOTSTRAP_TOKEN_TYPE = "workos_bootstrap";

interface SignedPayload {
  type: string;
  exp: number;
}

export interface WorkosLoginStatePayload extends SignedPayload {
  type: typeof WORKOS_LOGIN_TOKEN_TYPE;
  state: string;
  codeVerifier: string;
  returnTo: string;
}

export interface WorkosBootstrapTokenPayload extends SignedPayload {
  type: typeof WORKOS_BOOTSTRAP_TOKEN_TYPE;
  userId: string;
  email: string;
  name: string;
  providerSessionId?: string;
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf-8").toString("base64url");
}

function decodeBase64Url<T>(value: string): T {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf-8")) as T;
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) {
    return false;
  }
  return timingSafeEqual(aBuffer, bBuffer);
}

function createSignedToken<T extends SignedPayload>(payload: T, secret: string): string {
  const encoded = encodeBase64Url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded, secret)}`;
}

function verifySignedToken<T extends SignedPayload>(
  token: string,
  secret: string,
  expectedType: T["type"],
): T | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) {
    return null;
  }

  const expectedSignature = sign(encoded, secret);
  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = decodeBase64Url<T>(encoded);
    if (payload.type !== expectedType) {
      return null;
    }
    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function createWorkosLoginStateToken(
  payload: Omit<WorkosLoginStatePayload, "type" | "exp">,
  secret: string,
  ttlSeconds = 15 * 60,
): string {
  return createSignedToken<WorkosLoginStatePayload>({
    type: WORKOS_LOGIN_TOKEN_TYPE,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    ...payload,
  }, secret);
}

export function verifyWorkosLoginStateToken(token: string, secret: string): WorkosLoginStatePayload | null {
  return verifySignedToken<WorkosLoginStatePayload>(token, secret, WORKOS_LOGIN_TOKEN_TYPE);
}

export function createWorkosBootstrapToken(
  payload: Omit<WorkosBootstrapTokenPayload, "type" | "exp">,
  secret: string,
  ttlSeconds = 15 * 60,
): string {
  return createSignedToken<WorkosBootstrapTokenPayload>({
    type: WORKOS_BOOTSTRAP_TOKEN_TYPE,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    ...payload,
  }, secret);
}

export function verifyWorkosBootstrapToken(token: string, secret: string): WorkosBootstrapTokenPayload | null {
  return verifySignedToken<WorkosBootstrapTokenPayload>(token, secret, WORKOS_BOOTSTRAP_TOKEN_TYPE);
}

export function parseCookieHeader(header?: string): Record<string, string> {
  if (!header) {
    return {};
  }

  return header
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex === -1) {
        return acc;
      }
      const key = part.slice(0, separatorIndex);
      const value = part.slice(separatorIndex + 1);
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
}

export function serializeCookie(
  name: string,
  value: string,
  options?: {
    httpOnly?: boolean;
    maxAgeSeconds?: number;
    path?: string;
    sameSite?: "Lax" | "Strict" | "None";
    secure?: boolean;
  },
): string {
  const path = options?.path ?? "/";
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`];

  if (options?.httpOnly !== false) {
    parts.push("HttpOnly");
  }

  parts.push(`SameSite=${options?.sameSite ?? "Lax"}`);

  if (options?.secure) {
    parts.push("Secure");
  }

  if (options?.maxAgeSeconds !== undefined) {
    parts.push(`Max-Age=${options.maxAgeSeconds}`);
  }

  return parts.join("; ");
}

export function buildWorkosLoginCookie(value: string): string {
  return serializeCookie(WORKOS_LOGIN_COOKIE, value, {
    httpOnly: true,
    maxAgeSeconds: 15 * 60,
    path: "/api/v1/auth",
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export function clearWorkosLoginCookie(): string {
  return serializeCookie(WORKOS_LOGIN_COOKIE, "", {
    httpOnly: true,
    maxAgeSeconds: 0,
    path: "/api/v1/auth",
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export function extractWorkosSessionId(accessToken: string): string | undefined {
  const segments = accessToken.split(".");
  if (segments.length < 2) {
    return undefined;
  }

  try {
    const payload = decodeBase64Url<{ sid?: string }>(segments[1]!);
    return typeof payload.sid === "string" && payload.sid.length > 0 ? payload.sid : undefined;
  } catch {
    return undefined;
  }
}

export function buildDisplayName(input: {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}): string {
  const fullName = [input.firstName?.trim(), input.lastName?.trim()].filter(Boolean).join(" ").trim();
  if (fullName.length > 0) {
    return fullName;
  }

  const [localPart] = input.email.split("@");
  return localPart?.replace(/[._-]+/g, " ").trim() || input.email;
}
