"use client";
import "./rubric-panels.css";

export interface ReportAnalytics {
  granularity: string; asOf: string;
  buckets: { label: string; start: string; end: string; revenue: number; sessions: number; complete: boolean }[];
  previous: { start: string; end: string; revenue: number; sessions: number };
  comparison: { revenueChange: number; revenueChangePercent: number | null; currentPeriodComplete: boolean };
  statistics: { averageTicket: number; peakRevenueInterval: string | null; busiestInterval: string | null };
  projection: { revenue: number | null; start: string; end: string; completedBuckets: number; completedSessions: number; method: string; note: string };
}
const peso = (amount: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);
const periodDate = (value: string) => new Date(value).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric" });

function ReportChart({ data, metric }: { data: ReportAnalytics["buckets"]; metric: "revenue" | "sessions" }) {
  const label = metric === "revenue" ? "Paid PC revenue" : "Completed PC sessions";
  const width = 800, height = 260, left = 72, bottom = 40, top = 18;
  const plotWidth = width - left - 20, plotHeight = height - bottom - top;
  const max = Math.max(1, ...data.map(item => item[metric]));
  const step = plotWidth / Math.max(1, data.length);
  const y = (value: number) => top + plotHeight - value / max * plotHeight;
  return <figure className="rubric-chart"><figcaption>{label}</figcaption>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label} by interval, Philippine time. Exact values are in the chart data table.`}>
      <title>{label}</title>
      {[0, 0.25, 0.5, 0.75, 1].map(fraction => <g key={fraction}>
        <line x1={left} x2={width - 20} y1={y(max * fraction)} y2={y(max * fraction)} stroke="#dce6e0" />
        <text x={left - 10} y={y(max * fraction) + 4} textAnchor="end" fontSize="11" fill="#52675c">
          {metric === "revenue" ? `₱${(max * fraction).toFixed(max < 10 ? 2 : 0)}` : Number((max * fraction).toFixed(1))}
        </text>
      </g>)}
      {metric === "sessions" && <polyline fill="none" stroke="#226849" strokeWidth="2.5"
        points={data.map((item, index) => `${left + (index + 0.5) * step},${y(item.sessions)}`).join(" ")} />}
      {data.map((item, index) => <g key={item.start}>
        {metric === "revenue" ? <rect x={left + index * step + step * 0.16} y={y(item.revenue)}
          width={step * 0.68} height={plotHeight - (y(item.revenue) - top)} fill={item.complete ? "#226849" : "#9fb6a9"}>
          <title>{`${item.label}: ${peso(item.revenue)}${item.complete ? "" : " (interval not complete)"}`}</title>
        </rect> : <circle cx={left + (index + 0.5) * step} cy={y(item.sessions)} r="3.5" fill="#226849">
          <title>{`${item.label}: ${item.sessions} sessions`}</title></circle>}
        {(index % Math.ceil(data.length / 8) === 0 || index === data.length - 1) && <text
          x={left + (index + 0.5) * step} y={height - 15} textAnchor="middle" fontSize="11" fill="#52675c">{item.label}</text>}
      </g>)}
    </svg>
  </figure>;
}

export function ReportAnalyticsPanel({ data }: { data: ReportAnalytics | null }) {
  if (!data) return null;
  return <section className="rubric-analytics" aria-label="PC revenue charts and analysis">
    <div className="rubric-metrics">
      <article><small>Previous calendar period</small><strong>{peso(data.previous.revenue)}</strong>
        <p>{periodDate(data.previous.start)} through {periodDate(new Date(Date.parse(data.previous.end) - 1).toISOString())}</p></article>
      <article><small>Revenue change</small><strong>{peso(data.comparison.revenueChange)}</strong>
        <p>{data.comparison.revenueChangePercent === null ? "No previous revenue baseline for a percentage" : `${data.comparison.revenueChangePercent > 0 ? "+" : ""}${data.comparison.revenueChangePercent}% against previous period`}</p></article>
      <article><small>Average paid PC session</small><strong>{peso(data.statistics.averageTicket)}</strong>
        <p>Peak revenue: {data.statistics.peakRevenueInterval ?? "No paid sessions"}<br />Busiest interval: {data.statistics.busiestInterval ?? "No paid sessions"}</p></article>
    </div>
    <p className="rubric-note">PC session revenue only; snacks and wallet top-ups are excluded. All intervals use Philippine time.
      {!data.comparison.currentPeriodComplete && " The selected period is incomplete; comparison uses the previous full calendar period."}
      {` As of ${new Date(data.asOf).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} PHT.`}</p>
    <div className="rubric-charts"><ReportChart data={data.buckets} metric="revenue" /><ReportChart data={data.buckets} metric="sessions" /></div>
    <article className="rubric-projection"><h3>Next-period revenue projection</h3>
      <strong>{data.projection.revenue === null ? "Insufficient historical data" : peso(data.projection.revenue)}</strong>
      <p>{periodDate(data.projection.start)} through {periodDate(new Date(Date.parse(data.projection.end) - 1).toISOString())}</p>
      <p>{data.projection.method}</p><p>{data.projection.note}</p>
      <small>Sample: {data.projection.completedBuckets} completed intervals, {data.projection.completedSessions} paid sessions.</small>
    </article>
    <details className="rubric-chart-data"><summary>View exact chart data</summary><div className="rubric-table-wrap">
      <table className="nodecafe-table"><thead><tr><th>Interval (PHT)</th><th>PC revenue</th><th>Completed sessions</th><th>Interval complete</th></tr></thead>
        <tbody>{data.buckets.map(bucket => <tr key={bucket.start}><td>{bucket.label}</td><td>{peso(bucket.revenue)}</td><td>{bucket.sessions}</td><td>{bucket.complete ? "Yes" : "Not yet"}</td></tr>)}</tbody>
      </table></div></details>
  </section>;
}
