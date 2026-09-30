"use client";

import { useState } from "react";
import { EtherLanding } from "@/components/ether/ether-landing";
import { AuthModal } from "@/components/ether/auth-modal";
import ClientDashboard from "./client/dashboard/page";
import StaffDashboard from "./staff/dashboard/page";
import AdminDashboard from "./admin/dashboard/page";
import { useAuth } from "@/lib/auth-context";

export default function Home() {
  const { profile, loading, sessionError } = useAuth();
  const [showAuth, setShowAuth] = useState(false);

  // Show a simple loading state while Supabase restores the session
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--cream)",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: "3px solid var(--olive)",
            borderTopColor: "transparent",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading Internet Cafe...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Route to the correct dashboard based on the verified Supabase role
  if (profile?.status === "active") {
    if (profile.role === "admin") return <AdminDashboard />;
    if (profile.role === "staff") return <StaffDashboard />;
    if (profile.role === "customer") return <ClientDashboard />;
  }

  // Not logged in (or inactive account) — show the landing page
  return (
    <>
      {sessionError && (
        <div role="alert" className="auth-load-error">
          <p>{sessionError}</p>
          <button className="lp-view-all" onClick={() => window.location.reload()}>Try Again</button>
        </div>
      )}
      <EtherLanding onShowAuth={() => setShowAuth(true)} />
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  );
}
