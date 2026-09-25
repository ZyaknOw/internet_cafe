"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail, X, AlertCircle, CheckCircle2, KeyRound } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase/client";

interface AuthModalProps {
  onClose: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function AuthModal({ onClose }: AuthModalProps) {
  const router = useRouter();
  const { login, authError, clearAuthError } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotError, setForgotError] = useState("");

  // Must change password state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changeError, setChangeError] = useState("");
  const [changeSubmitting, setChangeSubmitting] = useState(false);

  const clearErrors = useCallback(() => {
    setFieldErrors({});
    clearAuthError();
  }, [clearAuthError]);

  const validate = useCallback(() => {
    const next: Record<string, string> = {};
    if (!email.trim()) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Enter a valid email address";
    if (!password) next.password = "Password is required";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }, [email, password]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    const result = await login(email.trim(), password);
    setSubmitting(false);

    if (result.error) return;

    if (result.mustChangePassword) {
      setShowChangePassword(true);
      return;
    }

    onClose();
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setForgotError("Enter the email address for your account.");
      return;
    }
    setForgotSubmitting(true);
    setForgotError("");
    const redirectTo = `${window.location.origin}/auth/set-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), { redirectTo });
    setForgotSubmitting(false);
    if (error) {
      setForgotError(error.message);
    } else {
      setForgotSuccess(true);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangeError("");

    if (newPassword.length < 8) {
      setChangeError("Password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setChangeError("Passwords do not match.");
      return;
    }

    setChangeSubmitting(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        data: { must_change_password: false },
      });

      if (updateError) throw new Error(updateError.message);

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await fetch(`${API_URL}/api/auth/complete-password-change`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        });
      }

      onClose();
    } catch (err: unknown) {
      setChangeError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setChangeSubmitting(false);
    }
  };

  const handleSignupClick = () => {
    onClose();
    router.push("/signup");
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="legal-overlay" onMouseDown={handleOverlayClick} role="dialog" aria-modal="true" aria-labelledby="auth-heading">
      <div className="legal-modal auth-modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div style={{ position: "relative" }}>
          <button
            onClick={onClose}
            className="icon-button"
            style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 4, zIndex: 2 }}
            aria-label="Close authentication"
          >
            <X size={20} aria-hidden="true" />
          </button>

          <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
            <div
              style={{
                flex: 1,
                padding: "16px",
                borderBottom: "3px solid var(--olive)",
                color: "var(--olive)",
                fontWeight: 700,
                fontSize: 15,
                fontFamily: "Georgia, serif",
                textAlign: "center",
              }}
            >
              {showChangePassword ? "Set Personal Password" : showForgot ? "Reset Password" : "Log In"}
            </div>
          </div>
        </div>

        {/* ----- MUST CHANGE PASSWORD PANEL ----- */}
        {showChangePassword ? (
          <div style={{ padding: "24px 28px 28px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#fef3c7", color: "#92400e", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <KeyRound size={18} />
              </div>
              <h2 id="auth-heading" style={{ fontSize: 20, margin: 0, fontFamily: "Georgia, serif" }}>
                Create Your Password
              </h2>
            </div>
            <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "0 0 16px", lineHeight: 1.5 }}>
              Your account was activated using a temporary password. Please set a secure personal password to continue.
            </p>

            {changeError && (
              <div role="alert" style={{ display: "flex", gap: 8, alignItems: "center", background: "#fdf0ed", border: "1px solid #f5b8a8", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
                <AlertCircle size={15} color="#b8452e" />
                <span style={{ fontSize: 13, color: "#7a2918" }}>{changeError}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={{ fontWeight: 700, fontSize: 13, marginBottom: 5, display: "block" }}>
                  New Password (min 8 characters)
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="auth-input"
                  autoFocus
                />
              </div>

              <div>
                <label style={{ fontWeight: 700, fontSize: 13, marginBottom: 5, display: "block" }}>
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="auth-input"
                />
              </div>

              <button type="submit" disabled={changeSubmitting} className="auth-submit" style={{ marginTop: 6 }}>
                {changeSubmitting ? "Saving New Password…" : "Save & Continue to Portal"}
              </button>
            </form>
          </div>
        ) : showForgot ? (
          /* ----- FORGOT PASSWORD PANEL ----- */
          <div style={{ padding: "24px 28px 28px" }}>
            <h2 id="auth-heading" style={{ fontSize: 22, margin: "0 0 6px", fontFamily: "Georgia, serif" }}>
              Reset your password
            </h2>
            <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 20px" }}>
              Enter your account email and we&apos;ll send you a reset link.
            </p>

            {forgotSuccess ? (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#edf7ed", border: "1px solid #a3d9a5", borderRadius: 10, padding: "14px 16px" }}>
                <CheckCircle2 size={18} color="#2e7d32" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ margin: 0, fontSize: 14, color: "#1b5e20", lineHeight: 1.5 }}>
                  Password reset email sent to <strong>{forgotEmail}</strong>. Check your inbox.
                </p>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} style={{ display: "grid", gap: 14 }}>
                <div style={{ position: "relative" }}>
                  <Mail size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => { setForgotEmail(e.target.value); setForgotError(""); }}
                    placeholder="you@example.com"
                    className="auth-input"
                    style={{ paddingLeft: 40 }}
                    autoComplete="email"
                    autoFocus
                  />
                </div>
                {forgotError && (
                  <p className="field-error" role="alert">
                    <AlertCircle size={13} /> {forgotError}
                  </p>
                )}
                <button type="submit" disabled={forgotSubmitting} className="auth-submit">
                  {forgotSubmitting ? "Sending…" : "Send Reset Link"}
                </button>
              </form>
            )}

            <p style={{ textAlign: "center", fontSize: 14, color: "var(--muted)", margin: "16px 0 0" }}>
              <button
                type="button"
                onClick={() => { setShowForgot(false); setForgotSuccess(false); setForgotError(""); }}
                style={{ background: "none", border: "none", color: "var(--gold-dark)", cursor: "pointer", fontSize: 14, textDecoration: "underline" }}
              >
                ← Back to Log In
              </button>
            </p>
          </div>
        ) : (
          /* ----- STANDARD LOGIN PANEL ----- */
          <div id="panel-login" role="tabpanel" style={{ padding: "24px 28px 28px" }}>
            <h2 id="auth-heading" style={{ fontSize: 26, margin: "0 0 6px", fontFamily: "Georgia, serif" }}>
              Welcome back
            </h2>
            <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 22px" }}>
              Sign in to access your ETHER.CAFE portal.
            </p>

            {/* Global auth error from context */}
            {authError && (
              <div
                role="alert"
                style={{
                  display: "flex",
                  gap: 9,
                  alignItems: "flex-start",
                  background: "#fdf0ed",
                  border: "1px solid #f5b8a8",
                  borderRadius: 10,
                  padding: "12px 14px",
                  marginBottom: 16,
                }}
              >
                <AlertCircle size={16} color="#b8452e" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ margin: 0, fontSize: 13.5, color: "#7a2918", lineHeight: 1.45 }}>{authError}</p>
              </div>
            )}

            {successMsg && (
              <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: "#edf7ed", border: "1px solid #a3d9a5", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
                <CheckCircle2 size={16} color="#2e7d32" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ margin: 0, fontSize: 13.5, color: "#1b5e20" }}>{successMsg}</p>
              </div>
            )}

            <form onSubmit={handleLogin} noValidate style={{ display: "grid", gap: 16 }}>
              {/* Email */}
              <div>
                <label htmlFor="login-email" style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, display: "block" }}>
                  Email Address
                </label>
                <div style={{ position: "relative" }}>
                  <Mail size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} aria-hidden="true" />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); clearErrors(); }}
                    placeholder="you@example.com"
                    className="auth-input"
                    style={{ paddingLeft: 40 }}
                    aria-invalid={!!fieldErrors.email}
                    aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
                    autoComplete="email"
                    autoFocus
                  />
                </div>
                {fieldErrors.email && (
                  <p id="login-email-error" className="field-error" role="alert">
                    <AlertCircle size={13} aria-hidden="true" /> {fieldErrors.email}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="login-password" style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, display: "block" }}>
                  Password
                </label>
                <div style={{ position: "relative" }}>
                  <Lock size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} aria-hidden="true" />
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); clearErrors(); }}
                    placeholder="Enter your password"
                    className="auth-input"
                    style={{ paddingLeft: 40, paddingRight: 44 }}
                    aria-invalid={!!fieldErrors.password}
                    aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 4 }}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p id="login-password-error" className="field-error" role="alert">
                    <AlertCircle size={13} aria-hidden="true" /> {fieldErrors.password}
                  </p>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 14 }}>
                <button
                  type="button"
                  onClick={() => { setShowForgot(true); clearErrors(); setSuccessMsg(""); }}
                  style={{ background: "none", border: "none", color: "var(--gold-dark)", cursor: "pointer", fontSize: 14, textDecoration: "underline" }}
                >
                  Forgot Password?
                </button>
              </div>

              <button type="submit" disabled={submitting} className="auth-submit">
                {submitting ? "Signing in…" : "Log In"}
              </button>

              <p style={{ textAlign: "center", fontSize: 14, color: "var(--muted)", margin: 0 }}>
                Don&apos;t have an account yet?{" "}
                <button
                  type="button"
                  onClick={handleSignupClick}
                  style={{ background: "none", border: "none", color: "var(--gold-dark)", cursor: "pointer", fontSize: 14, fontWeight: 700, textDecoration: "underline", padding: 0 }}
                >
                  Register here
                </button>
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
