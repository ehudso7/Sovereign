import { describe, expect, it } from "vitest";
import {
  buildDisplayName,
  createWorkosBootstrapToken,
  createWorkosLoginStateToken,
  extractWorkosSessionId,
  verifyWorkosBootstrapToken,
  verifyWorkosLoginStateToken,
} from "../../lib/workos-auth.js";

const SECRET = "test-session-secret-for-workos-helper-tests";

describe("workos auth helpers", () => {
  it("signs and verifies the WorkOS login state token", () => {
    const token = createWorkosLoginStateToken({
      state: "state_123",
      codeVerifier: "verifier_123",
      returnTo: "https://app.example.com/auth/callback?next=%2Fdashboard",
    }, SECRET);

    const payload = verifyWorkosLoginStateToken(token, SECRET);

    expect(payload).not.toBeNull();
    expect(payload?.state).toBe("state_123");
    expect(payload?.codeVerifier).toBe("verifier_123");
    expect(payload?.returnTo).toContain("/auth/callback");
  });

  it("rejects a tampered WorkOS bootstrap token", () => {
    const token = createWorkosBootstrapToken({
      userId: "user_123",
      email: "founder@example.com",
      name: "Founder",
      providerSessionId: "session_123",
    }, SECRET);

    const tampered = `${token}tampered`;

    expect(verifyWorkosBootstrapToken(tampered, SECRET)).toBeNull();
  });

  it("extracts the WorkOS session id from the access token", () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sid: "session_123" })).toString("base64url");
    const token = `${header}.${payload}.signature`;

    expect(extractWorkosSessionId(token)).toBe("session_123");
  });

  it("builds a display name from WorkOS profile fields", () => {
    expect(buildDisplayName({
      email: "jane.doe@example.com",
      firstName: "Jane",
      lastName: "Doe",
    })).toBe("Jane Doe");

    expect(buildDisplayName({
      email: "solo.user@example.com",
      firstName: null,
      lastName: null,
    })).toBe("solo user");
  });
});
