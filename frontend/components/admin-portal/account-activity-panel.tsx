"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import "./rubric-panels.css";

const ACTIONS: Record<string, string> = {
  "account.created": "Account created", "account.approved": "Account approved",
  "account.rejected": "Account rejected", "account.updated": "Profile updated",
  "account.deleted": "Account deleted", "account.password_setup_completed": "Password setup completed",
};
interface ActivityEvent {
  id: string; occurred_at: string; actor_name: string; actor_role: string | null;
  target_name: string; target_role: string; action: string;
  details: { changed_fields?: string[]; previous_status?: string | null; status?: string; source?: string };
}

export function AccountActivityPanel() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [updated, setUpdated] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      try {
        const params = new URLSearchParams({ page: String(page) });
        if (action) params.set("action", action);
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        const body = await apiFetch(`/api/admin/activity?${params}`, { signal: controller.signal }) as {
          events: ActivityEvent[]; total: number;
        };
        if (controller.signal.aborted) return;
        setEvents(body.events); setTotal(body.total); setError("");
        setUpdated(new Date().toLocaleTimeString("en-PH", { timeZone: "Asia/Manila" }));
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Could not load account history.");
          setEvents([]); setTotal(0);
        }
      } finally {
        pending = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    const timer = setInterval(() => { void load(); }, 15_000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [action, from, to, page, revision]);

  const filterChanged = () => { setPage(1); setLoading(true); };
  return <section className="nodecafe-page-view" aria-labelledby="activity-title">
    <div className="nodecafe-page-header"><div>
      <h2 id="activity-title" className="nodecafe-page-title">Account Activity History</h2>
      <p className="nodecafe-page-subtitle">Who changed an account, what changed, and when. Dates use Philippine time.</p>
    </div><button className="nodecafe-btn-primary" onClick={() => { setLoading(true); setRevision(value => value + 1); }}>Refresh</button></div>
    <div className="rubric-controls">
      <label>Action<select value={action} onChange={event => { filterChanged(); setAction(event.target.value); }}>
        <option value="">All actions</option>{Object.entries(ACTIONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select></label>
      <label>From<input type="date" value={from} onChange={event => { filterChanged(); setFrom(event.target.value); }} /></label>
      <label>Through<input type="date" value={to} onChange={event => { filterChanged(); setTo(event.target.value); }} /></label>
      <p aria-live="polite">{loading ? "Loading history…" : `${total} events`}{updated && ` · Updated ${updated} PHT`}</p>
    </div>
    <p className="rubric-note">Edits and rejections are recorded from history activation onward. Earlier approvals appear only when an original approval record exists. Passwords and private profile values are never included.</p>
    {error && <p role="alert" className="admin-report-error">{error}</p>}
    <div className="nodecafe-table-card rubric-table-wrap"><table className="nodecafe-table">
      <thead><tr><th>When (PHT)</th><th>Performed by</th><th>Action</th><th>Account</th><th>Details</th></tr></thead>
      <tbody>{!events.length && <tr><td colSpan={5}>{loading ? "Loading…" : error ? "History could not be loaded." : "No recorded events match these filters."}</td></tr>}
        {events.map(event => <tr key={event.id}>
          <td>{new Date(event.occurred_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</td>
          <td><b>{event.actor_name}</b><br /><small>{event.actor_role ?? "Public / system"}</small></td>
          <td>{ACTIONS[event.action] ?? event.action}</td>
          <td><b>{event.target_name}</b><br /><small>{event.target_role}</small></td>
          <td>{event.details.source === "stored_approval" ? "Original stored approval" : event.details.changed_fields?.length
            ? event.details.changed_fields.map(field => field.replaceAll("_", " ")).join(", ") : event.details.status ?? "—"}
            {event.details.previous_status && event.details.previous_status !== event.details.status
              && <div>{event.details.previous_status} → {event.details.status}</div>}</td>
        </tr>)}
      </tbody>
    </table></div>
    <div className="rubric-pagination">
      <button disabled={page <= 1} onClick={() => { setLoading(true); setPage(value => value - 1); }}>Previous</button>
      <span>Page {page} of {Math.max(1, Math.ceil(total / 25))}</span>
      <button disabled={page * 25 >= total} onClick={() => { setLoading(true); setPage(value => value + 1); }}>Next</button>
    </div>
  </section>;
}
