"use client";

import { useState } from "react";
import { X, UserPlus, AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

interface StaffRegisterCustomerModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function StaffRegisterCustomerModal({
  onClose,
  onSuccess,
}: StaffRegisterCustomerModalProps) {
  const [formData, setFormData] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    gender: "prefer-not-to-say",
    email: "",
    contact: "",
    address: "",
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

      // Staff registers a customer:
      // - role is strictly "customer"
      // - no password is sent
      // - status will be "pending"
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
          role: "customer",
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to register customer account");
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to register customer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="staff-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="staff-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
        <div className="staff-modal-header">
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
              <h3>Register Customer Account</h3>
              <p style={{ margin: 0, fontSize: 12, color: "#6a796e" }}>
                Front desk customer registration. Submits account for Administrator review.
              </p>
            </div>
          </div>
          <button className="staff-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Informational Notice on Workflow */}
        <div
          style={{
            padding: "12px 14px",
            background: "#fdf8ee",
            border: "1px solid #f1e0b5",
            borderRadius: 10,
            color: "#85581a",
            fontSize: 12.5,
            marginBottom: 16,
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            lineHeight: 1.45,
          }}
        >
          <ShieldAlert size={17} style={{ flexShrink: 0, marginTop: 2, color: "#b45309" }} />
          <div>
            <b style={{ color: "#78350f" }}>Pending Approval Workflow:</b>
            <p style={{ margin: "2px 0 0", color: "#92400e" }}>
              This account will be submitted with <b>Pending</b> status. Staff cannot approve accounts or generate passwords. An Administrator will review the registration in the Admin Portal and generate the customer&apos;s temporary login password upon approval.
            </p>
          </div>
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
              padding: "12px 14px",
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
            <CheckCircle2 size={16} />
            <span>Customer registered successfully! Queued for Admin approval.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
          {/* Account Role Badge (Fixed to Customer) */}
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: "#142219", display: "block", marginBottom: 6 }}>
              Account Role
            </label>
            <div
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                background: "#f5f2eb",
                border: "1px solid #e0dbcf",
                fontSize: 13,
                color: "#18452e",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>👤 Snack Customer</span>
              <span style={{ fontSize: 11, color: "#6a796e", fontWeight: 400 }}>
                (Standard user account with PC session and café access)
              </span>
            </div>
          </div>

          {/* Name Fields */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1.2fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#142219", display: "block", marginBottom: 4 }}>
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
                  borderRadius: 8,
                  border: "1px solid #d4cdbe",
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#142219", display: "block", marginBottom: 4 }}>
                Middle Name
              </label>
              <input
                type="text"
                value={formData.middleName}
                onChange={(e) => setFormData((f) => ({ ...f, middleName: e.target.value }))}
                placeholder="Optional"
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid #d4cdbe",
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#142219", display: "block", marginBottom: 4 }}>
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
                  borderRadius: 8,
                  border: "1px solid #d4cdbe",
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {/* Gender Selection */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#142219", display: "block", marginBottom: 4 }}>
              Gender
            </label>
            <select
              value={formData.gender}
              onChange={(e) => setFormData((f) => ({ ...f, gender: e.target.value }))}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: 8,
                border: "1px solid #d4cdbe",
                fontSize: 13,
                background: "#fff",
                outline: "none",
                boxSizing: "border-box",
              }}
            >
              <option value="prefer-not-to-say">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="non-binary">Non-binary</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Email & Contact */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#142219", display: "block", marginBottom: 4 }}>
                Email Address *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
                placeholder="customer@email.com"
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid #d4cdbe",
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#142219", display: "block", marginBottom: 4 }}>
                Contact Number *
              </label>
              <input
                type="tel"
                required
                value={formData.contact}
                onChange={(e) => setFormData((f) => ({ ...f, contact: e.target.value }))}
                placeholder="0917-000-0000"
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid #d4cdbe",
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#142219", display: "block", marginBottom: 4 }}>
              Complete Residential Address *
            </label>
            <input
              type="text"
              required
              value={formData.address}
              onChange={(e) => setFormData((f) => ({ ...f, address: e.target.value }))}
              placeholder="Unit / Street / Barangay / City"
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: 8,
                border: "1px solid #d4cdbe",
                fontSize: 13,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "9px 16px",
                borderRadius: 8,
                border: "1px solid #d4cdbe",
                background: "#faf8f4",
                color: "#4a584e",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "9px 20px",
                borderRadius: 8,
                border: "none",
                background: "#123725",
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Registering…" : "Register Customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
