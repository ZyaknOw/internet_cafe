"use client";

import { useEffect, useState } from "react";
import { CircleCheck, Clock3, Computer, LogIn, ShieldCheck, UserRound, Wifi } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface ActiveSessionData {
  id?: string;
  customer_name: string;
  station_name: string;
  status?: string;
  total?: number;
}

export default function ClientPage() {
  const [userCode, setUserCode] = useState("");
  const [contact, setContact] = useState("");
  const [session, setSession] = useState<ActiveSessionData | null>(null);
  const [error, setError] = useState("");

  const signIn = async () => {
    if (!userCode.trim() || !contact.trim()) return setError("Enter your NetCafe ID and registered contact number.");
    try {
      const response = await fetch(`${apiUrl}/api/client/session-sign-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userCode, contact }),
      });
      const body = await response.json() as { session?: ActiveSessionData; error?: string };
      if (!response.ok || !body.session) throw new Error(body.error ?? "Could not start the session.");
      setSession(body.session);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not start the session.");
    }
  };

  useEffect(() => {
    if (!session?.id || session.status === "ended") return;

    // Realtime listener for instant end-session notification
    const channel = supabase
      .channel(`client_session_${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "station_sessions",
          filter: `id=eq.${session.id}`,
        },
        (payload: any) => {
          if (payload.new && payload.new.status === "ended") {
            setSession((prev) => (prev ? { ...prev, status: "ended", total: Number(payload.new.total ?? 0) } : null));
          }
        }
      )
      .subscribe();

    const interval = window.setInterval(async () => {
      try {
        const res = await fetch(`${apiUrl}/api/client/sessions/${session.id}/status`);
        if (res.ok) {
          const body = await res.json() as { session?: ActiveSessionData };
          if (body.session && body.session.status === "ended") {
            setSession((prev) => (prev ? { ...prev, status: "ended", total: Number(body.session?.total ?? 0) } : null));
          }
        }
      } catch {
        // silent
      }
    }, 4000);

    return () => {
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [session?.id, session?.status]);

  return (
    <main className="client-portal">
      <header className="client-header">
        <a href="/" className="client-brand"><span aria-hidden="true" style={{ background: "#4ade80", color: "#061614", borderRadius: 8, fontWeight: 800 }}>N</span><b>Internet Cafe</b></a>
        <span><Wifi size={17} aria-hidden="true" /> Connected</span>
      </header>
      <section className="client-shell">
        {!session ? (
          <div className="client-signin">
            <div className="client-icon" aria-hidden="true" style={{ background: "#e6f6ee", color: "#0b2b23" }}><UserRound size={27} /></div>
            <p className="client-kicker">STATION TERMINAL</p>
            <h1>Ready to work?</h1>
            <p>Enter your registered details to start your session at Internet Cafe.</p>
            <label>
              User ID
              <input
                autoFocus
                value={userCode}
                onChange={(event) => setUserCode(event.target.value.toUpperCase())}
                placeholder="e.g. NC-000004"
                aria-describedby="userid-hint"
              />
            </label>
            <small id="userid-hint" style={{ color: "#4ade80", fontSize: 12 }}>
              Provided by Internet Cafe staff during registration
            </small>
            <label>
              Registered contact number
              <input
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void signIn()}
                placeholder="09xx xxx xxxx"
              />
            </label>
            {error && <div className="client-error" role="alert">{error}</div>}
            <button onClick={() => void signIn()}><LogIn size={18} aria-hidden="true" /> Start my session</button>
            <small><ShieldCheck size={14} aria-hidden="true" /> Your session timer starts only after this verification.</small>
          </div>
        ) : session.status === "ended" ? (
          <div className="client-session">
            <div className="client-icon success" aria-hidden="true"><CircleCheck size={28} /></div>
            <p className="client-kicker">SESSION FINISHED · {session.customer_name.toUpperCase()}</p>
            <h1>Thank you for your visit!</h1>
            <p>Your session has ended. Please proceed to the front desk to settle your bill.</p>
            <div className="client-station" style={{ display: "flex", flexDirection: "column", gap: 6, textAlign: "center", padding: 16 }}>
              <span style={{ fontSize: 13, color: "#6a766d" }}>Total Amount:</span>
              <b style={{ fontSize: 26, color: "#142219" }}>₱{(Number(session.total) || 0).toFixed(2)}</b>
            </div>
            <button onClick={() => { setSession(null); setUserCode(""); setContact(""); }} style={{ marginTop: 14 }}>
              Done &amp; Return to Login
            </button>
          </div>
        ) : (
          <div className="client-session">
            <div className="client-icon success" aria-hidden="true"><CircleCheck size={28} /></div>
            <p className="client-kicker">WELCOME, {session.customer_name.toUpperCase()}</p>
            <h1>Your session is live</h1>
            <p>Your time and charges are now being tracked by ETHER.CAFE Manager.</p>
            <div className="client-station">
              <Computer size={22} aria-hidden="true" />
              <div><small>ASSIGNED STATION</small><b>{session.station_name}</b></div>
              <span><Clock3 size={16} aria-hidden="true" /> Active</span>
            </div>
            <div className="session-live" aria-live="polite"><i aria-hidden="true" /> Session in progress — enjoy your time!</div>
          </div>
        )}
      </section>
      <footer className="client-footer">Need help? Please ask an ETHER.CAFE staff member.</footer>
    </main>
  );
}

