"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  User,
  Mail,
  Phone,
  MapPin,
  Hash,
  Shield,
  Eye,
  EyeOff,
  Save,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  Camera,
  Calendar,
  HeartHandshake,
  Trash2,
  Sparkles,
} from "lucide-react";
import { useAuth, AccountProfile } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrator",
  staff: "Staff Member",
  customer: "Client / Customer",
};

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  active:   { bg: "#dcfce7", color: "#166534", label: "Active" },
  approved: { bg: "#dcfce7", color: "#166534", label: "Approved" },
  pending:  { bg: "#fef9c3", color: "#854d0e", label: "Pending Approval" },
  rejected: { bg: "#fee2e2", color: "#991b1b", label: "Rejected" },
};

interface UserProfileModalProps {
  onClose: () => void;
  targetProfile?: AccountProfile | null;
  onProfileUpdated?: (profile: AccountProfile) => void;
}

type Tab = "profile" | "password";

export function UserProfileModal({ onClose, targetProfile, onProfileUpdated }: UserProfileModalProps) {
  const { profile: loggedInProfile, user, refreshProfile } = useAuth();
  
  // If targetProfile is provided (e.g. admin inspecting client/staff), use it; otherwise use logged-in user
  const isOwnProfile = !targetProfile || targetProfile.id === loggedInProfile?.id;
  const currentProfile = targetProfile ?? loggedInProfile;
  const isAdminViewingOther = !isOwnProfile && loggedInProfile?.role === "admin";

  const [tab, setTab] = useState<Tab>("profile");

  // Profile fields
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [suffix, setSuffix] = useState("");
  const [contact, setContact] = useState("");
  const [address, setAddress] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("prefer-not-to-say");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSuccess, setPwSuccess] = useState("");
  const [pwError, setPwError] = useState("");
  const [adminTempPw, setAdminTempPw] = useState<string | null>(null);

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedTempPw, setCopiedTempPw] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentProfile) {
      setFirstName(currentProfile.first_name || "");
      setMiddleName(currentProfile.middle_name || "");
      setLastName(currentProfile.last_name || "");
      setSuffix(currentProfile.suffix || "");
      setContact(currentProfile.contact || "");
      setAddress(currentProfile.address || "");
      setDateOfBirth(currentProfile.date_of_birth || "");
      setGender(currentProfile.gender || "prefer-not-to-say");
      setEmergencyContact(currentProfile.emergency_contact || "");
      setAvatarUrl(currentProfile.avatar_url || null);
    }
  }, [currentProfile]);

  const handleCopyCode = useCallback(() => {
    const code = currentProfile?.user_code || "";
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    });
  }, [currentProfile]);

  const handleCopyEmail = useCallback(() => {
    const email = currentProfile?.email || "";
    if (!email) return;
    navigator.clipboard.writeText(email).then(() => {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    });
  }, [currentProfile]);

  const handleCopyTempPw = useCallback(() => {
    if (!adminTempPw) return;
    navigator.clipboard.writeText(adminTempPw).then(() => {
      setCopiedTempPw(true);
      setTimeout(() => setCopiedTempPw(false), 2000);
    });
  }, [adminTempPw]);

  // Handle profile image upload & scale down to optimized Base64
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setProfileError("Please select a valid image file (PNG, JPG, WEBP).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 300;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const base64Url = canvas.toDataURL("image/jpeg", 0.85);
          setAvatarUrl(base64Url);
          setProfileSuccess("Profile picture selected! Click 'Save Changes' to apply.");
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setAvatarUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setProfileSuccess("Profile picture removed. Click 'Save Changes' to apply.");
  };

  // Save Profile Changes
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");

    if (!firstName.trim() || !lastName.trim()) {
      setProfileError("First name and last name are required.");
      return;
    }
    if (!contact.trim()) {
      setProfileError("Mobile/contact number is required.");
      return;
    }
    if (!address.trim()) {
      setProfileError("Complete address is required.");
      return;
    }

    setProfileSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const payload = {
        firstName: firstName.trim(),
        middleName: middleName.trim() || null,
        lastName: lastName.trim(),
        suffix: suffix.trim() || null,
        contact: contact.trim(),
        address: address.trim(),
        dateOfBirth: dateOfBirth.trim() || null,
        gender: gender || null,
        emergencyContact: emergencyContact.trim() || null,
        avatarUrl: avatarUrl,
      };

      // If updating own profile
      if (isOwnProfile) {
        if (token) {
          const res = await fetch(`${API_URL}/api/me/profile`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || "Failed to update profile");
          }
          const body = await res.json();
          if (onProfileUpdated && body.profile) onProfileUpdated(body.profile);
          await refreshProfile?.();
          setProfileSuccess("Your profile details and picture have been updated successfully!");
          return;
        }

        // Direct Supabase fallback
        if (currentProfile?.id) {
          const { data, error } = await supabase
            .from("account_profiles")
            .update({
              first_name: payload.firstName,
              middle_name: payload.middleName,
              last_name: payload.lastName,
              suffix: payload.suffix,
              contact: payload.contact,
              address: payload.address,
              date_of_birth: payload.dateOfBirth,
              gender: payload.gender,
              emergency_contact: payload.emergencyContact,
              avatar_url: payload.avatarUrl,
              updated_at: new Date().toISOString(),
            })
            .eq("id", currentProfile.id)
            .select()
            .single();

          if (error) throw new Error(error.message);
          if (onProfileUpdated && data) onProfileUpdated(data as AccountProfile);
          await refreshProfile?.();
          setProfileSuccess("Your profile details and picture have been updated successfully!");
        }
      } else if (isAdminViewingOther && currentProfile?.id) {
        // Admin updating another user's profile
        if (token) {
          const res = await fetch(`${API_URL}/api/admin/users/${currentProfile.id}/profile`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || "Failed to update user profile");
          }
          const body = await res.json();
          if (onProfileUpdated && body.profile) onProfileUpdated(body.profile);
          setProfileSuccess("User profile has been updated successfully by Administrator!");
          return;
        }

        const { data, error } = await supabase
          .from("account_profiles")
          .update({
            first_name: payload.firstName,
            middle_name: payload.middleName,
            last_name: payload.lastName,
            suffix: payload.suffix,
            contact: payload.contact,
            address: payload.address,
            date_of_birth: payload.dateOfBirth,
            gender: payload.gender,
            emergency_contact: payload.emergencyContact,
            avatar_url: payload.avatarUrl,
            updated_at: new Date().toISOString(),
          })
          .eq("id", currentProfile.id)
          .select()
          .single();

        if (error) throw new Error(error.message);
        if (onProfileUpdated && data) onProfileUpdated(data as AccountProfile);
        setProfileSuccess("User profile has been updated successfully!");
      }
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  // Delete account (for administrator inspecting another account)
  const handleDeleteAccount = async () => {
    if (!currentProfile?.id) return;
    const fullName = `${currentProfile.first_name} ${currentProfile.last_name}`;
    if (!window.confirm(`Are you sure you want to permanently delete the account of "${fullName}"? This action cannot be undone.`)) return;

    setProfileSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`${API_URL}/api/admin/users/${currentProfile.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || "Failed to delete user account");
      }

      alert(`Account for "${fullName}" has been deleted.`);
      onClose();
      if (typeof window !== "undefined") window.location.reload();
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to delete account");
    } finally {
      setProfileSaving(false);
    }
  };

  // Password Change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError("");
    setPwSuccess("");

    if (newPassword.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("Passwords do not match.");
      return;
    }

    setPwSaving(true);
    try {
      if (isOwnProfile) {
        const email = currentProfile?.email || user?.email || "";
        if (currentPassword && email) {
          const { error: reAuthError } = await supabase.auth.signInWithPassword({
            email,
            password: currentPassword,
          });
          if (reAuthError) throw new Error("Current / temporary password is incorrect.");
        }

        const { error: updateError } = await supabase.auth.updateUser({
          password: newPassword,
          data: { must_change_password: false },
        });
        if (updateError) throw new Error(updateError.message);

        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            await fetch(`${API_URL}/api/auth/complete-password-change`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            });
          }
        } catch {
          if (currentProfile?.id) {
            await supabase.from("account_profiles").update({ must_change_password: false }).eq("id", currentProfile.id);
          }
        }

        await refreshProfile?.();
        setPwSuccess("Password successfully changed! Your account is now secured.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else if (isAdminViewingOther && currentProfile?.id) {
        setPwSuccess("Password updated for user!");
      }
    } catch (err: unknown) {
      setPwError(err instanceof Error ? err.message : "Failed to change password.");
    } finally {
      setPwSaving(false);
    }
  };

  // Admin resets or generates new temporary password for user
  const handleAdminResetPassword = async () => {
    if (!currentProfile?.id) return;
    setPwError("");
    setPwSuccess("");
    setPwSaving(true);

    try {
      const lettersUpper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
      const lettersLower = "abcdefghijkmnpqrstuvwxyz";
      const numbers = "23456789";
      const specials = "!@#$%&*";
      const pick = (set: string) => set.charAt(Math.floor(Math.random() * set.length));
      let temp = "Eth-" + pick(lettersUpper) + pick(lettersLower) + pick(numbers) + pick(specials);
      const all = lettersUpper + lettersLower + numbers + specials;
      for (let i = 0; i < 4; i++) temp += pick(all);

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (token) {
        const res = await fetch(`${API_URL}/api/admin/account-requests/${currentProfile.id}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setAdminTempPw(data.temporaryPassword || temp);
          setPwSuccess("Temporary password generated! Provide this password to the user.");
          return;
        }
      }

      setAdminTempPw(temp);
      setPwSuccess("Temporary password generated!");
    } catch (err: unknown) {
      setPwError(err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
      setPwSaving(false);
    }
  };

  const statusMeta = STATUS_COLORS[currentProfile?.status ?? "pending"] ?? STATUS_COLORS.pending;
  const roleLabel = ROLE_LABEL[currentProfile?.role ?? "customer"] ?? "User";
  const memberSince = currentProfile?.created_at
    ? new Date(currentProfile.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })
    : "—";  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        backdropFilter: "blur(4px)",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 20,
          width: "100%",
          maxWidth: 620,
          maxHeight: "92vh",
          overflowY: "auto",
          boxShadow: "0 32px 80px rgba(0,0,0,0.35)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Top Header with Avatar Banner */}
        <div
          style={{
            background: "linear-gradient(135deg, #132a1f 0%, #20402e 100%)",
            borderRadius: "20px 20px 0 0",
            padding: "24px 28px 20px",
            position: "relative",
            color: "#fff",
          }}
        >
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              background: "rgba(255,255,255,0.15)",
              border: "none",
              color: "#fff",
              borderRadius: "50%",
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
            aria-label="Close modal"
          >
            <X size={16} />
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            {/* Avatar Circle with Upload Trigger */}
            <div style={{ position: "relative" }}>
              <div
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #c9a96a, #e8d5a3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 30,
                  fontWeight: 700,
                  color: "#1a2e22",
                  border: "3px solid rgba(255,255,255,0.4)",
                  overflow: "hidden",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
                }}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Profile"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  (currentProfile?.first_name?.[0] ?? "U").toUpperCase()
                )}
              </div>

              {/* Upload button overlay */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  position: "absolute",
                  bottom: -2,
                  right: -2,
                  background: "#16241b",
                  border: "2px solid #e8d5a3",
                  color: "#e8d5a3",
                  borderRadius: "50%",
                  width: 28,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                }}
                title="Upload Profile Picture"
                aria-label="Upload profile picture"
              >
                <Camera size={14} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleImageUpload}
              />
            </div>

            {/* Profile Identifiers */}
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ background: "rgba(255,255,255,0.18)", color: "#e8d5a3", fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 20, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {roleLabel}
                </span>
                <span style={{ background: statusMeta.bg, color: statusMeta.color, fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
                  {statusMeta.label}
                </span>
              </div>

              <h2 id="profile-modal-title" style={{ color: "#fff", fontSize: 22, margin: "0 0 4px", fontFamily: "Georgia, serif" }}>
                {currentProfile ? `${currentProfile.first_name} ${currentProfile.last_name} ${currentProfile.suffix ?? ""}`.trim() : "User Profile"}
              </h2>

              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 6 }}>
                {/* NetCafe ID pill */}
                {currentProfile?.user_code && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.12)", borderRadius: 8, padding: "4px 10px", fontSize: 13 }}>
                    <Hash size={13} color="#e8d5a3" />
                    <span style={{ color: "#e8d5a3", fontWeight: 700, letterSpacing: 0.5 }}>{currentProfile.user_code}</span>
                    <button onClick={handleCopyCode} style={{ background: "none", border: "none", color: "#e8d5a3", cursor: "pointer", padding: 2, display: "flex" }} title="Copy NetCafe ID">
                      {copiedCode ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  </div>
                )}

                {/* Email pill */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.12)", borderRadius: 8, padding: "4px 10px", fontSize: 13, color: "rgba(255,255,255,0.9)" }}>
                  <Mail size={13} color="#e8d5a3" />
                  <span>{currentProfile?.email ?? "—"}</span>
                  <button onClick={handleCopyEmail} style={{ background: "none", border: "none", color: "#e8d5a3", cursor: "pointer", padding: 2, display: "flex" }} title="Copy Email">
                    {copiedEmail ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Photo quick action note */}
          {avatarUrl && (
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={handleRemovePhoto}
                style={{
                  background: "rgba(220, 38, 38, 0.2)",
                  border: "1px solid rgba(239, 68, 68, 0.4)",
                  color: "#fca5a5",
                  borderRadius: 6,
                  padding: "4px 8px",
                  fontSize: 11,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  cursor: "pointer",
                }}
              >
                <Trash2 size={12} /> Remove Picture
              </button>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.65)" }}>Click Save Changes below to apply</span>
            </div>
          )}
        </div>

        {/* Info Highlights Strip */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: "1px solid #ede9e0", background: "#faf8f4" }}>
          <div style={{ padding: "10px 16px", borderRight: "1px solid #ede9e0" }}>
            <small style={{ display: "block", color: "#6b6558", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase" }}>Registration Status</small>
            <b style={{ fontSize: 12.5, color: "#166534" }}>{statusMeta.label}</b>
          </div>
          <div style={{ padding: "10px 16px", borderRight: "1px solid #ede9e0" }}>
            <small style={{ display: "block", color: "#6b6558", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase" }}>System Role</small>
            <b style={{ fontSize: 12.5, color: "#16241b" }}>{roleLabel}</b>
          </div>
          <div style={{ padding: "10px 16px" }}>
            <small style={{ display: "block", color: "#6b6558", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase" }}>Member Since</small>
            <b style={{ fontSize: 12.5, color: "#16241b" }}>{memberSince}</b>
          </div>
        </div>

        {/* Tab Selection */}
        <div style={{ display: "flex", borderBottom: "1px solid #ede9e0", background: "#ffffff" }}>
          {(["profile", "password"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: "13px 16px",
                border: "none",
                cursor: "pointer",
                background: "none",
                borderBottom: tab === t ? "3px solid #1a2e22" : "3px solid transparent",
                color: tab === t ? "#1a2e22" : "#6b6558",
                fontWeight: tab === t ? 700 : 500,
                fontSize: 13.5,
                transition: "all 0.15s",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                {t === "profile" ? (
                  <>
                    <User size={15} /> All Profile &amp; Registration Info
                  </>
                ) : (
                  <>
                    <KeyRound size={15} /> Password &amp; Credentials
                  </>
                )}
              </span>
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div style={{ padding: "22px 28px 28px" }}>
          {/* ══════════════ TAB 1: FULL PROFILE DETAILS ══════════════ */}
          {tab === "profile" && (
            <form onSubmit={handleSaveProfile} style={{ display: "grid", gap: 15 }}>
              {profileError && (
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#fdf0ed", border: "1px solid #f5b8a8", borderRadius: 10, padding: "10px 12px" }}>
                  <AlertCircle size={16} color="#b8452e" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 13, color: "#7a2918" }}>{profileError}</span>
                </div>
              )}
              {profileSuccess && (
                <div style={{ display: "flex", gap: 8, alignItems: "center", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "10px 12px" }}>
                  <CheckCircle2 size={16} color="#166534" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "#166534", fontWeight: 500 }}>{profileSuccess}</span>
                </div>
              )}

              {/* Photo selection indicator */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8f5ee", padding: "10px 14px", borderRadius: 10, border: "1px solid #e9e4d8" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Camera size={16} color="#1f3d2b" />
                  <span style={{ fontSize: 13, color: "#374151" }}>
                    {avatarUrl ? "Custom profile picture is set." : "No profile picture uploaded yet."}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    background: "#1f3d2b",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {avatarUrl ? "Change Photo" : "Upload Photo"}
                </button>
              </div>

              {/* Row 1: Name Breakdown */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#374151", marginBottom: 5 }}>
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First Name"
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13.5, background: "#fafafa" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#374151", marginBottom: 5 }}>
                    Middle Name <span style={{ color: "#9ca3af", fontWeight: 400 }}>(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    placeholder="Middle Name"
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13.5, background: "#fafafa" }}
                  />
                </div>
              </div>

              {/* Row 2: Last Name & Suffix */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#374151", marginBottom: 5 }}>
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last Name"
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13.5, background: "#fafafa" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#374151", marginBottom: 5 }}>
                    Suffix <span style={{ color: "#9ca3af", fontWeight: 400 }}>(e.g. Jr.)</span>
                  </label>
                  <input
                    type="text"
                    value={suffix}
                    onChange={(e) => setSuffix(e.target.value)}
                    placeholder="Jr., III"
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13.5, background: "#fafafa" }}
                  />
                </div>
              </div>

              {/* Row 3: Contacts */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#374151", marginBottom: 5 }}>
                    Mobile / Contact Number *
                  </label>
                  <div style={{ position: "relative" }}>
                    <Phone size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
                    <input
                      type="tel"
                      required
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      placeholder="09XXXXXXXXX"
                      style={{ width: "100%", padding: "10px 12px 10px 32px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13.5, background: "#fafafa" }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#374151", marginBottom: 5 }}>
                    Emergency Contact
                  </label>
                  <div style={{ position: "relative" }}>
                    <HeartHandshake size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
                    <input
                      type="text"
                      value={emergencyContact}
                      onChange={(e) => setEmergencyContact(e.target.value)}
                      placeholder="Name / 09XXXXXXXXX"
                      style={{ width: "100%", padding: "10px 12px 10px 32px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13.5, background: "#fafafa" }}
                    />
                  </div>
                </div>
              </div>

              {/* Row 4: Date of Birth & Gender */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#374151", marginBottom: 5 }}>
                    Date of Birth
                  </label>
                  <div style={{ position: "relative" }}>
                    <Calendar size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
                    <input
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      style={{ width: "100%", padding: "10px 12px 10px 32px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13.5, background: "#fafafa" }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#374151", marginBottom: 5 }}>
                    Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13.5, background: "#fafafa" }}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="prefer-not-to-say">Prefer not to say</option>
                  </select>
                </div>
              </div>

              {/* Complete Address */}
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#374151", marginBottom: 5 }}>
                  Complete Address *
                </label>
                <div style={{ position: "relative" }}>
                  <MapPin size={14} style={{ position: "absolute", left: 10, top: 12, color: "#9ca3af" }} />
                  <textarea
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={2}
                    placeholder="Street, Barangay, City, Province"
                    style={{ width: "100%", padding: "10px 12px 10px 32px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13.5, background: "#fafafa", resize: "vertical" }}
                  />
                </div>
              </div>

              {/* Readonly info note */}
              <div style={{ background: "#f8f5ee", border: "1px solid #e9e4d8", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#6b6558" }}>
                Registered Email: <b style={{ color: "#16241b" }}>{currentProfile?.email ?? "—"}</b> · NetCafe ID: <b style={{ color: "#16241b" }}>{currentProfile?.user_code ?? "—"}</b>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={profileSaving}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  background: profileSaving ? "#9ca3af" : "#132a1f",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "12px 20px",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: profileSaving ? "not-allowed" : "pointer",
                  marginTop: 6,
                }}
              >
                {profileSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {profileSaving ? "Saving Details…" : "Save Details & Profile Picture"}
              </button>

              {isAdminViewingOther && (
                <div style={{ marginTop: 8, paddingTop: 14, borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={profileSaving}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "1px solid #fca5a5",
                      background: "#fff",
                      color: "#dc2626",
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={14} /> Delete Account Permanently
                  </button>
                </div>
              )}
            </form>
          )}

          {/* ══════════════ TAB 2: PASSWORD & SECURITY ══════════════ */}
          {tab === "password" && (
            <div>
              {/* Temporary Password banner if active */}
              {currentProfile?.must_change_password && (
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#fef9c3", border: "1px solid #fde047", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
                  <KeyRound size={16} color="#854d0e" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ margin: "0 0 2px", fontSize: 13.5, fontWeight: 700, color: "#78350f" }}>
                      Admin Temporary Password Active
                    </p>
                    <p style={{ margin: 0, fontSize: 12.5, color: "#92400e", lineHeight: 1.5 }}>
                      This account was initialized with a temporary password given by the administrator. Set a secure personal password below to complete account setup.
                    </p>
                  </div>
                </div>
              )}

              {pwError && (
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#fdf0ed", border: "1px solid #f5b8a8", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
                  <AlertCircle size={16} color="#b8452e" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 13, color: "#7a2918" }}>{pwError}</span>
                </div>
              )}
              {pwSuccess && (
                <div style={{ display: "flex", gap: 8, alignItems: "center", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
                  <CheckCircle2 size={16} color="#166534" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "#166534", fontWeight: 500 }}>{pwSuccess}</span>
                </div>
              )}

              {/* Admin viewing other user: can generate a new temporary password */}
              {isAdminViewingOther ? (
                <div style={{ background: "#f5f2eb", border: "1px solid #e2ddd3", borderRadius: 12, padding: 18 }}>
                  <h4 style={{ margin: "0 0 6px", fontSize: 14, color: "#16241b" }}>Administrator Password Management</h4>
                  <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "#616f64" }}>
                    Generate a fresh temporary password for this user. They will be prompted to change it upon their next sign-in.
                  </p>

                  <button
                    type="button"
                    onClick={handleAdminResetPassword}
                    disabled={pwSaving}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      background: "#132a1f",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      padding: "10px 16px",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: pwSaving ? "not-allowed" : "pointer",
                    }}
                  >
                    {pwSaving ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    Generate New Temporary Password
                  </button>

                  {adminTempPw && (
                    <div style={{ marginTop: 14, background: "#ffffff", border: "1.5px dashed #166534", borderRadius: 10, padding: 14 }}>
                      <small style={{ display: "block", color: "#616f64", fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>
                        Generated Temporary Password
                      </small>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                        <code style={{ fontSize: 16, fontWeight: 700, color: "#132a1f", letterSpacing: 1 }}>{adminTempPw}</code>
                        <button
                          type="button"
                          onClick={handleCopyTempPw}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            background: "#dcfce7",
                            color: "#166534",
                            border: "none",
                            borderRadius: 6,
                            padding: "6px 12px",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          {copiedTempPw ? <Check size={13} /> : <Copy size={13} />}
                          {copiedTempPw ? "Copied!" : "Copy Password"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* User changing own password */
                <form onSubmit={handleChangePassword} style={{ display: "grid", gap: 15 }}>
                  {/* Current Password */}
                  <div>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#374151", marginBottom: 5 }}>
                      Current / Admin-Given Password
                    </label>
                    <div style={{ position: "relative" }}>
                      <KeyRound size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
                      <input
                        type={showCurrent ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter temporary or current password"
                        style={{ width: "100%", padding: "10px 38px 10px 32px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13.5, background: "#fafafa" }}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrent(!showCurrent)}
                        style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#9ca3af", cursor: "pointer", padding: 2, display: "flex" }}
                      >
                        {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    <small style={{ color: "#6b6558", fontSize: 11.5, marginTop: 4, display: "block" }}>
                      Enter the temporary password given by the admin if this is your first time updating your password.
                    </small>
                  </div>

                  {/* New Password */}
                  <div>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#374151", marginBottom: 5 }}>
                      New Personal Password * (min 8 characters)
                    </label>
                    <div style={{ position: "relative" }}>
                      <KeyRound size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
                      <input
                        type={showNew ? "text" : "password"}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Create strong new password"
                        style={{ width: "100%", padding: "10px 38px 10px 32px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13.5, background: "#fafafa" }}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew(!showNew)}
                        style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#9ca3af", cursor: "pointer", padding: 2, display: "flex" }}
                      >
                        {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>

                    {/* Strength meter */}
                    {newPassword.length > 0 && (
                      <div style={{ marginTop: 6, display: "flex", gap: 4, alignItems: "center" }}>
                        {[8, 10, 12].map((len, i) => (
                          <div
                            key={i}
                            style={{
                              height: 4,
                              flex: 1,
                              borderRadius: 4,
                              background: newPassword.length >= len ? (len === 8 ? "#fbbf24" : len === 10 ? "#34d399" : "#059669") : "#e5e7eb",
                              transition: "background 0.3s",
                            }}
                          />
                        ))}
                        <span style={{ fontSize: 11, color: "#6b7280", marginLeft: 4 }}>
                          {newPassword.length < 8 ? "Too short" : newPassword.length < 10 ? "Fair" : newPassword.length < 12 ? "Good" : "Strong"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#374151", marginBottom: 5 }}>
                      Confirm New Password *
                    </label>
                    <div style={{ position: "relative" }}>
                      <KeyRound size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
                      <input
                        type={showConfirm ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-type new password"
                        style={{ width: "100%", padding: "10px 38px 10px 32px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13.5, background: "#fafafa" }}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#9ca3af", cursor: "pointer", padding: 2, display: "flex" }}
                      >
                        {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {confirmPassword && confirmPassword !== newPassword && (
                      <small style={{ color: "#dc2626", fontSize: 11.5, marginTop: 4, display: "block" }}>
                        Passwords do not match.
                      </small>
                    )}
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={pwSaving}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      background: pwSaving ? "#9ca3af" : "#132a1f",
                      color: "#fff",
                      border: "none",
                      borderRadius: 10,
                      padding: "12px 20px",
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: pwSaving ? "not-allowed" : "pointer",
                      marginTop: 4,
                    }}
                  >
                    {pwSaving ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                    {pwSaving ? "Updating Password…" : "Save New Password"}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
