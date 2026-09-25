import "dotenv/config";
import { supabaseAdmin } from "./supabase.js";

async function bootstrap() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD in backend/.env before running this script.");
  if (password.length < 12) throw new Error("Choose an administrator password with at least 12 characters.");
  const { count, error: countError } = await supabaseAdmin.from("account_profiles").select("id", { count: "exact", head: true });
  if (countError) throw countError;
  if ((count ?? 0) > 0) throw new Error("Bootstrap only runs on an empty account_profiles table.");
  const { data: auth, error: authError } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { role: "admin" } });
  if (authError || !auth.user) throw authError ?? new Error("Could not create Auth user");
  const { error: profileError } = await supabaseAdmin.from("account_profiles").insert({ auth_user_id: auth.user.id, first_name: "Administrator", middle_name: null, last_name: "", address: "To be updated", contact: "To be updated", email: email.toLowerCase(), role: "admin", status: "active" });
  if (profileError) throw profileError;
  console.log(`Initial administrator created for ${email}. Remove BOOTSTRAP_ADMIN_PASSWORD from backend/.env now.`);
}

bootstrap().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
