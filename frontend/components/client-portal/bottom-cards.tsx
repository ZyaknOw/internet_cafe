"use client";

import { Shield, Headphones, ArrowRight } from "lucide-react";
import Image from "next/image";

interface BottomCardsProps {
  onManageAccount?: () => void;
  onOrderNow?: () => void;
  onContactStaff?: () => void;
}

export function BottomCards({
  onManageAccount,
  onOrderNow,
  onContactStaff,
}: BottomCardsProps) {
  return (
    <section className="client-bottom-grid" aria-label="Account, Specials and Assistance">
      {/* 1. Account & Privacy Card */}
      <div className="client-card-standard">
        <div className="client-card-standard-top">
          <div className="client-card-standard-title-row">
            <Shield size={20} color="#142219" aria-hidden="true" />
            <h4 className="client-card-standard-title">Account &amp; Privacy</h4>
          </div>
          <p className="client-card-standard-desc">
            Update your profile, consent preferences, or request account assistance.
          </p>
        </div>
        <button
          className="client-pill-btn"
          onClick={onManageAccount}
          aria-label="Manage Account and Privacy Settings"
        >
          <span>Manage Account</span>
          <ArrowRight size={13} aria-hidden="true" />
        </button>
      </div>

      {/* 2. Coffee Promo Card: Good Coffee Better Games */}
      <div className="client-card-promo">
        <div className="client-promo-left">
          <span className="client-promo-kicker">Good Coffee</span>
          <h4 className="client-promo-title">Better Games</h4>
          <p className="client-promo-desc">
            Pre-order your favorite drinks and keep going!
          </p>
          <button
            className="client-promo-btn"
            onClick={onOrderNow}
            aria-label="Order coffee drinks now"
          >
            <span>Order Now</span>
            <ArrowRight size={13} aria-hidden="true" />
          </button>
        </div>

        <div className="client-promo-image-box">
          <img
            src="/images/dashboard/coffee-latte-art.jpg"
            alt="Latte art in ceramic cup with roasted coffee beans"
            className="client-promo-img"
          />
        </div>
      </div>

      {/* 3. Need Assistance Card */}
      <div className="client-card-standard">
        <div className="client-card-standard-top">
          <div className="client-card-standard-title-row">
            <Headphones size={20} color="#142219" aria-hidden="true" />
            <h4 className="client-card-standard-title">Need Assistance?</h4>
          </div>
          <p className="client-card-standard-desc">
            Our staff is ready to assist you.
          </p>
        </div>
        <button
          className="client-pill-btn"
          onClick={onContactStaff}
          aria-label="Contact Cafe Staff"
        >
          <span>Contact Staff</span>
          <ArrowRight size={13} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
