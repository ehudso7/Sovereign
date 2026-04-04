// ---------------------------------------------------------------------------
// API client for the web app — talks to apps/api
// ---------------------------------------------------------------------------

import { COOKIE_SESSION_TOKEN_MARKER, CSRF_COOKIE, readCookie } from "./session";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3002";

export function getApiBaseUrl(): string {
  return API_BASE;
}

export interface ApiResponse<T> {
  data: T;
  meta: {
    request_id: string;
    timestamp: string;
    total?: number;
    has_more?: boolean;
    next_cursor?: string;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: {
    request_id: string;
    timestamp: string;
  };
}

export type ApiResult<T> =
  | { ok: true; data: T; meta: ApiResponse<T>["meta"] }
  | { ok: false; error: ApiError["error"] };

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<ApiResult<T>> {
  const { token, ...fetchOptions } = options;
  const csrfToken = readCookie(CSRF_COOKIE);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token && token !== COOKIE_SESSION_TOKEN_MARKER ? { Authorization: `Bearer ${token}` } : {}),
    ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
    ...(fetchOptions.headers as Record<string, string> ?? {}),
  };

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      credentials: "include",
      headers,
      signal: options.signal ?? AbortSignal.timeout(30_000),
    });

    const json = await response.json();

    if (!response.ok) {
      return { ok: false, error: json.error };
    }

    return { ok: true, data: json.data, meta: json.meta };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Network error";
    const isTimeout = e instanceof DOMException && e.name === "TimeoutError";

    return {
      ok: false,
      error: {
        code: isTimeout ? "TIMEOUT" : "NETWORK_ERROR",
        message: isTimeout
          ? `Request to ${API_BASE} timed out. The API server may be unreachable.`
          : `Cannot reach the API server (${API_BASE}): ${message}`,
      },
    };
  }
}
