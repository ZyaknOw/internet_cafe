"use client";

import { Gamepad2, Wallet, Clock3 } from "lucide-react";

interface SummaryMetricsProps {
  activeSession?: string;
  balance?: string;
  rate?: string;
  onTopUp?: () => void;
}

export function SummaryMetrics({
  activeSession = "—",
  balance = "₱ 0.00",
  rate = "₱ 50/hr",
  onTopUp,
}: SummaryMetricsProps) {
  return (
    <section className="client-metrics-grid" aria-label="Portal Statistics Summary">
      {/* 1. Active Session */}
      <div className="client-metric-card session">
        <div className="client-metric-icon-box" aria-hidden="true">
          <Gamepad2 size={22} />
        </div>
        <div className="client-metric-info">
          <span className="client-metric-label">ACTIVE SESSION</span>
          <span className="client-metric-value">{activeSession}</span>
          <span className="client-metric-sub">No active session</span>
        </div>
      </div>

      {/* 2. Remaining Balance */}
      <div
        className="client-metric-card balance"
        onClick={onTopUp}
        style={{ cursor: onTopUp ? "pointer" : "default" }}
        role={onTopUp ? "button" : undefined}
        tabIndex={onTopUp ? 0 : undefined}
        onKeyDown={(e) => {
          if (onTopUp && (e.key === "Enter" || e.key === " ")) onTopUp();
        }}
      >
        <div className="client-metric-icon-box" aria-hidden="true">
          <Wallet size={22} />
        </div>
        <div className="client-metric-info">
          <span className="client-metric-label">REMAINING BALANCE</span>
          <span className="client-metric-value">{balance}</span>
          <span className="client-metric-sub">Top up to continue</span>
        </div>
      </div>

      {/* 3. Current Rate */}
      <div className="client-metric-card rate">
        <div className="client-metric-icon-box" aria-hidden="true">
          <Clock3 size={22} />
        </div>
        <div className="client-metric-info">
          <span className="client-metric-label">CURRENT RATE</span>
          <span className="client-metric-value">{rate}</span>
          <span className="client-metric-sub">Casual Stay</span>
        </div>
      </div>
    </section>
  );
}
