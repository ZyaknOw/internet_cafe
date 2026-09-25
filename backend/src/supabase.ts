import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required in backend/.env");

// Node 20 has no native WebSocket; Supabase initialises its realtime client eagerly.
globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;

export const supabaseAdmin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
