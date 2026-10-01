"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";

export interface ReceiptRecord {
  id: string;
  source: "order" | "session";
  customer: string;
  service: string;
  amount: number;
  method: string;
  timestamp: string | null;
  status: string;
  transactionId?: string;
  station?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  durationSeconds?: number | null;
  pcTotal?: number | null;
  snackItems?: { id: string; name: string; price: number; quantity: number }[];
  cashReceived?: number | null;
  changeDue?: number | null;
  notes?: string | null;
}

const money = (value: number) => `₱${Number(value).toFixed(2)}`;
const date = (value?: string | null) => value ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "medium" }) : "Not recorded";
const duration = (seconds: number) => [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), Math.floor(seconds % 60)].map((value) => String(value).padStart(2, "0")).join(":");

export function ReceiptDetailsModal({ receipt, onClose }: { receipt: ReceiptRecord; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    return () => { element?.close(); document.body.style.overflow = overflow; previousFocus?.focus(); };
  }, []);
  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(onClose, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180);
    return () => window.clearTimeout(timer);
  }, [closing, onClose]);
  const row = (label: string, value: string) => <div className="receipt-detail-row"><span>{label}</span><b>{value}</b></div>;
  return <dialog ref={dialog} className={`receipt-details-dialog digital-receipt${closing ? " is-closing" : ""}`}
    aria-labelledby="receipt-details-title" onCancel={(event) => { event.preventDefault(); setClosing(true); }}
    onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) setClosing(true);
    }}>
    <div className="payment-success-icon" aria-hidden="true"><CheckCircle2 size={38} /></div>
    <div className="receipt-kicker">INTERNET CAFE</div>
    <h3 id="receipt-details-title">Receipt Details</h3>
    <div className="receipt-paid">PAID ✓</div>
    <div className="receipt-separator" />
    <div className="receipt-detail-lines">
      {row("Receipt", receipt.id)}
      {row("Client", receipt.customer)}
      {row("Date / time", date(receipt.timestamp))}
      {(receipt.station || receipt.source === "session") && row("PC / Station", receipt.station || "Not recorded")}
      {receipt.source === "session" && <>
        {row("Session start", date(receipt.startedAt))}
        {row("Session end", date(receipt.endedAt))}
        {row("Duration", receipt.durationSeconds == null ? "Not recorded" : duration(receipt.durationSeconds))}
        <div className="receipt-separator" />
        {row("PC Usage", receipt.pcTotal == null ? "Not recorded" : money(receipt.pcTotal))}
      </>}
      {receipt.snackItems?.map((item, index) => <div className="receipt-detail-row" key={`${item.id}-${index}`}>
        <span>{item.name}<small>{item.quantity} × {money(item.price)}</small></span><b>{money(item.quantity * item.price)}</b>
      </div>)}
      <div className="receipt-separator" />
      {row("TOTAL PAID", money(receipt.amount))}
      {row("Payment method", receipt.method)}
      {receipt.cashReceived != null && row("Cash received", money(receipt.cashReceived))}
      {receipt.changeDue != null && row("Change", money(receipt.changeDue))}
      {receipt.notes && row("Notes", receipt.notes)}
      {receipt.transactionId && row("Transaction ID", receipt.transactionId)}
    </div>
    <p className="receipt-thanks">Thank you for visiting!</p>
    <button type="button" className="nodecafe-btn-primary" autoFocus onClick={() => setClosing(true)}>Close receipt</button>
  </dialog>;
}
