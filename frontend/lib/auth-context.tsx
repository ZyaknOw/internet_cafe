"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { subscribeToSession } from "@/lib/session-loader";
import type { User } from "@supabase/supabase-js";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type UserRole = "admin" | "staff" | "customer";

export interface AccountProfile {
  id: string;
  auth_user_id: string | null;
  role: UserRole;
  status: "pending" | "approved" | "active" | "rejected";
  first_name: string;
  middle_name: string | null;
  last_name: string;
  email: string;
  contact: string;
  address: string;
  user_code: string | null;
  must_change_password?: boolean;
  avatar_url?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  emergency_contact?: string | null;
  suffix?: string | null;
  balance?: number;
  created_at: string;
}

interface AuthContextValue {
  user: User | null;
  profile: AccountProfile | null;
  loading: boolean;
  authError: string | null;
  sessionError: string | null;
  login: (email: string, password: string) => Promise<{ error?: string; mustChangePassword?: boolean }>;
  logout: () => Promise<void>;
  clearAuthError: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const fetchProfile = useCallback(async (accessToken: string, currentUser?: User | null): Promise<AccountProfile | null> => {
    // 1. Try the backend /api/me endpoint
    try {
      const res = await fetch(`${API_URL}/api/me`, {
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(5_000),
      });
      if (res.ok) {
        const body = (await res.json()) as { profile: AccountProfile };
        if (body.profile) return body.profile;
      }
    } catch {
      // Backend /api/me unreachable, proceed to direct Supabase queries
    }

    // 2. Direct Supabase query fallback
    try {
      if (currentUser?.id) {
        const { data: byAuthId } = await supabase
          .from("account_profiles")
          .select("*")
          .eq("auth_user_id", currentUser.id)
          .abortSignal(AbortSignal.timeout(4_000))
          .maybeSingle();
        if (byAuthId) return byAuthId as AccountProfile;
      }

      if (currentUser?.email) {
        const { data: byEmail } = await supabase
          .from("account_profiles")
          .select("*")
          .eq("email", currentUser.email.toLowerCase())
          .abortSignal(AbortSignal.timeout(4_000))
          .maybeSingle();
        if (byEmail) return byEmail as AccountProfile;
      }
    } catch {
      // Ignore Supabase query errors
    }

    // A failed lookup must not synthesize an active account from user metadata.
    return null;
  }, []);

  // INITIAL_SESSION is emitted by Supabase after restoration. Using one event
  // subscription avoids competing bootstrap/profile requests.
  useEffect(() => subscribeToSession(
    supabase.auth,
    (session) => fetchProfile(session.access_token, session.user),
    (session, account) => {
      setUser(session?.user ?? null);
      setProfile(account);
      setSessionError(null);
      setLoading(false);
    },
    (message) => {
      setUser(null);
      setProfile(null);
      setSessionError(message);
      setLoading(false);
    },
  ), [fetchProfile]);

  const login = useCallback(async (email: string, password: string): Promise<{ error?: string; mustChangePassword?: boolean }> => {
    setAuthError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      const msg = error.message.includes("Invalid login") || error.message.includes("invalid_credentials")
        ? "Incorrect email or password. Please try again."
        : error.message;
      setAuthError(msg);
      return { error: msg };
    }

    const p = await fetchProfile(data.session.access_token, data.user);
    if (!p) {
      await supabase.auth.signOut();
      const msg = "No ETHER.CAFE account found for this email. Please contact staff.";
      setAuthError(msg);
      return { error: msg };
    }

    if (p.status === "pending") {
      await supabase.auth.signOut();
      const msg = "Your account is pending admin approval. We'll email you once it's activated.";
      setAuthError(msg);
      return { error: msg };
    }

    if (p.status === "rejected") {
      await supabase.auth.signOut();
      const msg = "Your account registration was rejected. Please contact ETHER.CAFE staff.";
      setAuthError(msg);
      return { error: msg };
    }

    // "active" or "approved" users can proceed into the system
    const mustChange = Boolean(p.must_change_password || data.user.user_metadata?.must_change_password);
    setProfile(p);
    return { mustChangePassword: mustChange };
  }, [fetchProfile]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    router.push("/");
  }, [router]);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const refreshProfile = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const p = await fetchProfile(session.access_token, session.user);
        if (p) setProfile(p);
      }
    } catch {
      // Ignored
    }
  }, [fetchProfile]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, authError, sessionError, login, logout, clearAuthError, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
