"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import { apiFetch } from "./api";
import { COOKIE_SESSION_TOKEN_MARKER } from "./session";

interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

interface AuthOrg {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

interface AuthState {
  user: AuthUser | null;
  org: AuthOrg | null;
  role: string | null;
  token: string | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password?: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  switchOrg: (orgId: string) => Promise<boolean>;
  completeSessionToken: (token: string) => Promise<boolean>;
  bootstrap: (params: {
    email: string;
    name: string;
    orgName: string;
    orgSlug: string;
  }) => Promise<boolean>;
  bootstrapWithWorkos: (params: {
    token: string;
    orgName: string;
    orgSlug: string;
  }) => Promise<boolean>;
  /** Load a session from an existing token (used by OAuth callback) */
  loadSessionFromToken: (token: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    org: null,
    role: null,
    token: null,
    isLoading: true,
  });

  const loadSession = useCallback(async (token: string) => {
    const result = await apiFetch<{
      user: AuthUser;
      org: AuthOrg | null;
      role: string;
      sessionId: string;
    }>("/api/v1/auth/me", token === COOKIE_SESSION_TOKEN_MARKER ? {} : { token });

    if (result.ok) {
      setState({
        user: result.data.user,
        org: result.data.org,
        role: result.data.role,
        token: COOKIE_SESSION_TOKEN_MARKER,
        isLoading: false,
      });
      return true;
    }

    setState({ user: null, org: null, role: null, token: null, isLoading: false });
    return false;
  }, []);

  useEffect(() => {
    loadSession(COOKIE_SESSION_TOKEN_MARKER);
  }, [loadSession]);

  const signIn = useCallback(async (email: string, password?: string) => {
    const result = await apiFetch<{
      user: AuthUser;
      sessionToken: string;
      expiresAt: string;
    }>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (!result.ok) return false;

    return loadSession(COOKIE_SESSION_TOKEN_MARKER);
  }, [loadSession]);

  const signOut = useCallback(async () => {
    let logoutUrl: string | null = null;

    const result = await apiFetch<{ message: string; logoutUrl?: string | null }>("/api/v1/auth/logout", {
      method: "POST",
      token: state.token ?? undefined,
    });
    if (result.ok) {
      logoutUrl = result.data.logoutUrl ?? null;
    }

    setState({ user: null, org: null, role: null, token: null, isLoading: false });

    if (logoutUrl) {
      window.location.assign(logoutUrl);
    }
  }, [state.token]);

  const switchOrg = useCallback(async (orgId: string) => {
    const result = await apiFetch<{
      user: AuthUser;
      sessionToken: string;
      expiresAt: string;
    }>("/api/v1/auth/switch-org", {
      method: "POST",
      token: state.token ?? undefined,
      body: JSON.stringify({ orgId }),
    });

    if (!result.ok) return false;

    return loadSession(COOKIE_SESSION_TOKEN_MARKER);
  }, [state.token, loadSession]);

  const bootstrap = useCallback(async (params: {
    email: string;
    name: string;
    orgName: string;
    orgSlug: string;
  }) => {
    const result = await apiFetch<{
      user: AuthUser;
      org: AuthOrg;
      auth: { sessionToken: string; expiresAt: string };
    }>("/api/v1/auth/bootstrap", {
      method: "POST",
      body: JSON.stringify(params),
    });

    if (!result.ok) return false;

    return loadSession(COOKIE_SESSION_TOKEN_MARKER);
  }, [loadSession]);

  const bootstrapWithWorkos = useCallback(async (params: {
    token: string;
    orgName: string;
    orgSlug: string;
  }) => {
    const result = await apiFetch<{
      user: AuthUser;
      sessionToken: string;
      expiresAt: string;
    }>("/api/v1/auth/workos/bootstrap", {
      method: "POST",
      body: JSON.stringify(params),
    });

    if (!result.ok) return false;

    return loadSession(COOKIE_SESSION_TOKEN_MARKER);
  }, [loadSession]);

  const completeSessionToken = useCallback(async (token: string) => {
    const result = await apiFetch<{ expiresAt: string }>("/api/v1/auth/session", {
      method: "POST",
      body: JSON.stringify({ token }),
    });

    if (!result.ok) {
      return false;
    }

    return loadSession(COOKIE_SESSION_TOKEN_MARKER);
  }, [loadSession]);

  const loadSessionFromToken = useCallback(async (token: string) => {
    if (token.length > 0) {
      return completeSessionToken(token);
    }

    return loadSession(COOKIE_SESSION_TOKEN_MARKER);
  }, [completeSessionToken, loadSession]);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signIn,
        signOut,
        switchOrg,
        completeSessionToken,
        bootstrap,
        bootstrapWithWorkos,
        loadSessionFromToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
