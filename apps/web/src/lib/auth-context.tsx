"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import { apiFetch } from "./api";

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
  /** Load a session from an existing token (used by OAuth callback) */
  loadSessionFromToken: (token: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "sovereign_session_token";

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
    }>("/api/v1/auth/me", { token });

    if (result.ok) {
      setState({
        user: result.data.user,
        org: result.data.org,
        role: result.data.role,
        token,
        isLoading: false,
      });
      return true;
    }

    localStorage.removeItem(TOKEN_KEY);
    setState({ user: null, org: null, role: null, token: null, isLoading: false });
    return false;
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      loadSession(token);
    } else {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
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

    localStorage.setItem(TOKEN_KEY, result.data.sessionToken);
    return loadSession(result.data.sessionToken);
  }, [loadSession]);

  const signOut = useCallback(async () => {
    let logoutUrl: string | null = null;

    if (state.token) {
      const result = await apiFetch<{ message: string; logoutUrl?: string | null }>("/api/v1/auth/logout", {
        method: "POST",
        token: state.token,
      });
      if (result.ok) {
        logoutUrl = result.data.logoutUrl ?? null;
      }
    }

    localStorage.removeItem(TOKEN_KEY);
    setState({ user: null, org: null, role: null, token: null, isLoading: false });

    if (logoutUrl) {
      window.location.assign(logoutUrl);
    }
  }, [state.token]);

  const switchOrg = useCallback(async (orgId: string) => {
    if (!state.token) return false;

    const result = await apiFetch<{
      user: AuthUser;
      sessionToken: string;
      expiresAt: string;
    }>("/api/v1/auth/switch-org", {
      method: "POST",
      token: state.token,
      body: JSON.stringify({ orgId }),
    });

    if (!result.ok) return false;

    localStorage.setItem(TOKEN_KEY, result.data.sessionToken);
    return loadSession(result.data.sessionToken);
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

    localStorage.setItem(TOKEN_KEY, result.data.auth.sessionToken);
    return loadSession(result.data.auth.sessionToken);
  }, [loadSession]);

  const loadSessionFromToken = useCallback(async (token: string) => {
    return loadSession(token);
  }, [loadSession]);

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut, switchOrg, bootstrap, loadSessionFromToken }}>
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
