"use client";

import { Clock3, Computer, Play, Plus, Square } from "lucide-react";
import { Header } from "../app-shell";
import { Station } from "../types";

export function StationsPage({ stations, onStart, onEnd, onAdd }: { stations: Station[]; onStart: (station: Station) => void; onEnd: (station: Station) => void; onAdd: () => void }) {
  const active = stations.filter((station) => station.active);
  const estimated = active.reduce((sum, station) => sum + (Date.now() - (station.startedAt ?? Date.now())) / 3_600_000 * station.rate, 0);
  return <>
    <Header title="Station Board"><span className="header-metric"><Computer /> Active: <b>{active.length}/{stations.length}</b></span><span className="header-metric"><Clock3 /> Sessions: <b>{active.length}</b></span><span className="header-metric">Est. Revenue: <b>₱{estimated.toFixed(2)}</b></span></Header>
    <div className="page-body"><div className="title-row"><div><h2>All Stations</h2><p>{stations.length} stations configured</p></div><button onClick={onAdd}><Plus size={18} /> Add Station</button></div>
      <div className="station-grid">{stations.map((station) => <article className={`station-card ${station.active ? "in-use" : station.pending ? "waiting" : ""}`} key={station.id}>
        <h3><Computer size={18} /> {station.name}</h3>
        <p><span className={`badge ${station.type.toLowerCase()}`}>{station.type}</span><span className="rate">₱{station.rate.toFixed(2)}/hr</span></p>
        {station.notes && <small className="station-note">{station.notes}</small>}
        {station.pending && <div className="session-info"><span>{station.customer}</span><strong><Clock3 size={15} /> Waiting for client sign-in</strong></div>}
        {station.active && <div className="session-info"><span>{station.customer}</span><strong><Clock3 size={15} /> Active session</strong></div>}
        {station.active ? <button className="danger" onClick={() => onEnd(station)}><Square size={17} /> End Session</button> : station.pending ? <button className="secondary" disabled><Clock3 size={17} /> Awaiting Client</button> : <button onClick={() => onStart(station)}><Play size={17} /> Start Session</button>}
      </article>)}</div>
    </div>
  </>;
}
