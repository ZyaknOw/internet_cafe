"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export const stationIdentity = (name: string) => name.trim().toUpperCase().replace(/^PC[ -]*0*([1-9][0-9]*)( .*)?$/, "PC-$1");

export interface TransferredSession {
  id: string;
  station_key: string;
  station_name: string;
  customer_profile_id: string;
  customer_name: string;
  hourly_rate: number;
  started_at: string;
  billing_paused_ms?: number;
  status: "active";
}

export interface TransferDestination { id: string; name: string; status: string; transferAvailable: boolean; type: "Standard" | "VIP"; rate: number; specs: string }

export function TransferPcModal({ sessionId, sourceName, customerName, onClose, onTransferred }: {
  sessionId: string;
  sourceName: string;
  customerName: string;
  onClose: () => void;
  onTransferred: (session: TransferredSession, destination: TransferDestination) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef(false);
  const availabilityPending = useRef(false);
  const [destinations, setDestinations] = useState<TransferDestination[]>([]);
  const [destinationId, setDestinationId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [availabilityError, setAvailabilityError] = useState("");

  const loadDestinations = useCallback(async (signal: AbortSignal) => {
    if (availabilityPending.current || signal.aborted) return;
    availabilityPending.current = true;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Please sign in again.");
      const response = await fetch(`${API_URL}/api/stations`, {
        headers: { Authorization: `Bearer ${session.access_token}` }, signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]), cache: "no-store",
      });
      if (!response.ok) throw new Error("Could not refresh available PCs. Close this window and try again.");
      const body = await response.json() as { stations: TransferDestination[] };
      if (!signal.aborted) {
        setAvailabilityError("");
        setDestinations(body.stations.filter((station) =>
          station.status === "available" && station.transferAvailable === true && stationIdentity(station.name) !== stationIdentity(sourceName),
        ));
      }
    } catch (err) {
      if (!signal.aborted) {
        setDestinations([]);
        setAvailabilityError(err instanceof Error ? err.message : "Could not load available PCs.");
      }
    } finally {
      availabilityPending.current = false;
      if (!signal.aborted) setLoading(false);
    }
  }, [sourceName]);

  useEffect(() => {
    dialog.current?.showModal();
    const controller = new AbortController();
    const initialLoad = window.setTimeout(() => void loadDestinations(controller.signal), 0);
    const timer = window.setInterval(() => {
      void loadDestinations(controller.signal);
    }, 5000);
    return () => { controller.abort(); window.clearTimeout(initialLoad); window.clearInterval(timer); };
  }, [loadDestinations]);

  const destination = destinations.find((station) => station.id === destinationId);
  const confirm = async () => {
    if (!destination || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Please sign in again.");
      const response = await fetch(`${API_URL}/api/station-sessions/${encodeURIComponent(sessionId)}/transfer`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ destinationStationId: destination.id, expectedStationKey: sourceName }),
      });
      const body = await response.json() as { session?: TransferredSession; error?: string };
      if (!response.ok || !body.session) throw new Error(body.error || "Could not transfer this session.");
      onTransferred(body.session, destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not transfer this session. Refresh before retrying.");
      setDestinationId("");
      setDestinations([]);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  return (
    <dialog ref={dialog} className="staff-transfer-dialog" aria-labelledby="transfer-title"
      onCancel={(event) => { event.preventDefault(); if (!pending.current) onClose(); }}>
      <h2 id="transfer-title">Transfer PC</h2>
      <p>Move <strong>{customerName}</strong> from <strong>{sourceName}</strong> to another available PC.</p>
      <label htmlFor="transfer-destination">Destination PC</label>
      <select id="transfer-destination" value={destinationId} disabled={busy || loading}
        onChange={(event) => setDestinationId(event.target.value)}>
        <option value="">{loading ? "Loading available PCs..." : "Choose an available PC"}</option>
        {destinations.map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}
      </select>
      {!loading && destinations.length === 0 && <p role="status">No other PCs are available right now.</p>}
      <p>The same session, elapsed time, and hourly rate continue. No new bill is created.</p>
      {destination && <p>Confirm transfer: <strong>{sourceName} → {destination.name}</strong>?</p>}
      {availabilityError && <p role="alert">{availabilityError}</p>}
      {error && <p role="alert" style={{ color: "#a32121" }}>{error}</p>}
      <div className="staff-transfer-actions">
        <button type="button" className="staff-transfer-button" disabled={busy} onClick={onClose}>Cancel</button>
        <button type="button" className="nodecafe-btn-primary" disabled={!destination || busy} onClick={() => void confirm()}>
          {busy ? "Transferring..." : "Confirm Transfer"}
        </button>
      </div>
    </dialog>
  );
}
