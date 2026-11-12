import type { SupabaseClient } from "@supabase/supabase-js";

export async function sessionPersonnel(client: SupabaseClient, sessions: {
  created_by_profile_id?: string | null; customer_profile_id?: string | null;
}[], viewerId?: string) {
  const relevant = viewerId ? sessions.filter(session => session.customer_profile_id === viewerId) : sessions;
  const ids = [...new Set(relevant.map(session => session.created_by_profile_id).filter((id): id is string => Boolean(id)))];
  const result = new Map<string, { name: string; role: "staff" | "admin" }>();
  if (!ids.length) return result;
  const { data, error } = await client.from("account_profiles").select("id, first_name, last_name, role").in("id", ids);
  if (error) throw new Error("Could not load assigned personnel");
  for (const profile of data ?? []) {
    if (profile.role !== "staff" && profile.role !== "admin") continue;
    result.set(profile.id, {
      name: [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Staff member",
      role: profile.role,
    });
  }
  return result;
}
