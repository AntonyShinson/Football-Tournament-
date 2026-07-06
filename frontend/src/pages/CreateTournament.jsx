import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTournament, saveOrganizerToken } from '../api/client.js';

export default function CreateTournament() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', organizerName: '', location: '', organizerPassword: '',
    expectedTeams: '', tournamentType: 'group_knockout', allowLateEntry: false,
  });
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function set(key, value) { setForm((f) => ({ ...f, [key]: value })); }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.organizerPassword) return;
    setBusy(true);
    setError('');
    try {
      const res = await createTournament({ ...form, expectedTeams: Number(form.expectedTeams) || undefined });
      saveOrganizerToken(res.tournamentId, res.organizerToken);
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const origin = window.location.origin;
    const joinLink = `${origin}/t/${result.tournamentId}/join`;
    const adminLink = `${origin}/t/${result.tournamentId}/admin`;

    return (
      <div className="container">
        <div className="eyebrow">Tournament created</div>
        <h1 style={{ fontSize: 30, margin: '8px 0 24px' }}>{form.name}</h1>

        <div className="ticket" style={{ padding: 16, marginBottom: 14, borderColor: 'var(--amber)' }}>
          <p style={{ fontSize: 13, marginBottom: 8 }}>Tournament ID — teams and viewers use this</p>
          <div className="mono" style={{ fontSize: 22, fontWeight: 700 }}>{result.tournamentId}</div>
        </div>

        <LinkBlock label="Team join link — share this in WhatsApp" value={joinLink} />
        <LinkBlock label="Your admin dashboard — bookmark this, and remember your organizer password" value={adminLink} />

        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate(`/t/${result.tournamentId}/admin`)}>
          Go to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="eyebrow">FootballHub</div>
      <h1 style={{ fontSize: 30, margin: '8px 0 6px' }}>Start a tournament</h1>
      <p style={{ marginBottom: 28 }}>No accounts. Just a tournament ID, an organizer password, and a link to share.</p>

      <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Tournament name">
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} required />
        </Field>
        <Field label="Organizer name (optional)">
          <input className="input" value={form.organizerName} onChange={(e) => set('organizerName', e.target.value)} />
        </Field>
        <Field label="Location (optional)">
          <input className="input" value={form.location} onChange={(e) => set('location', e.target.value)} />
        </Field>
        <Field label="Expected number of teams (optional)">
          <input className="input" type="number" min="2" value={form.expectedTeams} onChange={(e) => set('expectedTeams', e.target.value)} />
        </Field>
        <Field label="Tournament format">
          <select className="input" value={form.tournamentType} onChange={(e) => set('tournamentType', e.target.value)}>
            <option value="group_knockout">Group stage + Knockout</option>
            <option value="knockout_only">Knockout only</option>
          </select>
        </Field>
        <Field label="Organizer password — you'll use this to log into the dashboard">
          <input className="input" type="password" value={form.organizerPassword} onChange={(e) => set('organizerPassword', e.target.value)} required />
        </Field>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.allowLateEntry} onChange={(e) => set('allowLateEntry', e.target.checked)} />
          <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>Allow late entries after the tournament starts</span>
        </label>

        {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create tournament'}</button>
      </form>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

function LinkBlock({ label, value }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="ticket" style={{ padding: 16, marginBottom: 14 }}>
      <p style={{ fontSize: 13, marginBottom: 8 }}>{label}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 12px', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value}
        </div>
        <button className="btn btn-secondary" onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
