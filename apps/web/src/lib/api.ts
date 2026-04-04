// ---------------------------------------------------------------------------
// API client for the web app — talks to apps/api
// ---------------------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

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
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(fetchOptions.headers as Record<string, string> ?? {}),
  };

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      headers,
    });

    const json = await response.json();

    if (!response.ok) {
      return { ok: false, error: json.error };
    }

    return { ok: true, data: json.data, meta: json.meta };
  } catch (e) {
    return {
      ok: false,
      error: {
        code: "NETWORK_ERROR",
        message: e instanceof Error ? e.message : "Network error",
      },
    };
  }
}
