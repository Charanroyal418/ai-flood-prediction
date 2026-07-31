"use client";

/**
 * AuthContext — JWT-based authentication for FloodSense AI
 * ==========================================================
 * Provides authentication state, login/logout/register actions,
 * and JWT token management with automatic refresh.
 */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import api from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────
export type UserRole = "Admin" | "Operator" | "Viewer" | "Collector" | "Rescue";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  is_active: boolean;
  created_at?: string;
  last_login?: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isOperator: boolean;
}

// ── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY_TOKEN = "floodsense_access_token";
const STORAGE_KEY_REFRESH = "floodsense_refresh_token";
const STORAGE_KEY_USER = "floodsense_user";

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const token = localStorage.getItem(STORAGE_KEY_TOKEN);
      const userStr = localStorage.getItem(STORAGE_KEY_USER);
      if (token && userStr) {
        const user = JSON.parse(userStr) as AuthUser;
        // Set axios default header
        api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        setState({
          user,
          accessToken: token,
          isLoading: false,
          isAuthenticated: true,
        });
        return;
      }
    } catch {
      // Corrupted storage
    }
    setState((s) => ({ ...s, isLoading: false }));
  }, []);

  const _saveSession = useCallback(
    (accessToken: string, refreshToken: string, user: AuthUser) => {
      localStorage.setItem(STORAGE_KEY_TOKEN, accessToken);
      localStorage.setItem(STORAGE_KEY_REFRESH, refreshToken);
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
      api.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;
      setState({
        user,
        accessToken,
        isLoading: false,
        isAuthenticated: true,
      });
    },
    []
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const resp = await api.post("/auth/login", { email, password });
      const { access_token, refresh_token, user } = resp.data;
      _saveSession(access_token, refresh_token, user);
    },
    [_saveSession]
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const resp = await api.post("/auth/register", { name, email, password });
      const { access_token, refresh_token, user } = resp.data;
      _saveSession(access_token, refresh_token, user);
    },
    [_saveSession]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_REFRESH);
    localStorage.removeItem(STORAGE_KEY_USER);
    delete api.defaults.headers.common["Authorization"];
    setState({
      user: null,
      accessToken: null,
      isLoading: false,
      isAuthenticated: false,
    });
  }, []);

  const value: AuthContextValue = {
    ...state,
    login,
    register,
    logout,
    isAdmin: state.user?.role === "Admin",
    isOperator:
      state.user?.role === "Admin" || state.user?.role === "Operator",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
