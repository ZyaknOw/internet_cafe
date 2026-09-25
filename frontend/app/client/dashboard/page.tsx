"use client";

import { useEffect, useState, useCallback } from "react";
import "@/components/admin-portal/admin-portal.css";
import "@/components/staff-portal/staff-portal.css";
import { UserProfileModal } from "@/components/shared/user-profile-modal";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase/client";
import { SNACK_PRODUCTS } from "@/lib/snack-menu";
import {
  Bell,
  Monitor,
  Coffee,
  Receipt,
  LayoutGrid,
  Laptop,
  ShoppingBag,
  ArrowRight,
  User,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Headphones,
  Coins,
  Search,
  Send,
  Sparkles,
  Wifi,
  X,
} from "lucide-react";

interface CoffeeProduct {
  id: string;
  name: string;
  price: number;
  type: "Savory" | "Sweet";
  description: string;
  image: string;
}

interface CartItem extends CoffeeProduct {
  quantity: number;
}

// Live rig state from GET /api/client/stations — the same shape the staff
// Workstation Live Control Board renders.
interface StationItem {
  id: string;
  name: string;
  type: "Standard" | "VIP";
  rate: number;
  specs: string;
  status: "available" | "in-use" | "waiting";
  startedAt?: string;
  sessionStatus?: "pending_client" | "active";
  mine?: boolean;
}

// A confirmed café order. Doubles as the receipt the confirmation modal renders
// and as the row that lands in the Billing & Transaction History table.
interface PlacedOrder {
  reference: string;
  items: CartItem[];
  total: number;
  station: string;
  paymentMethod: string;
  timestamp: string;
}

interface TransactionRow {
  id: string;
  service: string;
  amount: number;
  method: string;
  date: string;
  status: string;
}

// Starting history for the Billing & Transaction History tab. Confirmed café
// orders are prepended to this list so the new charge is visible immediately.
const TRANSACTION_HISTORY: TransactionRow[] = [
  { id: "TXN-8801", service: "Workstation Session (PC-04 · 3.0 hrs)", amount: 150.0, method: "Member Balance", date: "Sep 20, 2026, 4:15 PM", status: "Completed" },
  { id: "TXN-8800", service: "Snack Order (Spanish Latte)", amount: 120.0, method: "Member Balance", date: "Sep 20, 2026, 3:30 PM", status: "Completed" },
  { id: "TXN-8792", service: "Wallet Prepaid Top-Up", amount: 500.0, method: "Cash at Desk", date: "Sep 18, 2026, 1:10 PM", status: "Credited" },
  { id: "TXN-8740", service: "Workstation Session (PC-02 · 2.0 hrs)", amount: 100.0, method: "Member Balance", date: "Sep 15, 2026, 10:00 AM", status: "Completed" },
];

// A café ticket as stored in public.orders (migration 008). The receipt, the
// Billing & Transaction History row, and the staff queue all read this shape.
interface OrderRecord {
  id: string;
  reference: string;
  customer_name: string;
  station_key: string | null;
  items: { id: string; name: string; price: number | string; quantity: number }[];
  item_count: number;
  total: number | string;
  payment_method: string;
  status: "pending" | "preparing" | "ready" | "completed" | "cancelled";
  placed_at: string;
}

const ORDER_STATUS_LABELS: Record<OrderRecord["status"], string> = {
  pending: "Pending",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};

function formatOrderTimestamp(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function describeOrderItems(items: OrderRecord["items"]) {
  return items.map((item) => `${item.name} × ${item.quantity}`).join(", ") || "Snack order";
}

function orderToTransactionRow(order: OrderRecord): TransactionRow {
  // A ticket the client has only filed (not yet settled by the cashier) shows up
  // as awaiting payment so the history never implies the client already paid.
  const unpaid = order.status === "pending" && order.payment_method === "Unpaid";
  return {
    id: order.reference,
    service: `Snack Order (${describeOrderItems(order.items)})`,
    amount: Number(order.total) || 0,
    method: unpaid ? "Pay at Counter" : order.payment_method,
    date: formatOrderTimestamp(order.placed_at),
    status: unpaid ? "Awaiting Payment" : ORDER_STATUS_LABELS[order.status] ?? order.status,
  };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Mirrors the staff / cashier "Cafe Orders" menu exactly so both portals stay in sync.
const COFFEE_PRODUCTS: CoffeeProduct[] = SNACK_PRODUCTS;

export default function ClientDashboard() {
  const { profile, logout, refreshProfile } = useAuth();

  const [activeTab, setActiveTab] = useState<"overview" | "stations" | "coffee" | "transactions">("overview");

  const [dateStr, setDateStr] = useState("TUESDAY · SEPTEMBER 22, 2026");
  const [greeting, setGreeting] = useState("Good evening, Client.");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [sessionSeconds, setSessionSeconds] = useState(2520); // 42 minutes default

  // Live workstation board (read from the stations table through the API)
  const [stations, setStations] = useState<StationItem[]>([]);
  const [stationsLoaded, setStationsLoaded] = useState(false);

  // Coffee order form — auto-filled with the station this client is signed in on
  const [orderStation, setOrderStation] = useState("");

  // ── Snack Menu state (mirrors the staff / cashier Snack Orders menu) ────────
  const [snackSearch, setSnackSearch] = useState("");
  const [snackFilter, setSnackFilter] = useState<"All" | "Savory" | "Sweet">("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);

  // ── Snack order billing (confirmation modal → member balance charge) ──────
  const [confirmOrderOpen, setConfirmOrderOpen] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);
  const [transactions, setTransactions] = useState<TransactionRow[]>(TRANSACTION_HISTORY);
  const [nextTransactionSerial, setNextTransactionSerial] = useState(8802);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderError, setOrderError] = useState("");

  const addToCart = (product: CoffeeProduct) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== productId));
  };

  const clearCart = () => setCart([]);

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const filteredSnackProducts = COFFEE_PRODUCTS.filter((p) => {
    const matchesSearch = snackSearch === "" || p.name.toLowerCase().includes(snackSearch.toLowerCase());
    const matchesFilter = snackFilter === "All" || p.type === snackFilter;
    return matchesSearch && matchesFilter;
  });

  // ── Live floor board (DB-backed, mirrors the staff station board) ─────────
  const fetchStations = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`${API_URL}/api/client/stations`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) return;
      const body = await res.json() as { stations?: StationItem[] };
      setStations(
        (body.stations || []).map((st) => ({
          ...st,
          startedAt:
            st.startedAt && st.startedAt !== "Waiting for client"
              ? new Date(st.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : st.startedAt,
        }))
      );
      setStationsLoaded(true);
    } catch {
      // silent
    }
  }, []);

  // Mirrors the staff control board: one effect loads the board and keeps it live,
  // and tab entry re-reads it through an event handler instead of a second effect.
  const openStationsTab = useCallback(() => {
    setActiveTab("stations");
    void fetchStations();
  }, [fetchStations]);

  useEffect(() => {
    // The first snapshot read sits inside the async continuation so the resulting
    // state updates land outside the effect body (react-hooks/set-state-in-effect).
    void (async () => {
      await fetchStations();
    })();

    const channel = supabase
      .channel("client_stations_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stations" },
        () => {
          void fetchStations();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "station_sessions" },
        () => {
          void fetchStations();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchStations]);

  // ── Snack order history (DB-backed, mirrors the staff order queue) ─────────
  // Rows come from GET /api/client/orders. While migration 008 is not applied the
  // API answers `available: false`, and the seeded demo history is left as is.
  const fetchCafeOrders = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`${API_URL}/api/client/orders`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) return;
      const body = await res.json() as { orders?: OrderRecord[]; available?: boolean };
      if (!body.available) return;
      const rows = (body.orders || []).map(orderToTransactionRow);
      setTransactions((prev) => {
        const seen = new Set(rows.map((row) => row.id));
        return [...rows, ...prev.filter((row) => !seen.has(row.id))];
      });
    } catch {
      // silent
    }
  }, []);

  // Same pattern as the floor board: the read sits inside the async continuation
  // so the resulting state updates land outside the effect body
  // (react-hooks/set-state-in-effect).
  useEffect(() => {
    void (async () => {
      await fetchCafeOrders();
    })();
  }, [fetchCafeOrders]);

  const openTransactionsTab = useCallback(() => {
    setActiveTab("transactions");
    void fetchCafeOrders();
  }, [fetchCafeOrders]);

  const availableStations = stations.filter((s) => s.status === "available").length;
  const inUseStations = stations.filter((s) => s.status === "in-use").length;
  const myStation = stations.find((s) => s.mine) ?? null;

  // Delivery target for café orders — what the client typed in the café tab,
  // otherwise the rig they are signed in on, otherwise the front desk.
  const deliveryStation = orderStation || (myStation ? myStation.name : "Front Desk");

  // Line items and amount the confirmation modal shows: the live cart until the
  // order is confirmed, then the frozen copy captured at confirmation time.
  const orderItems = placedOrder ? placedOrder.items : cart;
  const orderTotal = placedOrder ? placedOrder.total : cartTotal;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // ── Snack order billing flow ──────────────────────────────────────────────
  // Step 1: the cart pill ("Order (n)") is the checkout trigger — one click on
  // it opens the confirmation modal so the client sees exactly what is being
  // ordered, the delivery station, and the amount before anything is billed.
  // The cart modal and the cart list are mutually exclusive: opening the
  // confirmation hides the list, and "Edit items" inside it brings the list back.
  const openOrderConfirmation = () => {
    if (cart.length === 0) return;
    setPlacedOrder(null);
    setOrderError("");
    setShowCart(false);
    setConfirmOrderOpen(true);
  };

  // "Edit items" swaps the confirmation modal back to the cart list, which is
  // the only place a drink can be removed or the whole order cleared.
  const editOrderItems = () => {
    setConfirmOrderOpen(false);
    setPlacedOrder(null);
    setOrderError("");
    setShowCart(true);
  };

  const closeOrderConfirmation = () => {
    setConfirmOrderOpen(false);
    setPlacedOrder(null);
    setOrderError("");
  };

  // Step 2: confirming bills the order to the member balance and writes the ticket
  // to public.orders through POST /api/client/orders, so the front desk queue picks
  // it up. The DB-issued ORD-#### reference comes back as the receipt, and the
  // charge is logged in the Billing & Transaction History tab.
  const confirmCoffeeOrder = async () => {
    if (cart.length === 0 || orderSubmitting) return;

    const items = cart.map((item) => ({ ...item }));
    const total = cartTotal;
    const station = deliveryStation;
    // The client chooses how they will pay, but the cashier is the one who takes
    // the money — this is just a preference shown on the ticket.
    const paymentMethod = "Pay at Counter";
    const offlineReference = `TXN-${nextTransactionSerial}`;

    // Used only when the API is unreachable or migration 008 is not applied yet:
    // the receipt and history row then stay local so the client is never blocked.
    const saveLocally = () => {
      const timestamp = new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
      setPlacedOrder({ reference: offlineReference, items, total, station, paymentMethod, timestamp });
      setTransactions((prev) => [
        {
          id: offlineReference,
          service: `Snack Order (${describeOrderItems(items)})`,
          amount: total,
          method: paymentMethod,
          date: timestamp,
          status: "Awaiting Payment",
        },
        ...prev,
      ]);
      setNextTransactionSerial((serial) => serial + 1);
      clearCart();
      setShowCart(false);
      showToast(`☕ Order sent to the front desk! ₱${total.toFixed(2)} for ${station} — pay at the counter.`);
    };

    setOrderSubmitting(true);
    setOrderError("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`${API_URL}/api/client/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ items, stationKey: station, paymentMethod }),
      });
      const body = await res.json().catch(() => ({})) as { order?: OrderRecord; balance?: number; error?: string };

      if (res.ok && body.order) {
        const order = body.order;
        const chargedTotal = Number(order.total) || total;
        setPlacedOrder({
          reference: order.reference,
          items,
          total: chargedTotal,
          station: order.station_key || station,
          paymentMethod,
          timestamp: formatOrderTimestamp(order.placed_at),
        });
        setTransactions((prev) => [orderToTransactionRow(order), ...prev.filter((row) => row.id !== order.reference)]);
        clearCart();
        setShowCart(false);
        showToast(`☕ Order ${order.reference} sent to the front desk! ₱${chargedTotal.toFixed(2)} — settle payment at the counter and it will be delivered to ${order.station_key || station}.`);
        void refreshProfile();
        return;
      }

      // A refused order or an invalid basket has to be fixed by the client, so it
      // is surfaced instead of being re-booked locally.
      if (res.status === 402 || res.status === 400) {
        setOrderError(body.error || "This order could not be sent to the front desk.");
        return;
      }

      saveLocally();
    } catch {
      saveLocally();
    } finally {
      setOrderSubmitting(false);
    }
  };

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

      const name = profile?.first_name ? profile.first_name : "Client";
      setGreeting(`${timeGreet}, ${name}.`);
    };

    updateHeader();
    const interval = setInterval(updateHeader, 60000);
    return () => clearInterval(interval);
  }, [profile]);

  // Session timer ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs > 0 ? `${hrs}h ` : ""}${mins}m ${secs < 10 ? "0" : ""}${secs}s`;
  };

  const displayName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : "Client";
  const userBalance = Number(profile?.balance ?? 240);

  return (
    <div className="nodecafe-root">
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: "#091c17",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            zIndex: 9999,
            fontSize: 13.5,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 8,
            border: "1px solid #164034",
            animation: "nodecafe-fade 0.2s ease-in-out",
          }}
        >
          <Sparkles size={16} color="#4ade80" />
          <span>{toast}</span>
        </div>
      )}

      {/* -------------------------------------------------------------
          LEFT SIDEBAR (Unified Internet Cafe Dark Obsidian)
          ------------------------------------------------------------- */}
      <aside className="nodecafe-sidebar" aria-label="Client Navigation">
        <div style={{ width: "100%" }}>
          {/* Brand Logo */}
          <div className="nodecafe-brand">
            <div className="nodecafe-brand-icon" aria-hidden="true">
              N
            </div>
            <div>
              <div className="nodecafe-brand-title">Internet Cafe</div>
              <div className="nodecafe-brand-sub">Client Lounge</div>
            </div>
          </div>

          {/* Navigation Links - FULL IN-PAGE NAVIGATION */}
          <nav className="nodecafe-nav" aria-label="Client Links">
            <button
              className={`nodecafe-nav-item ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              <LayoutGrid size={17} />
              <span>Overview</span>
            </button>

            <button
              className={`nodecafe-nav-item ${activeTab === "stations" ? "active" : ""}`}
              onClick={openStationsTab}
            >
              <Monitor size={17} />
              <span>PC Stations</span>
            </button>

            <button
              className={`nodecafe-nav-item ${activeTab === "coffee" ? "active" : ""}`}
              onClick={() => setActiveTab("coffee")}
            >
              <Coffee size={17} />
              <span>Snacks</span>
            </button>

            <button
              className={`nodecafe-nav-item ${activeTab === "transactions" ? "active" : ""}`}
              onClick={openTransactionsTab}
            >
              <Receipt size={17} />
              <span>Transactions</span>
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
              onClick={() => showToast("No new alerts. Your workstation session is running smoothly!")}
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell size={17} />
              <span className="nodecafe-notif-badge">1</span>
            </button>

            {/* Profile Avatar Pill with Dropdown */}
            <div style={{ position: "relative" }}>
              <button
                className="nodecafe-user-pill"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                aria-expanded={showProfileMenu}
                aria-label="Client account menu"
              >
                <div className="nodecafe-user-avatar" aria-hidden="true">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Avatar"
                      style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
                    />
                  ) : (
                    (displayName[0] || "C").toUpperCase()
                  )}
                </div>
                <span className="nodecafe-user-label">Client account</span>
              </button>

              {showProfileMenu && (
                <div className="nodecafe-user-dropdown" role="menu">
                  <button
                    className="nodecafe-dropdown-item"
                    onClick={() => {
                      setShowProfileMenu(false);
                      setShowProfileModal(true);
                    }}
                  >
                    <User size={15} />
                    <span>My Profile</span>
                  </button>
                  <div style={{ height: 1, background: "#edf3f0", margin: "4px 0" }} />
                  <button
                    className="nodecafe-dropdown-item danger"
                    onClick={() => {
                      setShowProfileMenu(false);
                      void logout();
                    }}
                  >
                    <LogOut size={15} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* -------------------------------------------------------------
            TAB 1: CLIENT OVERVIEW
            ------------------------------------------------------------- */}
        {activeTab === "overview" && (
          <div className="nodecafe-page-view">
            {/* Top 4 KPI Cards */}
            <section className="nodecafe-kpi-grid" aria-label="Account Indicators">
              <div className="nodecafe-kpi-card">
                <div className="nodecafe-kpi-label">Active Station</div>
                <div className="nodecafe-kpi-val" style={{ color: myStation ? "#166534" : "#6a887e" }}>
                  {myStation ? myStation.name : "—"}
                </div>
                <div className="nodecafe-kpi-sub" style={{ color: myStation ? "#166534" : "#6a887e" }}>
                  {myStation ? `Active for ${formatTimer(sessionSeconds)}` : "No station assigned yet"}
                </div>
              </div>

              <div className="nodecafe-kpi-card">
                <div className="nodecafe-kpi-label">Prepaid Balance</div>
                <div className="nodecafe-kpi-val">₱{userBalance.toFixed(2)}</div>
                <div className="nodecafe-kpi-sub">
                  Approx ~4.8 hrs remaining
                </div>
              </div>

              <div className="nodecafe-kpi-card">
                <div className="nodecafe-kpi-label">Hourly Rate</div>
                <div className="nodecafe-kpi-val">₱{(myStation?.rate ?? 0).toFixed(2)}</div>
                <div className="nodecafe-kpi-sub">
                  {myStation ? `${myStation.type} Rig Tier` : "Pick a rig at the front desk"}
                </div>
              </div>

              <div className="nodecafe-kpi-card">
                <div className="nodecafe-kpi-label">Stations Available</div>
                <div className="nodecafe-kpi-val" style={{ color: "#166534" }}>
                  {availableStations} / {stations.length}
                </div>
                <div className="nodecafe-kpi-sub" style={{ color: "#166534" }}>
                  {stationsLoaded ? "Open seats on the floor right now" : "Loading live floor data…"}
                </div>
              </div>
            </section>

            {/* Middle Section: Active Session Card & Quick Actions */}
            <section className="nodecafe-middle-grid" aria-label="Session and Actions">
              {/* Left: Active Station Session */}
              <div className="nodecafe-card">
                <div className="nodecafe-card-kicker">Live Workstation</div>
                <div className="nodecafe-card-header">
                  <h2 className="nodecafe-card-title">Session at Station {myStation ? myStation.name : "—"}</h2>
                  <span className={`nodecafe-status-chip ${myStation ? "active" : "pending"}`}>
                    {myStation ? "Connected" : "Idle"}
                  </span>
                </div>

                <div style={{ background: "#fbfcfb", border: "1px solid #edf2ef", borderRadius: 14, padding: "20px 22px", marginBottom: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 12, color: "#6a887e", fontWeight: 600 }}>Elapsed Playing Time</div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: "#091c17", letterSpacing: 0.5, marginTop: 4 }}>
                        {formatTimer(sessionSeconds)}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12, color: "#6a887e", fontWeight: 600 }}>Current Accrued Total</div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: "#166534", marginTop: 4 }}>
                        ₱{((sessionSeconds / 3600) * (myStation?.rate ?? 0)).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, paddingTop: 14, borderTop: "1px solid #edf3f0", fontSize: 12.5, color: "#4f6358" }}>
                    <div>Hardware: <b>{myStation?.specs ?? "—"}</b></div>
                    <div>Network: <b>850 Mbps Fiber (4ms Ping)</b></div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    className="nodecafe-btn-primary"
                    onClick={() => setActiveTab("coffee")}
                    style={{ flex: 1 }}
                  >
                    <Coffee size={16} />
                    <span>Order Snacks to {myStation ? myStation.name : "your station"}</span>
                  </button>
                  <button
                    className="nodecafe-btn-decline"
                    onClick={() => {
                      showToast("Front desk alerted! A staff member is on their way to your station.");
                    }}
                    style={{ padding: "10px 18px", display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    <Headphones size={15} />
                    <span>Call Staff</span>
                  </button>
                </div>
              </div>

              {/* Right: Quick Lounge Actions */}
              <div className="nodecafe-card">
                <div className="nodecafe-card-kicker">Quick Actions</div>
                <div className="nodecafe-card-header" style={{ marginBottom: 12 }}>
                  <h2 className="nodecafe-card-title">Client Services</h2>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button
                    className="nodecafe-btn-decline"
                    style={{ textAlign: "left", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}
                    onClick={() => setActiveTab("coffee")}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Coffee size={16} color="#0b2b23" />
                      <div>
                        <b style={{ color: "#091c17", fontSize: 13 }}>Pre-order Snacks</b>
                        <div style={{ fontSize: 11, color: "#6a887e" }}>Delivered to your PC seat</div>
                      </div>
                    </div>
                    <ArrowRight size={14} color="#6a887e" />
                  </button>

                  <button
                    className="nodecafe-btn-decline"
                    style={{ textAlign: "left", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}
                    onClick={openStationsTab}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Monitor size={16} color="#0b2b23" />
                      <div>
                        <b style={{ color: "#091c17", fontSize: 13 }}>Check Station Availability</b>
                        <div style={{ fontSize: 11, color: "#6a887e" }}>{availableStations} rigs open right now</div>
                      </div>
                    </div>
                    <ArrowRight size={14} color="#6a887e" />
                  </button>

                  <button
                    className="nodecafe-btn-decline"
                    style={{ textAlign: "left", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}
                    onClick={() => {
                      showToast("Pay in cash at the front desk — just approach the counter anytime.");
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Coins size={16} color="#0b2b23" />
                      <div>
                        <b style={{ color: "#091c17", fontSize: 13 }}>Pay at the Counter</b>
                        <div style={{ fontSize: 11, color: "#6a887e" }}>Walk-in cash payment</div>
                      </div>
                    </div>
                    <ArrowRight size={14} color="#6a887e" />
                  </button>
                </div>

                <div className="nodecafe-stepper-footer" style={{ marginTop: "auto" }}>
                  Internet Cafe High-Speed Network · Protected by RA 10173
                </div>
              </div>
            </section>

            {/* Bottom Live Services Section */}
            <section className="nodecafe-services-section" aria-label="Services Available">
              <div className="nodecafe-card-kicker">Services</div>
              <div className="nodecafe-card-header">
                <h2 className="nodecafe-card-title">Live service availability</h2>
              </div>

              <div className="nodecafe-services-grid">
                <div
                  className="nodecafe-service-card"
                  onClick={openStationsTab}
                  role="button"
                  tabIndex={0}
                >
                  <div className="nodecafe-service-top">
                    <div className="nodecafe-service-icon" aria-hidden="true">
                      <Laptop size={19} />
                    </div>
                    <div>
                      <div className="nodecafe-service-name">PC Station</div>
                      <div className="nodecafe-service-spec">
                        {myStation ? `You are on ${myStation.name}` : `${stations.length} rigs on the floor`}
                      </div>
                    </div>
                  </div>
                  <div className="nodecafe-service-bottom">
                    <div className="nodecafe-service-price">
                      ₱{(stations.length ? Math.min(...stations.map((s) => s.rate)) : 0).toFixed(2)} / hr
                    </div>
                    <div className="nodecafe-service-badge">
                      {availableStations > 0 ? `${availableStations} Available` : "Fully Booked"}
                    </div>
                  </div>
                </div>

                <div
                  className="nodecafe-service-card"
                  onClick={() => setActiveTab("coffee")}
                  role="button"
                  tabIndex={0}
                >
                  <div className="nodecafe-service-top">
                    <div className="nodecafe-service-icon" aria-hidden="true">
                      <Coffee size={19} />
                    </div>
                    <div>
                      <div className="nodecafe-service-name">Snacks</div>
                      <div className="nodecafe-service-spec">Seasoned Fries</div>
                    </div>
                  </div>
                  <div className="nodecafe-service-bottom">
                    <div className="nodecafe-service-price">₱95</div>
                    <div className="nodecafe-service-badge">Available</div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 2: WORKSTATION BOARD (same control-board UI as staff)
            ------------------------------------------------------------- */}
        {activeTab === "stations" && (
          <div className="nodecafe-page-view">
            <div className="nodecafe-page-header">
              <div>
                <h2 className="nodecafe-page-title">Workstation Availability</h2>
                <p className="nodecafe-page-subtitle">
                  {stationsLoaded
                    ? `${availableStations} of ${stations.length} rigs are open right now — updated live from the front desk board.`
                    : "Loading the live floor board…"}
                </p>
              </div>
            </div>

            <section className="nodecafe-kpi-grid" aria-label="Station Availability Summary">
              <div className="nodecafe-kpi-card">
                <div className="nodecafe-kpi-label">Available</div>
                <div className="nodecafe-kpi-val" style={{ color: "#166534" }}>{availableStations}</div>
                <div className="nodecafe-kpi-sub" style={{ color: "#166534" }}>Ready to use now</div>
              </div>

              <div className="nodecafe-kpi-card">
                <div className="nodecafe-kpi-label">Occupied</div>
                <div className="nodecafe-kpi-val" style={{ color: "#b45309" }}>{inUseStations}</div>
                <div className="nodecafe-kpi-sub">Sessions in progress</div>
              </div>

              <div className="nodecafe-kpi-card">
                <div className="nodecafe-kpi-label">Your Station</div>
                <div className="nodecafe-kpi-val">{myStation ? myStation.name : "—"}</div>
                <div className="nodecafe-kpi-sub">
                  {myStation ? `Running · ${formatTimer(sessionSeconds)}` : "Not assigned yet"}
                </div>
              </div>

              <div className="nodecafe-kpi-card">
                <div className="nodecafe-kpi-label">Total Rigs</div>
                <div className="nodecafe-kpi-val">{stations.length}</div>
                <div className="nodecafe-kpi-sub">Standard &amp; VIP tiers</div>
              </div>
            </section>

            {/* Same control-board cards the staff portal renders, read from the stations table */}
            <div className="nodecafe-card" style={{ padding: "20px 24px" }}>
              {stations.length === 0 ? (
                <div style={{ fontSize: 13, color: "#6a887e", padding: "10px 0" }}>
                  {stationsLoaded
                    ? "No workstations are configured yet. Please ask the front desk for a rig."
                    : "Loading live station data…"}
                </div>
              ) : (
                <div className="nodecafe-stations-grid">
                  {stations.map((st) => (
                    <div key={st.id} className={`nodecafe-station-card ${st.status}`}>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Laptop size={16} color={st.status === "in-use" ? "#dc2626" : "#166534"} />
                            <b style={{ color: "#091c17", fontSize: 14.5 }}>{st.name}</b>
                          </div>
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

                        <div style={{ fontSize: 11.5, color: "#6a887e", marginBottom: 8, lineHeight: 1.3 }}>
                          {st.status === "in-use" ? (
                            <span style={{ color: "#b91c1c", fontWeight: 600 }}>
                              {st.mine ? `${displayName} (${st.startedAt})` : `In session (${st.startedAt})`}
                            </span>
                          ) : (
                            st.specs
                          )}
                        </div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px solid #f0f5f2" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#091c17" }}>₱{st.rate}/hr</span>
                        {st.mine ? (
                          <span
                            style={{
                              fontSize: 11,
                              padding: "4px 8px",
                              background: "#dcfce7",
                              color: "#166534",
                              borderRadius: 5,
                              fontWeight: 700,
                            }}
                          >
                            Your Station
                          </span>
                        ) : st.status === "in-use" ? (
                          <button
                            style={{ fontSize: 11, padding: "4px 8px", background: "#fee2e2", color: "#991b1b", border: 0, borderRadius: 5, fontWeight: 700, cursor: "pointer" }}
                            onClick={() => showToast(`${st.name} is taken right now. Front desk notified — you are queued for the next open rig.`)}
                          >
                            Notify Me
                          </button>
                        ) : (
                          <button
                            style={{ fontSize: 11, padding: "4px 8px", background: "#0b2b23", color: "#fff", border: 0, borderRadius: 5, fontWeight: 700, cursor: "pointer" }}
                            onClick={() => showToast(`Front desk notified! ${st.name} can be held for you.`)}
                          >
                            Request Station
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="nodecafe-card" style={{ padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#166534" }}>
                  <Wifi size={17} />
                  <span>Direct Fiber Connection Active · 850 Mbps Dual Redundancy</span>
                </div>
                <button
                  className="nodecafe-btn-primary"
                  style={{ width: "auto", padding: "10px 18px" }}
                  onClick={() => {
                    showToast("Front desk staff notified! They will guide you to an available VIP rig.");
                  }}
                >
                  Request VIP Station Upgrade
                </button>
              </div>
            </div>
          </div>
        )}


        {/* -------------------------------------------------------------
            TAB 4: COFFEE MENU (FULL IN-PAGE VIEW)
            ------------------------------------------------------------- */}
        {/* -------------------------------------------------------------
            TAB 4: CAFÉ ORDERS (mirrors the staff / cashier menu)
            ------------------------------------------------------------- */}
        {activeTab === "coffee" && (
          <div className="nodecafe-page-view">
            {/* ── Page Title + Controls ─────────────────────────────────── */}
            <div className="cafe-orders-header">
              <div className="cafe-orders-title-col">
                <h2 className="cafe-orders-title">Snack Menu</h2>
                <p className="cafe-orders-subtitle">Fresh bites delivered to your station.</p>
              </div>
              <div className="cafe-orders-controls">
                {/* Search */}
                <div className="cafe-orders-search">
                  <Search size={16} className="cafe-search-icon" />
                  <input
                    type="text"
                    placeholder="Search snacks..."
                    value={snackSearch}
                    onChange={(e) => setSnackSearch(e.target.value)}
                    className="cafe-search-input"
                  />
                </div>
                {/* Filter Buttons */}
                <div className="cafe-filter-pills">
                  {(["All", "Savory", "Sweet"] as const).map((f) => (
                    <button
                      key={f}
                      className={`cafe-filter-btn${snackFilter === f ? " active" : ""}`}
                      onClick={() => setSnackFilter(f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                {/* Delivery Station */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "#4f6358" }}>Deliver to:</span>
                  <input
                    type="text"
                    value={deliveryStation}
                    onChange={(e) => setOrderStation(e.target.value)}
                    style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #d1ded7", fontSize: 13, fontWeight: 700, width: 85, textAlign: "center" }}
                  />
                </div>
                {/* Cart Button — one click checks out: opens the confirmation modal */}
                {cart.length > 0 && (
                  <button
                    className="cafe-cart-btn"
                    onClick={openOrderConfirmation}
                    title="Review and confirm your order"
                  >
                    <ShoppingBag size={16} />
                    <span>Order ({cartCount})</span>
                    <span className="cafe-cart-total">₱{cartTotal.toFixed(2)}</span>
                  </button>
                )}
              </div>
            </div>

            {/* ── Product Grid ─────────────────────────────────────────── */}
            {filteredSnackProducts.length === 0 ? (
              <div className="cafe-empty-state">
                <Coffee size={40} style={{ color: "#b0c8bf", marginBottom: 12 }} />
                <p>No products found matching your search.</p>
              </div>
            ) : (
              <div className="cafe-product-grid">
                {filteredSnackProducts.map((product) => {
                  const cartItem = cart.find((c) => c.id === product.id);
                  return (
                    <div key={product.id} className="cafe-product-card">
                      {/* Product Image */}
                      <div className="cafe-product-img-wrap">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="cafe-product-img"
                        />
                      </div>
                      {/* Product Info */}
                      <div className="cafe-product-info">
                        <div className="cafe-product-top-row">
                          <span className={`cafe-temp-badge ${product.type === "Sweet" ? "iced" : "hot"}`}>
                            {product.type === "Sweet" ? "🍪" : "🥪"} {product.type}
                          </span>
                        </div>
                        <div className="cafe-product-name">{product.name}</div>
                        <div className="cafe-product-desc">{product.description}</div>
                        <div className="cafe-product-price">₱{product.price}</div>
                        <button
                          className="cafe-add-btn"
                          onClick={() => addToCart(product)}
                        >
                          <ShoppingBag size={14} />
                          <span>{cartItem ? `Add More (${cartItem.quantity})` : "Add to Order"}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Cart / Order Panel ───────────────────────────────────── */}
            {showCart && cart.length > 0 && (
              <div className="cafe-cart-panel">
                <div className="cafe-cart-header">
                  <h3 className="cafe-cart-title">
                    <ShoppingBag size={17} />
                    Current Order
                  </h3>
                  <button className="cafe-cart-close" onClick={() => setShowCart(false)}>
                    <X size={17} />
                  </button>
                </div>
                <div className="cafe-cart-items">
                  {cart.map((item) => (
                    <div key={item.id} className="cafe-cart-item">
                      <div className="cafe-cart-item-info">
                        <span className="cafe-cart-item-name">{item.name}</span>
                        <span className="cafe-cart-item-qty">× {item.quantity}</span>
                      </div>
                      <div className="cafe-cart-item-right">
                        <span className="cafe-cart-item-subtotal">₱{(item.price * item.quantity).toFixed(2)}</span>
                        <button className="cafe-cart-remove" onClick={() => removeFromCart(item.id)}>
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="cafe-cart-footer">
                  <div className="cafe-cart-total-row">
                    <span>Order Total</span>
                    <span className="cafe-cart-grand-total">₱{cartTotal.toFixed(2)}</span>
                  </div>
                  <div className="cafe-cart-actions">
                    <button className="cafe-clear-btn" onClick={clearCart}>Clear</button>
                    <button
                      className="cafe-confirm-btn"
                      onClick={openOrderConfirmation}
                    >
                      <Send size={14} />
                      Send Order for {deliveryStation}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 5: TRANSACTIONS (FULL IN-PAGE VIEW)
            ------------------------------------------------------------- */}
        {activeTab === "transactions" && (
          <div className="nodecafe-page-view">
            <div className="nodecafe-page-header">
              <div>
                <h2 className="nodecafe-page-title">Billing &amp; Transaction History</h2>
                <p className="nodecafe-page-subtitle">Your workstation charges, prepaid top-ups, and in-café orders.</p>
              </div>
            </div>

            <div className="nodecafe-table-card">
              <table className="nodecafe-table">
                <thead>
                  <tr>
                    <th>Transaction Code</th>
                    <th>Service / Item</th>
                    <th>Amount</th>
                    <th>Payment Mode</th>
                    <th>Timestamp</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td><code style={{ fontWeight: 700, color: "#0b2b23" }}>{tx.id}</code></td>
                      <td><b>{tx.service}</b></td>
                      <td><b>₱{tx.amount.toFixed(2)}</b></td>
                      <td>
                        <span style={{ fontSize: 12, padding: "2px 7px", borderRadius: 4, background: "#f0f5f2", color: "#143a2d", fontWeight: 600 }}>
                          {tx.method}
                        </span>
                      </td>
                      <td style={{ color: "#6a887e", fontSize: 12 }}>{tx.date}</td>
                      <td>
                        <span className="nodecafe-status-chip active">
                          <CheckCircle2 size={12} />
                          {tx.status}
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

      {/* Snack Order Confirmation & Billing Modal */}
      {confirmOrderOpen && (
        <div
          className="admin-modal-overlay"
          onClick={closeOrderConfirmation}
          role="dialog"
          aria-modal="true"
          aria-label="Confirm your café order"
        >
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="admin-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#eaf3ed", color: "#18452e", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {placedOrder ? <CheckCircle2 size={16} /> : <Coffee size={16} />}
                </div>
                <h3>{placedOrder ? "Order Sent" : "Confirm Your Order"}</h3>
              </div>
              <button className="admin-modal-close" onClick={closeOrderConfirmation} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            {placedOrder && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#eaf7ef", border: "1px solid #bfe3cd", color: "#14532d", borderRadius: 10, padding: "10px 12px", fontSize: 12.5, fontWeight: 600, marginBottom: 14 }}>
                <Sparkles size={15} />
                <span>Order sent to the front desk! Please settle ₱{placedOrder.total.toFixed(2)} at the counter — it will then be delivered to {placedOrder.station}.</span>
              </div>
            )}

            {/* Coffee being ordered */}
            <div style={{ border: "1px solid #e6ece8", borderRadius: 12, background: "#fbfdfc", padding: "12px 14px" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, color: "#7d968c", textTransform: "uppercase", marginBottom: 6 }}>
                {placedOrder ? "Your Order" : "You Are Ordering"}
              </div>
              {orderItems.map((item) => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "7px 0", borderBottom: "1px dashed #e6ece8" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: "#eaf3ed", color: "#18452e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Coffee size={14} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "#091c17" }}>{item.name}</div>
                      <div style={{ fontSize: 11.5, color: "#6a887e" }}>
                        {item.type} · ₱{item.price.toFixed(2)} each
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: "#4f6358" }}>× {item.quantity}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#091c17" }}>₱{(item.price * item.quantity).toFixed(2)}</div>
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", paddingTop: 10 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#4f6358" }}>
                  Total Amount {orderItems.length > 1 ? `(${orderItems.reduce((sum, item) => sum + item.quantity, 0)} items)` : ""}
                </span>
                <span style={{ fontSize: 21, fontWeight: 800, color: "#0b2b23" }}>₱{orderTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Client details + how the order is billed */}
            <div style={{ border: "1px solid #e6ece8", borderRadius: 12, padding: "12px 14px", marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, color: "#7d968c", textTransform: "uppercase", marginBottom: 6 }}>
                {placedOrder ? "Billed To" : "Your Details"}
              </div>
              {[
                { label: "Client", value: displayName },
                { label: "NetCafe ID", value: profile?.user_code || "—" },
                { label: "Contact", value: profile?.contact || "—" },
                { label: "Deliver to", value: placedOrder ? placedOrder.station : deliveryStation },
              ].map((row) => (
                <div key={row.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 12.5, padding: "3px 0" }}>
                  <span style={{ color: "#6a887e" }}>{row.label}</span>
                  <b style={{ color: "#091c17", textAlign: "right" }}>{row.value}</b>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 12.5, paddingTop: 9, marginTop: 5, borderTop: "1px solid #eef3f0" }}>
                <span style={{ color: "#6a887e" }}>Payment mode</span>
                <span style={{ fontSize: 11.5, padding: "2px 8px", borderRadius: 5, background: "#fdf3e0", color: "#8a5a06", fontWeight: 700 }}>
                  {placedOrder ? placedOrder.paymentMethod : "Pay at Counter"}
                </span>
              </div>
              {placedOrder ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 12.5, paddingTop: 4 }}>
                    <span style={{ color: "#6a887e" }}>Reference</span>
                    <b style={{ color: "#0b2b23" }}>{placedOrder.reference} · {placedOrder.timestamp}</b>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 12.5, paddingTop: 4 }}>
                    <span style={{ color: "#6a887e" }}>Status</span>
                    <b style={{ color: "#8a5a06" }}>Awaiting payment at the front desk</b>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 11.5, color: "#8a9c95", lineHeight: 1.45, marginTop: 9 }}>
                  Sending this order files a <b>₱{orderTotal.toFixed(2)}</b> ticket at the front desk. You will not be charged here — front desk staff collect payment in cash at the counter.
                </div>
              )}
            </div>

            {orderError && (
              <div
                role="alert"
                style={{ display: "flex", alignItems: "center", gap: 8, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 10, padding: "10px 12px", fontSize: 12.5, fontWeight: 600, marginTop: 14 }}
              >
                <AlertCircle size={15} />
                <span>{orderError}</span>
              </div>
            )}

            {/* Actions */}
            {placedOrder ? (
              <button className="nodecafe-btn-primary" style={{ marginTop: 14 }} onClick={closeOrderConfirmation}>
                Done
              </button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 16 }}>
                {/* Escape hatch back to the cart list, where a drink can be removed */}
                <button
                  type="button"
                  onClick={editOrderItems}
                  disabled={orderSubmitting}
                  style={{ background: "none", border: 0, padding: 0, color: "#4f6358", fontSize: 12.5, fontWeight: 700, textDecoration: "underline", cursor: orderSubmitting ? "not-allowed" : "pointer", opacity: orderSubmitting ? 0.7 : 1 }}
                >
                  Edit items
                </button>
                <div style={{ display: "flex", gap: 10 }}>
                <button
                  className="nodecafe-btn-decline"
                  style={{ padding: "9px 16px", fontSize: 13, opacity: orderSubmitting ? 0.7 : 1 }}
                  onClick={closeOrderConfirmation}
                  disabled={orderSubmitting}
                >
                  Cancel
                </button>
                <button
                  className="nodecafe-btn-approve"
                  style={{ padding: "9px 18px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 7, opacity: orderSubmitting ? 0.7 : 1, cursor: orderSubmitting ? "wait" : "pointer" }}
                  onClick={() => void confirmCoffeeOrder()}
                  disabled={orderSubmitting}
                >
                  <CheckCircle2 size={15} />
                  {orderSubmitting ? "Sending order…" : "Confirm & Send to Front Desk"}
                </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* User Profile Modal */}
      {showProfileModal && (
        <UserProfileModal
          targetProfile={null}
          onClose={() => setShowProfileModal(false)}
        />
      )}
    </div>
  );
}
