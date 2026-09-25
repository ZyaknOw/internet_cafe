"use client";

import {
  Wifi,
  Users,
  Coffee,
  Gamepad2,
  Clock3,
  Receipt,
  ShieldCheck,
  UserRound,
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
    <section className="client-panels-grid" aria-label="Portal Services and Bookings">
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

      {/* Panel 2: Room Booking */}
      <div className="client-panel rooms">
        <div className="client-panel-bg" aria-hidden="true" />
        <div className="client-panel-overlay" aria-hidden="true" />

        <div className="client-panel-content">
          <div className="client-panel-top">
            <div className="client-panel-title-row">
              <Users className="client-panel-header-icon" size={20} aria-hidden="true" />
              <h3 className="client-panel-title">Room Booking</h3>
            </div>
            <p className="client-panel-desc">
              Reserve a Discussion Room for your team or study group.
            </p>
          </div>

          <div className="client-panel-rows">
            <button
              className="client-panel-row"
              onClick={() => handleClick("Reserve Studio Room (1–5 pax)", "₱1,500")}
            >
              <div className="client-panel-row-left">
                <ShieldCheck className="client-panel-row-icon" aria-hidden="true" />
                <span>Studio (1–5 pax)</span>
              </div>
              <div className="client-panel-row-right">
                <span>₱1,500</span>
                <ChevronRight size={14} className="client-panel-chevron" aria-hidden="true" />
              </div>
            </button>

            <button
              className="client-panel-row"
              onClick={() => handleClick("Reserve Forum Room (6–12 pax)", "₱3,000")}
            >
              <div className="client-panel-row-left">
                <ShieldCheck className="client-panel-row-icon" aria-hidden="true" />
                <span>Forum (6–12 pax)</span>
              </div>
              <div className="client-panel-row-right">
                <span>₱3,000</span>
                <ChevronRight size={14} className="client-panel-chevron" aria-hidden="true" />
              </div>
            </button>

            <button
              className="client-panel-row"
              onClick={() => handleClick("Add Extra Member Pass", "₱200")}
            >
              <div className="client-panel-row-left">
                <UserRound className="client-panel-row-icon" aria-hidden="true" />
                <span>Extra Member</span>
              </div>
              <div className="client-panel-row-right">
                <span>₱200</span>
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
              Order coffee and roastery items directly to your table or room.
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
