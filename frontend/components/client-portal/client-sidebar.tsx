"use client";

import { useEffect, useState } from "react";
import {
  Home,
  Gamepad2,
  Coffee,
  Receipt,
  UserRound,
  LogOut,
} from "lucide-react";

export type ClientNavTab =
  | "home"
  | "sessions"
  | "pre-order"
  | "transactions"
  | "account";

interface ClientSidebarProps {
  activeTab: ClientNavTab;
  onSelectTab: (tab: ClientNavTab) => void;
  onLogout?: () => void | Promise<void>;
  isOpen?: boolean;
  onClose?: () => void;
}

const NAV_ITEMS: { id: ClientNavTab; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "sessions", label: "Sessions", icon: Gamepad2 },
  { id: "pre-order", label: "Pre-order", icon: Coffee },
  { id: "transactions", label: "Transactions", icon: Receipt },
  { id: "account", label: "Account", icon: UserRound },
];

export function ClientSidebar({
  activeTab,
  onSelectTab,
  onLogout,
  isOpen = false,
  onClose,
}: ClientSidebarProps) {
  const [timeStr, setTimeStr] = useState("10:24 AM");
  const [dateStr, setDateStr] = useState("Sep 9, 2026");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      );
      setDateStr(
        now.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000 * 60);
    return () => clearInterval(timer);
  }, []);

  return (
    <aside className={`client-sidebar ${isOpen ? "open" : ""}`} aria-label="Sidebar navigation">
      {/* Botanical Leaf Watermark SVG */}
      <svg
        className="client-sidebar-watermark"
        viewBox="0 0 160 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M20 210 C35 170, 70 140, 140 120 C100 130, 60 160, 20 210 Z"
          fill="#53966c"
        />
        <path
          d="M22 208 C50 160, 95 125, 155 90 C120 115, 75 160, 22 208 Z"
          fill="#3e7552"
        />
        <path
          d="M25 205 C70 150, 110 80, 130 10 C105 50, 75 130, 25 205 Z"
          fill="#68b485"
        />
        <path
          d="M24 206 C15 150, 25 90, 60 40 C35 85, 25 145, 24 206 Z"
          fill="#44805c"
        />
        <path
          d="M26 204 Q60 140 145 105"
          stroke="#7bc597"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>

      <div className="client-sidebar-content">
        <div>
          {/* Brand Logo & Name */}
          <a href="/" className="client-sidebar-brand" onClick={() => onSelectTab("home")}>
            <div className="client-sidebar-logo-badge" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22C12 22 19 18 19 11C19 6 15 3 12 2C9 3 5 6 5 11C5 18 12 22 12 22Z" fill="rgba(199, 222, 203, 0.25)" stroke="#c7decb" />
                <path d="M12 22V10" stroke="#c7decb" />
                <path d="M12 14C14 13 16 11 16 9" stroke="#c7decb" />
                <path d="M12 17C10 16 8 14 8 12" stroke="#c7decb" />
              </svg>
            </div>
            <div className="client-sidebar-brand-text">
              <span className="client-sidebar-brand-title">ETHER.CAFE</span>
              <span className="client-sidebar-brand-subtitle">Client Portal</span>
            </div>
          </a>

          {/* Navigation Items */}
          <nav className="client-sidebar-nav" aria-label="Portal Navigation">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  className={`client-nav-item ${isActive ? "active" : ""}`}
                  onClick={() => {
                    onSelectTab(item.id);
                    if (onClose) onClose();
                  }}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="client-nav-icon" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}

            {onLogout && (
              <button
                type="button"
                className="client-nav-item"
                style={{ marginTop: 12, opacity: 0.85 }}
                onClick={async () => {
                  if (onClose) onClose();
                  await onLogout();
                }}
              >
                <LogOut className="client-nav-icon" aria-hidden="true" />
                <span>Sign Out</span>
              </button>
            )}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="client-sidebar-footer">
          <p className="client-sidebar-quote">
            “More than just internet — a better place to connect.”
          </p>
          <div className="client-sidebar-divider" aria-hidden="true" />
          <div className="client-sidebar-timestamp">
            <span className="client-sidebar-date">{dateStr}</span>
            <span className="client-sidebar-time">{timeStr}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
