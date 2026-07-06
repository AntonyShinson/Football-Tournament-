import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getTournament, organizerLogin, saveOrganizerToken, getOrganizerToken,
  listTeams, setTeamStatus, resetTeamPassword, startTournament, listMatches, getStandings,
  generateKnockout, addLateEntry, schedulePlayoff, updateSettings,
} from '../api/client.js';
import { unevenGroupsWarning, validateGroupCount, canStartKnockout } from '../lib/validation.js';
import MatchCard from '../components/MatchCard.jsx';
import MatchActionPanel from '../components/MatchActionPanel.jsx';
import GroupStandingsTable from '../components/GroupStandingsTable.jsx';
import KnockoutBracket from '../components/KnockoutBracket.jsx';
import TeamBadge from '../components/TeamBadge.jsx';
import ShareCard from '../components/ShareCard.jsx';

export default function OrganizerDashboard() {
  const { tournamentId } = useParams();
  const [token, setToken] = useState(() => getOrganizerToken(tournamentId));
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

  const [tournament, setTournament] = useState(null);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [standingsByGroup, setStandingsByGroup] = useState({});
  const [numGroups, setNumGroups] = useState(2);
  const [qualifiersPerGroup, setQualifiersPerGroup] = useState(2);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const t = await getTournament(tournamentId);
      const allTeams = await listTeams(tournamentId, token);
      const allMatches = t.status !== 'registration' ? await listMatches(tournamentId) : [];
      setTournament(t); setTeams(allTeams); setMatches(allMatches);

      if (t.groups?.length) {
        const entries = await Promise.all(t.groups.map(async (g) => [g.id, (await getStandings(tournamentId, g.id))]));
        setStandingsByGroup(Object.fromEntries(entries));
      }
    } catch (err) {
      if (err.message.includes('401')) { setToken(null); }
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tournamentId, token]);

  useEffect(() => { load(); }, [load]);

  async function handleLogin(e) {
    e.preventDefault();
    setLoginBusy(true); setLoginError('');
    try {
      const res = await organizerLogin(tournamentId, password);
      saveOrganizerToken(tournamentId, res.organizerToken);
      setToken(res.organizerToken);
    } catch (err) {
      setLoginError(err.message);
    } finally { setLoginBusy(false); }
  }

  if (!token) {
    return (
      <div className="container">
        <div className="eyebrow">{tournamentId}</div>
        <h1 style={{ fontSize: 26, margin: '8px 0 20px' }}>Organizer login</h1>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input className="input" type="password" placeholder="Organizer password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {loginError && <p style={{ color: 'var(--danger)' }}>{loginError}</p>}
          <button className="btn btn-primary" type="submit" disabled={loginBusy}>{loginBusy ? 'Checking…' : 'Log in'}</button>
        </form>
      </div>
    );
  }

  if (loading) return <div className="container"><p>Loading…</p></div>;
  if (!tournament) return <div className="container"><p>Could not load this tournament.</p></div>;

  const pending = teams.filter((t) => t.status === 'pending');
  const approved = teams.filter((t) => t.status === 'approved');
  const groupCheck = validateGroupCount(approved.length, numGroups);
  const unevenWarning = groupCheck.ok ? unevenGroupsWarning(approved.length, numGroups) : null;
  const teamsById = Object.fromEntries(teams.map((t) => [t.id, t]));
  const unplacedApproved = approved.filter((t) => !t.groupId);

  async function handleStart() {
    setError('');
    try { await startTournament(tournamentId, token, numGroups); await load(); }
    catch (err) { setError(err.message); }
  }
  async function handleGenerateKnockout() {
    setError('');
    try { await generateKnockout(tournamentId, token, qualifiersPerGroup); await load(); }
    catch (err) { setError(err.message); }
  }

  return (
    <div className="container">
      <div className="eyebrow">Organizer dashboard</div>
      <h1 style={{ fontSize: 28, margin: '8px 0 6px' }}>{tournament.name}</h1>
      <span className="badge badge-turf">{tournament.status.replace('_', ' ')}</span>
      <button className="btn btn-secondary" onClick={load} style={{ marginLeft: 10 }}>Refresh</button>

      <div style={{ margin: '20px 0' }}>
        <p style={{ fontSize: 13, marginBottom: 6 }}>Share this link for teams to join:</p>
        <code style={{ fontSize: 12, color: 'var(--turf-bright)' }}>{`${window.location.origin}/t/${tournamentId}/join`}</code>
      </div>

      <Section title="Tournament settings">
        <div className="ticket" style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>Allow late entries</div>
            <p style={{ fontSize: 12 }}>Lets teams register after the tournament has started.</p>
          </div>
          <ToggleSwitch
            checked={!!tournament.allowLateEntry}
            onChange={(next) => updateSettings(tournamentId, token, { allowLateEntry: next }).then(load)}
          />
        </div>
      </Section>

      {error && <p style={{ color: 'var(--danger)', marginBottom: 16 }}>{error}</p>}

      {pending.length > 0 && (
        <Section title={`Entry requests (${pending.length})`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pending.map((t) => (
              <div key={t.id} className="ticket" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                <TeamBadge name={t.name} size={32} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{t.name}</div>
                  {t.captainName && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Captain: {t.captainName}</div>}
                </div>
                <button className="btn btn-primary" onClick={() => setTeamStatus(tournamentId, token, t.id, 'approved').then(load)}>Approve</button>
                <button className="btn btn-secondary" onClick={() => setTeamStatus(tournamentId, token, t.id, 'rejected').then(load)}>Reject</button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {tournament.status === 'registration' && (
        <Section title={`Approved teams (${approved.length})`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {approved.map((t) => (
              <div key={t.id} className="ticket" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                <TeamBadge name={t.name} size={30} />
                {t.jerseyColor && (
                  <span style={{ width: 16, height: 16, borderRadius: '50%', background: t.jerseyColor, border: '1px solid var(--line)' }} title={t.jerseyColor} />
                )}
                <span style={{ flex: 1, fontWeight: 600 }}>{t.name}</span>
                <button
                  className="btn btn-secondary"
                  onClick={async () => {
                    const { newPassword } = await resetTeamPassword(tournamentId, token, t.id);
                    alert(`New password for ${t.name}: ${newPassword}\n\nShare this with the team directly — it won't be shown again.`);
                  }}
                >
                  Reset password
                </button>
              </div>
            ))}
          </div>

          <div className="ticket" style={{ padding: 18, marginTop: 18 }}>
            <p style={{ fontSize: 13, marginBottom: 10 }}>Number of groups</p>
            <input className="input mono" style={{ width: 100, marginBottom: 10 }} type="number" min="1"
              value={numGroups} onChange={(e) => setNumGroups(Number(e.target.value))} />
            {!groupCheck.ok && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{groupCheck.message}</p>}
            {unevenWarning && <p style={{ color: 'var(--amber)', fontSize: 13, marginBottom: 10 }}>{unevenWarning}</p>}
            <button className="btn btn-primary" disabled={!groupCheck.ok} onClick={handleStart}>Start tournament</button>
          </div>
        </Section>
      )}

      {tournament.status !== 'registration' && (
        <>
          {tournament.allowLateEntry && unplacedApproved.length > 0 && (
            <Section title="Newly approved teams (not yet placed)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {unplacedApproved.map((t) => (
                  <div key={t.id} className="ticket" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <TeamBadge name={t.name} size={32} />
                    <span style={{ flex: 1, fontWeight: 600 }}>{t.name}</span>
                    <button className="btn btn-primary" onClick={() => addLateEntry(tournamentId, token, t.id).then(load)}>Add to smallest group</button>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {tournament.groups.map((group) => {
            const groupMatches = matches.filter((m) => m.groupId === group.id);
            const { standings = [], unresolvedTies = [] } = standingsByGroup[group.id] ?? {};
            return (
              <Section key={group.id} title={group.name}>
                <div style={{ marginBottom: 12 }}>
                  <GroupStandingsTable standings={standings} teamsById={teamsById} qualifyCount={tournament.qualifiersPerGroup} />
                </div>
                {unresolvedTies.length > 0 && (
                  <div className="ticket" style={{ padding: 14, marginBottom: 12, borderColor: 'var(--amber)' }}>
                    <p style={{ fontSize: 13, marginBottom: 8 }}>
                      Standings still tied after head-to-head — schedule a playoff decider:
                    </p>
                    {unresolvedTies.map((cluster, i) => (
                      <button key={i} className="btn btn-secondary" style={{ marginRight: 8 }}
                        onClick={() => schedulePlayoff(tournamentId, token, cluster[0].teamId, cluster[1].teamId, group.id).then(load)}>
                        {teamsById[cluster[0].teamId]?.name} vs {teamsById[cluster[1].teamId]?.name}
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {groupMatches.map((m) => (
                    <MatchCard key={m.id} match={m} teamsById={teamsById}
                      footer={<MatchActionPanel tournamentId={tournamentId} match={m} teamsById={teamsById} viewer={{ type: 'organizer', token }} onChanged={load} />} />
                  ))}
                </div>
                <ShareSection tournamentName={tournament.name} title={`${group.name} — Fixtures`} matches={groupMatches} teamsById={teamsById} />
              </Section>
            );
          })}

          {tournament.status === 'group_stage' && (
            <Section title="Move to knockout stage">
              <div className="ticket" style={{ padding: 18 }}>
                <p style={{ fontSize: 13, marginBottom: 10 }}>Teams qualifying per group</p>
                <input className="input mono" style={{ width: 100, marginBottom: 10 }} type="number" min="1"
                  value={qualifiersPerGroup} onChange={(e) => setQualifiersPerGroup(Number(e.target.value))} />
                {(() => {
                  const check = canStartKnockout(tournament.groups, qualifiersPerGroup);
                  return !check.ok ? <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{check.message}</p> : null;
                })()}
                <button className="btn btn-primary" onClick={handleGenerateKnockout}
                  disabled={!canStartKnockout(tournament.groups, qualifiersPerGroup).ok}>
                  Generate knockout bracket
                </button>
              </div>
            </Section>
          )}

          {(tournament.status === 'knockout' || tournament.status === 'completed') && (
            <Section title="Knockout stage">
              <KnockoutBracket matches={matches.filter((m) => m.stage === 'knockout')} teamsById={teamsById} />
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {matches.filter((m) => m.stage === 'knockout' && m.status !== 'bye').map((m) => (
                  <MatchCard key={m.id} match={m} teamsById={teamsById} subtitle={m.roundName}
                    footer={<MatchActionPanel tournamentId={tournamentId} match={m} teamsById={teamsById} viewer={{ type: 'organizer', token }} onChanged={load} />} />
                ))}
              </div>
            </Section>
          )}
        </>
      )}

      <p style={{ marginTop: 32, fontSize: 13 }}>
        <Link to={`/t/${tournamentId}`}>View public spectator page</Link>
      </p>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>{title}</h3>
      {children}
    </div>
  );
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 46, height: 26, borderRadius: 999, border: 'none', cursor: 'pointer', position: 'relative',
        background: checked ? 'var(--turf-bright)' : 'var(--surface-2)', transition: 'background 0.15s ease', flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute', top: 3, left: checked ? 23 : 3, width: 20, height: 20, borderRadius: '50%',
          background: '#fff', transition: 'left 0.15s ease',
        }}
      />
    </button>
  );
}

function ShareSection({ tournamentName, title, matches, teamsById }) {
  if (matches.length === 0) return null;
  return (
    <div style={{ marginTop: 14 }}>
      <ShareCard tournamentName={tournamentName} title={title}>
        {matches.map((m) => <MatchCard key={m.id} match={m} teamsById={teamsById} compact />)}
      </ShareCard>
    </div>
  );
}
