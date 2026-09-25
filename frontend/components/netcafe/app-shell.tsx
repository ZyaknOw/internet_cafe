"use client";

import { BarChart3, Computer, Settings, ShieldCheck, UserPlus, UserRound, Users } from "lucide-react";
import { PageId, Profile } from "./types";

const nav: [PageId, string, typeof Computer][] = [["stations", "Stations", Computer], ["customers", "Customers", Users], ["reports", "Reports", BarChart3], ["admin", "Admin", ShieldCheck], ["profiles", "Profiles", UserRound], ["settings", "Settings", Settings]];

export function AppShell({ activeProfile, page, setPage, onSignOut, children }: { activeProfile: Profile; page: PageId; setPage: (page: PageId) => void; onSignOut: () => void; children: React.ReactNode }) {
  const items = nav.filter(([id]) => activeProfile.role === "Administrator" || !["admin", "settings"].includes(id));
  return <main className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand-icon" aria-hidden="true"><Computer size={21} /></span><b>Internet Cafe</b></div><nav>{items.map(([id, label, Icon]) => <button key={id} className={page === id ? "active" : ""} onClick={() => setPage(id)}><Icon size={20} aria-hidden="true" />{label}</button>)}</nav><div className="side-footer"><button className="current-profile" onClick={() => setPage("profiles")}><div className="profile-dot" style={{ background: activeProfile.color }}>{activeProfile.name[0]}</div><div><b>{activeProfile.name}</b><span>{activeProfile.role}</span></div></button><button onClick={onSignOut}><UserPlus size={19} aria-hidden="true" /> Sign Out</button></div></aside><section className="content">{children}</section></main>;
}

export function Header({ title, children }: { title: string; children?: React.ReactNode }) { return <header><h1>{title}</h1><div>{children}</div></header>; }
