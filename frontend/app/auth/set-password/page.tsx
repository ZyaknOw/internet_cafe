"use client";

import { useState } from "react";
import { CheckCircle2, KeyRound } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/lib/supabase/client";

export default function SetPasswordPage() {
  const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const submit = async () => { if (password.length < 8) return setError("Use at least 8 characters."); if (password !== confirm) return setError("Passwords do not match."); setError(""); const { error: authError } = await supabase.auth.updateUser({ password }); if (authError) return setError(authError.message); try { await apiFetch("/api/auth/activate-profile", { method: "POST" }); setMessage("Password created. Your NetCafe account is active—you can now sign in."); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Could not activate profile"); } };
  return <main className="client-portal"><section className="client-shell"><div className="client-signin"><div className="client-icon"><KeyRound size={26} /></div><p className="client-kicker">NETCAFE ACCOUNT SETUP</p><h1>Create your password</h1><p>Your administrator approved this account. Choose a secure password to activate it.</p>{message ? <div className="activation-success"><CheckCircle2 size={21} /> {message}</div> : <><label>New password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><label>Confirm password<input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submit()} /></label>{error && <div className="client-error">{error}</div>}<button onClick={submit}>Activate Account</button></>}</div></section></main>;
}
