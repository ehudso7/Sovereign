import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "./api";
import { COOKIE_SESSION_TOKEN_MARKER } from "./session";

describe("apiFetch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, "document");
  });

  it("uses cookie-backed credentials without leaking the session marker", async () => {
    Object.defineProperty(globalThis, "document", {
      value: { cookie: "sovereign_csrf=test-csrf-token" },
      configurable: true,
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { ok: true },
        meta: { request_id: "req_1", timestamp: new Date().toISOString() },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/api/v1/auth/me", { token: COOKIE_SESSION_TOKEN_MARKER });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0]!;
    expect(options.credentials).toBe("include");
    expect(options.headers["X-CSRF-Token"]).toBe("test-csrf-token");
    expect(options.headers.Authorization).toBeUndefined();
  });
});
