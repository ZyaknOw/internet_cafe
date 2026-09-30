"use client";

import { useEffect, useState, useCallback } from "react";
import {
  X,
  Tv,
  Gamepad2,
  Users,
  Coffee,
  CheckCircle2,
  Clock3,
  AlertCircle,
  Search,
  ChevronRight,
  PlayCircle,
  History,
  Coins,
  LayoutGrid,
  Laptop,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

interface ActionModalProps {
  modalId: string | null;
  initialStationKey?: string | null;
  onClose: () => void;
  onOpenRegister?: () => void;
  onSelectUser?: (user: any) => void;
  onDataChanged?: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ── Snack / pre-order queue (public.orders, migration 008) ───────────────────
// The front desk queue is DB-backed: POST /api/client/orders writes the ticket
// from the client portal and these helpers map the row onto the modal's shape.
type CafeOrderStatus = "Pending" | "Preparing" | "Ready" | "Completed" | "Cancelled";

interface CafeOrderRecord {
  id: string;
  reference: string;
  customer_name: string;
  station_key: string | null;
  items: { name: string; quantity: number }[];
  total: number | string;
  payment_method: string;
  status: "pending" | "preparing" | "ready" | "completed" | "cancelled";
  placed_at: string;
}

interface CafeOrderRow {
  id: string;
  reference: string;
  station: string;
  customer: string;
  items: string;
  total: number;
  time: string;
  status: CafeOrderStatus;
  payment: string;
}

const CAFE_ORDER_STATUS_LABELS: Record<CafeOrderRecord["status"], CafeOrderStatus> = {
  pending: "Pending",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Shown only while public.orders is missing, so the queue never renders empty
// on a project where migration 008 has not been run yet.
const CAFE_ORDER_SEED: CafeOrderRow[] = [
  { id: "ORD-501", reference: "ORD-501", station: "PC-04", customer: "Christian B.", items: "Spanish Latte (Iced) x1, Garlic Toast x1", total: 185, time: "5 mins ago", status: "Pending", payment: "Member Balance" },
  { id: "ORD-502", reference: "ORD-502", station: "PC-12", customer: "Alyssa Chen", items: "Cold Brew Reserve x1", total: 110, time: "12 mins ago", status: "Preparing", payment: "Member Balance" },
  { id: "ORD-503", reference: "ORD-503", station: "Studio 1", customer: "Alexander W.", items: "Matcha Cloud Cream x2, Caramel Macchiato x1", total: 390, time: "18 mins ago", status: "Ready", payment: "Member Balance" },
  { id: "ORD-504", reference: "ORD-504", station: "PC-08", customer: "Marco Diaz", items: "Americano (Hot) x1", total: 90, time: "35 mins ago", status: "Completed", payment: "Member Balance" },
];

function relativeOrderTime(iso: string) {
  const placed = new Date(iso).getTime();
  if (Number.isNaN(placed)) return iso;
  const minutes = Math.max(0, Math.round((Date.now() - placed) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function toCafeOrderRow(order: CafeOrderRecord): CafeOrderRow {
  return {
    id: order.id,
    reference: order.reference,
    station: order.station_key || "Front Desk",
    customer: order.customer_name || "Customer",
    items: order.items.map((item) => `${item.name} x${item.quantity}`).join(", ") || "Snack order",
    total: Number(order.total) || 0,
    time: relativeOrderTime(order.placed_at),
    status: CAFE_ORDER_STATUS_LABELS[order.status] ?? "Pending",
    payment: order.payment_method,
  };
}

interface CustomerRecord {
  id: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  suffix?: string | null;
  email: string;
  contact: string;
  user_code?: string | null;
  status: string;
  balance?: number | string;
  role: string;
  avatar_url?: string | null;
}

interface StationSessionRecord {
  id: string;
  station_key: string;
  station_name: string;
  customer_name: string;
  customer_profile_id: string;
  hourly_rate: number;
  status: "pending_client" | "active" | "ended" | "cancelled";
  requested_at: string;
  started_at?: string | null;
  ended_at?: string | null;
  total?: number | null;
}

export function StaffActionModals({
  modalId,
  initialStationKey,
  onClose,
  onOpenRegister,
  onSelectUser,
  onDataChanged,
}: ActionModalProps) {
  // Data collections
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [openSessions, setOpenSessions] = useState<StationSessionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Sub-tabs / views
  const [sessionSubTab, setSessionSubTab] = useState<"start" | "active" | "end" | "history">("start");
  const [orderFilter, setOrderFilter] = useState<"all" | "pending" | "preparing" | "ready" | "completed">("all");

  // Start Session Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedStationKey, setSelectedStationKey] = useState<string>(initialStationKey || "PC-01");
  const [selectedRate, setSelectedRate] = useState<number>(50);
  const [startingSession, setStartingSession] = useState(false);

  // Top Up Modal State
  const [topUpCustomer, setTopUpCustomer] = useState<CustomerRecord | null>(null);
  const [topUpAmount, setTopUpAmount] = useState<number>(100);
  const [toppingUp, setToppingUp] = useState(false);

  // Search customer query
  const [searchQuery, setSearchQuery] = useState("");

  // Snack / pre-order queue (staff front-desk operations). Rows stream in from
  // GET /api/staff/orders; CAFE_ORDER_SEED only shows while migration 008
  // (the public.orders table) has not been applied yet.
  const [orders, setOrders] = useState<CafeOrderRow[]>(CAFE_ORDER_SEED);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      // Fetch customers for registration, sessions, and directory
      const custRes = await fetch(`${API_URL}/api/customers`, { headers });
      if (custRes.ok) {
        const body = (await custRes.json()) as { customers: CustomerRecord[] };
        setCustomers(body.customers || []);
        const approved = (body.customers || []).find((c) => ["approved", "active"].includes(c.status));
        if (approved && !selectedCustomerId) {
          setSelectedCustomerId(approved.id);
        }
      }

      // Fetch open station sessions
      const sessRes = await fetch(`${API_URL}/api/station-sessions/open`, { headers });
      if (sessRes.ok) {
        const body = (await sessRes.json()) as { sessions: StationSessionRecord[] };
        setOpenSessions(body.sessions || []);
      }

      // Fetch the live café queue (public.orders). `available: false` means
      // migration 008 is not applied yet, so the seeded queue stays on screen.
      const orderRes = await fetch(`${API_URL}/api/staff/orders?includeClosed=true`, { headers });
      if (orderRes.ok) {
        const body = (await orderRes.json()) as { orders?: CafeOrderRecord[]; available?: boolean };
        if (body.available) setOrders((body.orders || []).map(toCafeOrderRow));
      }
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  }, [selectedCustomerId]);

  useEffect(() => {
    if (modalId) {
      void loadData();
      if (initialStationKey) {
        setSelectedStationKey(initialStationKey);
      }
    }
  }, [modalId, initialStationKey, loadData]);

  if (!modalId) return null;

  // Handle Start Session API call
  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      setFeedbackMessage({ text: "Please select an approved customer.", type: "error" });
      return;
    }

    setStartingSession(true);
    setFeedbackMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const stationName = `${selectedStationKey} - Standard Gaming`;

      const res = await fetch(`${API_URL}/api/station-sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          stationKey: selectedStationKey,
          stationName,
          hourlyRate: Number(selectedRate),
          customerProfileId: selectedCustomerId,
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Failed to start station session");
      }

      setFeedbackMessage({
        text: `Session started on ${selectedStationKey}. The usage timer is now running.`,
        type: "success",
      });
      void loadData();
      onDataChanged?.();
      setSessionSubTab("active");
    } catch (err: unknown) {
      setFeedbackMessage({
        text: err instanceof Error ? err.message : "Error starting session",
        type: "error",
      });
    } finally {
      setStartingSession(false);
    }
  };

  // Handle End Session API call
  const handleEndSession = async (stationKey: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`${API_URL}/api/station-sessions/${stationKey}/end`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to end session");
      }

      setFeedbackMessage({
        text: `Station ${stationKey} session concluded successfully.`,
        type: "success",
      });
      void loadData();
      onDataChanged?.();
    } catch (err: unknown) {
      setFeedbackMessage({
        text: err instanceof Error ? err.message : "Error ending session",
        type: "error",
      });
    }
  };

  // Handle Customer Top-up
  const handleTopUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topUpCustomer) return;
    setToppingUp(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`${API_URL}/api/customers/${topUpCustomer.id}/top-up`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ amount: Number(topUpAmount) }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to top up balance");
      }

      setFeedbackMessage({
        text: `Top-up of ₱${Number(topUpAmount).toFixed(2)} completed for ${topUpCustomer.first_name}!`,
        type: "success",
      });
      setTopUpCustomer(null);
      void loadData();
      onDataChanged?.();
    } catch (err: unknown) {
      setFeedbackMessage({
        text: err instanceof Error ? err.message : "Error topping up",
        type: "error",
      });
    } finally {
      setToppingUp(false);
    }
  };

  // Handle Snack order status update (PATCH /api/staff/orders/:id/status)
  const handleUpdateOrderStatus = async (orderId: string, nextStatus: CafeOrderStatus) => {
    const applyLocally = (message: string) => {
      setOrders((prev) => prev.map((ord) => (ord.id === orderId ? { ...ord, status: nextStatus } : ord)));
      setFeedbackMessage({ text: message, type: "success" });
      onDataChanged?.();
    };

    // Seeded demo ticket: migration 008 is not applied, so there is nothing to PATCH.
    if (!UUID_PATTERN.test(orderId)) {
      applyLocally(`Order ${orderId} updated to ${nextStatus} (local preview only).`);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`${API_URL}/api/staff/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: nextStatus.toLowerCase() }),
      });

      const body = (await res.json().catch(() => ({}))) as { order?: CafeOrderRecord; message?: string; error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to update the order");

      applyLocally(body.message || `Order updated to ${nextStatus}.`);
    } catch (err: unknown) {
      setFeedbackMessage({
        text: err instanceof Error ? err.message : "Error updating order",
        type: "error",
      });
    }
  };

  const ModalShell = ({
    title,
    icon: Icon,
    subtitle,
    children,
  }: {
    title: string;
    icon: typeof Tv;
    subtitle?: string;
    children: React.ReactNode;
  }) => (
    <div className="staff-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="staff-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="staff-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "#eaf3ed",
                color: "#18452e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon size={16} />
            </div>
            <div>
              <h3>{title}</h3>
              {subtitle && <p style={{ margin: 0, fontSize: 12, color: "#6a796e" }}>{subtitle}</p>}
            </div>
          </div>
          <button className="staff-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {feedbackMessage && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              marginBottom: 14,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12.5,
              background: feedbackMessage.type === "success" ? "#dcfce7" : "#fee2e2",
              border: `1px solid ${feedbackMessage.type === "success" ? "#86efac" : "#f87171"}`,
              color: feedbackMessage.type === "success" ? "#166534" : "#991b1b",
            }}
          >
            {feedbackMessage.type === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            <span>{feedbackMessage.text}</span>
          </div>
        )}

        {children}
      </div>
    </div>
  );

  // 1. SESSION MANAGEMENT MODAL
  if (
    modalId === "session-management" ||
    modalId === "start-session" ||
    modalId === "end-session" ||
    modalId === "active-sessions" ||
    modalId === "session-history"
  ) {
    const activePcKeys = openSessions.map((s) => s.station_key);
    const availablePcList = Array.from({ length: 8 }, (_, i) => {
      const num = i + 1;
      const key = `PC-${num.toString().padStart(2, "0")}`;
      return { key, inUse: activePcKeys.includes(key) };
    });

    return (
      <ModalShell
        title="Session Management"
        subtitle="Manage customer computer sessions, assign stations, and monitor time"
        icon={Gamepad2}
      >
        {/* Sub-nav Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16, borderBottom: "1px solid #efeae0", paddingBottom: 8 }}>
          <button
            onClick={() => setSessionSubTab("start")}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              background: sessionSubTab === "start" ? "#123725" : "transparent",
              color: sessionSubTab === "start" ? "#fff" : "#556459",
            }}
          >
            Start Session
          </button>
          <button
            onClick={() => setSessionSubTab("active")}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              background: sessionSubTab === "active" ? "#123725" : "transparent",
              color: sessionSubTab === "active" ? "#fff" : "#556459",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            Active Sessions
            <span style={{ fontSize: 11, background: "rgba(0,0,0,0.1)", padding: "1px 6px", borderRadius: 10 }}>
              {openSessions.length}
            </span>
          </button>
          <button
            onClick={() => setSessionSubTab("history")}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              background: sessionSubTab === "history" ? "#123725" : "transparent",
              color: sessionSubTab === "history" ? "#fff" : "#556459",
            }}
          >
            Session History
          </button>
        </div>

        {/* Start Session Sub-tab */}
        {sessionSubTab === "start" && (
          <form onSubmit={handleStartSession} style={{ display: "grid", gap: 14 }}>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "#142219", display: "block", marginBottom: 6 }}>
                Select Registered Customer *
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid #d4cdbe",
                  fontSize: 13,
                  background: "#fff",
                  outline: "none",
                }}
              >
                {customers
                  .filter((c) => ["approved", "active"].includes(c.status))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name} ({c.user_code || c.email}) · Bal: ₱{Number(c.balance || 0).toFixed(2)}
                    </option>
                  ))}
              </select>
              <span style={{ fontSize: 11.5, color: "#6a796e", marginTop: 4, display: "block" }}>
                Only customers approved by Administrator can be assigned to stations.
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: "#142219", display: "block", marginBottom: 6 }}>
                  Select Available PC Station *
                </label>
                <select
                  value={selectedStationKey}
                  onChange={(e) => setSelectedStationKey(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #d4cdbe",
                    fontSize: 13,
                    background: "#fff",
                    outline: "none",
                  }}
                >
                  {availablePcList.map((pc) => (
                    <option key={pc.key} value={pc.key} disabled={pc.inUse}>
                      {pc.key} {pc.inUse ? "(In Use)" : "— Ready"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: "#142219", display: "block", marginBottom: 6 }}>
                  Hourly Rate Tier
                </label>
                <select
                  value={selectedRate}
                  onChange={(e) => setSelectedRate(Number(e.target.value))}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #d4cdbe",
                    fontSize: 13,
                    background: "#fff",
                    outline: "none",
                  }}
                >
                  <option value={50}>Standard Gaming (₱50.00 / hr)</option>
                  <option value={75}>VIP RTX 4080 (₱75.00 / hr)</option>
                </select>
              </div>
            </div>

            <div style={{ padding: "10px 12px", background: "#f8f5ee", borderRadius: 8, fontSize: 12, color: "#546459" }}>
              💡 <b>Workflow Note:</b> Assigning a customer starts charging immediately. Client portal sign-in is optional.
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button
                type="submit"
                disabled={startingSession}
                style={{
                  padding: "9px 20px",
                  borderRadius: 8,
                  border: "none",
                  background: "#123725",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: startingSession ? "not-allowed" : "pointer",
                }}
              >
                {startingSession ? "Starting Session…" : "Start Session"}
              </button>
            </div>
          </form>
        )}

        {/* Active Sessions Sub-tab */}
        {sessionSubTab === "active" && (
          <div>
            <div style={{ maxHeight: 340, overflowY: "auto", display: "grid", gap: 8 }}>
              {openSessions.length === 0 ? (
                <div style={{ textAlign: "center", padding: 28, fontSize: 13, color: "#6a796e" }}>
                  No active computer sessions right now. All stations ready for use.
                </div>
              ) : (
                openSessions.map((session) => (
                  <div
                    key={session.id}
                    style={{
                      padding: "12px 14px",
                      background: "#faf8f4",
                      border: "1px solid #e6e0d4",
                      borderRadius: 10,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 700, color: "#142219", fontSize: 13.5 }}>
                          {session.station_key}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            padding: "2px 7px",
                            borderRadius: 6,
                            background: session.status === "active" ? "#dcfce7" : "#fef3c7",
                            color: session.status === "active" ? "#166534" : "#92400e",
                            fontWeight: 700,
                          }}
                        >
                          {session.status === "active" ? "Active" : "Waiting for Client"}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "#6e7b71", marginTop: 3 }}>
                        Customer: <b>{session.customer_name}</b> · Rate: ₱{session.hourly_rate}/hr
                      </div>
                    </div>

                    <span style={{ fontSize: 12, color: "#6e7b71", fontWeight: 600 }}>
                      Process payment from Billing
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Session History Sub-tab */}
        {sessionSubTab === "history" && (
          <div>
            <p style={{ fontSize: 12.5, color: "#6a796e", margin: "0 0 12px" }}>
              Operational log of recently completed sessions.
            </p>
            <div style={{ maxHeight: 300, overflowY: "auto", display: "grid", gap: 8 }}>
              <div style={{ padding: "10px 14px", background: "#fdfbf7", border: "1px solid #eee8dc", borderRadius: 8, display: "flex", justifyContent: "space-between" }}>
                <div>
                  <b style={{ color: "#16251b" }}>PC-03 — Standard Gaming</b>
                  <div style={{ fontSize: 11.5, color: "#718076" }}>Customer: Maria Santos · 2.5 hrs</div>
                </div>
                <span style={{ fontWeight: 700, color: "#123725" }}>₱ 125.00</span>
              </div>
              <div style={{ padding: "10px 14px", background: "#fdfbf7", border: "1px solid #eee8dc", borderRadius: 8, display: "flex", justifyContent: "space-between" }}>
                <div>
                  <b style={{ color: "#16251b" }}>PC-18 — VIP Station (RTX 4080)</b>
                  <div style={{ fontSize: 11.5, color: "#718076" }}>Customer: Jordan Cruz · 3.0 hrs</div>
                </div>
                <span style={{ fontWeight: 700, color: "#123725" }}>₱ 225.00</span>
              </div>
            </div>
          </div>
        )}
      </ModalShell>
    );
  }

  // 2. CUSTOMER MANAGEMENT MODAL
  if (
    modalId === "customer-management" ||
    modalId === "customer-list" ||
    modalId === "search-customer" ||
    modalId === "customer-profile"
  ) {
    const filteredCustomers = customers.filter((c) => {
      const q = searchQuery.toLowerCase();
      const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
      return (
        fullName.includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.contact || "").includes(q) ||
        (c.user_code || "").toLowerCase().includes(q)
      );
    });

    return (
      <ModalShell
        title="Customer Management"
        subtitle="Search customer profiles, view information, or top up prepaid station balance"
        icon={Users}
      >
        {/* Customer Top-Up Sub-panel if active */}
        {topUpCustomer ? (
          <div style={{ background: "#f8f6f0", padding: "14px 16px", borderRadius: 10, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h4 style={{ margin: 0, fontSize: 13.5, color: "#142219" }}>
                Top-Up Balance: <b>{topUpCustomer.first_name} {topUpCustomer.last_name}</b>
              </h4>
              <button
                onClick={() => setTopUpCustomer(null)}
                style={{ background: "none", border: 0, fontSize: 12, color: "#6a796e", cursor: "pointer" }}
              >
                Cancel
              </button>
            </div>
            <form onSubmit={handleTopUpSubmit} style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ display: "flex", gap: 6 }}>
                {[50, 100, 200, 500].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setTopUpAmount(amt)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: `1px solid ${topUpAmount === amt ? "#123725" : "#d4cdbe"}`,
                      background: topUpAmount === amt ? "#123725" : "#fff",
                      color: topUpAmount === amt ? "#fff" : "#142219",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    ₱{amt}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={10}
                max={5000}
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(Number(e.target.value))}
                style={{
                  width: 90,
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid #d4cdbe",
                  fontSize: 12.5,
                }}
              />
              <button
                type="submit"
                disabled={toppingUp}
                style={{
                  padding: "7px 14px",
                  borderRadius: 6,
                  background: "#123725",
                  color: "#fff",
                  border: "none",
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: toppingUp ? "not-allowed" : "pointer",
                }}
              >
                {toppingUp ? "Adding…" : "Confirm"}
              </button>
            </form>
          </div>
        ) : null}

        {/* Search bar & Register Shortcut */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search
              size={15}
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#6f7d73" }}
            />
            <input
              type="text"
              placeholder="Search by name, email, phone, or NetCafe ID…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px 8px 34px",
                borderRadius: 8,
                border: "1px solid #d4cdbe",
                fontSize: 12.5,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {onOpenRegister && (
            <button
              onClick={() => {
                onClose();
                onOpenRegister();
              }}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                background: "#123725",
                color: "#fff",
                fontSize: 12.5,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              + Register Customer
            </button>
          )}
        </div>

        {/* Customer Directory List */}
        <div style={{ maxHeight: 340, overflowY: "auto", display: "grid", gap: 8 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 24, fontSize: 13, color: "#6a796e" }}>Loading customer records…</div>
          ) : filteredCustomers.length === 0 ? (
            <div style={{ textAlign: "center", padding: 28, fontSize: 13, color: "#6a796e" }}>No matching customers found.</div>
          ) : (
            filteredCustomers.map((c) => (
              <div
                key={c.id}
                style={{
                  padding: "12px 14px",
                  background: "#faf8f4",
                  border: "1px solid #e6e0d4",
                  borderRadius: 10,
                  fontSize: 13,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "#e8d5a3",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      color: "#1a2e22",
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    {c.avatar_url ? (
                      <img src={c.avatar_url} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      (c.first_name?.[0] ?? "C").toUpperCase()
                    )}
                  </div>
                  <div>
                    <b style={{ color: "#142219", fontSize: 13.5 }}>
                      {c.first_name} {c.middle_name ? `${c.middle_name} ` : ""}{c.last_name}
                    </b>
                    <div style={{ fontSize: 12, color: "#6e7b71", marginTop: 2 }}>
                      {c.email} · {c.contact} {c.user_code ? `· ID: ${c.user_code}` : ""}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "3px 8px",
                      borderRadius: 6,
                      background: c.status === "active" || c.status === "approved" ? "#dcfce7" : "#fef3c7",
                      color: c.status === "active" || c.status === "approved" ? "#166534" : "#92400e",
                      fontWeight: 700,
                    }}
                  >
                    {c.status}
                  </span>

                  <button
                    onClick={() => setTopUpCustomer(c)}
                    title="Top-up balance"
                    style={{
                      padding: "5px 9px",
                      borderRadius: 6,
                      background: "#f0ece1",
                      border: "1px solid #d4cdbe",
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: "#142219",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Coins size={13} /> ₱{Number(c.balance || 0).toFixed(0)}
                  </button>

                  <button
                    onClick={() => onSelectUser?.(c)}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 6,
                      background: "#123725",
                      color: "#fff",
                      border: "none",
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Profile
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </ModalShell>
    );
  }

  // 4. CAFÉ / PRE-ORDER MANAGEMENT MODAL
  if (
    modalId === "cafe-management" ||
    modalId === "view-orders" ||
    modalId === "pending-orders" ||
    modalId === "order-queue"
  ) {
    const pendingCount = orders.filter((o) => o.status === "Pending").length;
    const preparingCount = orders.filter((o) => o.status === "Preparing").length;
    const readyCount = orders.filter((o) => o.status === "Ready").length;
    const completedCount = orders.filter((o) => o.status === "Completed").length;

    const filteredOrders = orders.filter((o) => {
      if (orderFilter === "all") return true;
      return o.status.toLowerCase() === orderFilter;
    });

    return (
      <ModalShell
        title="Snack &amp; Pre-Order Management"
        subtitle="Process customer beverage and food orders delivered to stations"
        icon={Coffee}
      >
        {/* Quick order counts */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 14 }}>
          <div
            onClick={() => setOrderFilter("pending")}
            style={{
              padding: "8px",
              background: orderFilter === "pending" ? "#fee2e2" : "#f5f2eb",
              borderRadius: 8,
              textAlign: "center",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "#991b1b" }}>Pending</span>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#142219" }}>{pendingCount}</div>
          </div>
          <div
            onClick={() => setOrderFilter("preparing")}
            style={{
              padding: "8px",
              background: orderFilter === "preparing" ? "#fef3c7" : "#f5f2eb",
              borderRadius: 8,
              textAlign: "center",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "#92400e" }}>Preparing</span>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#142219" }}>{preparingCount}</div>
          </div>
          <div
            onClick={() => setOrderFilter("ready")}
            style={{
              padding: "8px",
              background: orderFilter === "ready" ? "#e0f2fe" : "#f5f2eb",
              borderRadius: 8,
              textAlign: "center",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "#0369a1" }}>Ready</span>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#142219" }}>{readyCount}</div>
          </div>
          <div
            onClick={() => setOrderFilter("completed")}
            style={{
              padding: "8px",
              background: orderFilter === "completed" ? "#dcfce7" : "#f5f2eb",
              borderRadius: 8,
              textAlign: "center",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "#166534" }}>Completed</span>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#142219" }}>{completedCount}</div>
          </div>
        </div>

        {/* Order List */}
        <div style={{ maxHeight: 320, overflowY: "auto", display: "grid", gap: 10 }}>
          {filteredOrders.length === 0 ? (
            <div style={{ textAlign: "center", padding: 24, fontSize: 13, color: "#6a796e" }}>
              No orders found in this category.
            </div>
          ) : (
            filteredOrders.map((ord) => (
              <div
                key={ord.id}
                style={{
                  padding: "12px 14px",
                  background: "#faf8f4",
                  border: "1px solid #e6e0d4",
                  borderRadius: 10,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <b style={{ color: "#142219" }}>{ord.station}</b>
                    <span style={{ fontSize: 12, color: "#6a796e" }}>· {ord.customer}</span>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 6,
                      fontWeight: 700,
                      background:
                        ord.status === "Pending"
                          ? "#fee2e2"
                          : ord.status === "Preparing"
                          ? "#fef3c7"
                          : ord.status === "Ready"
                          ? "#e0f2fe"
                          : "#dcfce7",
                      color:
                        ord.status === "Pending"
                          ? "#991b1b"
                          : ord.status === "Preparing"
                          ? "#92400e"
                          : ord.status === "Ready"
                          ? "#0369a1"
                          : "#166534",
                    }}
                  >
                    {ord.status}
                  </span>
                </div>

                <div style={{ fontSize: 13, color: "#223528", marginBottom: 8 }}>{ord.items}</div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#728076" }}>
                    <b style={{ color: "#142219" }}>{ord.reference}</b> · Total: <b>₱{ord.total.toFixed(2)}</b> · {ord.payment} · {ord.time}
                  </span>

                  <div style={{ display: "flex", gap: 6 }}>
                    {ord.status === "Pending" && (
                      <button
                        onClick={() => void handleUpdateOrderStatus(ord.id, "Preparing")}
                        style={{
                          padding: "5px 10px",
                          borderRadius: 6,
                          background: "#b45309",
                          color: "#fff",
                          fontSize: 11.5,
                          fontWeight: 600,
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        Accept &amp; Prepare
                      </button>
                    )}
                    {ord.status === "Preparing" && (
                      <button
                        onClick={() => void handleUpdateOrderStatus(ord.id, "Ready")}
                        style={{
                          padding: "5px 10px",
                          borderRadius: 6,
                          background: "#0284c7",
                          color: "#fff",
                          fontSize: 11.5,
                          fontWeight: 600,
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        Mark as Ready
                      </button>
                    )}
                    {ord.status === "Ready" && (
                      <button
                        onClick={() => void handleUpdateOrderStatus(ord.id, "Completed")}
                        style={{
                          padding: "5px 10px",
                          borderRadius: 6,
                          background: "#166534",
                          color: "#fff",
                          fontSize: 11.5,
                          fontWeight: 600,
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        Complete Order
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ModalShell>
    );
  }

  // 3. PC AVAILABILITY MODAL
  if (modalId === "pc-availability" || modalId === "station-map") {
    return (
      <ModalShell
        title="PC Operational Status"
        subtitle="Live workstation availability board"
        icon={LayoutGrid}
      >
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "#142219" }}>All 20 PC Gaming &amp; Workstations</span>
            <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#6a796e" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} /> Available
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} /> In Use
              </span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
            {Array.from({ length: 8 }, (_, i) => {
              const num = i + 1;
              const key = `PC-${num.toString().padStart(2, "0")}`;
              const activeSession = openSessions.find((s) => s.station_key === key);
              const inUse = Boolean(activeSession);

              return (
                <div
                  key={key}
                  onClick={() => {
                    if (inUse) {
                      setSessionSubTab("active");
                    } else {
                      setSelectedStationKey(key);
                      setSessionSubTab("start");
                    }
                  }}
                  style={{
                    padding: "8px 6px",
                    borderRadius: 8,
                    background: inUse ? "#fef3c7" : "#eaf4ed",
                    border: `1px solid ${inUse ? "#f59e0b" : "#86efac"}`,
                    textAlign: "center",
                    cursor: "pointer",
                  }}
                >
                  <b style={{ fontSize: 12, color: "#142219" }}>{key}</b>
                  <div style={{ fontSize: 10, color: inUse ? "#92400e" : "#166534", fontWeight: 700, marginTop: 2 }}>
                    {inUse ? "IN USE" : "READY"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </ModalShell>
    );
  }

  return null;
}
