import { describe, expect, it } from "vitest";
import { parseAuthCallbackPayload } from "./auth-callback";

describe("parseAuthCallbackPayload", () => {
  it("prefers signed fragment session tokens and preserves redirect targets", () => {
    const payload = parseAuthCallbackPayload(
      new URLSearchParams("redirect_to=%2Fdashboard"),
      "#session_token=abc123",
    );

    expect(payload.sessionToken).toBe("abc123");
    expect(payload.redirectTo).toBe("/dashboard");
    expect(payload.error).toBeNull();
  });

  it("surfaces callback errors from the fragment", () => {
    const payload = parseAuthCallbackPayload(
      new URLSearchParams(),
      "#error=Authentication%20failed",
    );

    expect(payload.sessionToken).toBeNull();
    expect(payload.error).toBe("Authentication failed");
    expect(payload.redirectTo).toBe("/dashboard");
  });
});
