"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import "@/components/admin-portal/admin-portal.css";
import { PendingAccountsModal } from "@/components/admin-portal/pending-accounts-modal";
import { RegisterUserModal } from "@/components/admin-portal/register-user-modal";
import { AdminActionModals } from "@/components/admin-portal/admin-action-modals";
import { UserProfileModal } from "@/components/shared/user-profile-modal";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase/client";
import {
  Bell,
  Users,
  Monitor,
  Receipt,
  LayoutGrid,
  ChevronRight,
  User,
  LogOut,
  KeyRound,
  Plus,
  ArrowRight,
  Laptop,
  CheckCircle2,
  Copy,
  Check,
  Search,
  SlidersHorizontal,
  RefreshCw,
  Coins,
  TrendingUp,
  Clock3,
  ShieldCheck,
  CheckCircle,
  Play,
  Square,
  ShoppingBag,
  Pencil,
} from "lucide-react";

interface AdminOverviewData {
  dailyRevenue: number;
  activeSessions: number;
  totalUsers: number;
  pcsOnline: { active: number; total: number };
  pendingOrders: number;
  pendingRequests: number;
}

interface PendingItem {
  id: string;
  name: string;
  initials: string;
  meta: string;
  timeAgo: string;
  isReal?: boolean;
}

interface ClientUser {
  id: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  email: string;
  contact: string;
  user_code?: string;
  status: string;
  role: string;
  balance?: number;
  total_spent?: number;
  created_at: string;
  avatar_url?: string | null;
}

interface AdminTransaction {
  id: string;
  source: "order" | "session";
  customer: string;
  service: string;
  amount: number;
  method: string;
  timestamp: string | null;
  status: string;
}

interface AdminReportSummary {
  totalRevenue: number;
  sessionCount: number;
  totalHours: number;
}

type ReportPeriod = "daily" | "monthly" | "yearly";

const EMPTY_REPORT_SUMMARY: AdminReportSummary = { totalRevenue: 0, sessionCount: 0, totalHours: 0 };

function manilaToday() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function formatTransactionTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTransactionStatus(status: string) {
  if (!status) return "Pending";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

interface StationItem {
  id: string;
  name: string;
  type: "Standard" | "VIP";
  rate: number;
  specs: string;
  status: "available" | "in-use" | "waiting";
  customerName?: string;
  startedAt?: string;
}

interface StationEditorState {
  id?: string;
  name: string;
  type: "Standard" | "VIP";
  rate: number;
  specs: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const DEFAULT_STATIONS: StationItem[] = Array.from({ length: 8 }, (_, i) => {
  const num = String(i + 1).padStart(2, "0");
  const isVip = i < 6;
  return {
    id: `pc-${num}`,
    name: `PC-${num}`,
    type: isVip ? "VIP" : "Standard",
    rate: 100,
    specs: isVip ? "240Hz, RTX 4080, Mechanical Keyboard" : "165Hz, RTX 4060, Standard Rig",
    status: "available",
    customerName: undefined,
    startedAt: undefined,
  };
});

export default function AdminDashboard() {
  const router = useRouter();
  const { profile, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<"overview" | "clients" | "pc-stations" | "transactions">("overview");

  const [overview, setOverview] = useState<AdminOverviewData>({
    dailyRevenue: 0,
    activeSessions: 0,
    totalUsers: 0,
    pcsOnline: { active: 0, total: 8 },
    pendingOrders: 0,
    pendingRequests: 0,
  });

  const [dateStr, setDateStr] = useState("TUESDAY · SEPTEMBER 22, 2026");
  const [greeting, setGreeting] = useState("Good evening, Admin.");
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [profileInitialTab, setProfileInitialTab] = useState<"profile" | "password">("profile");

  // Clients View States
  const [clients, setClients] = useState<ClientUser[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [clientFilter, setClientFilter] = useState<"all" | "active" | "pending">("all");

  // Stations State
  const [stations, setStations] = useState<StationItem[]>(DEFAULT_STATIONS);
  const [stationEditor, setStationEditor] = useState<StationEditorState | null>(null);
  const [stationSaving, setStationSaving] = useState(false);
  const [stationEditorError, setStationEditorError] = useState("");

  // Reports tab — PC session revenue by Manila calendar period.
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [transactionSearch, setTransactionSearch] = useState("");
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("daily");
  const [reportDate, setReportDate] = useState(manilaToday);
  const [transactionSummary, setTransactionSummary] = useState<AdminReportSummary>(EMPTY_REPORT_SUMMARY);
  const [transactionsLoaded, setTransactionsLoaded] = useState(false);
  const [transactionsError, setTransactionsError] = useState("");

  // Pending queue items (loaded from the database — no mock rows)
  const [pendingList, setPendingList] = useState<PendingItem[]>([]);
  const [approvedNotice, setApprovedNotice] = useState<{ name: string; tempPass: string } | null>(null);
  const [copiedPass, setCopiedPass] = useState(false);

  // Modals (only for actions like creating account, editing profile, or rate editing)
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedUserProfile, setSelectedUserProfile] = useState<any>(null);
  const [activeActionModal, setActiveActionModal] = useState<string | null>(null);

  // Dynamic Date & Greeting
  useEffect(() => {
    const updateHeader = () => {
      const now = new Date();
      const weekday = now.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
      const month = now.toLocaleDateString("en-US", { month: "long" }).toUpperCase();
      const day = now.getDate();
      const year = now.getFullYear();
      setDateStr(`${weekday} · ${month} ${day}, ${year}`);

      const hour = now.getHours();
      let timeGreet = "Good evening";
      if (hour >= 5 && hour < 12) timeGreet = "Good morning";
      else if (hour >= 12 && hour < 17) timeGreet = "Good afternoon";

      const name = profile?.first_name ? profile.first_name : "Admin";
      setGreeting(`${timeGreet}, ${name}.`);
    };

    updateHeader();
    const interval = setInterval(updateHeader, 60000);
    return () => clearInterval(interval);
  }, [profile]);

  // Fetch overview & clients data from backend
  const fetchOverview = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const stationRes = await fetch(`${API_URL}/api/stations`, { headers });
      let stationInventory: StationItem[] | null = null;
      if (stationRes.ok) {
        const stationData = await stationRes.json() as { stations?: StationItem[] };
        stationInventory = stationData.stations || [];
      }

      const res = await fetch(`${API_URL}/api/admin/overview`, { headers });
      if (res.ok) {
        const data = await res.json() as AdminOverviewData;
        setOverview((prev) => ({
          ...prev,
          ...data,
        }));
      }

      // Fetch actual clients from the database.
      // /api/customers is the endpoint that returns every role='customer' profile
      // (the admin client directory is exactly that list).
      const usersRes = await fetch(`${API_URL}/api/customers`, { headers });
      if (usersRes.ok) {
        const uData = await usersRes.json() as { customers?: ClientUser[] };
        const clientOnly = (uData.customers || []).filter((u) => u.role === "customer" || !u.role);
        setClients(clientOnly);
      }

      // Fetch pending account requests
      const reqRes = await fetch(`${API_URL}/api/admin/account-requests`, { headers });
      if (reqRes.ok) {
        const reqData = await reqRes.json() as { requests?: any[] };
        const mapped: PendingItem[] = (reqData.requests || []).map((r) => {
          const first = r.first_name || "";
          const last = r.last_name || "";
          const inits = ((first[0] || "") + (last[0] || "")).toUpperCase() || "NC";
          return {
            id: r.id,
            name: `${first} ${last}`.trim() || "Customer",
            initials: inits,
            meta: `${r.contact || "No contact"} · ${r.email || ""}`,
            timeAgo: "Recently",
            isReal: true,
          };
        });
        setPendingList(mapped);
      }

      // Sync active sessions with PC cards
      const sessRes = await fetch(`${API_URL}/api/station-sessions/open`, { headers });
      if (sessRes.ok) {
        const sData = await sessRes.json() as { sessions?: any[] };
        const openSessions = sData.sessions || [];
        const openMap = new Map();
        for (const s of openSessions) {
          openMap.set(String(s.station_key).toUpperCase(), s);
          openMap.set(String(s.station_name).toUpperCase(), s);
          const num = String(s.station_key).replace(/\D/g, "");
          if (num) {
            openMap.set(`PC-${num.padStart(2, "0")}`, s);
            openMap.set(`PC-${num}`, s);
          }
        }
        setStations((prev) =>
          (stationInventory ?? prev).map((st) => {
            const open =
              openMap.get(st.name.toUpperCase()) ||
              openMap.get(st.id.toUpperCase()) ||
              openMap.get(st.name.replace(/\D/g, "")) ||
              openSessions.find((session) => String(session.station_key || "").replace(/\D/g, "") === st.name.replace(/\D/g, ""));
            if (open) {
              return {
                ...st,
                status: "in-use",
                customerName: open.customer_name || "Active Client",
                startedAt: open.started_at
                  ? new Date(open.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : (open.status === "pending_client" ? "Waiting for client" : "Active"),
              };
            }
            return {
              ...st,
              status: "available",
              customerName: undefined,
              startedAt: undefined,
            };
          })
        );
      }
    } catch {
      // silent
    }
  }, []);

  const saveStation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!stationEditor || stationSaving) return;
    setStationSaving(true);
    setStationEditorError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${API_URL}/api/admin/stations${stationEditor.id ? `/${stationEditor.id}` : ""}`, {
        method: stationEditor.id ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          name: stationEditor.name,
          type: stationEditor.type.toLowerCase(),
          rate: Number(stationEditor.rate),
          specs: stationEditor.specs,
        }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not save this PC station.");
      setStationEditor(null);
      await fetchOverview();
    } catch (error) {
      setStationEditorError(error instanceof Error ? error.message : "Could not save this PC station.");
    } finally {
      setStationSaving(false);
    }
  };

  const fetchTransactions = useCallback(async () => {
    setTransactionsLoaded(false);
    setTransactionsError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const params = new URLSearchParams({ period: reportPeriod, date: reportDate });
      const res = await fetch(`${API_URL}/api/admin/reports?${params}`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Could not load this report.");
      }
      const body = await res.json() as {
        transactions?: AdminTransaction[];
        summary?: AdminReportSummary;
      };
      setTransactions(body.transactions || []);
      setTransactionSummary(body.summary || EMPTY_REPORT_SUMMARY);
    } catch (error) {
      setTransactions([]);
      setTransactionSummary(EMPTY_REPORT_SUMMARY);
      setTransactionsError(error instanceof Error ? error.message : "Could not load this report.");
    } finally {
      setTransactionsLoaded(true);
    }
  }, [reportPeriod, reportDate]);

  useEffect(() => {
    void fetchOverview();
    void fetchTransactions();

    // Supabase Realtime subscription for admin dashboard
    const channel = supabase
      .channel("admin_dashboard_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "station_sessions" },
        (payload) => {
          console.log("[Realtime Admin] station_sessions change:", payload);
          void fetchOverview();
          void fetchTransactions();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "account_profiles" },
        (payload) => {
          console.log("[Realtime Admin] account_profiles change:", payload);
          void fetchOverview();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stations" },
        (payload) => {
          console.log("[Realtime Admin] stations change:", payload);
          void fetchOverview();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          void fetchTransactions();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchOverview, fetchTransactions]);

  const transactionQuery = transactionSearch.trim().toLowerCase();
  const paidTransactions = transactions
    .filter((tx) => {
      if (!transactionQuery) return true;
      return [tx.id, tx.customer, tx.service, tx.method].some((value) => value.toLowerCase().includes(transactionQuery));
    })
    .sort((a, b) => (b.timestamp ? new Date(b.timestamp).getTime() : 0) - (a.timestamp ? new Date(a.timestamp).getTime() : 0));
  const visibleTransactions = paidTransactions;

  // Handle inline approvals
  const handleApproveItem = async (item: PendingItem) => {
    if (item.isReal) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch(`${API_URL}/api/admin/account-requests/${item.id}/approve`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (res.ok) {
          // The API returns the real, just-set temporary password under
          // `temporaryPassword` — reading the wrong key here is what made the
          // displayed password unusable.
          const data = await res.json() as { temporaryPassword?: string };
          if (data.temporaryPassword) {
            setApprovedNotice({
              name: item.name,
              tempPass: data.temporaryPassword,
            });
            setPendingList((prev) => prev.filter((p) => p.id !== item.id));
            void fetchOverview();
            return;
          }
        }
        // The account was NOT approved — do not invent a password the client
        // could never sign in with.
        const errBody = await res.json().catch(() => ({})) as { error?: string };
        window.alert(errBody.error || "Failed to approve this account. Please try again.");
        return;
      } catch {
        window.alert("Failed to approve this account. Please try again.");
        return;
      }
    }
  };

  const handleDeclineItem = async (item: PendingItem) => {
    if (item.isReal) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        await fetch(`${API_URL}/api/admin/account-requests/${item.id}/reject`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
      } catch {
        // silent
      }
    }
    setPendingList((prev) => prev.filter((p) => p.id !== item.id));
  };



  const displayName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : "Admin";

  // Filtered clients list
  const filteredClients = clients.filter((c) => {
    const name = `${c.first_name} ${c.last_name}`.toLowerCase();
    const email = (c.email || "").toLowerCase();
    const contact = (c.contact || "").toLowerCase();
    const code = (c.user_code || "").toLowerCase();
    const q = clientSearch.toLowerCase();
    const matchesQuery = !q || name.includes(q) || email.includes(q) || contact.includes(q) || code.includes(q);

    if (!matchesQuery) return false;
    // "Active" covers the accounts that are cleared for use — the backend treats
    // `approved` and `active` as the same standing.
    if (clientFilter === "active") return c.status === "active" || c.status === "approved";
    if (clientFilter === "pending") return c.status === "pending";
    return true;
  });

  return (
    <div className="nodecafe-root">
      {/* -------------------------------------------------------------
          LEFT SIDEBAR (Dark Obsidian Forest)
          ------------------------------------------------------------- */}
      <aside className="nodecafe-sidebar" aria-label="Main Navigation">
        <div style={{ width: "100%" }}>
          {/* Brand Logo */}
          <div className="nodecafe-brand">
            <div className="nodecafe-brand-icon" aria-hidden="true">
              N
            </div>
            <div>
              <div className="nodecafe-brand-title">Internet Cafe</div>
              <div className="nodecafe-brand-sub">Internet Management</div>
            </div>
          </div>

          {/* Navigation Links - STRICTLY IN-PAGE SWITCHING */}
          <nav className="nodecafe-nav" aria-label="Primary Links">
            <button
              className={`nodecafe-nav-item ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              <LayoutGrid size={17} />
              <span>Overview</span>
            </button>

            <button
              className={`nodecafe-nav-item ${activeTab === "clients" ? "active" : ""}`}
              onClick={() => setShowNotificationModal(true)}
            >
              <Users size={17} />
              <span>Clients</span>
            </button>

            <button
              className={`nodecafe-nav-item ${activeTab === "pc-stations" ? "active" : ""}`}
              onClick={() => setActiveTab("pc-stations")}
            >
              <Monitor size={17} />
              <span>PC Stations</span>
            </button>

            <button
              className={`nodecafe-nav-item ${activeTab === "transactions" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("transactions");
                void fetchTransactions();
              }}
            >
              <Receipt size={17} />
              <span>Reports</span>
            </button>

          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="nodecafe-sidebar-footer">
          <div className="nodecafe-system-status">
            <span className="nodecafe-status-dot" aria-hidden="true" />
            <span>System online</span>
          </div>
          <div className="nodecafe-branch-name">Internet Cafe · Main Branch</div>
        </div>
      </aside>

      {/* -------------------------------------------------------------
          MAIN CONTENT AREA
          ------------------------------------------------------------- */}
      <main className="nodecafe-main">
        {/* Top Header */}
        <header className="nodecafe-topbar">
          <div>
            <div className="nodecafe-date-tracker">{dateStr}</div>
            <h1 className="nodecafe-greeting">{greeting}</h1>
          </div>

          <div className="nodecafe-topbar-actions">
            {/* Notification Bell */}
            <button
              className="nodecafe-notif-btn"
              onClick={() => setActiveTab("clients")}
              title="View pending approval notifications"
              aria-label="Notifications"
            >
              <Bell size={19} strokeWidth={2.5} color="#123725" aria-hidden="true" style={{ display: "block", flexShrink: 0, zIndex: 1 }} />
              <span className="nodecafe-notif-badge">{pendingList.length}</span>
            </button>

            {/* Account actions open in a modal */}
            <div style={{ position: "relative" }}>
              <button
                className="nodecafe-user-pill"
                onClick={() => setShowAccountModal(true)}
                aria-haspopup="dialog"
                aria-expanded={showAccountModal}
                aria-label="Admin account menu"
              >
                <div className="nodecafe-user-avatar" aria-hidden="true">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Avatar"
                      style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
                    />
                  ) : (
                    (displayName[0] || "A").toUpperCase()
                  )}
                </div>
                <span className="nodecafe-user-label">Admin account</span>
              </button>

            </div>
          </div>
        </header>

        {showNotificationModal && (
          <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowNotificationModal(false); }} style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(8, 24, 18, .48)", display: "grid", placeItems: "center", padding: 20 }}>
            <section role="dialog" aria-modal="true" aria-labelledby="admin-notifications-title" style={{ width: "min(100%, 480px)", background: "#fff", borderRadius: 16, padding: 22, boxShadow: "0 24px 70px rgba(0,0,0,.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 16 }}>
                <div><h2 id="admin-notifications-title" style={{ margin: 0, color: "#123725", fontSize: 19 }}>Notifications</h2><p style={{ margin: "5px 0 0", color: "#6a887e", fontSize: 13 }}>Pending account approvals</p></div>
                <button type="button" aria-label="Close notifications" onClick={() => setShowNotificationModal(false)} style={{ width: 32, height: 32, border: "1px solid #dce7e0", borderRadius: 8, background: "#fff", color: "#355b49", fontSize: 20, lineHeight: 1, cursor: "pointer" }}>×</button>
              </div>
              {pendingList.length ? <div style={{ display: "grid", gap: 9, maxHeight: 360, overflowY: "auto" }}>{pendingList.map((item) => <button key={item.id} type="button" onClick={() => { setShowNotificationModal(false); setActiveTab("clients"); }} style={{ textAlign: "left", border: "1px solid #e1ebe5", borderRadius: 10, background: "#f8fbf8", padding: "12px 14px", cursor: "pointer" }}><b style={{ display: "block", color: "#123725", fontSize: 13 }}>{item.name}</b><span style={{ display: "block", marginTop: 4, color: "#6a887e", fontSize: 12 }}>{item.meta}</span></button>)}</div> : <div style={{ padding: "25px 12px", textAlign: "center", color: "#6a887e", background: "#f8fbf8", borderRadius: 10, fontSize: 13 }}>You&apos;re all caught up. No pending notifications.</div>}
              <button type="button" onClick={() => { setShowNotificationModal(false); setActiveTab("clients"); }} style={{ marginTop: 14, width: "100%", padding: 11, border: 0, borderRadius: 9, background: "#123725", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Review account requests</button>
            </section>
          </div>
        )}

        {showAccountModal && (
          <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAccountModal(false); }} style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(8, 24, 18, .48)", display: "grid", placeItems: "center", padding: 20 }}>
            <section role="dialog" aria-modal="true" aria-labelledby="admin-account-title" style={{ width: "min(100%, 400px)", background: "#fff", borderRadius: 16, padding: 22, boxShadow: "0 24px 70px rgba(0,0,0,.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}><div><h2 id="admin-account-title" style={{ margin: 0, color: "#123725", fontSize: 19 }}>Admin account</h2><p style={{ margin: "5px 0 0", color: "#6a887e", fontSize: 13 }}>{displayName}</p></div><button type="button" aria-label="Close account" onClick={() => setShowAccountModal(false)} style={{ width: 32, height: 32, border: "1px solid #dce7e0", borderRadius: 8, background: "#fff", color: "#355b49", fontSize: 20, lineHeight: 1, cursor: "pointer" }}>×</button></div>
              <div style={{ display: "grid", gap: 8 }}>
                <button type="button" onClick={() => { setShowAccountModal(false); setSelectedUserProfile(null); setProfileInitialTab("profile"); setShowProfileModal(true); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, border: "1px solid #e1ebe5", borderRadius: 9, background: "#fff", color: "#123725", fontWeight: 600, cursor: "pointer" }}><User size={17} /> My Profile</button>
                <button type="button" onClick={() => { setShowAccountModal(false); setSelectedUserProfile(null); setProfileInitialTab("password"); setShowProfileModal(true); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, border: "1px solid #e1ebe5", borderRadius: 9, background: "#fff", color: "#123725", fontWeight: 600, cursor: "pointer" }}><KeyRound size={17} /> Change Password</button>
                <button type="button" onClick={() => { setShowAccountModal(false); void logout(); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, border: "1px solid #f0d8d8", borderRadius: 9, background: "#fffafa", color: "#a33131", fontWeight: 600, cursor: "pointer" }}><LogOut size={17} /> Sign Out</button>
              </div>
            </section>
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 1: OVERVIEW DASHBOARD
            ------------------------------------------------------------- */}
        {activeTab === "overview" && (
          <div className="nodecafe-page-view">
            {/* Top 4 Statistic Cards */}
            <section className="nodecafe-kpi-grid" aria-label="Key Performance Indicators">
              <div className="nodecafe-kpi-card">
                <div className="nodecafe-kpi-label">Today&apos;s sales</div>
                <div className="nodecafe-kpi-val">₱{overview.dailyRevenue.toLocaleString()}</div>
                <div className="nodecafe-kpi-sub" style={{ color: "#166534" }}>
                  +8.4% vs yesterday
                </div>
              </div>

              <div className="nodecafe-kpi-card">
                <div className="nodecafe-kpi-label">PC stations</div>
                <div className="nodecafe-kpi-val">
                  {overview.pcsOnline.active} / {overview.pcsOnline.total}
                </div>
                <div className="nodecafe-kpi-sub">
                  {overview.pcsOnline.total - overview.pcsOnline.active} currently available
                </div>
              </div>

              <div className="nodecafe-kpi-card">
                <div className="nodecafe-kpi-label">Pending clients</div>
                <div className="nodecafe-kpi-val">{overview.pendingRequests}</div>
                <div className="nodecafe-kpi-sub">{pendingList.length} awaiting review</div>
              </div>
            </section>

            {/* Middle 2 Columns */}
            <section className="nodecafe-middle-grid" aria-label="Registration Operations">
              {/* Registration Queue */}
              <div className="nodecafe-card">
                <div className="nodecafe-card-kicker">Registration Queue</div>
                <div className="nodecafe-card-header">
                  <h2 className="nodecafe-card-title">Pending client approvals</h2>
                  <button
                    className="nodecafe-link"
                    onClick={() => setActiveTab("clients")}
                  >
                    <span>View all</span>
                    <ArrowRight size={14} />
                  </button>
                </div>

                <div className="nodecafe-queue-list">
                  {pendingList.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "28px 0", color: "#6a887e", fontSize: 13 }}>
                      No pending registrations right now. All requests are cleared!
                    </div>
                  ) : (
                    pendingList.map((item) => (
                      <div key={item.id} className="nodecafe-queue-row">
                        <div className="nodecafe-queue-left">
                          <div className="nodecafe-queue-avatar">{item.initials}</div>
                          <div className="nodecafe-queue-info">
                            <div className="nodecafe-queue-name">{item.name}</div>
                            <div className="nodecafe-queue-meta">{item.meta}</div>
                          </div>
                        </div>

                        <div className="nodecafe-queue-actions">
                          <span className="nodecafe-queue-time">{item.timeAgo}</span>
                          <button
                            className="nodecafe-btn-decline"
                            onClick={() => void handleDeclineItem(item)}
                          >
                            Decline
                          </button>
                          <button
                            className="nodecafe-btn-approve"
                            onClick={() => void handleApproveItem(item)}
                          >
                            Approve
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Quick Action */}
              <div className="nodecafe-card">
                <div className="nodecafe-card-kicker">Quick Action</div>
                <div className="nodecafe-card-header" style={{ marginBottom: 12 }}>
                  <h2 className="nodecafe-card-title">Client registration</h2>
                </div>

                <p className="nodecafe-quick-desc">
                  Clients register using basic information only. After approval, an admin issues a temporary password for first-time access.
                </p>

                <button
                  className="nodecafe-btn-primary"
                  onClick={() => setShowRegisterModal(true)}
                >
                  <Plus size={16} />
                  <span>Register client</span>
                </button>

                <div className="nodecafe-stepper-footer">
                  01 Basic info &nbsp;—&nbsp; 02 Admin approval &nbsp;—&nbsp; 03 Temp password
                </div>
              </div>
            </section>

            {/* Bottom Live Services Section */}
            <section className="nodecafe-services-section" aria-label="Services Availability">
              <div className="nodecafe-card-kicker">Services</div>
              <div className="nodecafe-card-header">
                <h2 className="nodecafe-card-title">Live service availability</h2>
                <button
                  className="nodecafe-link"
                  onClick={() => setActiveActionModal("hourly-rates")}
                >
                  <span>Manage services</span>
                  <ArrowRight size={14} />
                </button>
              </div>

              <div className="nodecafe-services-grid">
                <div
                  className="nodecafe-service-card"
                  onClick={() => setActiveTab("pc-stations")}
                  role="button"
                  tabIndex={0}
                >
                  <div className="nodecafe-service-top">
                    <div className="nodecafe-service-icon" aria-hidden="true">
                      <Laptop size={19} />
                    </div>
                    <div>
                      <div className="nodecafe-service-name">PC Station</div>
                      <div className="nodecafe-service-spec">{stations[0]?.name ?? "PC-01"} · {stations[0]?.type ?? "Standard"}</div>
                    </div>
                  </div>
                  <div className="nodecafe-service-bottom">
                    <div className="nodecafe-service-price">₱{stations[0]?.rate ?? 100} / hr</div>
                    <div className="nodecafe-service-badge">
                      {stations.filter((station) => station.status === "available").length} available
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 2: CLIENTS (FULL IN-PAGE VIEW)
            ------------------------------------------------------------- */}
        {activeTab === "clients" && (
          <div className="nodecafe-page-view">
            {/* Header */}
            <div className="nodecafe-page-header">
              <div>
                <h2 className="nodecafe-page-title">Client Directory &amp; Accounts</h2>
                <p className="nodecafe-page-subtitle">
                  Manage registered users, process pending approval requests, and view customer balances.
                </p>
              </div>
              <button
                className="nodecafe-btn-primary"
                style={{ width: "auto", padding: "10px 18px" }}
                onClick={() => setShowRegisterModal(true)}
              >
                <Plus size={15} />
                <span>Register New Client</span>
              </button>
            </div>

            {/* Search and Filters */}
            <div className="nodecafe-search-row">
              <div className="nodecafe-search-box">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Search by name, email, phone, or ID code..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                />
              </div>

              <div className="nodecafe-filter-tabs">
                <button
                  className={`nodecafe-filter-pill ${clientFilter === "all" ? "active" : ""}`}
                  onClick={() => setClientFilter("all")}
                >
                  All Clients ({clients.length})
                </button>
                <button
                  className={`nodecafe-filter-pill ${clientFilter === "active" ? "active" : ""}`}
                  onClick={() => setClientFilter("active")}
                >
                  Active
                </button>
                <button
                  className={`nodecafe-filter-pill ${clientFilter === "pending" ? "active" : ""}`}
                  onClick={() => setClientFilter("pending")}
                >
                  Pending
                </button>
              </div>
            </div>

            {/* Full Clients Data Table */}
            <div className="nodecafe-table-card">
              <table className="nodecafe-table">
                <thead>
                  <tr>
                    <th>Customer Name</th>
                    <th>Contact &amp; Email</th>
                    <th>User ID Code</th>
                    <th>Status</th>
                    <th>Balance</th>
                    <th>Total Spent</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "36px 0", color: "#6a887e" }}>
                        No clients matched your filter or search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredClients.map((client) => (
                      <tr key={client.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div className="nodecafe-queue-avatar" style={{ width: 34, height: 34, fontSize: 12 }}>
                              {((client.first_name?.[0] || "") + (client.last_name?.[0] || "")).toUpperCase() || "C"}
                            </div>
                            <div>
                              <b style={{ color: "#091c17", fontSize: 13.5 }}>
                                {client.first_name} {client.middle_name ? `${client.middle_name} ` : ""}{client.last_name}
                              </b>
                              <div style={{ fontSize: 11.5, color: "#6a887e" }}>Customer Account</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ color: "#14251f", fontWeight: 500 }}>{client.contact}</div>
                          <div style={{ fontSize: 11.5, color: "#6a887e" }}>{client.email}</div>
                        </td>
                        <td>
                          <code style={{ background: "#f0f5f2", padding: "3px 7px", borderRadius: 5, fontSize: 12, fontWeight: 700, color: "#0b2b23" }}>
                            {client.user_code || `NC-000${client.id.slice(0, 3)}`}
                          </code>
                        </td>
                        <td>
                          <span className={`nodecafe-status-chip ${client.status === "active" ? "active" : "pending"}`}>
                            {client.status}
                          </span>
                        </td>
                        <td>
                          <b style={{ color: "#0b2b23" }}>₱{(client.balance ?? 0).toFixed(2)}</b>
                        </td>
                        <td>
                          <span style={{ color: "#6a887e" }}>₱{(client.total_spent ?? 0).toFixed(2)}</span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            style={{
                              padding: "5px 12px",
                              borderRadius: 7,
                              border: "1px solid #d0ded6",
                              background: "#ffffff",
                              fontSize: 12,
                              fontWeight: 600,
                              color: "#0b2b23",
                              cursor: "pointer",
                            }}
                            onClick={() => {
                              setSelectedUserProfile(client);
                              setShowProfileModal(true);
                            }}
                          >
                            View Profile
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 3: PC STATIONS (FULL IN-PAGE VIEW)
            ------------------------------------------------------------- */}
        {activeTab === "pc-stations" && (
          <div className="nodecafe-page-view">
            {/* Header */}
            <div className="nodecafe-page-header">
              <div>
                <h2 className="nodecafe-page-title">PC Stations</h2>
                <p className="nodecafe-page-subtitle">
                  Live workstation status, VIP hardware rigs, and session control.
                </p>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  className="nodecafe-btn-primary"
                  style={{ width: "auto", padding: "10px 18px" }}
                  onClick={() => {
                    const nextNumber = Math.max(0, ...stations.map((station) => Number(station.name.match(/^PC[ -]*0*(\d+)/i)?.[1] || 0))) + 1;
                    setStationEditor({ name: `PC-${String(nextNumber).padStart(2, "0")}`, type: "Standard", rate: 100, specs: "165Hz, RTX 4060, Standard Rig" });
                    setStationEditorError("");
                  }}
                >
                  <Plus size={15} />
                  <span>Add PC</span>
                </button>
                <button
                  className="nodecafe-btn-primary"
                  style={{ width: "auto", padding: "10px 18px" }}
                  onClick={() => setActiveActionModal("hourly-rates")}
                >
                  <Coins size={15} />
                  <span>Adjust Station Rates</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="nodecafe-stat-mini-grid">
              <div className="nodecafe-stat-mini-card">
                <div style={{ fontSize: 12, color: "#6a887e", fontWeight: 600 }}>Total PC Stations</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#091c17", marginTop: 4 }}>{stations.length}</div>
              </div>
              <div className="nodecafe-stat-mini-card">
                <div style={{ fontSize: 12, color: "#166534", fontWeight: 600 }}>Stations Available</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#15803d", marginTop: 4 }}>
                  {stations.filter((s) => s.status === "available").length}
                </div>
              </div>
              <div className="nodecafe-stat-mini-card">
                <div style={{ fontSize: 12, color: "#991b1b", fontWeight: 600 }}>Currently In Use</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#991b1b", marginTop: 4 }}>
                  {stations.filter((s) => s.status === "in-use").length}
                </div>
              </div>
            </div>

            {/* Station Visual Grid */}
            <div className="nodecafe-card" style={{ padding: "20px 24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 800, color: "#091c17", margin: 0 }}>Workstation Live Board</h3>
                  <span style={{ fontSize: 12, color: "#6a887e" }}>Click any station to view session timers or assign client check-in</span>
                </div>
                <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#547568", alignItems: "center" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} /> Available ({stations.filter((s) => s.status === "available").length})
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} /> In Use ({stations.filter((s) => s.status === "in-use").length})
                  </span>
                </div>
              </div>

              <div className="nodecafe-stations-grid">
                {stations.map((st) => (
                  <div
                    key={st.id}
                    className={`nodecafe-station-card ${st.status}`}
                    onClick={() => setActiveActionModal("active-sessions")}
                    role="button"
                    tabIndex={0}
                  >
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Laptop size={16} color={st.status === "in-use" ? "#dc2626" : "#166534"} />
                          <b style={{ color: "#091c17", fontSize: 14.5 }}>{st.name}</b>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <button
                            type="button"
                            aria-label={`Edit ${st.name}`}
                            title={st.status === "available" ? `Edit ${st.name}` : "End this session before editing the PC"}
                            disabled={st.status !== "available"}
                            onClick={(event) => {
                              event.stopPropagation();
                              setStationEditor({ id: st.id, name: st.name, type: st.type, rate: st.rate, specs: st.specs });
                              setStationEditorError("");
                            }}
                            style={{ border: "1px solid #dce7e0", background: "#fff", color: "#355b49", borderRadius: 6, padding: 4, display: "grid", placeItems: "center", cursor: st.status === "available" ? "pointer" : "not-allowed", opacity: st.status === "available" ? 1 : 0.45 }}
                          ><Pencil size={12} /></button>
                          <span
                            style={{
                            fontSize: 10,
                            fontWeight: 800,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: st.type === "VIP" ? "#fef08a" : "#e2ece6",
                            color: st.type === "VIP" ? "#854d0e" : "#133b2e",
                          }}
                        >
                            {st.type}
                          </span>
                        </div>
                      </div>

                      <div style={{ fontSize: 11.5, color: "#6a887e", marginBottom: 8, lineHeight: 1.3 }}>
                        {st.status === "in-use" ? (
                          <span style={{ color: "#b91c1c", fontWeight: 600 }}>
                            Playing: {st.customerName} ({st.startedAt})
                          </span>
                        ) : (
                          st.specs
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px solid #f0f5f2" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#091c17" }}>₱{st.rate}/hr</span>
                      <span className={`nodecafe-status-chip ${st.status}`}>{st.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 5: TRANSACTIONS (FULL IN-PAGE VIEW)
            ------------------------------------------------------------- */}
        {activeTab === "transactions" && (
          <div className="nodecafe-page-view">
            {/* Header */}
            <div className="nodecafe-page-header">
              <div>
                <h2 className="nodecafe-page-title">PC Revenue Reports</h2>
                <p className="nodecafe-page-subtitle">
                  Review PC session revenue by day, month, or year, then search the matching records.
                </p>
              </div>
              <button
                className="nodecafe-btn-primary"
                style={{ width: "auto", padding: "10px 18px" }}
                onClick={() => setActiveActionModal("revenue-report")}
              >
                <Receipt size={15} />
                <span>Export Detailed Ledger</span>
              </button>
            </div>

            <div className="admin-report-controls">
              <div className="admin-report-periods" role="group" aria-label="Report period">
                {(["daily", "monthly", "yearly"] as const).map((period) => (
                  <button
                    key={period}
                    type="button"
                    className={`admin-report-period${reportPeriod === period ? " active" : ""}`}
                    aria-pressed={reportPeriod === period}
                    onClick={() => setReportPeriod(period)}
                  >
                    {period.charAt(0).toUpperCase() + period.slice(1)}
                  </button>
                ))}
              </div>
              <label className="admin-report-date">
                <span>{reportPeriod === "daily" ? "Report date" : reportPeriod === "monthly" ? "Choose month" : "Choose a date in the year"}</span>
                <input
                  type={reportPeriod === "monthly" ? "month" : "date"}
                  value={reportPeriod === "monthly" ? reportDate.slice(0, 7) : reportDate}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (!value) return;
                    setReportDate(reportPeriod === "monthly" ? `${value}-01` : value);
                  }}
                  aria-label={reportPeriod === "daily" ? "Choose report date" : reportPeriod === "monthly" ? "Choose report month" : "Choose a date in the report year"}
                />
              </label>
              <div className="nodecafe-search-box admin-report-search">
                <Search size={16} />
                <input
                  type="search"
                  placeholder="Search PC sessions or customers..."
                  value={transactionSearch}
                  onChange={(event) => setTransactionSearch(event.target.value)}
                  aria-label="Search report rows"
                />
              </div>
            </div>

            <div className="nodecafe-stat-mini-grid admin-report-summary">
              <div className="nodecafe-stat-mini-card">
                <div style={{ fontSize: 12, color: "#6a887e", fontWeight: 600 }}>PC revenue</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#091c17", marginTop: 4 }}>₱{transactionSummary.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div style={{ fontSize: 11, color: "#166534", fontWeight: 600, marginTop: 2 }}>{reportPeriod[0].toUpperCase() + reportPeriod.slice(1)} report</div>
              </div>
              <div className="nodecafe-stat-mini-card">
                <div style={{ fontSize: 12, color: "#6a887e", fontWeight: 600 }}>Completed PC sessions</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#091c17", marginTop: 4 }}>{transactionSummary.sessionCount.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: "#6a887e", marginTop: 2 }}>In the selected period</div>
              </div>
              <div className="nodecafe-stat-mini-card">
                <div style={{ fontSize: 12, color: "#6a887e", fontWeight: 600 }}>PC hours billed</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#091c17", marginTop: 4 }}>{transactionSummary.totalHours.toFixed(1)}</div>
                <div style={{ fontSize: 11, color: "#6a887e", marginTop: 2 }}>Billable hours in period</div>
              </div>
            </div>

            {transactionsError && <p className="admin-report-error" role="alert">{transactionsError}</p>}

            {/* Recent transactions by default; search to find older client purchases. */}
            <div className="nodecafe-table-card">
              <table className="nodecafe-table">
                <thead>
                  <tr>
                    <th>Session Code</th>
                    <th>Customer Name</th>
                    <th>Service Category</th>
                    <th>Amount</th>
                    <th>Payment Method</th>
                    <th>Timestamp</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ color: "#6a887e", padding: "28px 16px", textAlign: "center" }}>
                        {transactionsLoaded
                          ? (transactionQuery ? "No PC sessions match your search." : "No completed PC sessions in this period.")
                          : "Loading transactions…"}
                      </td>
                    </tr>
                  ) : visibleTransactions.map((tx) => (
                    <tr key={`${tx.source}-${tx.id}`}>
                      <td>
                        <code style={{ fontWeight: 700, color: "#0b2b23" }}>{tx.id}</code>
                      </td>
                      <td>
                        <b style={{ color: "#091c17" }}>{tx.customer}</b>
                      </td>
                      <td style={{ color: "#324e43" }}>{tx.service}</td>
                      <td>
                        <b style={{ color: "#091c17" }}>₱{tx.amount.toFixed(2)}</b>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, padding: "2px 7px", borderRadius: 4, background: "#f0f5f2", color: "#143a2d", fontWeight: 600 }}>
                          {tx.method}
                        </span>
                      </td>
                      <td style={{ color: "#6a887e", fontSize: 12 }}>{formatTransactionTime(tx.timestamp)}</td>
                      <td>
                        <span className={`nodecafe-status-chip ${tx.status === "paid" || tx.status === "completed" ? "active" : ""}`}>
                          {(tx.status === "paid" || tx.status === "completed") && <CheckCircle size={12} />}
                          {formatTransactionStatus(tx.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* -------------------------------------------------------------
          MODALS & OVERLAYS (ONLY FOR SECONDARY ACTIONS)
          ------------------------------------------------------------- */}

      {/* Inline Approval Success Dialog */}
      {approvedNotice && (
        <div
          className="client-modal-overlay"
          onClick={() => setApprovedNotice(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="client-modal-card"
            style={{ maxWidth: 460, textAlign: "center" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: "#dcfce7",
                color: "#15803d",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <CheckCircle2 size={28} />
            </div>

            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#091c17", margin: "0 0 6px" }}>
              Account Approved!
            </h3>
            <p style={{ fontSize: 13, color: "#5a7d72", margin: "0 0 20px" }}>
              Temporary password generated for <b>{approvedNotice.name}</b>. Share this for their first sign-in:
            </p>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                background: "#f4f7f5",
                borderRadius: 10,
                border: "1px dashed #22c55e",
                marginBottom: 20,
              }}
            >
              <code style={{ fontSize: 16, fontWeight: 700, color: "#0b2b23", letterSpacing: 1 }}>
                {approvedNotice.tempPass}
              </code>
              <button
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  background: copiedPass ? "#15803d" : "#0b2b23",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  cursor: "pointer",
                  border: 0,
                }}
                onClick={() => {
                  void navigator.clipboard.writeText(approvedNotice.tempPass);
                  setCopiedPass(true);
                  setTimeout(() => setCopiedPass(false), 2000);
                }}
              >
                {copiedPass ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedPass ? "Copied" : "Copy"}</span>
              </button>
            </div>

            <button
              className="nodecafe-btn-primary"
              onClick={() => setApprovedNotice(null)}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Pending Accounts Full Modal (when clicking secondary view all) */}
      {showPendingModal && (
        <PendingAccountsModal
          onClose={() => {
            setShowPendingModal(false);
            void fetchOverview();
          }}
          onOpenRegister={() => {
            setShowPendingModal(false);
            setShowRegisterModal(true);
          }}
        />
      )}

      {/* Register User Modal */}
      {showRegisterModal && (
        <RegisterUserModal
          onClose={() => setShowRegisterModal(false)}
          onSuccess={() => {
            void fetchOverview();
            setActiveTab("clients");
          }}
        />
      )}

      {stationEditor && (
        <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !stationSaving) setStationEditor(null); }} style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(8, 24, 18, .48)", display: "grid", placeItems: "center", padding: 20 }}>
          <form onSubmit={saveStation} style={{ width: "min(100%, 460px)", background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 24px 70px rgba(0,0,0,.2)", display: "grid", gap: 14 }}>
            <div>
              <h3 style={{ margin: 0, color: "#091c17", fontSize: 19 }}>{stationEditor.id ? "Edit PC Station" : "Add PC Station"}</h3>
              <p style={{ margin: "6px 0 0", color: "#6a887e", fontSize: 13 }}>Keep the PC number, then add a short label after a dash if you like (for example, PC-09 - Gaming). Standard is ₱100/hr; VIP is ₱150/hr.</p>
            </div>
            <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 700, color: "#355b49" }}>PC Name
              <input required maxLength={60} value={stationEditor.name} onChange={(event) => setStationEditor({ ...stationEditor, name: event.target.value })} placeholder="PC-09 or PC-09 - Gaming" style={{ width: "100%", padding: "10px 12px", border: "1px solid #dce7e0", borderRadius: 8, color: "#091c17" }} />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 700, color: "#355b49" }}>Type
                <select value={stationEditor.type} onChange={(event) => { const type = event.target.value as StationEditorState["type"]; setStationEditor({ ...stationEditor, type, rate: type === "VIP" ? 150 : 100 }); }} style={{ padding: "10px 12px", border: "1px solid #dce7e0", borderRadius: 8, background: "#fff", color: "#091c17" }}>
                  <option value="Standard">Standard</option><option value="VIP">VIP</option>
                </select>
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 700, color: "#355b49" }}>Hourly Rate (₱)
                <input required type="number" value={stationEditor.type === "VIP" ? 150 : 100} readOnly style={{ padding: "10px 12px", border: "1px solid #dce7e0", borderRadius: 8, color: "#091c17", background: "#f6f8f6" }} />
              </label>
            </div>
            <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 700, color: "#355b49" }}>Specs / Description
              <input maxLength={240} value={stationEditor.specs} onChange={(event) => setStationEditor({ ...stationEditor, specs: event.target.value })} placeholder="165Hz, RTX 4060, Standard Rig" style={{ padding: "10px 12px", border: "1px solid #dce7e0", borderRadius: 8, color: "#091c17" }} />
            </label>
            {stationEditorError && <p role="alert" style={{ color: "#b91c1c", fontSize: 13, margin: 0 }}>{stationEditorError}</p>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
              <button type="button" disabled={stationSaving} onClick={() => setStationEditor(null)} style={{ border: "1px solid #dce7e0", background: "#fff", borderRadius: 8, padding: "9px 14px", cursor: "pointer", color: "#355b49" }}>Cancel</button>
              <button type="submit" disabled={stationSaving} className="nodecafe-btn-primary" style={{ width: "auto", padding: "9px 16px" }}>{stationSaving ? "Saving…" : stationEditor.id ? "Save Changes" : "Add PC"}</button>
            </div>
          </form>
        </div>
      )}

      {/* Feature Action Modals (for adjusting rates or viewing full logs) */}
      <AdminActionModals
        modalId={activeActionModal}
        onClose={() => setActiveActionModal(null)}
        onOpenPending={() => setActiveTab("clients")}
        onOpenRegister={() => setShowRegisterModal(true)}
        onSelectUser={(user) => {
          setSelectedUserProfile(user);
          setShowProfileModal(true);
        }}
      />

      {/* User Profile Modal */}
      {showProfileModal && (
        <UserProfileModal
          targetProfile={selectedUserProfile}
          onClose={() => {
            setShowProfileModal(false);
            setSelectedUserProfile(null);
            setProfileInitialTab("profile");
          }}
          initialTab={profileInitialTab}
          onProfileUpdated={() => {
            void fetchOverview();
          }}
        />
      )}
    </div>
  );
}
