"use client";

import { useState } from "react";
import { X, UserPlus, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

interface RegisterUserModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function RegisterUserModal({ onClose, onSuccess }: RegisterUserModalProps) {
  const [formData, setFormData] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    gender: "prefer-not-to-say",
    email: "",
    contact: "",
    address: "",
    role: "customer" as "customer" | "staff",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // 1. Submit to /api/account-requests
      const response = await fetch(`${API_URL}/api/account-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          firstName: formData.firstName.trim(),
          middleName: formData.middleName.trim() || undefined,
          lastName: formData.lastName.trim(),
          gender: formData.gender,
          email: formData.email.trim().toLowerCase(),
          contact: formData.contact.trim(),
          address: formData.address.trim(),
          role: formData.role,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to create account");
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to register user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="admin-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
        <div className="admin-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "#eaf3ed",
                color: "#18452e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <UserPlus size={16} />
            </div>
            <div>
              <h3>Register New User</h3>
              <p style={{ margin: 0, fontSize: 12, color: "#6a796e" }}>
                Creates a pending account. A temporary password will be generated upon approval.
              </p>
            </div>
          </div>
          <button className="admin-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              padding: "10px 14px",
              background: "#fee2e2",
              border: "1px solid #f87171",
              borderRadius: 10,
              color: "#991b1b",
              fontSize: 13,
              marginBottom: 14,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div
            role="status"
            style={{
              padding: "10px 14px",
              background: "#dcfce7",
              border: "1px solid #86efac",
              borderRadius: 10,
              color: "#166534",
              fontSize: 13,
              marginBottom: 14,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <CheckCircle2 size={15} />
            <span>User registered successfully as Pending!</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
          {/* Role selector */}
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: "#142219", display: "block", marginBottom: 6 }}>
              Account Role *
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button
                type="button"
                onClick={() => setFormData((f) => ({ ...f, role: "customer" }))}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: `2px solid ${formData.role === "customer" ? "#1b4d36" : "#e0dbcf"}`,
                  background: formData.role === "customer" ? "#eaf4ee" : "#faf8f4",
                  color: formData.role === "customer" ? "#123725" : "#556358",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "all 0.15s",
                }}
              >
                Customer / Client
              </button>
              <button
                type="button"
                onClick={() => setFormData((f) => ({ ...f, role: "staff" }))}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: `2px solid ${formData.role === "staff" ? "#1b4d36" : "#e0dbcf"}`,
                  background: formData.role === "staff" ? "#eaf4ee" : "#faf8f4",
                  color: formData.role === "staff" ? "#123725" : "#556358",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "all 0.15s",
                }}
              >
                Staff Member
              </button>
            </div>
          </div>

          {/* First & Last Name */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "#142219", display: "block", marginBottom: 5 }}>
                First Name *
              </label>
              <input
                type="text"
                required
                value={formData.firstName}
                onChange={(e) => setFormData((f) => ({ ...f, firstName: e.target.value }))}
                placeholder="e.g. Maria"
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  border: "1px solid #dfd8cb",
                  borderRadius: 10,
                  fontSize: 13,
                  outline: 0,
                  background: "#faf8f4",
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "#142219", display: "block", marginBottom: 5 }}>
                Last Name *
              </label>
              <input
                type="text"
                required
                value={formData.lastName}
                onChange={(e) => setFormData((f) => ({ ...f, lastName: e.target.value }))}
                placeholder="e.g. Santos"
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  border: "1px solid #dfd8cb",
                  borderRadius: 10,
                  fontSize: 13,
                  outline: 0,
                  background: "#faf8f4",
                }}
              />
            </div>
          </div>

          {/* Middle Name & Gender */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "#142219", display: "block", marginBottom: 5 }}>
                Middle Name (Optional)
              </label>
              <input
                type="text"
                value={formData.middleName}
                onChange={(e) => setFormData((f) => ({ ...f, middleName: e.target.value }))}
                placeholder="e.g. Cruz"
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  border: "1px solid #dfd8cb",
                  borderRadius: 10,
                  fontSize: 13,
                  outline: 0,
                  background: "#faf8f4",
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "#142219", display: "block", marginBottom: 5 }}>
                Gender
              </label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData((f) => ({ ...f, gender: e.target.value }))}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  border: "1px solid #dfd8cb",
                  borderRadius: 10,
                  fontSize: 13,
                  outline: 0,
                  background: "#faf8f4",
                }}
              >
                <option value="prefer-not-to-say">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: "#142219", display: "block", marginBottom: 5 }}>
              Email Address *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
              placeholder="e.g. user@example.com"
              style={{
                width: "100%",
                padding: "9px 12px",
                border: "1px solid #dfd8cb",
                borderRadius: 10,
                fontSize: 13,
                outline: 0,
                background: "#faf8f4",
              }}
            />
          </div>

          {/* Contact Number */}
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: "#142219", display: "block", marginBottom: 5 }}>
              Contact Number *
            </label>
            <input
              type="tel"
              required
              value={formData.contact}
              onChange={(e) => setFormData((f) => ({ ...f, contact: e.target.value }))}
              placeholder="09xx xxx xxxx"
              style={{
                width: "100%",
                padding: "9px 12px",
                border: "1px solid #dfd8cb",
                borderRadius: 10,
                fontSize: 13,
                outline: 0,
                background: "#faf8f4",
              }}
            />
          </div>

          {/* Address */}
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: "#142219", display: "block", marginBottom: 5 }}>
              Address *
            </label>
            <textarea
              required
              rows={2}
              value={formData.address}
              onChange={(e) => setFormData((f) => ({ ...f, address: e.target.value }))}
              placeholder="Complete home or business address"
              style={{
                width: "100%",
                padding: "9px 12px",
                border: "1px solid #dfd8cb",
                borderRadius: 10,
                fontSize: 13,
                outline: 0,
                background: "#faf8f4",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </div>

          <div
            style={{
              background: "#f7efe4",
              border: "1px solid #ebd9c2",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 12,
              color: "#734e26",
            }}
          >
            ℹ️ <b>Note:</b> You do not need to enter a password. The account is created with status <b>PENDING</b>. When you approve it, a temporary password will be generated automatically for the user.
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "9px 16px",
                borderRadius: 10,
                border: "1px solid #d4cebe",
                background: "none",
                fontSize: 13,
                cursor: "pointer",
                color: "#526056",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "9px 20px",
                borderRadius: 10,
                border: "none",
                background: "#133827",
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(19, 56, 39, 0.25)",
              }}
            >
              {loading ? "Registering…" : "Register Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
