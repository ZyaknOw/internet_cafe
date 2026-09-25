"use client";

import { useState } from "react";
import { Contact, Mail, MapPin, Pencil, Save, ShieldCheck, UserRound, X } from "lucide-react";
import { Header } from "../app-shell";
import { Profile } from "../types";

// Privacy boundary: this page receives only the signed-in user's profile.
export function ProfilesPage({ profile, onSave }: { profile: Profile; onSave: (profile: Profile) => void | Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile);
  const update = (field: keyof Profile, value: string) => setDraft((current) => ({ ...current, [field]: value }));
  const save = async () => {
    const firstName = draft.firstName.trim();
    const lastName = draft.lastName.trim();
    if (!firstName || !lastName || !draft.email.trim()) return;
    await onSave({ ...draft, firstName, lastName, name: [firstName, draft.middleName.trim(), lastName].filter(Boolean).join(" ") });
    setEditing(false);
  };
  const cancel = () => { setDraft(profile); setEditing(false); };

  return <>
    <Header title="My Profile">{!editing && <button onClick={() => setEditing(true)}><Pencil size={17} /> Edit Profile</button>}</Header>
    <div className="page-body"><section className="panel personal-profile">
      <div className="detail-avatar" style={{ background: profile.color }}>{profile.firstName[0]}</div>
      <h2>{profile.name}</h2>
      <span className="role-pill">{profile.role}</span>
      <p>Your personal information is visible only to you.</p>
      {editing ? <div className="profile-form">
        <Field label="First Name" value={draft.firstName} onChange={(value) => update("firstName", value)} />
        <Field label="Middle Name" value={draft.middleName} onChange={(value) => update("middleName", value)} />
        <Field label="Last Name" value={draft.lastName} onChange={(value) => update("lastName", value)} />
        <Field label="Address" value={draft.address} onChange={(value) => update("address", value)} />
        <Field label="Contact Information" value={draft.contact} onChange={(value) => update("contact", value)} />
        <Field label="Gmail (managed by sign-in)" type="email" value={draft.email} disabled onChange={() => undefined} />
        <div className="profile-form-actions"><button className="secondary" onClick={cancel}><X size={17} /> Cancel</button><button onClick={save}><Save size={17} /> Save Changes</button></div>
      </div> : <div className="personal-grid">
        <Info icon={<ShieldCheck size={18} />} label="NetCafe User ID" value={profile.userCode ?? "Will be assigned"} />
        <Info icon={<UserRound size={18} />} label="First Name" value={profile.firstName} />
        <Info icon={<UserRound size={18} />} label="Middle Name" value={profile.middleName || "—"} />
        <Info icon={<UserRound size={18} />} label="Last Name" value={profile.lastName} />
        <Info icon={<MapPin size={18} />} label="Address" value={profile.address} />
        <Info icon={<Contact size={18} />} label="Contact Information" value={profile.contact} />
        <Info icon={<Mail size={18} />} label="Gmail" value={profile.email} />
        <Info icon={<ShieldCheck size={18} />} label="Account Role" value={profile.role} />
      </div>}
    </section></div>
  </>;
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="profile-info"><span>{icon}</span><div><small>{label}</small><b>{value}</b></div></div>;
}

function Field({ label, value, type = "text", disabled = false, onChange }: { label: string; value: string; type?: string; disabled?: boolean; onChange: (value: string) => void }) {
  return <label>{label}<input type={type} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} /></label>;
}
