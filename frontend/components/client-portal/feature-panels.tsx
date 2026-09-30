"use client";

import {
  Wifi,
  Coffee,
  Gamepad2,
  Clock3,
  Receipt,
  ChevronRight,
  Sparkles,
} from "lucide-react";

interface FeaturePanelsProps {
  onActionClick?: (actionName: string, detail?: string) => void;
}

export function FeaturePanels({ onActionClick }: FeaturePanelsProps) {
  const handleClick = (title: string, meta: string) => {
    if (onActionClick) {
      onActionClick(title, meta);
    }
  };

  return (
    <section className="client-panels-grid" aria-label="Portal Services">
      {/* Panel 1: Session & Passes */}
      <div className="client-panel session">
        <div className="client-panel-bg" aria-hidden="true" />
        <div className="client-panel-overlay" aria-hidden="true" />

        <div className="client-panel-content">
          <div className="client-panel-top">
            <div className="client-panel-title-row">
              <Wifi className="client-panel-header-icon" size={20} aria-hidden="true" />
              <h3 className="client-panel-title">Session &amp; Passes</h3>
            </div>
            <p className="client-panel-desc">
              Start a new session, check your balance, or view active rates.
            </p>
          </div>

          <div className="client-panel-rows">
            <button
              className="client-panel-row"
              onClick={() => handleClick("Start New Session", "₱50/hr")}
            >
              <div className="client-panel-row-left">
                <Gamepad2 className="client-panel-row-icon" aria-hidden="true" />
                <span>Start New Session</span>
              </div>
              <div className="client-panel-row-right">
                <span>₱50/hr</span>
                <ChevronRight size={14} className="client-panel-chevron" aria-hidden="true" />
              </div>
            </button>

            <button
              className="client-panel-row"
              onClick={() => handleClick("View Active Session", "No active session")}
            >
              <div className="client-panel-row-left">
                <Clock3 className="client-panel-row-icon" aria-hidden="true" />
                <span>View Active Session</span>
              </div>
              <div className="client-panel-row-right">
                <span>—</span>
                <ChevronRight size={14} className="client-panel-chevron" aria-hidden="true" />
              </div>
            </button>

            <button
              className="client-panel-row"
              onClick={() => handleClick("Transaction History", "View receipts")}
            >
              <div className="client-panel-row-left">
                <Receipt className="client-panel-row-icon" aria-hidden="true" />
                <span>Transaction History</span>
              </div>
              <div className="client-panel-row-right">
                <span>Receipts</span>
                <ChevronRight size={14} className="client-panel-chevron" aria-hidden="true" />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Panel 3: Pre-order Services */}
      <div className="client-panel preorder">
        <div className="client-panel-bg" aria-hidden="true" />
        <div className="client-panel-overlay" aria-hidden="true" />

        <div className="client-panel-content">
          <div className="client-panel-top">
            <div className="client-panel-title-row">
              <Coffee className="client-panel-header-icon" size={20} aria-hidden="true" />
              <h3 className="client-panel-title">Pre-order Services</h3>
            </div>
            <p className="client-panel-desc">
              Order coffee and snacks directly to your workstation.
            </p>
          </div>

          <div className="client-panel-rows">
            <button
              className="client-panel-row"
              onClick={() => handleClick("Order Specialty Coffee", "In stock")}
            >
              <div className="client-panel-row-left">
                <Coffee className="client-panel-row-icon" aria-hidden="true" />
                <span>Specialty Coffee</span>
              </div>
              <div className="client-panel-row-right">
                <span>In stock</span>
                <ChevronRight size={14} className="client-panel-chevron" aria-hidden="true" />
              </div>
            </button>

            <button
              className="client-panel-row"
              onClick={() => handleClick("Order Tea & Refreshments", "In stock")}
            >
              <div className="client-panel-row-left">
                <Sparkles className="client-panel-row-icon" aria-hidden="true" />
                <span>Tea &amp; Refreshments</span>
              </div>
              <div className="client-panel-row-right">
                <span>In stock</span>
                <ChevronRight size={14} className="client-panel-chevron" aria-hidden="true" />
              </div>
            </button>

            <button
              className="client-panel-row"
              onClick={() => handleClick("Request Extra Pass", "₱200")}
            >
              <div className="client-panel-row-left">
                <Receipt className="client-panel-row-icon" aria-hidden="true" />
                <span>Request Extra Pass</span>
              </div>
              <div className="client-panel-row-right">
                <span>₱200</span>
                <ChevronRight size={14} className="client-panel-chevron" aria-hidden="true" />
              </div>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
