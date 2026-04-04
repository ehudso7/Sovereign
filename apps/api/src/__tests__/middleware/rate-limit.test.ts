import { describe, expect, it } from "vitest";
import type { FastifyRequest } from "fastify";
import { buildRateLimitKey, resolveRateLimitTier } from "../../middleware/rate-limit.js";

describe("rate-limit helpers", () => {
  it("classifies auth and health endpoints with versioned API paths", () => {
    expect(resolveRateLimitTier("/api/v1/auth/login")).toBe("auth");
    expect(resolveRateLimitTier("/api/v1/health")).toBe("health");
    expect(resolveRateLimitTier("/health")).toBe("health");
    expect(resolveRateLimitTier("/api/v1/agents")).toBe("heavy");
    expect(resolveRateLimitTier("/api/v1/projects")).toBe("standard");
  });

  it("keys authenticated traffic by ip and bearer token hash", () => {
    const request = {
      ip: "127.0.0.1",
      headers: {
        authorization: "Bearer test-session-token",
      },
    } as FastifyRequest;

    const key = buildRateLimitKey(request);
    expect(key.startsWith("127.0.0.1:")).toBe(true);
    expect(key).not.toContain("test-session-token");
  });
});
