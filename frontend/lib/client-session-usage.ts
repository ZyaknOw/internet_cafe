export interface ClientSessionStation {
  mine?: boolean;
  startedAt?: string;
  sessionStatus?: "pending_client" | "active" | "awaiting_payment";
  rate: number;
  sessionRate?: number;
  billingPausedMs?: number;
  checkoutDurationSeconds?: number | null;
  checkoutTotal?: number | null;
}

// Display only: persisted session checkout remains the authority for billing.
export function clientSessionUsage(station: ClientSessionStation | null, now: number) {
  const rawRate = Number(station?.sessionRate ?? station?.rate ?? 0);
  const rate = Number.isFinite(rawRate) && rawRate >= 0 ? rawRate : 0;
  const empty = { seconds: 0, total: 0, rate };
  if (!station?.mine || !station.startedAt) return empty;
  const startedAt = Date.parse(station.startedAt);
  if (!Number.isFinite(startedAt)) return empty;

  if (station.sessionStatus === "awaiting_payment") {
    const duration = Number(station.checkoutDurationSeconds);
    const total = Number(station.checkoutTotal);
    return {
      seconds: Number.isFinite(duration) ? Math.max(0, Math.floor(duration)) : 0,
      total: Number.isFinite(total) ? Math.max(0, total) : 0,
      rate,
    };
  }
  if (station.sessionStatus !== "active" || !Number.isFinite(now)) return empty;
  const paused = Number(station.billingPausedMs ?? 0);
  const pausedMs = Number.isFinite(paused) ? Math.max(0, paused) : 0;
  const seconds = Math.max(0, Math.floor((now - startedAt - pausedMs) / 1000));
  return { seconds, total: Number((seconds / 3600 * rate).toFixed(2)), rate };
}
