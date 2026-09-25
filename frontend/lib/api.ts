import { supabase } from "./supabase/client";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function apiFetch(path: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const response = await fetch(`${apiUrl}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}), ...init.headers } });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error ?? "Request failed"); }
  return response.status === 204 ? null : response.json();
}
