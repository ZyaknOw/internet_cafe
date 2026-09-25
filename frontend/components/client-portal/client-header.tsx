"use client";

import { useState } from "react";
import { SunMedium, Moon, ChevronDown, LogOut, User } from "lucide-react";

interface ClientHeaderProps {
  displayName?: string;
  avatarUrl?: string | null;
  onLogout?: () => void | Promise<void>;
  onOpenProfile?: () => void;
}

export function ClientHeader({ displayName = "Client", avatarUrl, onLogout, onOpenProfile }: ClientHeaderProps) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleLogout = async () => {
    setShowMenu(false);
    if (onLogout) await onLogout();
  };

  return (
    <header className="client-header-bar">
      <div className="client-header-titles">
        <h1>Welcome back, {displayName.split(" ")[0]}!</h1>
        <p>Manage your sessions, bookings, and account from one place.</p>
      </div>

      <div className="client-header-actions">
        {/* Theme Toggle Pill */}
        <button
          className="client-theme-toggle"
          onClick={() => setIsDarkMode(!isDarkMode)}
          title={`Switch to ${isDarkMode ? "Light" : "Dark"} theme`}
          aria-label="Toggle theme"
        >
          <SunMedium
            size={16}
            className={`client-theme-icon ${!isDarkMode ? "active" : "inactive"}`}
          />
          <Moon
            size={16}
            className={`client-theme-icon ${isDarkMode ? "active" : "inactive"}`}
          />
        </button>

        {/* Client Profile Capsule */}
        <div style={{ position: "relative" }}>
          <button
            className="client-profile-dropdown"
            onClick={() => setShowMenu(!showMenu)}
            aria-expanded={showMenu}
            aria-haspopup="true"
            aria-label="User account menu"
          >
            <div className="client-profile-avatar" aria-hidden="true" style={{ overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                initials
              )}
            </div>
            <div className="client-profile-meta">
              <span className="client-profile-name">{displayName}</span>
              <span className="client-profile-role">Client</span>
            </div>
            <ChevronDown size={14} className="client-profile-chevron" aria-hidden="true" />
          </button>

          {showMenu && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                background: "#ffffff",
                border: "1px solid #e2ddd3",
                borderRadius: "12px",
                padding: "6px",
                minWidth: "160px",
                boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                zIndex: 80,
                display: "flex",
                flexDirection: "column",
                gap: "2px",
              }}
            >
              <button
                onClick={() => {
                  setShowMenu(false);
                  onOpenProfile?.();
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  fontSize: "13px",
                  color: "#16241b",
                  borderRadius: "6px",
                  width: "100%",
                  textAlign: "left",
                  background: "none",
                  border: 0,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f1ea")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <User size={15} /> My Profile / Account
              </button>
              <div style={{ height: "1px", background: "#eee8de", margin: "3px 0" }} />
              <button
                onClick={handleLogout}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  fontSize: "13px",
                  color: "#b8452e",
                  borderRadius: "6px",
                  width: "100%",
                  textAlign: "left",
                  background: "none",
                  border: 0,
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#fdf0ed")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <LogOut size={15} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
