"use client";

import { Wifi } from "lucide-react";

export function ClientFooter() {
  return (
    <footer className="client-footer-bar">
      <div className="client-footer-left">
        <span className="client-footer-brand">ETHER.CAFE</span>
        <span className="client-footer-sep">|</span>
        <span>Client Portal</span>
      </div>

      <div className="client-footer-right">
        <Wifi size={14} aria-hidden="true" />
        <span>Fast Internet. Good People. Great Games.</span>
      </div>
    </footer>
  );
}
