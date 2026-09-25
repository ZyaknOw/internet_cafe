"use client";

import { useEffect, useState } from "react";
import {
  X,
  DollarSign,
  BarChart3,
  Clock3,
  Users,
  KeyRound,
  ShieldCheck,
  Gamepad2,
  CalendarDays,
  Coffee,
  Receipt,
  Lock,
  Download,
  Trash2,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

interface ActionModalProps {
  modalId: string | null;
  onClose: () => void;
  onOpenPending?: () => void;
  onOpenRegister?: () => void;
  onSelectUser?: (user: any) => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function AdminActionModals({
  modalId,
  onClose,
  onOpenPending,
  onOpenRegister,
  onSelectUser,
}: ActionModalProps) {
  const [dataList, setDataList] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!modalId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const headers = {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

        if (modalId === "client-accounts") {
          const res = await fetch(`${API_URL}/api/customers`, { headers });
          if (res.ok) {
            const body = await res.json() as { customers: unknown[] };
            setDataList(body.customers ?? []);
          }
        } else if (modalId === "staff-accounts") {
          const res = await fetch(`${API_URL}/api/staff`, { headers });
          if (res.ok) {
            const body = await res.json() as { staff: unknown[] };
            setDataList(body.staff ?? []);
          }
        } else if (modalId === "active-sessions" || modalId === "session-history") {
          const res = await fetch(`${API_URL}/api/station-sessions/open`, { headers });
          if (res.ok) {
            const body = await res.json() as { sessions: unknown[] };
            setDataList(body.sessions ?? []);
          }
        }
      } catch {
        // Handled silently
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [modalId]);

  if (!modalId) return null;

  const ModalShell = ({ title, icon: Icon, children }: { title: string; icon: typeof BarChart3; children: React.ReactNode }) => (
    <div className="admin-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
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
              <Icon size={16} />
            </div>
            <h3>{title}</h3>
          </div>
          <button className="admin-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );

  // 1. ANALYTICS & REPORTS
  if (modalId === "revenue-report" || modalId === "occupancy-stats" || modalId === "peak-hours" || modalId === "usage-analytics") {
    return (
      <ModalShell title="Analytics &amp; Financial Reports" icon={BarChart3}>
        <p style={{ fontSize: 13, color: "#5a685e", margin: "0 0 16px" }}>
          Daily revenue breakdown and real-time station metrics. All user tracking conforms to privacy compliance guidelines.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div style={{ background: "#f5f2eb", padding: "14px 16px", borderRadius: 10 }}>
            <small style={{ fontSize: 11, color: "#6a796e", textTransform: "uppercase", fontWeight: 700 }}>Today&apos;s Revenue</small>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#142219", marginTop: 4 }}>₱ 0.00</div>
          </div>
          <div style={{ background: "#f5f2eb", padding: "14px 16px", borderRadius: 10 }}>
            <small style={{ fontSize: 11, color: "#6a796e", textTransform: "uppercase", fontWeight: 700 }}>Peak Hour Average</small>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#142219", marginTop: 4 }}>4:00 PM – 8:00 PM</div>
          </div>
        </div>
        <div style={{ background: "#ffffff", border: "1px solid #e2ddd3", borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: "1px solid #f0ece2" }}>
            <span>Hourly PC Gaming &amp; Co-work</span>
            <b>₱ 0.00</b>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: "1px solid #f0ece2" }}>
            <span>Discussion Room Passes</span>
            <b>₱ 0.00</b>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0" }}>
            <span>Snack &amp; Specialty Coffee</span>
            <b>₱ 0.00</b>
          </div>
        </div>
      </ModalShell>
    );
  }

  // 2. CLIENT ACCOUNTS
  if (modalId === "client-accounts") {
    return (
      <ModalShell title="Registered Client Directory" icon={Users}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 12.5, color: "#637066" }}>{dataList.length} registered clients</span>
          {onOpenRegister && (
            <button
              onClick={() => {
                onClose();
                onOpenRegister();
              }}
              style={{
                fontSize: 12,
                padding: "6px 12px",
                borderRadius: 8,
                background: "#123725",
                color: "#fff",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
              }}
            >
              + Register New Client
            </button>
          )}
        </div>
        <div style={{ maxHeight: 340, overflowY: "auto", display: "grid", gap: 8 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 20, fontSize: 13, color: "#6a796e" }}>Loading clients…</div>
          ) : dataList.length === 0 ? (
            <div style={{ textAlign: "center", padding: 24, fontSize: 13, color: "#6a796e" }}>No registered clients found.</div>
          ) : (
            dataList.map((item: any) => (
              <div
                key={item.id}
                onClick={() => onSelectUser?.(item)}
                style={{
                  padding: "12px 14px",
                  background: "#faf8f4",
                  border: "1px solid #e6e0d4",
                  borderRadius: 10,
                  fontSize: 13,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: onSelectUser ? "pointer" : "default",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#123725")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e6e0d4")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: "50%",
                      background: "#e8d5a3",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      color: "#1a2e22",
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    {item.avatar_url ? (
                      <img src={item.avatar_url} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      (item.first_name?.[0] ?? "C").toUpperCase()
                    )}
                  </div>
                  <div>
                    <b style={{ color: "#142219", fontSize: 13.5 }}>
                      {item.first_name} {item.middle_name ? `${item.middle_name} ` : ""}{item.last_name} {item.suffix ?? ""}
                    </b>
                    <div style={{ fontSize: 12, color: "#6e7b71", marginTop: 2 }}>
                      {item.email} · {item.contact} {item.user_code ? `· ID: ${item.user_code}` : ""}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "#dcfce7", color: "#166534", fontWeight: 700 }}>
                    {item.status}
                  </span>
                  <span style={{ fontSize: 12, color: "#123725", fontWeight: 600, textDecoration: "underline" }}>
                    View Profile
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </ModalShell>
    );
  }

  // 3. STAFF ACCOUNTS
  if (modalId === "staff-accounts") {
    return (
      <ModalShell title="Staff &amp; Admin Permissions" icon={Users}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 12.5, color: "#637066" }}>Authorized team members</span>
          {onOpenRegister && (
            <button
              onClick={() => {
                onClose();
                onOpenRegister();
              }}
              style={{
                fontSize: 12,
                padding: "6px 12px",
                borderRadius: 8,
                background: "#123725",
                color: "#fff",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
              }}
            >
              + Add Staff Member
            </button>
          )}
        </div>
        <div style={{ maxHeight: 340, overflowY: "auto", display: "grid", gap: 8 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 20, fontSize: 13, color: "#6a796e" }}>Loading staff…</div>
          ) : dataList.length === 0 ? (
            <div style={{ textAlign: "center", padding: 24, fontSize: 13, color: "#6a796e" }}>No staff accounts found.</div>
          ) : (
            dataList.map((item: any) => (
              <div
                key={item.id}
                onClick={() => onSelectUser?.(item)}
                style={{
                  padding: "12px 14px",
                  background: "#faf8f4",
                  border: "1px solid #e6e0d4",
                  borderRadius: 10,
                  fontSize: 13,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: onSelectUser ? "pointer" : "default",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#123725")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e6e0d4")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: "50%",
                      background: item.role === "admin" ? "#fde68a" : "#bae6fd",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      color: "#1a2e22",
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    {item.avatar_url ? (
                      <img src={item.avatar_url} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      (item.first_name?.[0] ?? "S").toUpperCase()
                    )}
                  </div>
                  <div>
                    <b style={{ color: "#142219", fontSize: 13.5 }}>
                      {item.first_name} {item.middle_name ? `${item.middle_name} ` : ""}{item.last_name} {item.suffix ?? ""}
                    </b>
                    <div style={{ fontSize: 12, color: "#6e7b71", marginTop: 2 }}>
                      {item.email} {item.contact ? `· ${item.contact}` : ""} {item.user_code ? `· ID: ${item.user_code}` : ""}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "3px 8px",
                      borderRadius: 6,
                      background: item.role === "admin" ? "#fef3c7" : "#e0f2fe",
                      color: item.role === "admin" ? "#92400e" : "#0369a1",
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    {item.role}
                  </span>
                  <span style={{ fontSize: 12, color: "#123725", fontWeight: 600, textDecoration: "underline" }}>
                    View Profile
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </ModalShell>
    );
  }

  // 4. RESET CREDENTIALS
  if (modalId === "reset-credentials") {
    return (
      <ModalShell title="Password &amp; Access Reset" icon={KeyRound}>
        <p style={{ fontSize: 13, color: "#5a685e", margin: "0 0 14px" }}>
          To reset a user or staff member&apos;s password, approve their account in <b>Pending Accounts</b> or send them a password recovery link.
        </p>
        <div style={{ background: "#f8f6f0", padding: "14px 16px", borderRadius: 10, marginBottom: 14 }}>
          <p style={{ margin: "0 0 6px", fontSize: 12.5, fontWeight: 600, color: "#133827" }}>
            🔑 Password Change Policy
          </p>
          <p style={{ margin: 0, fontSize: 12, color: "#647266", lineHeight: 1.5 }}>
            Accounts approved with a temporary password are automatically flagged with <code>must_change_password: true</code>. Upon first login, users are required to establish their new password.
          </p>
        </div>
        {onOpenPending && (
          <button
            onClick={() => {
              onClose();
              onOpenPending();
            }}
            style={{
              width: "100%",
              padding: "10px",
              background: "#133827",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Go to Pending Accounts &amp; Approvals
          </button>
        )}
      </ModalShell>
    );
  }

  // 5. SESSION MANAGEMENT
  if (modalId === "active-sessions" || modalId === "start-stop-session" || modalId === "pc-availability") {
    return (
      <ModalShell title="Live Station Sessions &amp; PCs" icon={Gamepad2}>
        <p style={{ fontSize: 13, color: "#5a685e", margin: "0 0 14px" }}>
          Active PC gaming and workstation sessions. Staff front desk controls station assignments.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
          <div style={{ background: "#f5f2eb", padding: "12px", borderRadius: 10, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#6a796e", fontWeight: 700 }}>Total PCs</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#142219" }}>20</div>
          </div>
          <div style={{ background: "#eaf4ed", padding: "12px", borderRadius: 10, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#1b623a", fontWeight: 700 }}>Available</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#166534" }}>20</div>
          </div>
          <div style={{ background: "#fef3c7", padding: "12px", borderRadius: 10, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#92400e", fontWeight: 700 }}>In Use</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#92400e" }}>0</div>
          </div>
        </div>
        <p style={{ fontSize: 12, color: "#748277", margin: 0, textAlign: "center" }}>
          All 20 gaming and workstations are ready for customer check-in.
        </p>
      </ModalShell>
    );
  }

  // 6. BOOKING MANAGEMENT
  if (modalId === "upcoming-bookings" || modalId === "approve-cancel-booking" || modalId === "room-availability" || modalId === "booking-history") {
    return (
      <ModalShell title="Discussion Room Bookings" icon={CalendarDays}>
        <p style={{ fontSize: 13, color: "#5a685e", margin: "0 0 14px" }}>
          Manage private conference spaces: Studio 1, Studio 2, Studio 3, and The Forum.
        </p>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ padding: "12px 14px", background: "#faf8f4", border: "1px solid #e5dfd2", borderRadius: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <b style={{ color: "#142219", fontSize: 13.5 }}>Studio 1 (4 Pax)</b>
              <span style={{ fontSize: 11, color: "#15803d", fontWeight: 700 }}>AVAILABLE</span>
            </div>
            <div style={{ fontSize: 12, color: "#6a786e", marginTop: 2 }}>Equipped with 4K display, high-speed fiber, conference mic</div>
          </div>
          <div style={{ padding: "12px 14px", background: "#faf8f4", border: "1px solid #e5dfd2", borderRadius: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <b style={{ color: "#142219", fontSize: 13.5 }}>The Forum (8–12 Pax)</b>
              <span style={{ fontSize: 11, color: "#15803d", fontWeight: 700 }}>AVAILABLE</span>
            </div>
            <div style={{ fontSize: 12, color: "#6a786e", marginTop: 2 }}>Executive boardroom setup with surround sound &amp; projector</div>
          </div>
        </div>
      </ModalShell>
    );
  }

  // 7. PRICING & RATE CONTROL
  if (modalId === "hourly-rates" || modalId === "day-passes" || modalId === "room-rates" || modalId === "extra-member-fee") {
    return (
      <ModalShell title="Pricing &amp; Rate Control" icon={DollarSign}>
        <p style={{ fontSize: 13, color: "#5a685e", margin: "0 0 14px" }}>
          Active billing rates for PC usage, day packages, and private discussion rooms.
        </p>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#faf8f4", borderRadius: 8 }}>
            <span>Hourly Standard Station</span>
            <b style={{ color: "#123725" }}>₱ 50.00 / hr</b>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#faf8f4", borderRadius: 8 }}>
            <span>VIP Gaming Station (240Hz, RTX 4080)</span>
            <b style={{ color: "#123725" }}>₱ 75.00 / hr</b>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#faf8f4", borderRadius: 8 }}>
            <span>Stay-All-Day Pass (12 Hours)</span>
            <b style={{ color: "#123725" }}>₱ 249.00</b>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#faf8f4", borderRadius: 8 }}>
            <span>Private Studio (Up to 4 Pax)</span>
            <b style={{ color: "#123725" }}>₱ 350.00 / hr</b>
          </div>
        </div>
      </ModalShell>
    );
  }

  // 8. PRE-ORDER / CAFÉ MANAGEMENT
  if (modalId === "products-menu" || modalId === "inventory" || modalId === "orders" || modalId === "order-history") {
    return (
      <ModalShell title="Pre-order &amp; Snack Services" icon={Coffee}>
        <p style={{ fontSize: 13, color: "#5a685e", margin: "0 0 14px" }}>
          In-house barista pre-orders and workstation beverage delivery.
        </p>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#faf8f4", borderRadius: 8 }}>
            <span>Spanish Latte (Iced)</span>
            <b style={{ color: "#123725" }}>₱ 120.00 · In Stock</b>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#faf8f4", borderRadius: 8 }}>
            <span>Cold Brew Reserve</span>
            <b style={{ color: "#123725" }}>₱ 110.00 · In Stock</b>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#faf8f4", borderRadius: 8 }}>
            <span>Matcha Cloud Cream</span>
            <b style={{ color: "#123725" }}>₱ 130.00 · In Stock</b>
          </div>
        </div>
      </ModalShell>
    );
  }

  // 9. COMPLIANCE & LOGS
  if (modalId === "consent-logs" || modalId === "activity-logs" || modalId === "data-export" || modalId === "data-deletion") {
    return (
      <ModalShell title="Data Privacy Compliance (RA 10173)" icon={ShieldCheck}>
        <p style={{ fontSize: 13, color: "#5a685e", margin: "0 0 14px" }}>
          Audit logs, customer consent records, and data subject access requests under the Philippine Data Privacy Act.
        </p>
        <div style={{ background: "#eef6f0", border: "1px solid #cbe7d4", padding: "12px 14px", borderRadius: 10, marginBottom: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#166534", marginBottom: 2 }}>
            🛡️ Privacy Compliance Active
          </div>
          <div style={{ fontSize: 12, color: "#32573d" }}>
            All registration records store explicit consent timestamps. Data export &amp; deletion requests are processed by the System Administrator.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => alert("Audit log export generated.")}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: 8,
              border: "1px solid #d4cdbe",
              background: "#faf8f4",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <Download size={14} /> Export Audit Log
          </button>
        </div>
      </ModalShell>
    );
  }

  return null;
}
