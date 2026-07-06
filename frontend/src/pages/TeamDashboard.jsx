import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  getTournament, getTeamSession, clearTeamSession, listTeams, listMatches, getStandings,
} from '../api/client.js';
import MatchCard from '../components/MatchCard.jsx';
import MatchActionPanel from '../components/MatchActionPanel.jsx';
import GroupStandingsTable from '../components/GroupStandingsTable.jsx';
import ShareCard from '../components/ShareCard.jsx';

const STATUS_COPY = {
  pending: { text: 'Your entry request is waiting for organizer approval.', cls: 'badge-amber' },
  rejected: { text: 'Your entry request was not approved.', cls: 'badge-danger' },
  approved: { text: "You're entered.", cls: 'badge-turf' },
};

export default function TeamDashboard() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const [session] = useState(() => getTeamSession(tournamentId));

  const [tournament, setTournament] = useState(null);
  const [teamsById, setTeamsById] = useState({});
  const [matches, setMatches] = useState([]);
  const [groupStandings, setGroupStandings] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const t = await getTournament(tournamentId);
      const teams = await listTeams(tournamentId, session.token);
      const byId = Object.fromEntries(teams.map((tm) => [tm.id, tm]));
      const allMatches = t.status !== 'registration' ? await listMatches(tournamentId) : [];
      setTournament(t); setTeamsById(byId); setMatches(allMatches);

      const me = byId[session.teamId];
      if (me?.groupId) {
        const { standings } = await getStandings(tournamentId, me.groupId);
        setGroupStandings(standings);
      }
    } catch (err) {
      if (err.message.includes('401')) { clearTeamSession(tournamentId); navigate(`/t/${tournamentId}/join`); }
    } finally {
      setLoading(false);
    }
  }, [tournamentId, session, navigate]);

  useEffect(() => {
    if (!session) { navigate(`/t/${tournamentId}/join`); return; }
    load();
  }, [load, navigate, session, tournamentId]);

  if (!session) return null;
  if (loading) return <div className="container"><p>Loading…</p></div>;

  const team = teamsById[session.teamId];
  if (!team) return <div className="container"><p>Could not load your team.</p></div>;

  const myMatches = matches.filter((m) => m.teamAId === team.id || m.teamBId === team.id);
  const myGroupMatches = myMatches.filter((m) => m.stage === 'group');
  const myKnockoutMatches = myMatches.filter((m) => m.stage === 'knockout');
  const nextMatch = myMatches.find((m) => m.status === 'not_played' || m.status === 'pending_confirmation');
  const myGroup = tournament.groups?.find((g) => g.id === team.groupId);
  const status = STATUS_COPY[team.status];
  const viewer = { type: 'team', teamId: team.id, token: session.token };

  return (
    <div className="container">
      <div className="eyebrow">{tournament.name}</div>
      <h1 style={{ fontSize: 28, margin: '8px 0 6px' }}>{team.name}</h1>
      <span className={`badge ${status.cls}`}>{status.text}</span>
      <button className="btn btn-secondary" onClick={load} style={{ marginLeft: 10 }}>Refresh</button>
      <button
        className="btn btn-secondary"
        style={{ marginLeft: 10 }}
        onClick={() => { clearTeamSession(tournamentId); navigate(`/t/${tournamentId}/join`); }}
      >
        Switch team
      </button>

      {nextMatch && (
        <Section title="Your next match">
          <MatchCard match={nextMatch} teamsById={teamsById}
            footer={<MatchActionPanel tournamentId={tournamentId} match={nextMatch} teamsById={teamsById} viewer={viewer} onChanged={load} />} />
        </Section>
      )}

      {groupStandings && (
        <Section title={`${myGroup?.name ?? 'Group'} standings`}>
          <GroupStandingsTable standings={groupStandings} teamsById={teamsById} qualifyCount={tournament.qualifiersPerGroup} />
        </Section>
      )}

      {myGroupMatches.length > 0 && (
        <Section title="All your group matches">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {myGroupMatches.map((m) => (
              <MatchCard key={m.id} match={m} teamsById={teamsById}
                footer={m !== nextMatch ? <MatchActionPanel tournamentId={tournamentId} match={m} teamsById={teamsById} viewer={viewer} onChanged={load} /> : null} />
            ))}
          </div>
        </Section>
      )}

      {myKnockoutMatches.length > 0 && (
        <Section title="Knockout stage">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {myKnockoutMatches.map((m) => (
              <MatchCard key={m.id} match={m} teamsById={teamsById} subtitle={m.roundName}
                footer={<MatchActionPanel tournamentId={tournamentId} match={m} teamsById={teamsById} viewer={viewer} onChanged={load} />} />
            ))}
          </div>
        </Section>
      )}

      {nextMatch && (
        <Section title="Share this fixture">
          <ShareCard tournamentName={tournament.name} title={`${teamsById[nextMatch.teamAId]?.name} vs ${teamsById[nextMatch.teamBId]?.name}`}>
            <MatchCard match={nextMatch} teamsById={teamsById} compact />
          </ShareCard>
        </Section>
      )}

      <p style={{ marginTop: 32, fontSize: 13 }}>
        <Link to={`/t/${tournamentId}`}>View full tournament (fixtures, standings, bracket)</Link>
      </p>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>{title}</h3>
      {children}
    </div>
  );
}
