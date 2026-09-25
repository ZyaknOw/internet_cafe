import "dotenv/config";
import { supabaseAdmin } from "./supabase.js";

async function repairAdmin() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD in backend/.env first.");
  if (password.length < 12) throw new Error("Choose a password with at least 12 characters; do not use admin123.");
  const { data: admins, error } = await supabaseAdmin.from("account_profiles").select("id, auth_user_id").eq("role", "admin").order("created_at", { ascending: true });
  if (error) throw error;
  if (admins.length !== 1 || !admins[0].auth_user_id) throw new Error("Expected exactly one linked bootstrap admin. No changes were made.");
  const admin = admins[0];
  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(admin.auth_user_id, { email, password, email_confirm: true });
  if (authError) throw authError;
  const { error: profileError } = await supabaseAdmin.from("account_profiles").update({ email, updated_at: new Date().toISOString() }).eq("id", admin.id);
  if (profileError) throw profileError;
  console.log(`Administrator login updated to ${email}. Remove BOOTSTRAP_ADMIN_PASSWORD from backend/.env now.`);
}

repairAdmin().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
