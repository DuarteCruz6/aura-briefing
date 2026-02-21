import { useState, useEffect, useCallback } from "react";
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

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(readStoredUser);
  const navigate = useNavigate();

  // Sync from localStorage on mount (e.g. after login from Auth page)
  useEffect(() => {
    const stored = readStoredUser();
    if (stored) setUser(stored);
  }, []);

  useEffect(() => {
    if (user) return;
    // Don't redirect if we have auth in storage (e.g. just logged in, state not yet synced)
    if (readStoredUser()) return;
    navigate("/auth");
  }, [user, navigate]);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY);
    setUser(null);
  }, []);

  return { user, logout };
}
