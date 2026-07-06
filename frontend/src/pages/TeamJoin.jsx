import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTournament, registerTeam, teamLogin, saveTeamSession } from '../api/client.js';
import JerseyColorPicker from '../components/JerseyColorPicker.jsx';

export default function TeamJoin() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  // Deliberately starts as null every time this page loads — the person must
  // actively choose "New team" or "Existing team" on every visit, rather than
  // landing on whichever mode was last used.
  const [mode, setMode] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [reg, setReg] = useState({ name: '', captainName: '', password: '', contactNumber: '', jerseyColor: '' });
  const [login, setLogin] = useState({ name: '', password: '' });

  useEffect(() => { getTournament(tournamentId).then(setTournament).catch(() => setTournament(null)); }, [tournamentId]);

  const tournamentStarted = tournament && tournament.status !== 'registration';
  const entryClosed = tournamentStarted && !tournament.allowLateEntry;

  async function handleRegister(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const res = await registerTeam(tournamentId, reg);
      saveTeamSession(tournamentId, res.teamId, res.teamToken);
      navigate(`/t/${tournamentId}/team`);
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const res = await teamLogin(tournamentId, login.name, login.password);
      saveTeamSession(tournamentId, res.teamId, res.teamToken);
      navigate(`/t/${tournamentId}/team`);
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  }

  if (tournament === null) return <div className="container"><p>Loading…</p></div>;

  return (
    <div className="container">
      <div className="eyebrow">{tournament.name}</div>
      <h1 style={{ fontSize: 28, margin: '8px 0 24px' }}>Join as a team</h1>

      {mode === null && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <ChoiceCard
            title="New team"
            subtitle="Register your team for this tournament"
            onClick={() => setMode('register')}
          />
          <ChoiceCard
            title="Existing team"
            subtitle="Already registered — log in with your team name and password"
            onClick={() => setMode('login')}
          />
        </div>
      )}

      {mode === 'register' && (
        entryClosed ? (
          <div className="ticket" style={{ padding: 20 }}>
            <p>This tournament has started and the organizer isn't accepting late entries right now.</p>
            <button className="btn btn-secondary" style={{ marginTop: 14 }} onClick={() => setMode(null)}>Back</button>
          </div>
        ) : (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <input className="input" placeholder="Team name" value={reg.name} onChange={(e) => setReg({ ...reg, name: e.target.value })} required />
            <input className="input" placeholder="Captain name (optional)" value={reg.captainName} onChange={(e) => setReg({ ...reg, captainName: e.target.value })} />
            <input className="input" type="password" placeholder="Choose a team password" value={reg.password} onChange={(e) => setReg({ ...reg, password: e.target.value })} required />
            <input className="input" placeholder="Contact number (optional)" value={reg.contactNumber} onChange={(e) => setReg({ ...reg, contactNumber: e.target.value })} />

            <div className="ticket" style={{ padding: 18 }}>
              <JerseyColorPicker value={reg.jerseyColor} onChange={(color) => setReg({ ...reg, jerseyColor: color })} />
            </div>

            {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" type="button" onClick={() => setMode(null)}>Back</button>
              <button className="btn btn-primary" type="submit" disabled={busy} style={{ flex: 1 }}>
                {busy ? 'Submitting…' : 'Register team'}
              </button>
            </div>
          </form>
        )
      )}

      {mode === 'login' && (
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input className="input" placeholder="Team name" value={login.name} onChange={(e) => setLogin({ ...login, name: e.target.value })} required />
          <input className="input" type="password" placeholder="Team password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} required />
          {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" type="button" onClick={() => setMode(null)}>Back</button>
            <button className="btn btn-primary" type="submit" disabled={busy} style={{ flex: 1 }}>
              {busy ? 'Logging in…' : 'Log in'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function ChoiceCard({ title, subtitle, onClick }) {
  return (
    <button
      onClick={onClick}
      className="ticket"
      style={{
        padding: 20, textAlign: 'left', border: '1px solid var(--line)', background: 'var(--surface)',
        cursor: 'pointer', width: '100%',
      }}
    >
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, marginBottom: 4, color: 'var(--text)' }}>
        {title}
      </div>
      <p style={{ fontSize: 13 }}>{subtitle}</p>
    </button>
  );
}