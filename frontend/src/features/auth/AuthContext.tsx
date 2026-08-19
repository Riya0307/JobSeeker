import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { tokenStorage } from "../../api/client";
import * as authApi from "./api";
import type { AuthPayload, AuthUser, RegistrationPayload } from "./types";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: AuthPayload) => Promise<void>;
  register: (payload: RegistrationPayload) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const clearUser = () => setUser(null);
    window.addEventListener("auth:expired", clearUser);
    if (!tokenStorage.getRefresh()) {
      setIsLoading(false);
    } else {
      authApi
        .loadCurrentUser()
        .then(setUser)
        .catch(() => tokenStorage.clear())
        .finally(() => setIsLoading(false));
    }
    return () => window.removeEventListener("auth:expired", clearUser);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      async login(payload) {
        const result = await authApi.login(payload);
        tokenStorage.set(result.access, result.refresh);
        setUser(result.user);
      },
      async register(payload) {
        const result = await authApi.register(payload);
        tokenStorage.set(result.access, result.refresh);
        setUser(result.user);
      },
      async logout() {
        const refresh = tokenStorage.getRefresh();
        try {
          if (refresh) await authApi.logout(refresh);
        } finally {
          tokenStorage.clear();
          setUser(null);
        }
      },
    }),
    [isLoading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
