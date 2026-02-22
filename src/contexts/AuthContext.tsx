import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";

const AUTH_KEY = "briefcast_auth";

export interface AuthUser {
  email: string;
  name?: string;
}

function readStoredUser(): AuthUser | null {
  try {
    const stored = localStorage.getItem(AUTH_KEY);
    if (!stored) return null;
    const data = JSON.parse(stored) as { email?: string; name?: string };
    if (!data?.email) return null;
    return { email: data.email, name: data.name };
  } catch {
    return null;
  }
}

interface AuthContextValue {
  user: AuthUser | null;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readStoredUser);
  const navigate = useNavigate();

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY);
    setUser(null);
  }, []);

  // Sync from localStorage on mount (e.g. after login from Auth page)
  useEffect(() => {
    const stored = readStoredUser();
    if (stored) setUser(stored);
  }, []);

  // When any API call returns 401, clear user so we redirect to sign-in
  useEffect(() => {
    const onAuthRequired = () => {
      localStorage.removeItem(AUTH_KEY);
      setUser(null);
    };
    window.addEventListener("briefcast:auth-required", onAuthRequired);
    return () => window.removeEventListener("briefcast:auth-required", onAuthRequired);
  }, []);

  // Redirect to auth when user is null and not in storage
  useEffect(() => {
    if (user) return;
    if (readStoredUser()) return;
    navigate("/auth");
  }, [user, navigate]);

  return (
    <AuthContext.Provider value={{ user, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}
