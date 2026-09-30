"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import "@/components/admin-portal/admin-portal.css";
import "@/components/staff-portal/staff-portal.css";
import { StaffRegisterCustomerModal } from "@/components/staff-portal/staff-register-customer-modal";
import { StaffActionModals } from "@/components/staff-portal/staff-action-modals";
import { UserProfileModal } from "@/components/shared/user-profile-modal";
import { useAuth, AccountProfile } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase/client";
import { SNACK_PRODUCTS } from "@/lib/snack-menu";
import {
  Bell,
  Users,
  Monitor,
  Coffee,
  Receipt,
  LayoutGrid,
  Laptop,
  ShoppingBag,
  Plus,
  ArrowRight,
  User,
  LogOut,
  Settings,
  Search,
  CheckCircle,
  Coins,
  CheckCircle2,
  Clock3,
  X,
  AlertCircle,
  Gamepad2,
} from "lucide-react";

interface StaffOverviewData {
  activeSessions: number;
  pcsOnline: { active: number; total: number };
  pendingOrders: number;
  orderCounts: { pending: number; preparing: number; ready: number; completed: number };
}

interface StationItem {
  id: string;
  name: string;
  type: "Standard" | "VIP";
  rate: number;
  specs: string;
  status: "available" | "in-use" | "waiting";
  customerName?: string;
  customerProfileId?: string;
  sessionId?: string;
  startedAt?: string;
  sessionStartedAt?: string;
  checkoutAt?: string;
  checkoutDurationSeconds?: number;
  checkoutTotal?: number;
  awaitingPayment?: boolean;
}

interface OrderItem {
  id: string;
  customerName: string;
  station: string;
  items: string;
  total: number;
  status: "Pending" | "Preparing" | "Ready" | "Completed";
  time: string;
}

interface ReceiptRecord {
  id: string;
  source: "order" | "session";
  customer: string;
  service: string;
  amount: number;
  method: string;
  timestamp: string | null;
  status: string;
}

interface CustomerUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  contact: string;
  user_code?: string;
  status: string;
  balance?: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Safely pull a human-readable message out of an unknown thrown value. */
const errorMessage = (err: unknown, fallback: string): string =>
  err instanceof Error && err.message ? err.message : fallback;

interface OpenSession {
  id: string;
  station_key: string;
  station_name: string;
  customer_name: string;
  customer_profile_id: string;
  hourly_rate: number;
  started_at: string | null;
  checkout_at?: string | null;
  checkout_duration_seconds?: number | null;
  checkout_total?: number | null;
  status: string;
}

const DEFAULT_STATIONS: StationItem[] = Array.from({ length: 8 }, (_, i) => {
  const num = String(i + 1).padStart(2, "0");
  return {
    id: `pc-${num}`,
    name: `PC-${num}`,
    type: "Standard",
    rate: 50,
    specs: "165Hz, RTX 4060, Standard Rig",
    status: "available",
    customerName: undefined,
    startedAt: undefined,
  };
});

const DEFAULT_ORDERS: OrderItem[] = [
  { id: "ord-101", customerName: "Kyla Quirequire", station: "PC-02", items: "1x Spanish Latte (Iced)", total: 120, status: "Preparing", time: "12m ago" },
  { id: "ord-102", customerName: "Bonevie Tutor", station: "PC-05", items: "1x Cold Brew Reserve, 1x Truffle Fries", total: 205, status: "Ready", time: "24m ago" },
  { id: "ord-103", customerName: "Ashlie Yecyec", station: "PC-09", items: "2x Matcha Cloud Cream", total: 260, status: "Completed", time: "1h ago" },
  { id: "ord-104", customerName: "Lyndon Raganas", station: "PC-14", items: "1x Artisan Sandwich, 1x Americano", total: 220, status: "Completed", time: "2h ago" },
];

export default function StaffDashboard() {
  const router = useRouter();
  const { profile, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<"overview" | "stations" | "transactions" | "orders" | "billing" | "customers">("overview");
  const [liveNow, setLiveNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setLiveNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  // ── Snack Orders: Product Selection State ──────────────────────────────────
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

  const COFFEE_PRODUCTS: CoffeeProduct[] = SNACK_PRODUCTS;

  const [snackSearch, setSnackSearch] = useState("");
  const [snackFilter, setSnackFilter] = useState<"All" | "Savory" | "Sweet">("All");
  const [cart, setCart] = useState<CartItem[]>([]);

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

  const clearCart = () => setCart([]);

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const filteredSnackProducts = COFFEE_PRODUCTS.filter((p) => {
    const matchesSearch = snackSearch === "" || p.name.toLowerCase().includes(snackSearch.toLowerCase());
    const matchesFilter = snackFilter === "All" || p.type === snackFilter;
    return matchesSearch && matchesFilter;
  });

  // ── Customer State (declared before billing so billing can read it) ───────
  const [customers, setCustomers] = useState<CustomerUser[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customersLoading, setCustomersLoading] = useState(true);
  const [customersError, setCustomersError] = useState<string | null>(null);
  const customerRequestPending = useRef(false);

  // ── Billing State ─────────────────────────────────────────────────────────
  interface BillingRecord {
    id: string;
    customerName: string;
    customerCode: string;
    items: CartItem[];
    total: number;
    paymentMethod: "cash";
    timestamp: string;
    staffName: string;
  }

  const [billingOrder, setBillingOrder] = useState<CartItem[]>([]);
  const [billingCustomerId, setBillingCustomerId] = useState("");
  const [stationBilling, setStationBilling] = useState<StationItem | null>(null);
  const [stationPaymentMethod, setStationPaymentMethod] = useState<"cash" | "wallet">("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState<{ station: StationItem; amount: number; method: "cash" | "wallet"; cashReceived?: number; change?: number; reference?: string; paidAt: string } | null>(null);
  // Walk-in café payment is cash-only at the counter — no wallet/e-wallet.
  const [billingProcessing, setBillingProcessing] = useState(false);
  const [billingHistory, setBillingHistory] = useState<BillingRecord[]>([]);
  const [billingCustomerSearch, setBillingCustomerSearch] = useState("");
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [receiptSearch, setReceiptSearch] = useState("");

  // A café ticket the client filed from their own portal. It carries no payment
  // yet — the cashier is the one who collects it, right here in Billing.
  interface PendingClientOrder {
    id: string;
    reference: string;
    customer_profile_id: string | null;
    customer_name: string;
    station_key: string | null;
    items: { id: string; name: string; price: number | string; quantity: number }[];
    item_count: number;
    total: number | string;
    placed_at: string;
  }

  // Client-filed tickets waiting at the counter, newest first.
  const [pendingClientOrders, setPendingClientOrders] = useState<PendingClientOrder[]>([]);
  const [settlingOrderId, setSettlingOrderId] = useState<string | null>(null);

  const billingTotal = billingOrder.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const billingCustomer = customers.find((c) => c.id === billingCustomerId) ?? null;

  // Staff Billing reads the open client tickets (status=pending) so the cashier
  // sees what clients have confirmed and are waiting to pay for.
  const fetchPendingClientOrders = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`${API_URL}/api/staff/orders?status=pending`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) return;
      const body = await res.json() as { orders?: PendingClientOrder[]; available?: boolean };
      if (!body.available) return;
      setPendingClientOrders(body.orders || []);
    } catch {
      // silent
    }
  }, []);

  const fetchReceipts = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`${API_URL}/api/transactions`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) return;
      const body = await res.json() as { transactions?: ReceiptRecord[] };
      setReceipts(body.transactions || []);
    } catch {
      // silent
    }
  }, []);

  // Settle a client ticket: walk-in cash only. The server closes the ticket and
  // the client's history flips to paid.
  const settleClientOrder = async (order: PendingClientOrder) => {
    setSettlingOrderId(order.id);
    setFeedback(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`${API_URL}/api/staff/orders/${order.id}/settle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ paymentMethod: "cash" }),
      });
      const body = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to process payment");

      const total = Number(order.total) || 0;
      const customer = customers.find((c) => c.id === order.customer_profile_id);
      setBillingHistory((prev) => [
        {
          id: order.reference,
          customerName: order.customer_name,
          customerCode: customer?.user_code ?? "—",
          items: order.items.map((i) => ({
            id: i.id,
            name: i.name,
            price: Number(i.price) || 0,
            quantity: i.quantity,
            type: "Savory" as const,
            description: "",
            image: "",
          })),
          total,
          paymentMethod: "cash",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          staffName: displayName,
        },
        ...prev,
      ]);
      setPendingClientOrders((prev) => prev.filter((o) => o.id !== order.id));
      setFeedback({
        text: `✓ ${order.reference} paid by ${order.customer_name} — ₱${total.toFixed(2)} in cash.`,
        type: "success",
      });
      void fetchOverview();
    } catch (err: unknown) {
      setFeedback({ text: errorMessage(err, "Payment failed. Please try again."), type: "error" });
    } finally {
      setSettlingOrderId(null);
    }
  };

  const handleBillingSubmit = async () => {
    if (!billingCustomerId || billingOrder.length === 0) return;
    setBillingProcessing(true);
    setFeedback(null);
    try {
      // Walk-in café payment is collected in cash at the counter — no wallet.
      // Record in local billing history
      const customer = customers.find((c) => c.id === billingCustomerId);
      const newRecord: BillingRecord = {
        id: crypto.randomUUID(),
        customerName: customer ? `${customer.first_name} ${customer.last_name}` : "Unknown",
        customerCode: customer?.user_code ?? "—",
        items: [...billingOrder],
        total: billingTotal,
        paymentMethod: "cash",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        staffName: displayName,
      };
      setBillingHistory((prev) => [newRecord, ...prev]);

      setFeedback({
        text: `✓ Order billed to ${newRecord.customerName} — ₱${billingTotal.toFixed(2)} in cash.`,
        type: "success",
      });

      // Reset
      setBillingOrder([]);
      setBillingCustomerId("");
      clearCart();
      void fetchOverview();
    } catch (err: unknown) {
      setFeedback({ text: errorMessage(err, "Billing failed. Please try again."), type: "error" });
    } finally {
      setBillingProcessing(false);
    }
  };
  // ─────────────────────────────────────────────────────────────────────────

  const [overview, setOverview] = useState<StaffOverviewData>({
    activeSessions: 0,
    pcsOnline: { active: 0, total: 8 },
    pendingOrders: 0,
    orderCounts: { pending: 0, preparing: 0, ready: 0, completed: 0 },
  });

  const [dateStr, setDateStr] = useState("TUESDAY · SEPTEMBER 22, 2026");
  const [greeting, setGreeting] = useState("Good evening, Staff.");
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // In-page States
  const [stations, setStations] = useState<StationItem[]>(DEFAULT_STATIONS);
  const [orders, setOrders] = useState<OrderItem[]>(DEFAULT_ORDERS);
  // NOTE: `customers` / `customerSearch` are declared above the Billing State
  // block because the billing calculations depend on them.

  // Action & Feedback States
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Modals
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedUserProfile, setSelectedUserProfile] = useState<AccountProfile | null>(null);
  const [activeActionModal, setActiveActionModal] = useState<string | null>(null);

  // Station Assignment Modal State
  const [assignStation, setAssignStation] = useState<StationItem | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [assigningSession, setAssigningSession] = useState(false);

  // Top Up Modal State
  const [topUpModalCustomer, setTopUpModalCustomer] = useState<CustomerUser | null>(null);
  const [topUpAmount, setTopUpAmount] = useState<number>(100);
  const [toppingUp, setToppingUp] = useState(false);

  // Header dynamic time
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

      const name = profile?.first_name ? profile.first_name : "Staff";
      setGreeting(`${timeGreet}, ${name}.`);
    };

    updateHeader();
    const interval = setInterval(updateHeader, 60000);
    return () => clearInterval(interval);
  }, [profile]);

  // Customer loading must not wait for overview or station requests.
  const fetchCustomers = useCallback(async () => {
    if (customerRequestPending.current) return;
    customerRequestPending.current = true;
    setCustomersLoading(true);
    setCustomersError(null);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const { data: { session } } = await Promise.race([
        supabase.auth.getSession(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error("Session lookup timed out. Please retry or sign in again.")), 10_000);
        }),
      ]);
      clearTimeout(timeout);
      if (!session) throw new Error("Your session has expired. Please sign in again.");
      const response = await fetch(API_URL + "/api/customers", {
        headers: { Authorization: "Bearer " + session.access_token },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        if (response.status === 401) throw new Error("Your session has expired. Please sign in again.");
        if (response.status === 403) throw new Error("An active staff or admin account is required to view customers.");
        throw new Error("Could not load customers from the server. Please try again.");
      }
      const cData = await response.json() as { customers?: (Partial<AccountProfile> & { name?: string; approved?: boolean })[] };
      if (!Array.isArray(cData.customers)) throw new Error("The server returned an invalid customer list. Please try again.");
        const mapped = (cData.customers || []).filter((c): c is typeof c & { id: string } => Boolean(c.id)).map((c) => ({
          id: c.id,
          first_name: c.first_name || c.name || "Customer",
          last_name: c.last_name || "",
          email: c.email || "",
          contact: c.contact || "",
          user_code: c.user_code ?? undefined,
          status: c.status || (c.approved ? "active" : "pending"),
          balance: Number(c.balance || 0),
        }));
      setCustomers(mapped);
    } catch (error) {
      setCustomersError(error instanceof Error && error.name !== "TimeoutError" && error.name !== "TypeError"
        ? error.message : "Could not connect to the customer directory. Check the backend connection and retry.");
    } finally {
      clearTimeout(timeout);
      customerRequestPending.current = false;
      setCustomersLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void fetchCustomers(); }, 0);
    return () => clearTimeout(timer);
  }, [fetchCustomers, profile?.id]);

  // Fetch staff data from backend
  const fetchOverview = useCallback(async () => {
    void fetchCustomers();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const res = await fetch(`${API_URL}/api/staff/overview`, { headers });
      if (res.ok) {
        const data = await res.json() as StaffOverviewData;
        setOverview(data);
      }

      // Sync active station sessions
      const sessRes = await fetch(`${API_URL}/api/station-sessions/open`, { headers });
      if (sessRes.ok) {
        const body = await sessRes.json() as { sessions?: OpenSession[] };
        const openSessions = body.sessions || [];
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
          prev.map((st) => {
            const open =
              openMap.get(st.name.toUpperCase()) ||
              openMap.get(st.id.toUpperCase()) ||
              openMap.get(st.name.replace(/\D/g, ""));
            if (open) {
              return {
                ...st,
                status: open.status === "awaiting_payment" ? "waiting" : "in-use",
                customerName: open.customer_name || "Client",
                customerProfileId: open.customer_profile_id,
                sessionId: open.id,
                rate: Number(open.hourly_rate) || st.rate,
                checkoutAt: open.checkout_at || undefined,
                checkoutDurationSeconds: open.checkout_duration_seconds ?? undefined,
                checkoutTotal: open.checkout_total ?? undefined,
                awaitingPayment: open.status === "awaiting_payment",
                startedAt: open.started_at
                  ? new Date(open.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                     : (open.status === "pending_client" ? "Waiting for client" : open.status === "awaiting_payment" ? "Awaiting payment" : "Active"),
                  sessionStartedAt: open.started_at || undefined,
              };
            }
            return {
              ...st,
              status: "available",
              customerName: undefined,
              customerProfileId: undefined,
              sessionId: undefined,
              startedAt: undefined,
              sessionStartedAt: undefined,
            };
          })
        );
      }

    } catch {
      // silent
    }
  }, [fetchCustomers]);

  useEffect(() => {
    // The reads sit inside an async continuation so the resulting state updates
    // land outside the effect body (react-hooks/set-state-in-effect).
    void (async () => {
      await fetchOverview();
      await fetchPendingClientOrders();
      await fetchReceipts();
    })();

    // Realtime PostgreSQL subscription on station_sessions, account_profiles, stations
    const channel = supabase
      .channel("staff_dashboard_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "station_sessions" },
        (payload) => {
          console.log("[Realtime Staff] station_sessions change:", payload);
          void fetchOverview();
          void fetchReceipts();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "account_profiles" },
        (payload) => {
          console.log("[Realtime Staff] account_profiles change:", payload);
          void fetchOverview();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stations" },
        (payload) => {
          console.log("[Realtime Staff] stations change:", payload);
          void fetchOverview();
        }
      )
      // A client confirming an order files a pending ticket — surface it here right away.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          void fetchPendingClientOrders();
          void fetchReceipts();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchOverview, fetchPendingClientOrders, fetchReceipts]);

  const openStationBilling = (station: StationItem) => {
    setStationBilling(station);
    setStationPaymentMethod("cash");
    setCashReceived("");
    setFeedback(null);
    setActiveTab("billing");
  };

  useEffect(() => {
    if (activeTab === "billing" && !stationBilling) {
      const awaiting = stations.find((station) => station.awaitingPayment);
      if (awaiting) setStationBilling(awaiting);
    }
  }, [activeTab, stationBilling, stations]);

  const beginStationCheckout = async (station: StationItem) => {
    if (station.awaitingPayment) {
      openStationBilling(station);
      return;
    }
    setActionLoading(station.id);
    setFeedback(null);
    try {
      const authResult = await supabase.auth.getSession();
      const session = authResult.data.session;
      const token = session?.access_token;
      const res = await fetch(`${API_URL}/api/station-sessions/${encodeURIComponent(station.sessionId ?? station.name)}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({}),
      });
      const body = await res.json().catch(() => ({})) as { session?: OpenSession; error?: string };
      if (!res.ok || !body.session) throw new Error(body.error || "Could not freeze this station session for Billing.");
      const frozen: StationItem = {
        ...station,
        status: "waiting",
        checkoutAt: body.session.checkout_at || undefined,
        checkoutDurationSeconds: body.session.checkout_duration_seconds ?? undefined,
        checkoutTotal: Number(body.session.checkout_total) || 0,
        awaitingPayment: true,
      };
      setStations((prev) => prev.map((item) => item.id === station.id ? frozen : item));
      openStationBilling(frozen);
    } catch (err: unknown) {
      setFeedback({ text: errorMessage(err, "Could not start checkout"), type: "error" });
    } finally {
      setActionLoading(null);
    }
  };

  // Final station-session payment is submitted only from Billing.
  const handleEndSession = async (st: StationItem, paymentMethod: "cash" | "wallet") => {
    const total = stationPaymentTotal(st);
    const received = Number(cashReceived);
    if (paymentMethod === "cash" && (!Number.isFinite(received) || received < total)) {
      setFeedback({ text: `Cash received must be at least ₱${total.toFixed(2)}.`, type: "error" });
      return;
    }
    if (paymentMethod === "wallet" && !walletAllowedForStation(st)) {
      setFeedback({ text: "Insufficient customer wallet balance. Collect cash instead.", type: "error" });
      return;
    }
    setActionLoading(st.id);
    setFeedback(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const sessionKey = st.sessionId ?? st.name;
      const res = await fetch(`${API_URL}/api/station-sessions/${encodeURIComponent(sessionKey)}/end`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ paymentMethod, ...(paymentMethod === "cash" ? { cashReceived: received } : {}) }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Failed to complete payment");
      }

      setPaymentSuccess({
        station: st,
        amount: Number(body.session?.total) || total,
        method: paymentMethod,
        cashReceived: paymentMethod === "cash" ? received : undefined,
        change: paymentMethod === "cash" ? Number((received - total).toFixed(2)) : undefined,
        reference: body.session?.id ? `SES-${String(body.session.id).slice(0, 8).toUpperCase()}` : undefined,
        paidAt: new Date().toISOString(),
      });
      setStationBilling(null);
      setFeedback(null);
      setStations((prev) =>
        prev.map((s) => (s.id === st.id ? { ...s, status: "available", awaitingPayment: false, checkoutAt: undefined, checkoutDurationSeconds: undefined, checkoutTotal: undefined, customerName: undefined, customerProfileId: undefined, sessionId: undefined, startedAt: undefined, sessionStartedAt: undefined } : s))
      );
      void fetchOverview();
      void fetchReceipts();
    } catch (err: unknown) {
      setFeedback({ text: errorMessage(err, "Failed to complete payment. The frozen checkout remains available for retry."), type: "error" });
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Assign Station Submit
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignStation || !selectedCustomerId) return;
    setAssigningSession(true);
    setFeedback(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`${API_URL}/api/station-sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          stationKey: assignStation.name,
          stationName: `${assignStation.name} - ${assignStation.type} Gaming`,
          hourlyRate: Number(assignStation.rate),
          customerProfileId: selectedCustomerId,
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to assign station");

      setFeedback({
        text: `Station ${assignStation.name} started. The usage timer is now running.`,
        type: "success",
      });
      setAssignStation(null);
      setSelectedCustomerId("");
      void fetchOverview();
    } catch (err: unknown) {
      setFeedback({ text: errorMessage(err, "Failed to assign station"), type: "error" });
    } finally {
      setAssigningSession(false);
    }
  };

  // Handle Customer Top-up
  const handleTopUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topUpModalCustomer || !topUpAmount || topUpAmount <= 0) return;
    setToppingUp(true);
    setFeedback(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`${API_URL}/api/customers/${topUpModalCustomer.id}/top-up`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ amount: Number(topUpAmount) }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to top up balance");

      setFeedback({
        text: `Successfully credited ₱${Number(topUpAmount).toFixed(2)} to ${topUpModalCustomer.first_name}'s wallet.`,
        type: "success",
      });
      setTopUpModalCustomer(null);
      void fetchOverview();
    } catch (err: unknown) {
      setFeedback({ text: errorMessage(err, "Failed to top up balance"), type: "error" });
    } finally {
      setToppingUp(false);
    }
  };
  // Open registration in separate window
  const openRegisterWindow = () => {
    const url = `${window.location.origin}/staff/register-customer`;
    window.open(url, "_blank", "width=600,height=800");
  };
  const displayName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : "Staff";

  // Filtered customer list
  const filteredCustomers = customers.filter((c) => {
    const q = customerSearch.toLowerCase();
    const name = `${c.first_name} ${c.last_name}`.toLowerCase();
    const contact = (c.contact || "").toLowerCase();
    const code = (c.user_code || "").toLowerCase();
    return !q || name.includes(q) || contact.includes(q) || code.includes(q);
  });

  const stationPaymentTotal = (station: StationItem) => {
    if (station.checkoutTotal !== undefined) return station.checkoutTotal;
    if (!station.sessionStartedAt) return 0;
    const startedAt = new Date(station.sessionStartedAt).getTime();
    if (Number.isNaN(startedAt)) return 0;
    return Number(Math.max(0, ((liveNow - startedAt) / 3_600_000) * station.rate).toFixed(2));
  };

  const walletAllowedForStation = (station: StationItem) => {
    const customer = customers.find((item) => item.id === station.customerProfileId);
    return (customer?.balance ?? 0) >= stationPaymentTotal(station);
  };

  const stationElapsedTime = (station: StationItem) => {
    if (station.checkoutDurationSeconds !== undefined) {
      const elapsedSeconds = station.checkoutDurationSeconds;
      const hours = String(Math.floor(elapsedSeconds / 3600)).padStart(2, "0");
      const minutes = String(Math.floor((elapsedSeconds % 3600) / 60)).padStart(2, "0");
      const seconds = String(elapsedSeconds % 60).padStart(2, "0");
      return `${hours}:${minutes}:${seconds}`;
    }
    if (!station.sessionStartedAt) return "00:00:00";
    const startedAt = new Date(station.sessionStartedAt).getTime();
    if (Number.isNaN(startedAt)) return "00:00:00";
    const elapsedSeconds = Math.max(0, Math.floor((liveNow - startedAt) / 1000));
    const hours = String(Math.floor(elapsedSeconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((elapsedSeconds % 3600) / 60)).padStart(2, "0");
    const seconds = String(elapsedSeconds % 60).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  };

  const activeStationPayments = stations.filter((station) => station.status === "in-use" || station.awaitingPayment);
  const receiptQuery = receiptSearch.trim().toLowerCase();
  const paidReceipts = receipts
    .filter((receipt) => receipt.status === "paid" || receipt.status === "completed")
    .filter((receipt) => {
      if (!receiptQuery) return true;
      return [receipt.id, receipt.customer, receipt.service, receipt.method].some((value) => value.toLowerCase().includes(receiptQuery));
    })
    .sort((a, b) => (b.timestamp ? new Date(b.timestamp).getTime() : 0) - (a.timestamp ? new Date(a.timestamp).getTime() : 0));
  const visiblePaidReceipts = receiptQuery ? paidReceipts : paidReceipts.slice(0, 10);

  return (
    <div className="nodecafe-root staff-dashboard-root">
      {/* -------------------------------------------------------------
          LEFT SIDEBAR (Unified Internet Cafe Aesthetic)
          ------------------------------------------------------------- */}
      <aside className="nodecafe-sidebar" aria-label="Staff Navigation">
        <div style={{ width: "100%" }}>
          {/* Brand Logo */}
          <div className="nodecafe-brand">
            <div className="nodecafe-brand-icon" aria-hidden="true">
              N
            </div>
            <div>
              <div className="nodecafe-brand-title">Internet Cafe</div>
              <div className="nodecafe-brand-sub">Staff Operations</div>
            </div>
          </div>

          {/* Navigation Links - STRICTLY IN-PAGE */}
          <nav className="nodecafe-nav" aria-label="Staff Links">
            <button
              className={`nodecafe-nav-item ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              <LayoutGrid size={17} />
              <span>Overview</span>
            </button>

            <button
              className={`nodecafe-nav-item ${activeTab === "stations" ? "active" : ""}`}
              onClick={() => setActiveTab("stations")}
            >
              <Monitor size={17} />
              <span>Station Control</span>
            </button>

            <button
              className={`nodecafe-nav-item ${activeTab === "transactions" ? "active" : ""}`}
              onClick={() => setActiveTab("transactions")}
              style={{ position: "relative" }}
            >
              <Receipt size={17} />
              <span>Transactions</span>
              {activeStationPayments.length > 0 && (
                <span style={{ marginLeft: "auto", background: "#fbbf24", color: "#3b2400", fontSize: 10, fontWeight: 800, borderRadius: 9999, padding: "1px 7px", lineHeight: 1.6 }}>
                  {activeStationPayments.length}
                </span>
              )}
            </button>

            <button
              className={`nodecafe-nav-item ${activeTab === "orders" ? "active" : ""}`}
              onClick={() => setActiveTab("orders")}
            >
              <Coffee size={17} />
              <span>Snack Orders</span>
            </button>

            <button
              className={`nodecafe-nav-item ${activeTab === "billing" ? "active" : ""}`}
              onClick={() => setActiveTab("billing")}
              style={{ position: "relative" }}
            >
              <Receipt size={17} />
              <span>Billing</span>
              {billingOrder.length > 0 && (
                <span style={{
                  marginLeft: "auto",
                  background: "#4ade80",
                  color: "#061614",
                  fontSize: 10,
                  fontWeight: 800,
                  borderRadius: 9999,
                  padding: "1px 7px",
                  lineHeight: 1.6,
                }}>PENDING</span>
              )}
              {billingOrder.length === 0 && pendingClientOrders.length > 0 && (
                <span style={{
                  marginLeft: "auto",
                  background: "#fbbf24",
                  color: "#3b2400",
                  fontSize: 10,
                  fontWeight: 800,
                  borderRadius: 9999,
                  padding: "1px 7px",
                  lineHeight: 1.6,
                }}>{pendingClientOrders.length}</span>
              )}
            </button>

            <button
              className={`nodecafe-nav-item ${activeTab === "customers" ? "active" : ""}`}
              onClick={() => setActiveTab("customers")}
            >
              <Users size={17} />
              <span>Customers &amp; Top-up</span>
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
              onClick={() => setActiveTab("orders")}
              title="View pending order notifications"
              aria-label="Notifications"
            >
              <Bell size={17} />
              <span className="nodecafe-notif-badge">3</span>
            </button>

            {/* Profile Avatar Pill with Dropdown */}
            <div style={{ position: "relative" }}>
              <button
                className="nodecafe-user-pill"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                aria-expanded={showProfileMenu}
                aria-label="Staff account menu"
              >
                <div className="nodecafe-user-avatar" aria-hidden="true">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Avatar"
                      style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
                    />
                  ) : (
                    (displayName[0] || "S").toUpperCase()
                  )}
                </div>
                <span className="nodecafe-user-label">Staff account</span>
              </button>

              {showProfileMenu && (
                <div className="nodecafe-user-dropdown" role="menu">
                  <button
                    className="nodecafe-dropdown-item"
                    onClick={() => {
                      setShowProfileMenu(false);
                      setSelectedUserProfile(null);
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

        {/* Feedback / Toast Banner */}
        {feedback && (
          <div
            style={{
              padding: "12px 18px",
              background: feedback.type === "success" ? "#dcfce7" : "#fee2e2",
              color: feedback.type === "success" ? "#166534" : "#991b1b",
              borderRadius: 8,
              marginBottom: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <span>{feedback.text}</span>
            <button
              onClick={() => setFeedback(null)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "inherit" }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 1: STAFF OVERVIEW
            ------------------------------------------------------------- */}
        {activeTab === "overview" && (
          <div className="nodecafe-page-view">
            {/* Top 4 KPI Cards */}
            <section className="nodecafe-kpi-grid" aria-label="Operational Indicators">
              <div className="nodecafe-kpi-card">
                <div className="nodecafe-kpi-label">Active PC Sessions</div>
                <div className="nodecafe-kpi-val">{stations.filter((s) => s.status === "in-use").length} / {stations.length}</div>
                <div className="nodecafe-kpi-sub" style={{ color: "#166534" }}>
                  {stations.filter((s) => s.status === "available").length} stations available
                </div>
              </div>

              <div className="nodecafe-kpi-card">
                <div className="nodecafe-kpi-label">Pending Snack Orders</div>
                <div className="nodecafe-kpi-val">{overview.pendingOrders}</div>
                <div className="nodecafe-kpi-sub" style={{ color: "#92400e" }}>
                  Deliver to workstations
                </div>
              </div>

              <div className="nodecafe-kpi-card">
                <div className="nodecafe-kpi-label">Registered Customers</div>
                <div className="nodecafe-kpi-val">{customers.length}</div>
                <div className="nodecafe-kpi-sub">Checked in accounts</div>
              </div>
            </section>

            {/* Middle Section: Urgent Station Actions & Orders */}
            <section className="nodecafe-middle-grid" aria-label="Urgent Tasks">
              {/* Left: Quick Station Monitor */}
              <div className="nodecafe-card">
                <div className="nodecafe-card-kicker">Live Stations</div>
                <div className="nodecafe-card-header">
                  <h2 className="nodecafe-card-title">Active PC sessions</h2>
                  <button className="nodecafe-link" onClick={() => setActiveTab("stations")}>
                    <span>View all stations</span>
                    <ArrowRight size={14} />
                  </button>
                </div>

                <div className="nodecafe-queue-list">
                  {stations.filter((s) => s.status === "in-use").length === 0 ? (
                    <div style={{ textAlign: "center", padding: "28px 16px", color: "#6a887e", fontSize: 13 }}>
                      No active sessions in database. All {stations.length} workstations are available.
                    </div>
                  ) : (
                    stations.filter((s) => s.status === "in-use").map((st) => (
                      <div key={st.id} className="nodecafe-queue-row">
                        <div className="nodecafe-queue-left">
                          <div className="nodecafe-queue-avatar" style={{ background: "#fee2e2", color: "#991b1b" }}>
                            PC
                          </div>
                          <div className="nodecafe-queue-info">
                            <div className="nodecafe-queue-name">{st.name} — {st.customerName}</div>
                            <div className="nodecafe-queue-meta">Time used: {stationElapsedTime(st)} · ₱{stationPaymentTotal(st).toFixed(2)}</div>
                          </div>
                        </div>
                        <div className="nodecafe-queue-actions">
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#091c17" }}>₱{st.rate}/hr</span>
                          <button
                            className="nodecafe-btn-primary"
                            style={{ width: "auto", padding: "8px 12px" }}
                            onClick={() => void beginStationCheckout(st)}
                          >
                            {st.awaitingPayment ? "Open Billing" : "Process Payment"}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Right: Quick Action Front Desk */}
              <div className="nodecafe-card">
                <div className="nodecafe-card-kicker">Front Desk</div>
                <div className="nodecafe-card-header" style={{ marginBottom: 12 }}>
                  <h2 className="nodecafe-card-title">Customer Check-in</h2>
                </div>
                <p className="nodecafe-quick-desc">
                  Register walk-in customers or top-up account balances to unlock PC workstations.
                </p>

                <button
                  className="nodecafe-btn-primary"
                  onClick={() => setShowRegisterModal(true)}
                  style={{ marginBottom: 12 }}
                >
                  <Plus size={16} />
                  <span>Register Walk-in Customer</span>
                </button>

                <button
                  className="nodecafe-btn-decline"
                  style={{ width: "100%", justifyContent: "center", padding: "10px", display: "flex", gap: 6 }}
                  onClick={() => setActiveTab("customers")}
                >
                  <Coins size={15} />
                  <span>Top-up Customer Wallet</span>
                </button>
              </div>
            </section>
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 2: STATION CONTROL (FULL IN-PAGE VIEW)
            ------------------------------------------------------------- */}
        {activeTab === "stations" && (
          <div className="nodecafe-page-view staff-station-control">
            <div className="nodecafe-page-header">
              <div>
                <h2 className="nodecafe-page-title">Workstation Live Control Board</h2>
                <p className="nodecafe-page-subtitle">Assign customers, monitor session timers, and manage workstation access.</p>
              </div>
            </div>

            <div className="nodecafe-card" style={{ padding: "20px 24px" }}>
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
                            background: "#e8efe8",
                            color: "#5c6b58",
                          }}
                        >
                          {st.status === "available" ? "Available" : "Unavailable"}
                        </span>
                      </div>

                      <div style={{ fontSize: 11.5, color: "#6a887e", marginBottom: 8, lineHeight: 1.3 }}>
                        {st.status === "in-use" || st.awaitingPayment ? (
                             <span style={{ color: st.awaitingPayment ? "#92400e" : "#b91c1c", fontWeight: 600 }}>
                               {st.customerName} · Time used: {stationElapsedTime(st)} · ₱{stationPaymentTotal(st).toFixed(2)}{st.awaitingPayment ? " · Awaiting payment" : ""}
                             </span>
                           ) : (
                          st.specs
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px solid #f0f5f2" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#091c17" }}>₱{st.rate}/hr</span>
                      {st.status === "in-use" || st.awaitingPayment ? (
                        <button
                          style={{ fontSize: 11, padding: "4px 8px", background: "#0b2b23", color: "#fff", border: 0, borderRadius: 5, fontWeight: 700, cursor: "pointer" }}
                          onClick={() => void beginStationCheckout(st)}
                        >
                          {st.awaitingPayment ? "Open Billing" : "Process Payment"}
                        </button>
                      ) : (
                        <button
                          style={{ fontSize: 11, padding: "4px 8px", background: "#0b2b23", color: "#fff", border: 0, borderRadius: 5, fontWeight: 700, cursor: "pointer" }}
                          onClick={() => {
                            setAssignStation(st);
                            setSelectedCustomerId(customers[0]?.id || "");
                          }}
                        >
                          Assign Client
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            TRANSACTIONS: STATION PAYMENT CHECKOUT
            ------------------------------------------------------------- */}
        {activeTab === "transactions" && (
          <div className="nodecafe-page-view">
            <div className="nodecafe-page-header">
              <div>
                <h2 className="nodecafe-page-title">Station Transactions</h2>
                <p className="nodecafe-page-subtitle">Collect station payments, end customer sessions, and review payment history.</p>
              </div>
              <button className="nodecafe-btn-decline" onClick={() => void fetchOverview()}>
                Refresh sessions
              </button>
            </div>

            <div className="nodecafe-card" style={{ padding: "20px 24px" }}>
              <div className="nodecafe-card-kicker">Payment Queue</div>
              <div className="nodecafe-card-header" style={{ marginBottom: 18 }}>
                <h3 className="nodecafe-card-title">Active station checkouts</h3>
                <span style={{ fontSize: 12, color: "#6a887e" }}>{activeStationPayments.length} active session{activeStationPayments.length === 1 ? "" : "s"}</span>
              </div>

              {activeStationPayments.length === 0 ? (
                <div style={{ textAlign: "center", padding: "36px 16px", color: "#6a887e", fontSize: 13 }}>
                  No active station sessions are waiting for payment.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {activeStationPayments.map((station) => {
                    const total = stationPaymentTotal(station);
                    const customer = customers.find((item) => `${item.first_name} ${item.last_name}`.trim() === station.customerName);
                    const walletBalance = customer?.balance ?? 0;
                    return (
                      <div key={station.id} style={{ border: "1px solid #dce9e2", borderRadius: 10, padding: "16px", display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                            <Laptop size={16} color="#166534" />
                            <b style={{ color: "#091c17" }}>{station.name}</b>
                            <span className={`nodecafe-status-chip ${station.awaitingPayment ? "pending" : "active"}`}>{station.awaitingPayment ? "Awaiting Payment" : "Active"}</span>
                          </div>
                          <div style={{ color: "#547568", fontSize: 13 }}>{station.customerName || "Customer"} · Started {station.startedAt}</div>
                          <div style={{ color: "#547568", fontSize: 12, marginTop: 4 }}>Time used: {stationElapsedTime(station)} · Rate: ₱{station.rate.toFixed(2)}/hr · Wallet balance: ₱{walletBalance.toFixed(2)}</div>
                          {station.awaitingPayment && <span className="nodecafe-status-chip pending" style={{ marginTop: 6, display: "inline-flex" }}>Awaiting payment · frozen</span>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <b style={{ color: "#091c17", fontSize: 18 }}>₱{total.toFixed(2)}</b>
                          <button
                            className="nodecafe-btn-primary"
                            style={{ width: "auto", padding: "9px 14px" }}
                            onClick={() => void beginStationCheckout(station)}
                          >
                            {station.awaitingPayment ? "Open Billing" : "Process Payment"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="nodecafe-card" style={{ padding: "20px 24px" }}>
              <div className="nodecafe-card-kicker">Recent Payment History</div>
              <div className="nodecafe-card-header" style={{ marginBottom: 14 }}>
                <h3 className="nodecafe-card-title">Completed client payments</h3>
                <span style={{ fontSize: 12, color: "#6a887e" }}>{receiptQuery ? `${paidReceipts.length} matching payment${paidReceipts.length === 1 ? "" : "s"}` : `Showing ${visiblePaidReceipts.length} recent payment${visiblePaidReceipts.length === 1 ? "" : "s"}`}</span>
              </div>
              <div className="nodecafe-search-box" style={{ width: "100%", marginBottom: 14 }}>
                <Search size={16} />
                <input
                  type="search"
                  placeholder="Search payment, client, service, or payment method..."
                  value={receiptSearch}
                  onChange={(event) => setReceiptSearch(event.target.value)}
                  aria-label="Search completed client payments"
                />
              </div>
              <div className="nodecafe-table-card">
                <table className="nodecafe-table">
                  <thead>
                    <tr>
                      <th>Receipt</th>
                      <th>Client</th>
                      <th>Service</th>
                      <th>Amount</th>
                      <th>Paid via</th>
                      <th>Paid at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePaidReceipts.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", padding: "26px 16px", color: "#6a887e" }}>
                          {receiptQuery ? "No completed payments match your search." : "No recent completed payments yet."}
                        </td>
                      </tr>
                    ) : visiblePaidReceipts.map((receipt) => (
                      <tr key={`${receipt.source}-${receipt.id}`}>
                        <td><code>{receipt.id}</code></td>
                        <td><b>{receipt.customer}</b></td>
                        <td>{receipt.service}</td>
                        <td><b>₱{receipt.amount.toFixed(2)}</b></td>
                        <td>{receipt.method}</td>
                        <td>{receipt.timestamp ? new Date(receipt.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 3: CAFÉ ORDERS (FULL IN-PAGE VIEW)
            ------------------------------------------------------------- */}
        {activeTab === "orders" && (
          <div className="nodecafe-page-view">
            {/* ── Page Title + Subtitle ─────────────────────────────────── */}
            <div className="cafe-orders-header">
              <div className="cafe-orders-title-col">
                <h2 className="cafe-orders-title">Snack Menu</h2>
                <p className="cafe-orders-subtitle">Made fresh. Ready for your next game.</p>
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
                {/* Cart Button — jumps straight to Billing to pick the client */}
                {cart.length > 0 && (
                  <button
                    className="cafe-cart-btn"
                    onClick={() => {
                      setBillingOrder([...cart]);
                      setActiveTab("billing");
                    }}
                  >
                    <Receipt size={16} />
                    <span>Checkout ({cartCount})</span>
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
                        <div className="cafe-product-price">&#8369;{product.price} / pack</div>
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

          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 4: BILLING
            ------------------------------------------------------------- */}
        {activeTab === "billing" && (
          <div className="nodecafe-page-view">
            {/* Minimal cash-only billing: settle client orders and bill walk-ins. */}
            <div className="billing-page-header">
              <div>
                <h2 className="billing-page-title">Billing</h2>
                <p className="billing-page-subtitle">Confirm café orders or station session payments at the counter.</p>
              </div>
              {billingOrder.length === 0 && (
                <button
                  className="nodecafe-btn-primary"
                  style={{ width: "auto", padding: "9px 16px" }}
                  onClick={() => setActiveTab("orders")}
                >
                  <Coffee size={15} />
                  <span>Snack Orders</span>
                </button>
              )}
            </div>

            {/* Incoming client orders — flat list, one cash action each. */}
            {pendingClientOrders.length > 0 && (
              <div className="billing-mini-section">
                <div className="billing-mini-title">
                  <Bell size={14} />
                  <span>Client orders to settle</span>
                  <span className="billing-mini-count">{pendingClientOrders.length}</span>
                </div>
                <div className="billing-mini-list">
                  {pendingClientOrders.map((order) => {
                    const total = Number(order.total) || 0;
                    const busy = settlingOrderId === order.id;
                    return (
                      <div key={order.id} className="billing-mini-row">
                        <div className="billing-mini-info">
                          <div className="billing-mini-name">{order.customer_name}</div>
                          <div className="billing-mini-meta">
                            {order.reference} · {order.station_key || "Front Desk"} ·{" "}
                            {order.items.map((i) => i.quantity + "× " + i.name).join(", ")}
                          </div>
                        </div>
                        <div className="billing-mini-amount">₱{total.toFixed(2)}</div>
                        <button
                          className="billing-mini-btn"
                          disabled={busy}
                          onClick={() => void settleClientOrder(order)}
                        >
                          {busy ? "…" : "Cash"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {stationBilling ? (
              <div className="billing-layout">
                <div className="billing-summary-panel">
                  <div className="billing-panel-title"><Monitor size={15} /> Station Session</div>
                  <div className="billing-items-list">
                  <div className="billing-item-row"><div><div className="billing-item-name">Customer</div><div className="billing-item-meta">{stationBilling.customerName || "Customer"}</div></div></div>
                  <div className="billing-item-row"><div><div className="billing-item-name">PC / Station</div><div className="billing-item-meta">{stationBilling.name}</div></div></div>
                  <div className="billing-item-row"><div><div className="billing-item-name">Session start</div><div className="billing-item-meta">{stationBilling.startedAt || "—"}</div></div></div>
                  <div className="billing-item-row"><div><div className="billing-item-name">Checkout time</div><div className="billing-item-meta">{stationBilling.checkoutAt ? new Date(stationBilling.checkoutAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—"}</div></div></div>
                  <div className="billing-item-row"><div><div className="billing-item-name">Final duration</div><div className="billing-item-meta">{stationElapsedTime(stationBilling)}</div></div><div className="billing-item-price">₱{stationPaymentTotal(stationBilling).toFixed(2)}</div></div>
                  </div>
                  <div className="billing-summary-footer">
                    <div className="billing-summary-row"><span>Subtotal</span><span>₱{stationPaymentTotal(stationBilling).toFixed(2)}</span></div>
                    <div className="billing-summary-row total"><span>Total Amount Due</span><span>₱{stationPaymentTotal(stationBilling).toFixed(2)}</span></div>
                  </div>
                </div>
                <div className="billing-payment-panel">
                  <div className="billing-section">
                    <div className="billing-section-label"><Receipt size={14} /> Payment Method</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className={stationPaymentMethod === "cash" ? "billing-process-btn" : "billing-back-btn"} onClick={() => setStationPaymentMethod("cash")}>Cash</button>
                      <button className={stationPaymentMethod === "wallet" ? "billing-process-btn" : "billing-back-btn"} onClick={() => setStationPaymentMethod("wallet")}>Wallet</button>
                    </div>
                  </div>
                  {stationPaymentMethod === "cash" ? (
                    <div className="billing-section">
                      <div className="billing-section-label">Cash Received</div>
                      <input type="number" min={stationPaymentTotal(stationBilling)} step="0.01" value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} className="billing-customer-search-input" placeholder="Enter cash received" />
                      <div className="billing-summary-row" style={{ marginTop: 12 }}><span>Change</span><b>₱{Math.max(0, Number(cashReceived || 0) - stationPaymentTotal(stationBilling)).toFixed(2)}</b></div>
                    </div>
                  ) : (
                    <div className="billing-section"><div className="billing-section-label">Wallet Balance</div><div className="billing-total-amount">₱{(customers.find((customer) => customer.id === stationBilling.customerProfileId)?.balance ?? 0).toFixed(2)}</div><p style={{ fontSize: 12, color: "#66817B" }}>₱{stationPaymentTotal(stationBilling).toFixed(2)} will be deducted after confirmation.</p></div>
                  )}
                  <button className="billing-process-btn" disabled={actionLoading === stationBilling.id || (stationPaymentMethod === "cash" ? Number(cashReceived || 0) < stationPaymentTotal(stationBilling) : !walletAllowedForStation(stationBilling))} onClick={() => void handleEndSession(stationBilling, stationPaymentMethod)}>{actionLoading === stationBilling.id ? "Processing..." : "Confirm Payment"}</button>
                  {feedback?.type === "error" && <p role="alert" style={{ color: "#991b1b", fontSize: 12 }}>{feedback.text}</p>}
                </div>
              </div>
            ) : billingOrder.length === 0 ? (
              <div className="billing-empty">
                <Receipt size={36} style={{ color: "#b0c8bf", marginBottom: 12 }} />
                <p style={{ margin: 0, color: "#66817B", fontSize: 13.5 }}>
                  No order selected. Confirmed client orders show above; to bill a walk-in, open <b>Snack Orders</b> and add items.
                </p>
              </div>
            ) : (
              <div className="billing-layout">
                {/* LEFT — Order summary */}
                <div className="billing-summary-panel">
                  <div className="billing-panel-title">
                    <ShoppingBag size={15} />
                    Order
                  </div>
                  <div className="billing-items-list">
                    {billingOrder.map((item) => (
                      <div key={item.id} className="billing-item-row">
                        <div className="billing-item-left">
                          <img src={item.image} alt={item.name} className="billing-item-img" />
                          <div>
                            <div className="billing-item-name">{item.name}</div>
                            <div className="billing-item-meta">
                              <span style={{ fontSize: 11.5, color: "#66817B" }}>× {item.quantity}</span>
                            </div>
                          </div>
                        </div>
                        <div className="billing-item-price">₱{(item.price * item.quantity).toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="billing-summary-footer">
                    <div className="billing-summary-row total">
                      <span>Total</span>
                      <span>₱{billingTotal.toFixed(2)}</span>
                    </div>
                  </div>
                  <button
                    className="billing-back-btn"
                    onClick={() => { setBillingOrder([]); setActiveTab("orders"); }}
                  >
                    ← Edit order
                  </button>
                </div>

                {/* RIGHT — Customer + cash */}
                <div className="billing-payment-panel">
                  <div className="billing-section">
                    <div className="billing-section-label">
                      <Users size={14} />
                      Customer
                    </div>
                    {billingCustomer && (
                      <div className="cafe-cart-customer-picked" style={{ marginBottom: 10 }}>
                        <div className="cafe-cart-customer-avatar">
                          {(billingCustomer.first_name[0] ?? "?").toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="cafe-cart-customer-name">
                            {billingCustomer.first_name} {billingCustomer.last_name}
                          </div>
                          <div className="cafe-cart-customer-meta">{billingCustomer.user_code ?? "No code"}</div>
                        </div>
                      </div>
                    )}
                    <div className="billing-customer-search">
                      <Search size={14} style={{ color: "#66817B", flexShrink: 0 }} />
                      <input
                        type="text"
                        placeholder="Search name, code, or contact..."
                        value={billingCustomerSearch}
                        onChange={(e) => setBillingCustomerSearch(e.target.value)}
                        className="billing-customer-search-input"
                      />
                    </div>
                    <div className="billing-customer-list">
                      {customers
                        .filter((c) => {
                          const q = billingCustomerSearch.toLowerCase();
                          const name = (c.first_name + " " + c.last_name).toLowerCase();
                          const code = (c.user_code ?? "").toLowerCase();
                          const contact = (c.contact ?? "").toLowerCase();
                          return !q || name.includes(q) || code.includes(q) || contact.includes(q);
                        })
                        .slice(0, 8)
                        .map((c) => (
                          <button
                            key={c.id}
                            className={"billing-customer-option" + (billingCustomerId === c.id ? " selected" : "")}
                            onClick={() => setBillingCustomerId(c.id)}
                          >
                            <div className="billing-cust-avatar">
                              {(c.first_name[0] ?? "?").toUpperCase()}
                            </div>
                            <div className="billing-cust-info">
                              <span className="billing-cust-name">{c.first_name} {c.last_name}</span>
                              <span className="billing-cust-meta">{c.user_code ?? "No code"}</span>
                            </div>
                            {billingCustomerId === c.id && (
                              <CheckCircle2 size={16} style={{ color: "#00695C", flexShrink: 0 }} />
                            )}
                          </button>
                        ))}
                      {customers.length === 0 && (
                        <div style={{ textAlign: "center", padding: "20px 0", color: "#9bbdb5", fontSize: 12.5 }}>
                          {customersLoading ? "Loading registered customers..." : customersError || "No registered customers found."}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="billing-total-section">
                    <div className="billing-total-label">Amount due · Cash</div>
                    <div className="billing-total-amount">₱{billingTotal.toFixed(2)}</div>
                  </div>

                  <button
                    className="billing-process-btn"
                    disabled={!billingCustomerId || billingProcessing}
                    onClick={() => void handleBillingSubmit()}
                  >
                    {billingProcessing ? (
                      "Processing..."
                    ) : (
                      <>
                        <Receipt size={15} />
                        Receive Cash — ₱{billingTotal.toFixed(2)}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Today’s settled bills */}
            {billingHistory.length > 0 && (
              <div className="billing-history-section">
                <div className="billing-mini-title" style={{ marginBottom: 10 }}>
                  <Clock3 size={14} />
                  <span>Settled today</span>
                </div>
                <div className="billing-history-table-wrap">
                  <table className="nodecafe-table">
                    <thead>
                      <tr>
                        <th>Bill</th>
                        <th>Customer</th>
                        <th>Items</th>
                        <th>Total</th>
                        <th>Time</th>
                        <th>Staff</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billingHistory.map((rec) => (
                        <tr key={rec.id}>
                          <td><code style={{ fontWeight: 700, fontSize: 11 }}>{rec.id}</code></td>
                          <td>
                            <b>{rec.customerName}</b>
                            <div style={{ fontSize: 11, color: "#66817B" }}>{rec.customerCode}</div>
                          </td>
                          <td style={{ fontSize: 12.5, color: "#66817B" }}>
                            {rec.items.map((i) => i.quantity + "× " + i.name).join(", ")}
                          </td>
                          <td><b style={{ color: "#00695C" }}>₱{rec.total.toFixed(2)}</b></td>
                          <td style={{ color: "#66817B", fontSize: 12 }}>{rec.timestamp}</td>
                          <td style={{ fontSize: 12, color: "#66817B" }}>{rec.staffName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 5: CUSTOMERS & TOP-UP (FULL IN-PAGE VIEW)
            ------------------------------------------------------------- */}
        {activeTab === "customers" && (

          <div className="nodecafe-page-view">
            <div className="nodecafe-page-header">
              <div>
                <h2 className="nodecafe-page-title">Customer Accounts &amp; Wallet Top-up</h2>
                <p className="nodecafe-page-subtitle">Search customers, view balances, and load prepaid wallet balance.</p>
              </div>
              <button
                className="nodecafe-btn-primary"
                style={{ width: "auto", padding: "10px 18px" }}
                onClick={() => setShowRegisterModal(true)}
              >
                <Plus size={15} />
                <span>Register Customer</span>
              </button>
            </div>

            <div className="nodecafe-search-row">
              <div className="nodecafe-search-box">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Search customer name, contact, or code..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                />
              </div>
            </div>

            {customersLoading && <p role="status">Loading registered customers...</p>}
            {customersError && (
              <div role="alert">
                <p>{customersError}</p>
                <button type="button" className="nodecafe-btn-outline" onClick={() => void fetchCustomers()}>Retry Customer List</button>
              </div>
            )}

            <div className="nodecafe-table-card">
              <table className="nodecafe-table">
                <thead>
                  <tr>
                    <th>Customer Name</th>
                    <th>Contact Info</th>
                    <th>Account Code</th>
                    <th>Wallet Balance</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((cust) => (
                    <tr key={cust.id}>
                      <td>
                        <b>{cust.first_name} {cust.last_name}</b>
                        <div style={{ fontSize: 11.5, color: "#6a887e" }}>{cust.email}</div>
                      </td>
                      <td>{cust.contact}</td>
                      <td>
                        <code style={{ fontWeight: 700, color: "#0b2b23" }}>{cust.user_code || "NC-USER"}</code>
                      </td>
                      <td>
                        <b style={{ color: "#0b2b23", fontSize: 14 }}>₱{(cust.balance || 0).toFixed(2)}</b>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="nodecafe-btn-approve"
                          onClick={() => {
                            setTopUpModalCustomer(cust);
                            setTopUpAmount(100);
                          }}
                        >
                          + Top-Up
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>

      {/* Assign Station Modal */}
      {assignStation && (
        <div className="admin-modal-overlay" onClick={() => setAssignStation(null)} role="dialog" aria-modal="true">
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="admin-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#eaf3ed", color: "#18452e", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Gamepad2 size={16} />
                </div>
                <h3>Assign Station {assignStation.name}</h3>
              </div>
              <button className="admin-modal-close" onClick={() => setAssignStation(null)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} style={{ padding: "16px 20px" }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>
                  Station Type &amp; Rate
                </label>
                <div style={{ padding: "10px 12px", background: "#f8fafc", borderRadius: 8, fontSize: 13, color: "#0f172a" }}>
                  <b>{assignStation.type} Workstation</b> · ₱{assignStation.rate}/hr ({assignStation.specs})
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>
                  Select Customer
                </label>
                {customersLoading ? (
                  <p role="status">Loading registered customers...</p>
                ) : customersError ? (
                  <div role="alert">
                    <p>{customersError}</p>
                    <button type="button" className="nodecafe-btn-outline" onClick={() => void fetchCustomers()}>Retry Customer List</button>
                  </div>
                ) : customers.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#dc2626", background: "#fef2f2", padding: 10, borderRadius: 8 }}>
                    No registered customers found. Please register a customer first.
                  </div>
                ) : (
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                      color: "#0f172a",
                      background: "#fff",
                    }}
                  >
                    <option value="">-- Choose Customer --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.first_name} {c.last_name} ({c.user_code || "No Code"}) - ₱{(c.balance || 0).toFixed(2)}
                      </option>
                    ))}
                  </select>
                )}
                <small style={{ display: "block", fontSize: 11, color: "#64748b", marginTop: 6 }}>
                  The session will be created in Supabase database. The client signs in at /client to unlock the terminal.
                </small>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setAssignStation(null)}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                    color: "#475569",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigningSession || customersLoading || Boolean(customersError) || !selectedCustomerId}
                  className="nodecafe-btn-primary"
                  style={{ width: "auto", padding: "9px 18px", fontSize: 13 }}
                >
                  {assigningSession ? "Assigning..." : "Confirm Assignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Top Up Customer Modal */}
      {topUpModalCustomer && (
        <div className="admin-modal-overlay" onClick={() => setTopUpModalCustomer(null)} role="dialog" aria-modal="true">
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="admin-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#eaf3ed", color: "#18452e", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Coins size={16} />
                </div>
                <h3>Wallet Top-Up</h3>
              </div>
              <button className="admin-modal-close" onClick={() => setTopUpModalCustomer(null)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleTopUpSubmit} style={{ padding: "16px 20px" }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: "#475569" }}>Customer:</div>
                <b style={{ fontSize: 15, color: "#0f172a" }}>
                  {topUpModalCustomer.first_name} {topUpModalCustomer.last_name}
                </b>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Current balance: <b>₱{(topUpModalCustomer.balance || 0).toFixed(2)}</b>
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>
                  Amount to Add (PHP)
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(Number(e.target.value))}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setTopUpModalCustomer(null)}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                    color: "#475569",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={toppingUp || topUpAmount <= 0}
                  className="nodecafe-btn-approve"
                  style={{ padding: "9px 18px", fontSize: 13 }}
                >
                  {toppingUp ? "Crediting..." : `Add ₱${topUpAmount}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modals */}
      {showRegisterModal && (
        <StaffRegisterCustomerModal
          onClose={() => setShowRegisterModal(false)}
          onSuccess={() => {
            void fetchOverview();
            setActiveTab("customers");
          }}
        />
      )}

      {paymentSuccess && (
        <div className="admin-modal-overlay" role="dialog" aria-modal="true">
          <div className="admin-modal-card payment-success-modal digital-receipt" style={{ maxWidth: 420, textAlign: "center", padding: 28 }}>
          <div className="payment-success-icon" aria-hidden="true"><CheckCircle2 size={38} /></div>
          <div className="receipt-kicker">INTERNET CAFE</div>
          <h3 style={{ margin: "8px 0 4px", color: "#0b2b23", fontSize: 21 }}>PAYMENT SUCCESSFUL</h3>
          <p style={{ margin: "0 0 16px", color: "#66817B", fontSize: 12 }}>Official Payment Receipt</p>
          <div className="receipt-separator" />
          <div style={{ textAlign: "left", background: "#f4f8f5", borderRadius: 12, padding: "14px 16px", display: "grid", gap: 8, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Receipt date</span><b>{new Date(paymentSuccess.paidAt).toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</b></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Customer</span><b>{paymentSuccess.station.customerName || "Customer"}</b></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Station</span><b>{paymentSuccess.station.name}</b></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Session start</span><b>{paymentSuccess.station.startedAt || "—"}</b></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Session end</span><b>{paymentSuccess.station.checkoutAt ? new Date(paymentSuccess.station.checkoutAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—"}</b></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Duration</span><b>{stationElapsedTime(paymentSuccess.station)}</b></div>
              <div className="receipt-separator" />
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>PC Usage</span><b>₱{paymentSuccess.amount.toFixed(2)}</b></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15 }}><span>TOTAL</span><b>₱{paymentSuccess.amount.toFixed(2)}</b></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Payment Method</span><b>{paymentSuccess.method === "cash" ? "Cash" : "Wallet"}</b></div>
              {paymentSuccess.method === "cash" && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Cash Received</span><b>₱{(paymentSuccess.cashReceived ?? 0).toFixed(2)}</b></div>}
              {paymentSuccess.method === "cash" && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Change</span><b>₱{(paymentSuccess.change ?? 0).toFixed(2)}</b></div>}
              {paymentSuccess.reference && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Reference</span><b>{paymentSuccess.reference}</b></div>}
            </div>
            <div className="receipt-separator" />
            <div className="receipt-paid">PAID ✓</div>
            <p className="receipt-thanks">Thank you for visiting!</p>
            <button className="nodecafe-btn-primary" style={{ marginTop: 20 }} onClick={() => { setPaymentSuccess(null); setActiveTab("transactions"); void fetchOverview(); void fetchReceipts(); }}>Done</button>
          </div>
        </div>
      )}

      {showProfileModal && (
        <UserProfileModal
          targetProfile={selectedUserProfile}
          onClose={() => {
            setShowProfileModal(false);
            setSelectedUserProfile(null);
          }}
          onProfileUpdated={() => {
            void fetchOverview();
          }}
        />
      )}
    </div>
  );
}
