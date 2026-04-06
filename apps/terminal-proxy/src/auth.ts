// ---------------------------------------------------------------------------
// Auth validation for terminal proxy connections
// ---------------------------------------------------------------------------

export interface AuthResult {
  readonly ok: boolean;
  readonly orgId: string;
  readonly userId: string;
}

/**
 * Validate a session token against the Sovereign API.
 *
 * In production, this calls the API server's session validation endpoint.
 * For development, accepts any non-empty token with a dev fallback.
 */
export async function validateSessionToken(token: string): Promise<AuthResult> {
  if (!token || token.trim().length === 0) {
    return { ok: false, orgId: "", userId: "" };
  }

  const apiUrl = process.env.SOVEREIGN_API_URL ?? "http://localhost:3001";

  try {
    const response = await fetch(`${apiUrl}/api/v1/auth/validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      // In development mode, allow connections with a dev fallback
      if (process.env.NODE_ENV !== "production") {
        return { ok: true, orgId: "dev-org", userId: "dev-user" };
      }
      return { ok: false, orgId: "", userId: "" };
    }

    const data = (await response.json()) as {
      orgId: string;
      userId: string;
    };

    return { ok: true, orgId: data.orgId, userId: data.userId };
  } catch {
    // In development, allow connections even if API is down
    if (process.env.NODE_ENV !== "production") {
      return { ok: true, orgId: "dev-org", userId: "dev-user" };
    }
    return { ok: false, orgId: "", userId: "" };
  }
}
