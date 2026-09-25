"use client";

import { useMemo, useState } from "react";
import { CalendarDays, CircleDollarSign, Clock3, Computer, Download, Gauge } from "lucide-react";
import { Header } from "../app-shell";
import { Session, Station } from "../types";

const money = (value: number) => `₱${value.toFixed(2)}`;
const hoursLabel = (minutes: number) => `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`;

export function ReportsPage({ stations, sessions }: { stations: Station[]; sessions: Session[] }) {
  const [period, setPeriod] = useState<"Daily" | "Weekly" | "Monthly">("Daily");
  const metrics = useMemo(() => {
    const now = Date.now();
    const activeSessions = stations.filter((station) => station.active);
    const activeRevenue = activeSessions.reduce((total, station) => total + ((now - (station.startedAt ?? now)) / 3_600_000) * station.rate, 0);
    const revenue = sessions.reduce((total, session) => total + session.total, 0) + activeRevenue;
    const minutes = sessions.reduce((total, session) => total + (session.endedAt - session.startedAt) / 60_000, 0) + activeSessions.reduce((total, station) => total + (now - (station.startedAt ?? now)) / 60_000, 0);
    const count = sessions.length + activeSessions.length;
    return { revenue, minutes, count, activeRevenue };
  }, [sessions, stations]);

  const cards = [
    [CircleDollarSign, "Today", money(metrics.revenue)], [CalendarDays, "This Week", money(metrics.revenue)],
    [CalendarDays, "This Month", money(metrics.revenue)], [CircleDollarSign, "All-Time Revenue", money(metrics.revenue)],
    [Clock3, "Total Hours", hoursLabel(metrics.minutes)], [Computer, "Total Sessions", String(metrics.count)],
    [Computer, "Stations", String(stations.length)], [Gauge, "Avg Session", metrics.count ? money(metrics.revenue / metrics.count) : "₱0.00"],
  ] as const;

  return <><Header title="Reports"><button onClick={() => window.print()}><Download size={18} /> Export CSV</button></Header><div className="page-body reports-page">
    <div className="metrics report-metrics">{cards.map(([Icon, label, value]) => <article className="metric" key={label}><Icon /><p>{label}</p><b>{value}</b></article>)}</div>
    <ReportChart title="Revenue Over Time" period={period} setPeriod={setPeriod} values={period === "Daily" ? [72, 26, 54, 34, 88, 43, 64] : period === "Weekly" ? [28, 56, 43, 76, 52, 88] : [42, 72, 56, 91, 68, 83]} prefix="₱" />
    <ReportChart title="Sessions Count Over Time" period={period} setPeriod={setPeriod} values={period === "Daily" ? [26, 48, 31, 64, 52, 82, 58] : period === "Weekly" ? [33, 52, 67, 48, 79, 88] : [40, 68, 53, 87, 72, 93]} />
    <section className="panel utilization-panel"><div className="section-title">Station Utilization</div>{stations.map((station) => { const stationSessions = sessions.filter((session) => session.station === station.name).length + (station.active ? 1 : 0); const minutes = sessions.filter((session) => session.station === station.name).reduce((total, session) => total + (session.endedAt - session.startedAt) / 60_000, 0); const width = stationSessions ? Math.min(100, 25 + stationSessions * 25) : 4; return <div className="util" key={station.id}><span><span><b>{station.name}</b> <em>{station.type}</em></span><small>{stationSessions} sessions · {hoursLabel(minutes)}</small></span><div><i style={{ width: `${width}%` }} /></div></div>; })}</section>
    <section className="panel session-log"><div className="section-title">Session Log</div>{sessions.length ? sessions.map((session) => <div className="log-row" key={session.id}><div><b>{session.customer}</b><small>{new Date(session.endedAt).toLocaleString()} · {session.station}</small></div><div><span>{Math.max(1, Math.round((session.endedAt - session.startedAt) / 60_000))} min</span><span>{session.payment}</span><b>{money(session.total)}</b></div></div>) : <div className="approval-empty"><Clock3 size={28} /> Completed sessions will appear here.</div>}</section>
  </div></>;
}

function ReportChart({ title, period, setPeriod, values, prefix = "" }: { title: string; period: "Daily" | "Weekly" | "Monthly"; setPeriod: (period: "Daily" | "Weekly" | "Monthly") => void; values: number[]; prefix?: string }) {
  return <section className="panel report-chart"><div className="section-title">{title}<div className="report-tabs">{(["Daily", "Weekly", "Monthly"] as const).map((item) => <button className={period === item ? "selected" : ""} key={item} onClick={() => setPeriod(item)}>{item}</button>)}</div></div><div className="bar-chart"><div className="chart-scale"><span>{prefix}100</span><span>{prefix}75</span><span>{prefix}50</span><span>{prefix}25</span><span>{prefix}0</span></div><div className="chart-columns">{values.map((value, index) => <div className="chart-column" key={`${title}-${index}`}><i style={{ height: `${value}%` }} /><small>{period === "Daily" ? `Day ${index + 1}` : `${period.slice(0, 1)}${index + 1}`}</small></div>)}</div></div></section>;
}
