export type ReportPeriod = "daily" | "monthly" | "yearly";
type Range = { start: Date; end: Date };
type PaidSession = {
  ended_at: string; started_at?: string | null; checkout_total?: number | string | null;
  total?: number | string | null; checkout_duration_seconds?: number | null; billing_paused_ms?: number | null;
};
const MANILA_OFFSET = 8 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const money = (value: number) => Number(value.toFixed(2));
const amount = (row: PaidSession) => Math.max(0, Number(row.checkout_total ?? row.total) || 0);

function shiftPeriod(date: Date, period: ReportPeriod, count: number) {
  if (period === "daily") return new Date(date.getTime() + count * DAY);
  const local = new Date(date.getTime() + MANILA_OFFSET);
  return new Date(Date.UTC(local.getUTCFullYear() + (period === "yearly" ? count : 0),
    local.getUTCMonth() + (period === "monthly" ? count : 0), 1) - MANILA_OFFSET);
}
export function previousReportRange(range: Range, period: ReportPeriod): Range {
  return { start: shiftPeriod(range.start, period, -1), end: range.start };
}

export function reportAnalytics(rows: PaidSession[], previousRows: PaidSession[], range: Range,
  period: ReportPeriod, now: Date) {
  const granularity = period === "daily" ? "hour" : period === "monthly" ? "day" : "month";
  const buckets: { label: string; start: string; end: string; revenue: number; sessions: number; complete: boolean }[] = [];
  let start = range.start;
  while (start < range.end) {
    const end = period === "yearly" ? shiftPeriod(start, "monthly", 1)
      : new Date(start.getTime() + (period === "daily" ? 60 * 60 * 1000 : DAY));
    const label = start.toLocaleString("en-US", { timeZone: "Asia/Manila",
      ...(period === "daily" ? { hour: "numeric" as const } : period === "monthly"
        ? { month: "short" as const, day: "numeric" as const } : { month: "short" as const }) });
    buckets.push({ label, start: start.toISOString(), end: end.toISOString(), revenue: 0, sessions: 0,
      complete: end <= now });
    start = end;
  }
  for (const row of rows) {
    const ended = Date.parse(row.ended_at);
    if (!Number.isFinite(ended) || ended > now.getTime()) continue;
    const bucket = buckets.find(item => ended >= Date.parse(item.start) && ended < Date.parse(item.end));
    if (bucket) { bucket.revenue += amount(row); bucket.sessions += 1; }
  }
  for (const bucket of buckets) bucket.revenue = money(bucket.revenue);
  const totalRevenue = money(buckets.reduce((sum, bucket) => sum + bucket.revenue, 0));
  const sessionCount = buckets.reduce((sum, bucket) => sum + bucket.sessions, 0);
  const previousRevenue = money(previousRows.reduce((sum, row) => sum + amount(row), 0));
  const completed = buckets.filter(bucket => bucket.complete);
  const completedSessions = completed.reduce((sum, bucket) => sum + bucket.sessions, 0);
  const nextStart = range.end;
  const nextEnd = shiftPeriod(nextStart, period, 1);
  const nextUnits = period === "daily" ? 24 : period === "yearly" ? 12
    : Math.round((nextEnd.getTime() - nextStart.getTime()) / DAY);
  const projected = completed.length >= 3 && completedSessions >= 3
    ? money(completed.reduce((sum, bucket) => sum + bucket.revenue, 0) / completed.length * nextUnits) : null;
  const peak = [...buckets].sort((a, b) => b.revenue - a.revenue)[0];
  const busiest = [...buckets].sort((a, b) => b.sessions - a.sessions)[0];
  return {
    granularity, buckets, asOf: now.toISOString(), timezone: "Asia/Manila",
    previous: { ...previousReportRange(range, period), revenue: previousRevenue, sessions: previousRows.length },
    comparison: { revenueChange: money(totalRevenue - previousRevenue),
      revenueChangePercent: previousRevenue > 0 ? money((totalRevenue - previousRevenue) / previousRevenue * 100) : null,
      currentPeriodComplete: now >= range.end },
    statistics: { averageTicket: sessionCount ? money(totalRevenue / sessionCount) : 0,
      peakRevenueInterval: totalRevenue > 0 ? peak.label : null,
      busiestInterval: sessionCount ? busiest.label : null },
    projection: { revenue: projected, start: nextStart.toISOString(), end: nextEnd.toISOString(),
      completedBuckets: completed.length, completedSessions,
      method: `Average revenue per completed ${granularity} in the selected period × ${nextUnits} ${granularity}s in the next period.`,
      note: "Estimate only. Assumes the observed average continues; excludes seasonality, holidays and demand changes. At least 3 completed intervals and 3 paid sessions are required." },
  };
}
