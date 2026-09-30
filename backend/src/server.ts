import "dotenv/config";
import cors from "cors";
import express from "express";
import { z } from "zod";
import { AuthenticatedRequest, requireActiveUser, requireRole, requireSignedInProfile } from "./auth.js";
import { supabaseAdmin } from "./supabase.js";
import { STATION_HOURLY_RATE } from "./pc-services.js";

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:3000" }));
app.use(express.json());

const MAX_STATIONS = 8;

const accountRequest = z.object({
  firstName: z.string().min(1),
  middleName: z.string().optional(),
  lastName: z.string().min(1),
  address: z.string().min(1),
  contact: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["staff", "customer"]),
  gender: z.string().optional(),
  password: z.string().min(6).optional(),
});
const profileUpdate = z.object({
  firstName: z.string().min(1),
  middleName: z.string().optional().nullable(),
  lastName: z.string().min(1),
  suffix: z.string().optional().nullable(),
  address: z.string().min(1),
  contact: z.string().min(1),
  dateOfBirth: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  emergencyContact: z.string().optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
});
const stationSessionRequest = z.object({ stationKey: z.string().min(1), stationName: z.string().min(1), hourlyRate: z.number().nonnegative(), customerProfileId: z.string().uuid() });
const clientSessionSignIn = z.object({ userCode: z.string().min(3), contact: z.string().min(1) });
const checkoutStationSessionRequest = z.object({});
const endStationSessionRequest = z.object({ paymentMethod: z.enum(["cash", "wallet"]), cashReceived: z.number().nonnegative().optional() });

function logSupabaseError(operation: string, error: unknown) {
  const details = error && typeof error === "object" ? error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown } : {};
  console.error(`[station checkout] ${operation} failed`, {
    message: details.message,
    details: details.details,
    hint: details.hint,
    code: details.code,
    error,
  });
}

async function findDuplicateAccount({
  email,
  firstName,
  lastName,
  contact,
  excludeId,
}: {
  email?: string;
  firstName?: string;
  lastName?: string;
  contact?: string;
  excludeId?: string;
}): Promise<{ isDuplicate: boolean; reason?: string }> {
  const normEmail = email?.trim().toLowerCase();
  const normFirst = firstName?.trim().toLowerCase().replace(/\s+/g, " ");
  const normLast = lastName?.trim().toLowerCase().replace(/\s+/g, " ");
  const normContact = contact?.replace(/[\s\-\(\)\+]/g, "");

  let query = supabaseAdmin
    .from("account_profiles")
    .select("id, first_name, last_name, email, contact, status");

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data: profiles, error } = await query;
  if (error || !profiles) {
    return { isDuplicate: false };
  }

  for (const p of profiles) {
    const pFirst = (p.first_name || "").trim().toLowerCase().replace(/\s+/g, " ");
    const pLast = (p.last_name || "").trim().toLowerCase().replace(/\s+/g, " ");
    const pEmail = (p.email || "").trim().toLowerCase();
    const pContact = (p.contact || "").replace(/[\s\-\(\)\+]/g, "");

    // 1. Check Email
    if (normEmail && pEmail === normEmail) {
      return {
        isDuplicate: true,
        reason: "An account with this email address already exists.",
      };
    }

    // 2. Check First Name + Last Name
    if (normFirst && normLast && pFirst === normFirst && pLast === normLast) {
      return {
        isDuplicate: true,
        reason: `An account for "${firstName?.trim()} ${lastName?.trim()}" already exists. Every account must have a unique first and last name.`,
      };
    }

    // 3. Check Contact Number (if >= 7 digits)
    if (normContact && normContact.length >= 7 && pContact.length >= 7 && pContact === normContact) {
      return {
        isDuplicate: true,
        reason: "An account with this mobile/contact number already exists.",
      };
    }
  }

  return { isDuplicate: false };
}

app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/health/database", async (_req, res) => {
  const { error } = await supabaseAdmin.from("account_profiles").select("id", { head: true, count: "exact" }).limit(1);
  if (error) return res.status(503).json({ ok: false, error: error.message });
  res.json({ ok: true, database: "account_profiles table reachable" });
});

app.get("/api/me", requireSignedInProfile, async (req: AuthenticatedRequest, res) => {
  const { data, error } = await supabaseAdmin.from("account_profiles").select("*").eq("id", req.profile!.id).single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ profile: data });
});

app.patch("/api/me/profile", requireActiveUser, async (req: AuthenticatedRequest, res) => {
  const input = profileUpdate.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: "Invalid profile information", fields: input.error.flatten() });
  const p = input.data;

  const duplicate = await findDuplicateAccount({
    firstName: p.firstName,
    lastName: p.lastName,
    contact: p.contact,
    excludeId: req.profile!.id,
  });
  if (duplicate.isDuplicate) return res.status(409).json({ error: duplicate.reason });

  const updatePayload: Record<string, unknown> = {
    first_name: p.firstName,
    middle_name: p.middleName ?? null,
    last_name: p.lastName,
    suffix: p.suffix ?? null,
    address: p.address,
    contact: p.contact,
    date_of_birth: p.dateOfBirth ?? null,
    gender: p.gender ?? null,
    emergency_contact: p.emergencyContact ?? null,
    updated_at: new Date().toISOString(),
  };
  if (p.avatarUrl !== undefined) {
    updatePayload.avatar_url = p.avatarUrl;
  }
  const { data, error } = await supabaseAdmin
    .from("account_profiles")
    .update(updatePayload)
    .eq("id", req.profile!.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ profile: data });
});

app.patch("/api/admin/users/:id/profile", requireActiveUser, requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  const input = profileUpdate.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: "Invalid profile information", fields: input.error.flatten() });
  const p = input.data;
  const targetId = String(req.params.id);

  const duplicate = await findDuplicateAccount({
    firstName: p.firstName,
    lastName: p.lastName,
    contact: p.contact,
    excludeId: targetId,
  });
  if (duplicate.isDuplicate) return res.status(409).json({ error: duplicate.reason });

  const updatePayload: Record<string, unknown> = {
    first_name: p.firstName,
    middle_name: p.middleName ?? null,
    last_name: p.lastName,
    suffix: p.suffix ?? null,
    address: p.address,
    contact: p.contact,
    date_of_birth: p.dateOfBirth ?? null,
    gender: p.gender ?? null,
    emergency_contact: p.emergencyContact ?? null,
    updated_at: new Date().toISOString(),
  };
  if (p.avatarUrl !== undefined) {
    updatePayload.avatar_url = p.avatarUrl;
  }
  const { data, error } = await supabaseAdmin
    .from("account_profiles")
    .update(updatePayload)
    .eq("id", targetId)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ profile: data });
});

app.delete("/api/admin/users/:id", requireActiveUser, requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  const userId = String(req.params.id);
  if (req.profile?.id === userId) {
    return res.status(400).json({ error: "You cannot delete your own administrator account." });
  }

  const { data: targetProfile, error: fetchErr } = await supabaseAdmin
    .from("account_profiles")
    .select("id, auth_user_id, role")
    .eq("id", userId)
    .maybeSingle();

  if (fetchErr || !targetProfile) {
    return res.status(404).json({ error: "User account not found." });
  }

  // Remove any associated station sessions
  await supabaseAdmin.from("station_sessions").delete().eq("customer_profile_id", userId);

  // Delete profile
  const { error: delErr } = await supabaseAdmin.from("account_profiles").delete().eq("id", userId);
  if (delErr) {
    return res.status(500).json({ error: delErr.message });
  }

  // Delete from Supabase Auth if auth_user_id is present
  if (targetProfile.auth_user_id) {
    await supabaseAdmin.auth.admin.deleteUser(targetProfile.auth_user_id).catch(() => undefined);
  }

  res.json({ ok: true, message: "Account deleted successfully." });
});

// Assigning a customer immediately starts the metered station session. The
// customer may open the client portal later without affecting the timer.
app.post("/api/station-sessions", requireActiveUser, requireRole("admin", "staff"), async (req: AuthenticatedRequest, res) => {
  const input = stationSessionRequest.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: "Invalid station session", fields: input.error.flatten() });
  const value = input.data;
  const stationNumber = Number(value.stationKey.replace(/\D/g, ""));
  if (!Number.isInteger(stationNumber) || stationNumber < 1 || stationNumber > MAX_STATIONS) {
    return res.status(400).json({ error: "Only PC-01 through PC-08 are available." });
  }
  const { data: customer, error: customerError } = await supabaseAdmin.from("account_profiles").select("id, first_name, middle_name, last_name, role, status").eq("id", value.customerProfileId).single();
  if (customerError || !customer || customer.role !== "customer" || !["approved", "active"].includes(customer.status)) return res.status(400).json({ error: "Choose an approved registered customer." });
  const customerName = [customer.first_name, customer.middle_name, customer.last_name].filter(Boolean).join(" ");
  const { data, error } = await supabaseAdmin.from("station_sessions").insert({ station_key: value.stationKey, station_name: value.stationName, hourly_rate: STATION_HOURLY_RATE, customer_profile_id: customer.id, customer_name: customerName, status: "active", started_at: new Date().toISOString(), created_by_profile_id: req.profile!.id }).select().single();
  if (error) return res.status(409).json({ error: error.message.includes("station_sessions_one_open_per_station") ? "This station already has an open session." : error.message });

  // Sync public.stations status
  try {
    await supabaseAdmin
      .from("stations")
      .update({ status: "in_use" })
      .or(`name.ilike.${value.stationKey},name.ilike.${value.stationName}`);
  } catch {
    // silent
  }

  res.status(201).json({ session: data });
});

app.get("/api/station-sessions/open", requireActiveUser, requireRole("admin", "staff"), async (_req, res) => {
  const { data, error } = await supabaseAdmin.from("station_sessions").select("*").in("status", ["pending_client", "active", "awaiting_payment"]);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ sessions: data });
});

// Client PCs have no staff bearer token. A NetCafe ID plus registered contact
// lets the customer view a session that staff has already started.
app.post("/api/client/session-sign-in", async (req, res) => {
  const input = clientSessionSignIn.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: "Enter your NetCafe ID and registered contact number." });
  const value = input.data;
  const rawCode = value.userCode.trim().toUpperCase();
  const normalizedCode = rawCode.startsWith("ETHER-") ? rawCode.replace("ETHER-", "NC-") : rawCode;

  const { data: customer, error: customerError } = await supabaseAdmin
    .from("account_profiles")
    .select("id, status")
    .or(`user_code.eq.${rawCode},user_code.eq.${normalizedCode}`)
    .eq("contact", value.contact.trim())
    .eq("role", "customer")
    .maybeSingle();
  if (customerError || !customer || !["approved", "active"].includes(customer.status)) return res.status(401).json({ error: "Customer account was not found or is not approved." });
  const { data: openSession, error: openError } = await supabaseAdmin.from("station_sessions").select("*").eq("customer_profile_id", customer.id).in("status", ["pending_client", "active"]).order("requested_at", { ascending: false }).limit(1).maybeSingle();
  if (openError || !openSession) return res.status(404).json({ error: "No active station was found. Ask staff to assign a station first." });
  if (openSession.status === "active") return res.json({ session: openSession });
  const { data, error } = await supabaseAdmin.from("station_sessions").update({ status: "active", started_at: new Date().toISOString() }).eq("id", openSession.id).eq("status", "pending_client").select().single();
  if (error) return res.status(409).json({ error: "This session was already started or is no longer available." });
  res.json({ session: data });
});

app.get("/api/stations", requireActiveUser, requireRole("admin", "staff"), async (_req, res) => {
  try {
    const { data: stations, error: stErr } = await supabaseAdmin
      .from("stations")
      .select("*")
      .order("name", { ascending: true });

    if (stErr) return res.status(500).json({ error: stErr.message });

    const { data: openSessions } = await supabaseAdmin
      .from("station_sessions")
      .select("*")
      .in("status", ["pending_client", "active", "awaiting_payment"]);

    const openMap = new Map();
    (openSessions || []).forEach((s) => {
      openMap.set(String(s.station_key).toUpperCase(), s);
      openMap.set(String(s.station_name).toUpperCase(), s);
      const num = String(s.station_key).replace(/\D/g, "");
      if (num) {
        openMap.set(`PC-${num.padStart(2, "0")}`, s);
        openMap.set(`PC-${num}`, s);
      }
    });

    const list = (stations || []).map((st) => {
      const s = openMap.get(st.name.toUpperCase());
      return {
        id: st.id,
        name: st.name,
        type: st.type === "vip" ? "VIP" : "Standard",
        rate: Number(st.hourly_rate),
        specs: st.notes || (st.type === "vip" ? "240Hz, RTX 4080, Mechanical Rig" : "165Hz, RTX 4060, Standard Rig"),
        status: s ? "in-use" : "available",
        customerName: s ? s.customer_name : undefined,
        startedAt: s ? (s.started_at ? new Date(s.started_at).toISOString() : "Waiting for client") : undefined,
        sessionStatus: s ? s.status : undefined,
      };
    });

    res.json({ stations: list });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stations" });
  }
});

// Client lounge floor board. Clients need the same live rig picture the staff
// control board shows, but never another guest's name — so this payload carries
// availability plus a `mine` flag instead of `customerName`.
app.get("/api/client/stations", requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { data: stations, error: stErr } = await supabaseAdmin
      .from("stations")
      .select("*")
      .order("name", { ascending: true });

    if (stErr) return res.status(500).json({ error: stErr.message });

    const { data: openSessions } = await supabaseAdmin
      .from("station_sessions")
      .select("*")
      .in("status", ["pending_client", "active", "awaiting_payment"]);

    const openMap = new Map();
    (openSessions || []).forEach((s) => {
      openMap.set(String(s.station_key).toUpperCase(), s);
      openMap.set(String(s.station_name).toUpperCase(), s);
      const num = String(s.station_key).replace(/\D/g, "");
      if (num) {
        openMap.set(`PC-${num.padStart(2, "0")}`, s);
        openMap.set(`PC-${num}`, s);
      }
    });

    const viewerProfileId = req.profile?.id;
    const list = (stations || []).map((st) => {
      const s = openMap.get(st.name.toUpperCase());
      return {
        id: st.id,
        name: st.name,
        type: st.type === "vip" ? "VIP" : "Standard",
        rate: Number(st.hourly_rate),
        specs: st.notes || (st.type === "vip" ? "240Hz, RTX 4080, Mechanical Rig" : "165Hz, RTX 4060, Standard Rig"),
        status: s ? "in-use" : "available",
        startedAt: s ? (s.started_at ? new Date(s.started_at).toISOString() : "Waiting for client") : undefined,
        sessionStatus: s ? s.status : undefined,
        mine: Boolean(s && viewerProfileId && s.customer_profile_id === viewerProfileId),
      };
    });

    res.json({ stations: list });
  } catch {
    res.status(500).json({ error: "Failed to fetch stations" });
  }
});

app.post("/api/station-sessions/:stationKey/checkout", requireActiveUser, requireRole("admin", "staff"), async (req, res) => {
  const input = checkoutStationSessionRequest.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: "Invalid checkout request." });
  const rawKey = String(req.params.stationKey || "").trim();
  if (!rawKey) return res.status(400).json({ error: "Station or session key is required." });
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawKey);
  let query = supabaseAdmin.from("station_sessions").select("*").in("status", ["active", "awaiting_payment"]);
  query = isUuid ? query.eq("id", rawKey) : query.or(`station_key.ilike.${rawKey},station_name.ilike.%${rawKey}%`);
  const { data: session, error: sessionError } = await query.order("requested_at", { ascending: false }).limit(1).maybeSingle();
  if (sessionError) {
    logSupabaseError("loading station session", sessionError);
    return res.status(500).json({ error: "Could not load the station session for checkout." });
  }
  if (!session) return res.status(404).json({ error: "No active station session was found." });
  if (session.status === "awaiting_payment") return res.json({ session });

  const checkoutAt = new Date();
  const startedAt = session.started_at ? new Date(session.started_at).getTime() : checkoutAt.getTime();
  const durationSeconds = Math.max(0, Math.floor((checkoutAt.getTime() - startedAt) / 1000));
  const total = Number(((durationSeconds / 3600) * Number(session.hourly_rate || STATION_HOURLY_RATE)).toFixed(2));
  const checkoutPayload = {
    status: "awaiting_payment",
    checkout_at: checkoutAt.toISOString(),
    checkout_duration_seconds: durationSeconds,
    checkout_total: total,
  };
  const { data: locked, error } = await supabaseAdmin
    .from("station_sessions")
    .update(checkoutPayload)
    .eq("id", session.id)
    .eq("status", "active")
    .select("*")
    .maybeSingle();
  if (error) {
    logSupabaseError("saving frozen station checkout", error);
    console.error("[station checkout] payload", { sessionId: session.id, checkoutPayload });
    return res.status(500).json({ error: "Could not save the station checkout. Check the backend console for the database error." });
  }
  if (!locked) return res.status(409).json({ error: "This session is already in checkout or has been completed." });
  res.json({ session: locked });
});

app.post("/api/station-sessions/:stationKey/end", requireActiveUser, requireRole("admin", "staff"), async (req, res) => {
  const input = endStationSessionRequest.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: "Choose cash or customer wallet for this payment." });
  const paymentMethod = input.data.paymentMethod;
  const cashReceived = input.data.cashReceived;
  const rawParam = Array.isArray(req.params.stationKey) ? req.params.stationKey[0] : req.params.stationKey;
  const param = (rawParam || "").trim();
  if (!param) return res.status(400).json({ error: "Station key is required." });

  const rawKey = param;
  const upperKey = rawKey.toUpperCase();
  const numOnly = rawKey.replace(/^pc-?/i, "").replace(/^0+/, "");
  const pcPadded = numOnly ? `PC-${numOnly.padStart(2, "0")}` : "";

  // Query station_sessions
  let query = supabaseAdmin
    .from("station_sessions")
    .select("*")
    .in("status", ["active", "awaiting_payment", "pending_client"]);

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawKey);
  if (isUuid) {
    query = query.or(`id.eq.${rawKey},station_key.eq.${rawKey}`);
  } else {
    const filters = [
      `station_key.eq.${rawKey}`,
      `station_key.ilike.${upperKey}`,
      `station_name.ilike.%${rawKey}%`,
    ];
    if (pcPadded) {
      filters.push(`station_key.ilike.${pcPadded}`);
      filters.push(`station_name.ilike.%${pcPadded}%`);
    }
    if (numOnly) {
      filters.push(`station_key.eq.${numOnly}`);
    }
    query = query.or(filters.join(","));
  }

  const { data: sessions, error: sessionError } = await query
    .order("requested_at", { ascending: false })
    .limit(1);

  const session = sessions?.[0];

  if (sessionError) {
    logSupabaseError("loading station session for payment", sessionError);
    return res.status(500).json({ error: "Could not load the station session for payment." });
  }
  if (!session) return res.status(404).json({ error: "No active or pending session was found for this station." });

  const endedAt = session.checkout_at ? new Date(session.checkout_at) : new Date();

  // If pending_client, cancel without charge
  if (session.status === "pending_client") {
    const { data, error } = await supabaseAdmin
      .from("station_sessions")
      .update({ status: "cancelled", ended_at: endedAt.toISOString(), total: 0 })
      .eq("id", session.id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    // Sync public.stations status
    try {
      await supabaseAdmin
        .from("stations")
        .update({ status: "available" })
        .or(`name.ilike.${session.station_key},name.ilike.${session.station_name}`);
    } catch {
      // silent
    }

    return res.json({ session: data, message: "Station assignment cancelled." });
  }

  // Active session billing calculation
  const start = session.started_at ? new Date(session.started_at).getTime() : endedAt.getTime();
  const durationSeconds = session.checkout_duration_seconds ?? Math.max(0, Math.floor((endedAt.getTime() - start) / 1000));
  const total = session.checkout_total !== null && session.checkout_total !== undefined
    ? Number(session.checkout_total)
    : Number(((durationSeconds / 3600) * Number(session.hourly_rate || STATION_HOURLY_RATE)).toFixed(2));

  const { data: customerProfile, error: customerError } = session.customer_profile_id
    ? await supabaseAdmin
      .from("account_profiles")
      .select("id, balance, total_spent")
      .eq("id", session.customer_profile_id)
      .maybeSingle()
    : { data: null, error: null };
  if (customerError) {
    logSupabaseError("loading customer wallet for station payment", customerError);
    return res.status(500).json({ error: "Could not load the customer wallet for payment." });
  }
  if (paymentMethod === "wallet" && customerProfile && Number(customerProfile.balance || 0) < total) {
    return res.status(400).json({ error: "Insufficient customer wallet balance. Collect cash instead." });
  }
  if (paymentMethod === "cash" && (cashReceived === undefined || cashReceived < total)) {
    return res.status(400).json({ error: `Cash received must be at least ₱${total.toFixed(2)}.` });
  }
  const changeDue = paymentMethod === "cash" ? Number((cashReceived! - total).toFixed(2)) : 0;

  const { data, error } = await supabaseAdmin
    .from("station_sessions")
    .update({ status: "ended", ended_at: endedAt.toISOString(), total, payment_method: paymentMethod, cash_received: paymentMethod === "cash" ? cashReceived : null, change_due: paymentMethod === "cash" ? changeDue : null })
    .eq("id", session.id)
    .in("status", ["active", "awaiting_payment"])
    .select()
    .maybeSingle();

  if (error) {
    logSupabaseError("finalizing station payment", error);
    return res.status(500).json({ error: "Could not finalize the station payment. Check the backend console for the database error." });
  }
  if (!data) return res.status(409).json({ error: "This station payment was already completed or is being processed." });

  // Sync public.stations status
  try {
    await supabaseAdmin
      .from("stations")
      .update({ status: "available" })
      .or(`name.ilike.${session.station_key},name.ilike.${session.station_name}`);
  } catch {
    // silent
  }

  // Wallet payments deduct the customer's balance; cash payments only add to spend.
  if (customerProfile) {
      const currentBalance = Number(customerProfile.balance || 0);
      const currentSpent = Number(customerProfile.total_spent || 0);
      const newSpent = Number((currentSpent + total).toFixed(2));
      const newBalance = paymentMethod === "wallet"
        ? Number((currentBalance - total).toFixed(2))
        : currentBalance;

      await supabaseAdmin
        .from("account_profiles")
        .update({
          balance: newBalance,
          total_spent: newSpent,
          updated_at: new Date().toISOString(),
        })
        .eq("id", customerProfile.id);
  }

  res.json({ session: data, paymentMethod, cashReceived: paymentMethod === "cash" ? cashReceived : null, changeDue });
});

// Top-up customer prepaid balance
const topUpRequest = z.object({
  amount: z.number().positive(),
});

app.post("/api/customers/:id/top-up", requireActiveUser, requireRole("admin", "staff"), async (req: AuthenticatedRequest, res) => {
  const input = topUpRequest.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: "Invalid top-up amount" });

  const customerId = String(req.params.id);
  const { data: customer, error: fetchErr } = await supabaseAdmin
    .from("account_profiles")
    .select("id, balance")
    .eq("id", customerId)
    .maybeSingle();

  if (fetchErr || !customer) return res.status(404).json({ error: "Customer not found" });

  const newBalance = Number((Number(customer.balance || 0) + input.data.amount).toFixed(2));
  const { data, error } = await supabaseAdmin
    .from("account_profiles")
    .update({
      balance: newBalance,
      updated_at: new Date().toISOString(),
    })
    .eq("id", customerId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ profile: data, message: `Successfully topped up ₱${input.data.amount.toFixed(2)}.` });
});

// ── Snack / pre-order tickets ────────────────────────────────────────────────
// A client portal order becomes a row in public.orders (migration 008). The
// front desk works that ticket through the Snack & Pre-Order Management queue,
// and the same rows feed the client's Billing & Transaction History tab.
const cafeOrderItem = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  price: z.number().nonnegative(),
  quantity: z.number().int().positive(),
});
const cafeOrderRequest = z.object({
  items: z.array(cafeOrderItem).min(1),
  stationKey: z.string().max(120).nullish(),
  paymentMethod: z.string().min(1).max(40).nullish(),
  notes: z.string().max(500).nullish(),
});
const orderStatusUpdate = z.object({ status: z.enum(["pending", "preparing", "ready", "completed", "cancelled"]) });
// A client-filed ticket carries this until the cashier settles it, so the staff
// billing queue can tell "awaiting payment" apart from an already-paid method.
const UNPAID_PAYMENT = "Unpaid";

// Migrations are applied by hand, so every café order read must stay usable on a
// project where public.orders does not exist yet.
function isOrdersTableMissing(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const message = error.message ?? "";
  return /orders/i.test(message) && /(does not exist|schema cache)/i.test(message);
}

// Ticket counters behind the staff/admin overview cards. Falls back to zeros
// while migration 008 is not applied so both dashboards keep rendering.
async function readOrderCounts() {
  const counts = { pending: 0, preparing: 0, ready: 0, completed: 0 };
  const { data, error } = await supabaseAdmin.from("orders").select("status");
  if (error || !data) return counts;
  data.forEach((row) => {
    const status = String(row.status);
    if (status === "pending" || status === "preparing" || status === "ready" || status === "completed") counts[status] += 1;
  });
  return counts;
}

// Client portal: place a café order. The client never settles payment here —
// confirming only files a `pending` ticket that lands in the staff Billing
// section, where the cashier collects the money (wallet or cash) and marks it
// paid. So no balance is touched on this route: the member still owes the total
// until staff process it at the counter.
app.post("/api/client/orders", requireActiveUser, async (req: AuthenticatedRequest, res) => {
  const input = cafeOrderRequest.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: "Invalid café order", fields: input.error.flatten() });
  const value = input.data;

  // Prices and the total are re-derived here — the browser is never trusted with
  // the amount that actually gets charged.
  const items = value.items.map((item) => ({ id: item.id, name: item.name, price: Number(item.price), quantity: item.quantity }));
  const total = Number(items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2));
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  if (total <= 0) return res.status(400).json({ error: "The order total must be greater than zero." });

  // Payment is left unset until the cashier picks wallet or cash: `Unpaid` keeps
  // the ticket clearly in the staff billing queue rather than looking settled.
  const { data: customer, error: customerError } = await supabaseAdmin
    .from("account_profiles")
    .select("id, first_name, last_name, balance")
    .eq("id", req.profile!.id)
    .single();
  if (customerError || !customer) return res.status(404).json({ error: "Customer profile not found." });

  const customerName = `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() || "Customer";
  const { data: created, error: orderError } = await supabaseAdmin
    .from("orders")
    .insert({
      customer_profile_id: customer.id,
      customer_name: customerName,
      station_key: value.stationKey ?? null,
      items,
      item_count: itemCount,
      total,
      payment_method: UNPAID_PAYMENT,
      status: "pending",
      notes: value.notes ?? null,
    })
    .select()
    .single();
  if (orderError) {
    const status = isOrdersTableMissing(orderError) ? 503 : 500;
    return res.status(status).json({ error: orderError.message });
  }

  const balance = Number(customer.balance || 0);
  res.status(201).json({
    order: created,
    balance,
    message: `Order ${created.reference} sent to the front desk — please settle payment at the counter.`,
  });
});

// Staff Billing: settle a pending client order with cash. This is the only place
// a café ticket turns into money — café payments are walk-in cash at the counter
// (no wallet/e-wallet), so the ticket is simply closed as paid.
const settleOrderRequest = z.object({ paymentMethod: z.enum(["cash"]) });
app.post("/api/staff/orders/:id/settle", requireActiveUser, requireRole("admin", "staff"), async (req: AuthenticatedRequest, res) => {
  const input = settleOrderRequest.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: "Snack orders are settled in cash at the counter." });

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("id", String(req.params.id))
    .single();
  if (orderError || !order) return res.status(404).json({ error: "Order not found." });
  if (order.status === "completed") return res.status(409).json({ error: `Order ${order.reference} is already paid.` });
  if (order.status === "cancelled") return res.status(409).json({ error: `Order ${order.reference} was cancelled.` });

  const total = Number(order.total) || 0;

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("orders")
    .update({
      status: "completed",
      payment_method: "Cash at Desk",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id)
    .select()
    .single();
  if (updateError) return res.status(500).json({ error: updateError.message });

  res.json({ order: updated, message: `Order ${updated.reference} paid — ₱${total.toFixed(2)} in cash.` });
});

// Client portal: the signed-in member's own café order history, newest first.
app.get("/api/client/orders", requireActiveUser, async (req: AuthenticatedRequest, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("customer_profile_id", req.profile!.id)
    .order("placed_at", { ascending: false })
    .limit(limit);

  if (error) {
    // migration 008 not applied yet — the portal must keep rendering.
    if (isOrdersTableMissing(error)) return res.json({ orders: [], available: false });
    return res.status(500).json({ error: error.message });
  }
  res.json({ orders: data ?? [], available: true });
});

// Front desk queue behind the staff Snack & Pre-Order Management modal.
// Open tickets by default; closed ones only when explicitly requested.
app.get("/api/staff/orders", requireActiveUser, requireRole("admin", "staff"), async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
  const includeClosed = req.query.includeClosed === "true";

  let query = supabaseAdmin.from("orders").select("*").order("placed_at", { ascending: false }).limit(100);
  if (status) {
    query = query.eq("status", status);
  } else if (!includeClosed) {
    query = query.in("status", ["pending", "preparing", "ready"]);
  }

  const { data, error } = await query;
  if (error) {
    if (isOrdersTableMissing(error)) return res.json({ orders: [], available: false });
    return res.status(500).json({ error: error.message });
  }
  res.json({ orders: data ?? [], available: true });
});

// Shared receipt feed for Admin and Staff: café tickets plus ended station
// checkouts, newest first. Top-ups are not included because they only update a
// balance and are not stored as their own rows.
app.get(["/api/transactions", "/api/admin/transactions"], requireActiveUser, requireRole("admin", "staff"), async (_req, res) => {
  const [ordersResult, sessionsResult] = await Promise.all([
    supabaseAdmin.from("orders").select("*").order("placed_at", { ascending: false }).limit(100),
    supabaseAdmin
      .from("station_sessions")
      .select("id, station_name, customer_name, status, started_at, ended_at, checkout_at, checkout_duration_seconds, checkout_total, total, hourly_rate, payment_method, cash_received, change_due")
      .eq("status", "ended")
      .order("ended_at", { ascending: false })
      .limit(100),
  ]);

  const ordersAvailable = !isOrdersTableMissing(ordersResult.error);
  if (ordersResult.error && ordersAvailable) return res.status(500).json({ error: ordersResult.error.message });
  if (sessionsResult.error) return res.status(500).json({ error: sessionsResult.error.message });

  const orderRows = ordersAvailable ? ordersResult.data ?? [] : [];
  const sessionRows = sessionsResult.data ?? [];

  const transactions = [
    ...orderRows.map((order) => ({
      id: order.reference || order.id,
      source: "order",
      customer: order.customer_name || "Customer",
      service: `Snack Order${order.item_count ? ` · ${order.item_count} item${Number(order.item_count) === 1 ? "" : "s"}` : ""}${order.station_key ? ` (${order.station_key})` : ""}`,
      amount: Number(order.total) || 0,
      method: order.payment_method || "Unpaid",
      timestamp: order.completed_at || order.placed_at,
      status: order.status || "pending",
    })),
    ...sessionRows.map((session) => {
      const started = session.started_at ? new Date(session.started_at).getTime() : 0;
      const ended = session.ended_at ? new Date(session.ended_at).getTime() : 0;
      const hours = started && ended ? Math.max(0, (ended - started) / 3_600_000) : 0;
      const hoursLabel = hours > 0 ? ` · ${hours.toFixed(1)} hrs` : "";
      return {
        id: `SES-${String(session.id).slice(0, 8).toUpperCase()}`,
        source: "session",
        customer: session.customer_name || "Customer",
        service: `Station Session (${session.station_name || "PC"}${hoursLabel})`,
        amount: Number(session.total ?? session.checkout_total) || 0,
        method: session.payment_method === "cash" ? "Cash" : session.payment_method === "wallet" ? "Wallet" : "Member Balance",
        timestamp: session.ended_at || session.checkout_at,
        status: "paid",
      };
    }),
  ]
    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
    .slice(0, 100);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const isToday = (value: string | null | undefined) => {
    if (!value) return false;
    const time = new Date(value).getTime();
    return !Number.isNaN(time) && time >= startOfDay.getTime();
  };
  const todayOrders = orderRows.filter((order) => order.status === "completed" && isToday(order.completed_at || order.placed_at));
  const todaySessions = sessionRows.filter((session) => isToday(session.ended_at));

  res.json({
    transactions,
    available: ordersAvailable,
    summary: {
      grossSales:
        todayOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0) +
        todaySessions.reduce((sum, session) => sum + (Number(session.total) || 0), 0),
      stationSales: todaySessions.reduce((sum, session) => sum + (Number(session.total) || 0), 0),
      stationHours: todaySessions.reduce((sum, session) => {
        const started = session.started_at ? new Date(session.started_at).getTime() : 0;
        const ended = session.ended_at ? new Date(session.ended_at).getTime() : 0;
        return sum + (started && ended ? Math.max(0, (ended - started) / 3_600_000) : 0);
      }, 0),
      cafeSales: todayOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0),
      cafeOrders: todayOrders.length,
    },
  });
});

// Front desk moves a ticket along its lifecycle.
app.patch("/api/staff/orders/:id/status", requireActiveUser, requireRole("admin", "staff"), async (req, res) => {
  const input = orderStatusUpdate.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: "Invalid order status" });

  const updates: Record<string, unknown> = { status: input.data.status, updated_at: new Date().toISOString() };
  if (input.data.status === "completed" || input.data.status === "cancelled") updates.completed_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("orders")
    .update(updates)
    .eq("id", String(req.params.id))
    .select()
    .single();
  if (error) return res.status(409).json({ error: error.message });
  res.json({ order: data, message: `Order ${data.reference} marked ${data.status}.` });
});

// Public client check session status (for live station PC monitoring)
app.get("/api/client/sessions/:id/status", async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("station_sessions")
    .select("id, status, started_at, ended_at, total, hourly_rate, station_name, customer_name")
    .eq("id", req.params.id)
    .maybeSingle();

  if (error || !data) return res.status(404).json({ error: "Session not found" });
  res.json({ session: data });
});

function generateTemporaryPassword(): string {
  const lettersUpper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lettersLower = "abcdefghijkmnpqrstuvwxyz";
  const numbers = "23456789";
  const specials = "!@#$%&*";
  const pick = (set: string) => set.charAt(Math.floor(Math.random() * set.length));

  // Guarantee a mix of upper, lower, number, special for security
  let res = "Eth-" + pick(lettersUpper) + pick(lettersLower) + pick(numbers) + pick(specials);
  const all = lettersUpper + lettersLower + numbers + specials;
  for (let i = 0; i < 4; i++) res += pick(all);
  return res;
}

// Admin / staff user registration — creates a pending account without requiring a password.
app.post("/api/account-requests", requireActiveUser, requireRole("admin", "staff"), async (req: AuthenticatedRequest, res) => {
  const input = accountRequest.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: "Invalid profile information", fields: input.error.flatten() });
  const value = input.data;

  const duplicate = await findDuplicateAccount({
    email: value.email,
    firstName: value.firstName,
    lastName: value.lastName,
    contact: value.contact,
  });
  if (duplicate.isDuplicate) return res.status(409).json({ error: duplicate.reason });

  const { data, error } = await supabaseAdmin.from("account_profiles").insert({
    first_name: value.firstName,
    middle_name: value.middleName ?? null,
    last_name: value.lastName,
    address: value.address,
    contact: value.contact,
    email: value.email.toLowerCase(),
    role: value.role,
    status: "pending",
    auth_user_id: null,
    created_by_profile_id: req.profile!.id,
    must_change_password: false,
  }).select().single();

  if (error) return res.status(409).json({ error: error.message });
  res.status(201).json({ profile: data, message: "Account registered and pending administrator approval." });
});

// Staff/admin customer directory
app.get("/api/customers", requireActiveUser, requireRole("admin", "staff"), async (_req, res) => {
  const { data, error } = await supabaseAdmin.from("account_profiles").select("*").eq("role", "customer").order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ customers: data });
});

// Staff list for admin oversight
app.get("/api/staff", requireActiveUser, requireRole("admin"), async (_req, res) => {
  const { data, error } = await supabaseAdmin.from("account_profiles").select("*").in("role", ["staff", "admin"]).order("created_at", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ staff: data });
});

// List of all pending account requests
app.get("/api/admin/account-requests", requireActiveUser, requireRole("admin"), async (_req, res) => {
  const { data, error } = await supabaseAdmin.from("account_profiles").select("*").eq("status", "pending").order("created_at", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ requests: data });
});

// Approve pending account: generates secure temporary password, registers/updates Supabase Auth,
// sets must_change_password: true, and returns the temporary password ONCE to the admin.
app.post("/api/admin/account-requests/:profileId/approve", requireActiveUser, requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  const { data: profile, error: readError } = await supabaseAdmin.from("account_profiles").select("*").eq("id", req.params.profileId).single();
  if (readError || !profile) return res.status(404).json({ error: "Account request not found in account_profiles" });
  if (String(profile.status).toLowerCase() !== "pending") return res.status(409).json({ error: `This account is already ${profile.status}. Refresh Pending Accounts.` });

  const temporaryPassword = generateTemporaryPassword();
  let authUserId = profile.auth_user_id;

  try {
    if (authUserId) {
      const { error: updateAuthErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        password: temporaryPassword,
        user_metadata: { role: profile.role, must_change_password: true },
      });
      if (updateAuthErr) return res.status(500).json({ error: "Failed to set user temporary password: " + updateAuthErr.message });
    } else {
      // Check if user exists in Supabase Auth by email
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = listData?.users.find((u) => u.email?.toLowerCase() === profile.email.toLowerCase());

      if (existingUser) {
        authUserId = existingUser.id;
        const { error: updateAuthErr } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
          password: temporaryPassword,
          user_metadata: { role: profile.role, must_change_password: true },
        });
        if (updateAuthErr) return res.status(500).json({ error: "Failed to update user password: " + updateAuthErr.message });
      } else {
        const { data: newUser, error: createAuthErr } = await supabaseAdmin.auth.admin.createUser({
          email: profile.email.toLowerCase(),
          password: temporaryPassword,
          email_confirm: true,
          user_metadata: {
            role: profile.role,
            first_name: profile.first_name,
            last_name: profile.last_name,
            must_change_password: true,
          },
        });
        if (createAuthErr || !newUser.user) {
          return res.status(500).json({ error: "Failed to create Supabase Auth user: " + (createAuthErr?.message ?? "unknown error") });
        }
        authUserId = newUser.user.id;
      }
    }

    const { data: updated, error: updateProfileError } = await supabaseAdmin.from("account_profiles").update({
      auth_user_id: authUserId,
      status: "active",
      approved_by_profile_id: req.profile!.id,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      must_change_password: true,
    }).eq("id", profile.id).select().single();

    if (updateProfileError) return res.status(500).json({ error: updateProfileError.message });

    res.json({
      profile: updated,
      temporaryPassword,
      message: "Account approved and activated. Temporary password generated successfully.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected approval error";
    res.status(500).json({ error: message });
  }
});

// Reject pending account
app.post("/api/admin/account-requests/:profileId/reject", requireActiveUser, requireRole("admin"), async (req, res) => {
  const { data, error } = await supabaseAdmin.from("account_profiles").update({
    status: "rejected",
    updated_at: new Date().toISOString(),
  }).eq("id", req.params.profileId).select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ profile: data, message: "Account request rejected." });
});

// Clears must_change_password after user successfully updates their password
app.post("/api/auth/complete-password-change", requireSignedInProfile, async (req: AuthenticatedRequest, res) => {
  const { data, error } = await supabaseAdmin.from("account_profiles").update({
    must_change_password: false,
    updated_at: new Date().toISOString(),
  }).eq("id", req.profile!.id).select().single();

  if (error) return res.status(500).json({ error: error.message });
  if (req.profile!.auth_user_id) {
    await supabaseAdmin.auth.admin.updateUserById(req.profile!.auth_user_id, {
      user_metadata: { must_change_password: false },
    });
  }
  res.json({ profile: data, message: "Password updated successfully." });
});

// Live Admin Overview Statistics
app.get("/api/admin/overview", requireActiveUser, requireRole("admin"), async (_req, res) => {
  try {
    const { count: usersCount } = await supabaseAdmin.from("account_profiles").select("id", { count: "exact", head: true });
    const { count: pendingCount } = await supabaseAdmin.from("account_profiles").select("id", { count: "exact", head: true }).eq("status", "pending");
    const { count: activeSessionsCount } = await supabaseAdmin.from("station_sessions").select("id", { count: "exact", head: true }).in("status", ["active", "awaiting_payment", "pending_client"]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data: todaySessions } = await supabaseAdmin.from("station_sessions").select("total").eq("status", "ended").gte("ended_at", today.toISOString());
    const dailyRevenue = todaySessions?.reduce((acc, s) => acc + (Number(s.total) || 0), 0) ?? 0;
    const orderCounts = await readOrderCounts();

    res.json({
      dailyRevenue,
      activeSessions: activeSessionsCount ?? 0,
      totalUsers: usersCount ?? 0,
      pcsOnline: { active: activeSessionsCount ?? 0, total: MAX_STATIONS },
      pendingOrders: orderCounts.pending,
      pendingRequests: pendingCount ?? 0,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch admin overview" });
  }
});

// Live Staff Operational Overview (Front desk operations only - strictly no revenue or admin data)
app.get("/api/staff/overview", requireActiveUser, requireRole("admin", "staff"), async (_req, res) => {
  try {
    const { count: activeSessionsCount } = await supabaseAdmin
      .from("station_sessions")
      .select("id", { count: "exact", head: true })
      .in("status", ["active", "awaiting_payment", "pending_client"]);

    // Snack tickets come from public.orders (migration 008).
    const orderCounts = await readOrderCounts();
    res.json({
      activeSessions: activeSessionsCount ?? 0,
      pcsOnline: { active: activeSessionsCount ?? 0, total: MAX_STATIONS },
      pendingOrders: orderCounts.pending,
      orderCounts,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch staff overview" });
  }
});

// Public customer self-registration — creates a pending profile.
// Admin approval (and email invite) is still required before the account becomes usable.
const publicRegisterRequest = z.object({
  firstName: z.string().min(1),
  middleName: z.string().optional(),
  lastName: z.string().min(1),
  suffix: z.string().optional(),
  address: z.string().min(1),
  contact: z.string().min(1),
  email: z.string().email(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  emergencyContact: z.string().optional(),
});

app.post("/api/public/register", async (req, res) => {
  const input = publicRegisterRequest.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: "Invalid registration information", fields: input.error.flatten() });
  const value = input.data;

  const duplicate = await findDuplicateAccount({
    email: value.email,
    firstName: value.firstName,
    lastName: value.lastName,
    contact: value.contact,
  });
  if (duplicate.isDuplicate) return res.status(409).json({ error: duplicate.reason });

  const { data, error } = await supabaseAdmin.from("account_profiles").insert({
    first_name: value.firstName,
    middle_name: value.middleName ?? null,
    last_name: value.lastName,
    suffix: value.suffix ?? null,
    address: value.address,
    contact: value.contact,
    email: value.email.toLowerCase(),
    date_of_birth: value.dateOfBirth ?? null,
    gender: value.gender ?? null,
    emergency_contact: value.emergencyContact ?? null,
    role: "customer",
    status: "pending",
    auth_user_id: null,
  }).select("id, email, status").single();
  if (error) return res.status(409).json({ error: error.message });
  res.status(201).json({ profile: data, message: "Registration submitted. An admin will review and email you when your account is approved." });
});

app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => { console.error(error); res.status(500).json({ error: "Unexpected server error" }); });
app.listen(Number(process.env.PORT ?? 4000), () => console.log(`NetCafe backend listening on port ${process.env.PORT ?? 4000}`));
