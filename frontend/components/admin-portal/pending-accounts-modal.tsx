"use client";

import { useEffect, useState } from "react";
import {
  X,
  UserCheck,
  UserX,
  CheckCircle2,
  Copy,
  Check,
  AlertTriangle,
  UserPlus,
  RefreshCw,
  KeyRound,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

interface PendingAccount {
  id: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  email: string;
  contact: string;
  role: "customer" | "staff" | "admin";
  status: "pending" | "approved" | "active" | "rejected";
  created_at: string;
}

interface PendingAccountsModalProps {
  onClose: () => void;
  onOpenRegister: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function PendingAccountsModal({ onClose, onOpenRegister }: PendingAccountsModalProps) {
  const [accounts, setAccounts] = useState<PendingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [confirmApprove, setConfirmApprove] = useState<PendingAccount | null>(null);
  const [confirmReject, setConfirmReject] = useState<PendingAccount | null>(null);
  const [approvedResult, setApprovedResult] = useState<{
    account: PendingAccount;
    tempPassword: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchPending = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`${API_URL}/api/admin/account-requests`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error("Failed to fetch pending requests");
      const data = await res.json() as { requests: PendingAccount[] };
      setAccounts(data.requests ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading pending accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPending();
  }, []);

  const handleApprove = async (acc: PendingAccount) => {
    setActionLoading(acc.id);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`${API_URL}/api/admin/account-requests/${acc.id}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || "Failed to approve account");
      }

      const body = await res.json() as { temporaryPassword: string; profile: PendingAccount };
      setConfirmApprove(null);
      setApprovedResult({
        account: acc,
        tempPassword: body.temporaryPassword,
      });
      // Remove from pending list
      setAccounts((prev) => prev.filter((a) => a.id !== acc.id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Approval failed");
      setConfirmApprove(null);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (acc: PendingAccount) => {
    setActionLoading(acc.id);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`${API_URL}/api/admin/account-requests/${acc.id}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || "Failed to reject account");
      }

      setConfirmReject(null);
      setAccounts((prev) => prev.filter((a) => a.id !== acc.id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Rejection failed");
      setConfirmReject(null);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (acc: PendingAccount) => {
    if (!window.confirm(`Delete registration request for ${acc.first_name} ${acc.last_name} permanently?`)) return;
    setActionLoading(acc.id);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`${API_URL}/api/admin/users/${acc.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || "Failed to delete account");
      }

      setAccounts((prev) => prev.filter((a) => a.id !== acc.id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Deletion failed");
    } finally {
      setActionLoading(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="admin-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="admin-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 760 }}
      >
        {/* Header */}
        <div className="admin-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "#fef3c7",
                color: "#92400e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <KeyRound size={17} />
            </div>
            <div>
              <h3>Pending Account Approvals</h3>
              <p style={{ margin: 0, fontSize: 12, color: "#6a796e" }}>
                Review registered users, generate temporary passwords upon approval, or decline access.
              </p>
            </div>
          </div>
          <button className="admin-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Toolbar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
            gap: 10,
          }}
        >
          <div style={{ fontSize: 13, color: "#4d5b51", fontWeight: 500 }}>
            {accounts.length} {accounts.length === 1 ? "account" : "accounts"} awaiting review
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={fetchPending}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 12px",
                borderRadius: 8,
                border: "1px solid #dcd5c7",
                background: "#faf8f4",
                fontSize: 12,
                cursor: "pointer",
                color: "#4d5b51",
              }}
              title="Refresh list"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => {
                onClose();
                onOpenRegister();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                borderRadius: 8,
                border: "none",
                background: "#133827",
                color: "#ffffff",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <UserPlus size={13} />
              <span>+ Register User</span>
            </button>
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
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* List of Pending Accounts */}
        {loading ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "#6a796e", fontSize: 13 }}>
            Loading pending accounts…
          </div>
        ) : accounts.length === 0 ? (
          <div
            style={{
              padding: "48px 20px",
              textAlign: "center",
              background: "#faf7f2",
              borderRadius: 12,
              border: "1px dashed #d8d0c2",
            }}
          >
            <CheckCircle2 size={32} color="#16a34a" style={{ margin: "0 auto 10px" }} />
            <p style={{ margin: "0 0 6px", fontWeight: 600, fontSize: 14, color: "#142219" }}>
              All Caught Up!
            </p>
            <p style={{ margin: 0, fontSize: 12.5, color: "#6a786f" }}>
              There are currently no pending account registration requests.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10, maxHeight: 420, overflowY: "auto" }}>
            {accounts.map((acc) => {
              const fullName = [acc.first_name, acc.middle_name, acc.last_name].filter(Boolean).join(" ");
              const regDate = new Date(acc.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              });

              return (
                <div
                  key={acc.id}
                  style={{
                    padding: "14px 16px",
                    background: "#ffffff",
                    border: "1px solid #e5ded2",
                    borderRadius: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 14,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: "#142219" }}>
                        {fullName}
                      </span>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: 0.4,
                          padding: "2px 7px",
                          borderRadius: 6,
                          background: acc.role === "staff" ? "#fef3c7" : "#e0f2fe",
                          color: acc.role === "staff" ? "#92400e" : "#0369a1",
                        }}
                      >
                        {acc.role}
                      </span>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 600,
                          padding: "2px 7px",
                          borderRadius: 6,
                          background: "#fff7ed",
                          color: "#c2410c",
                          border: "1px solid #fed7aa",
                        }}
                      >
                        Pending
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#68766c", display: "flex", gap: 14, flexWrap: "wrap" }}>
                      <span>✉️ {acc.email}</span>
                      <span>📱 {acc.contact}</span>
                      <span>📅 Registered: {regDate}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={() => void handleDelete(acc)}
                      disabled={actionLoading === acc.id}
                      title="Permanently delete account request"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "7px 10px",
                        borderRadius: 8,
                        border: "1px solid #e5ded2",
                        background: "#fff",
                        color: "#6b7280",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                    <button
                      onClick={() => setConfirmReject(acc)}
                      disabled={actionLoading === acc.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "7px 12px",
                        borderRadius: 8,
                        border: "1px solid #fca5a5",
                        background: "#fff",
                        color: "#dc2626",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      <UserX size={13} />
                      <span>Reject</span>
                    </button>
                    <button
                      onClick={() => setConfirmApprove(acc)}
                      disabled={actionLoading === acc.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "7px 14px",
                        borderRadius: 8,
                        border: "none",
                        background: "#166534",
                        color: "#ffffff",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        boxShadow: "0 2px 4px rgba(22, 101, 52, 0.25)",
                      }}
                    >
                      <UserCheck size={13} />
                      <span>Approve</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ========================================================
            CONFIRM APPROVAL MODAL
        ======================================================== */}
        {confirmApprove && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 120,
              padding: 20,
            }}
          >
            <div
              style={{
                background: "#ffffff",
                borderRadius: 14,
                padding: "22px 24px",
                maxWidth: 440,
                width: "100%",
                boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
              }}
            >
              <h4 style={{ margin: "0 0 10px", fontSize: 16, color: "#142219" }}>
                Approve Account Request?
              </h4>
              <p style={{ margin: "0 0 16px", fontSize: 13, color: "#5a685e", lineHeight: 1.5 }}>
                Are you sure you want to approve{" "}
                <b>
                  {confirmApprove.first_name} {confirmApprove.last_name}
                </b>{" "}
                ({confirmApprove.email})?
                <br />
                A <b>secure temporary password</b> will be generated automatically and displayed for you to give to the user.
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  onClick={() => setConfirmApprove(null)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "1px solid #d4cdbe",
                    background: "none",
                    fontSize: 12.5,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleApprove(confirmApprove)}
                  disabled={actionLoading === confirmApprove.id}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 8,
                    border: "none",
                    background: "#166534",
                    color: "#fff",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {actionLoading === confirmApprove.id ? "Approving…" : "Yes, Approve & Generate Password"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            CONFIRM REJECT MODAL
        ======================================================== */}
        {confirmReject && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 120,
              padding: 20,
            }}
          >
            <div
              style={{
                background: "#ffffff",
                borderRadius: 14,
                padding: "22px 24px",
                maxWidth: 420,
                width: "100%",
                boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, color: "#dc2626" }}>
                <AlertTriangle size={18} />
                <h4 style={{ margin: 0, fontSize: 16, color: "#142219" }}>Reject Account Request?</h4>
              </div>
              <p style={{ margin: "0 0 16px", fontSize: 13, color: "#5a685e", lineHeight: 1.5 }}>
                Are you sure you want to reject the registration for{" "}
                <b>
                  {confirmReject.first_name} {confirmReject.last_name}
                </b>{" "}
                ({confirmReject.email})? They will not be able to log in.
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  onClick={() => setConfirmReject(null)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "1px solid #d4cdbe",
                    background: "none",
                    fontSize: 12.5,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleReject(confirmReject)}
                  disabled={actionLoading === confirmReject.id}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 8,
                    border: "none",
                    background: "#dc2626",
                    color: "#fff",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {actionLoading === confirmReject.id ? "Rejecting…" : "Yes, Reject Account"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            SUCCESS TEMPORARY PASSWORD DIALOG
        ======================================================== */}
        {approvedResult && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.65)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 130,
              padding: 20,
            }}
          >
            <div
              style={{
                background: "#ffffff",
                borderRadius: 16,
                padding: "26px 28px",
                maxWidth: 480,
                width: "100%",
                boxShadow: "0 24px 50px rgba(0,0,0,0.3)",
                border: "1px solid #cce5d6",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "#dcfce7",
                    color: "#166534",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: 17, color: "#12241a", fontWeight: 700 }}>
                    Account Approved &amp; Activated!
                  </h4>
                  <p style={{ margin: 0, fontSize: 12, color: "#5e6e62" }}>
                    Temporary password generated successfully.
                  </p>
                </div>
              </div>

              <div
                style={{
                  background: "#f7f5ed",
                  borderRadius: 12,
                  padding: "14px 16px",
                  marginBottom: 14,
                  fontSize: 13,
                  color: "#303e33",
                }}
              >
                <p style={{ margin: "0 0 6px" }}>
                  <b>User Name:</b> {approvedResult.account.first_name} {approvedResult.account.last_name}
                </p>
                <p style={{ margin: "0 0 10px" }}>
                  <b>Email / Username:</b> {approvedResult.account.email}
                </p>

                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    color: "#6b5830",
                    marginBottom: 4,
                  }}
                >
                  Temporary Password
                </label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "#ffffff",
                    border: "1px solid #c9a96a",
                    borderRadius: 8,
                    padding: "9px 12px",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: 15,
                      fontWeight: 700,
                      color: "#133827",
                      letterSpacing: 0.8,
                    }}
                  >
                    {approvedResult.tempPassword}
                  </span>
                  <button
                    onClick={() => copyToClipboard(approvedResult.tempPassword)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 8px",
                      borderRadius: 6,
                      background: copied ? "#dcfce7" : "#f1ecdf",
                      color: copied ? "#15803d" : "#4f3d1b",
                      border: "none",
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copied ? "Copied!" : "Copy"}</span>
                  </button>
                </div>
              </div>

              <div
                style={{
                  background: "#fffbeb",
                  border: "1px solid #fef3c7",
                  borderRadius: 10,
                  padding: "10px 12px",
                  fontSize: 12,
                  color: "#92400e",
                  lineHeight: 1.45,
                  marginBottom: 16,
                }}
              >
                ⚠️ <b>Important:</b> Give this temporary password to the user. They will be required to change it immediately upon logging in. <i>This password will not be shown again.</i>
              </div>

              <button
                onClick={() => setApprovedResult(null)}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: 10,
                  border: "none",
                  background: "#133827",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                I Have Saved / Shared The Password
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
