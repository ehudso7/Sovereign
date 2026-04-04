export interface AuthCallbackPayload {
  sessionToken: string | null;
  redirectTo: string;
  error: string | null;
}

export function parseAuthCallbackPayload(
  searchParams: URLSearchParams,
  hash: string,
): AuthCallbackPayload {
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  const sessionToken = fragment.get("session_token") ?? searchParams.get("token");
  const redirectTo = searchParams.get("redirect_to") ?? "/dashboard";
  const error = fragment.get("error") ?? searchParams.get("error");

  return {
    sessionToken,
    redirectTo,
    error,
  };
}
