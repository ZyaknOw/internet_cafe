import { Header } from "../app-shell";
import { Station } from "../types";
export function SettingsPage({ stations }: { stations: Station[] }) { return <><Header title="Settings" /><div className="page-body narrow"><section className="panel"><div className="section-title">Station Rates</div><p>Manage station pricing and bulk configuration here.</p>{stations.map(station => <div className="station-rate" key={station.id}><span><b>{station.name}</b><em>{station.type}</em></span><b>₱{station.rate.toFixed(2)}/hr</b></div>)}</section></div></>; }
