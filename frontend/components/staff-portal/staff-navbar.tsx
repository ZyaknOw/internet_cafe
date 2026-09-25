"use client";

import { useEffect, useState } from "react";
import { SunMedium, Moon, ChevronDown, LogOut, User } from "lucide-react";

interface StaffNavbarProps {
  displayName?: string;
  avatarUrl?: string | null;
  onLogout?: () => void | Promise<void>;
  onOpenProfile?: () => void;
}

export function StaffNavbar({
  displayName = "Staff",
  avatarUrl,
  onLogout,
  onOpenProfile,
}: StaffNavbarProps) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [dateTimeStr, setDateTimeStr] = useState("Sep 9, 2026  10:24 AM");

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      const datePart = now.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const timePart = now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      setDateTimeStr(`${datePart}  ${timePart}`);
    };
    updateDateTime();
    const timer = setInterval(updateDateTime, 1000 * 60);
    return () => clearInterval(timer);
  }, []);

  const handleLogoutClick = async () => {
    setShowProfileMenu(false);
    if (onLogout) await onLogout();
  };

  return (
    <nav className="staff-navbar" aria-label="Staff Navigation">
      {/* Left Branding */}
      <div className="staff-nav-left">
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div className="staff-brand-mark" aria-hidden="true">
            E
          </div>
          <span className="staff-brand-title">ETHER.CAFE</span>
        </a>
        <span className="staff-brand-sep" aria-hidden="true">|</span>
        <span className="staff-brand-portal">Staff Portal</span>
      </div>

      {/* Right Controls */}
      <div className="staff-nav-right">
        <div className="staff-nav-datetime">{dateTimeStr}</div>

        {/* Theme Toggle */}
        <button
          className="staff-theme-toggle"
          onClick={() => setIsDarkMode(!isDarkMode)}
          title={`Switch to ${isDarkMode ? "Light" : "Dark"} theme`}
          aria-label="Toggle theme"
        >
          <div className={`staff-theme-icon ${!isDarkMode ? "active" : ""}`}>
            <SunMedium size={13} />
          </div>
          <div className={`staff-theme-icon ${isDarkMode ? "active" : ""}`}>
            <Moon size={13} />
          </div>
        </button>

        {/* Profile Pill */}
        <div style={{ position: "relative" }}>
          <button
            className="staff-profile-badge"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            aria-expanded={showProfileMenu}
            aria-label="Staff user menu"
          >
            <div
              className="staff-avatar"
              aria-hidden="true"
              style={{ overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                (displayName?.[0] ?? "S").toUpperCase()
              )}
            </div>
            <div className="staff-profile-text">
              <span className="staff-profile-name">{displayName}</span>
              <span className="staff-profile-role">Staff</span>
            </div>
            <ChevronDown size={14} style={{ color: "rgba(255,255,255,0.7)" }} aria-hidden="true" />
          </button>

          {showProfileMenu && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                background: "#ffffff",
                border: "1px solid #e2ddd3",
                borderRadius: "12px",
                padding: "6px",
                minWidth: "170px",
                boxShadow: "0 10px 25px rgba(0,0,0,0.18)",
                zIndex: 80,
                display: "flex",
                flexDirection: "column",
                gap: "2px",
              }}
            >
              <button
                onClick={() => {
                  setShowProfileMenu(false);
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
                <User size={15} /> Staff Account
              </button>
              <div style={{ height: "1px", background: "#eee8de", margin: "3px 0" }} />
              <button
                onClick={handleLogoutClick}
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

        {/* Logout Button */}
        <button
          onClick={handleLogoutClick}
          className="staff-logout-btn"
          aria-label="Logout"
        >
          <LogOut size={14} aria-hidden="true" />
          <span>Logout</span>
        </button>
      </div>
    </nav>
  );
}
