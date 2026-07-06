import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getTournament, listTeams, listMatches, getStandings } from '../api/client.js';
import MatchCard from '../components/MatchCard.jsx';
import GroupStandingsTable from '../components/GroupStandingsTable.jsx';
import KnockoutBracket from '../components/KnockoutBracket.jsx';

export default function PublicView() {
  const { tournamentId } = useParams();
  const [tournament, setTournament] = useState(null);
  const [teamsById, setTeamsById] = useState({});
  const [matches, setMatches] = useState([]);
  const [standingsByGroup, setStandingsByGroup] = useState({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    try {
      const t = await getTournament(tournamentId);
      const teams = await listTeams(tournamentId);
      const allMatches = t.status !== 'registration' ? await listMatches(tournamentId) : [];
      setTeamsById(Object.fromEntries(teams.map((tm) => [tm.id, tm])));
      setMatches(allMatches);
      setTournament(t);
      if (t.groups?.length) {
        const entries = await Promise.all(t.groups.map(async (g) => [g.id, (await getStandings(tournamentId, g.id)).standings]));
        setStandingsByGroup(Object.fromEntries(entries));
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="container"><p>Loading…</p></div>;
  if (notFound || !tournament) return <div className="container"><p>Tournament not found.</p></div>;

  return (
    <div className="container">
      <div className="eyebrow">FootballHub</div>
      <h1 style={{ fontSize: 28, margin: '8px 0 6px' }}>{tournament.name}</h1>
      <span className="badge badge-turf">{tournament.status.replace('_', ' ')}</span>
      <button className="btn btn-secondary" onClick={load} style={{ marginLeft: 10 }}>Refresh</button>

      {tournament.status === 'registration' && (
        <p style={{ marginTop: 20 }}>
          Registration is open. Teams can join at <Link to={`/t/${tournamentId}/join`}>this link</Link>.
        </p>
      )}

      {tournament.status !== 'registration' && tournament.groups.map((group) => {
        const groupMatches = matches.filter((m) => m.groupId === group.id);
        const standings = standingsByGroup[group.id] ?? [];
        return (
          <Section key={group.id} title={group.name}>
            <div style={{ marginBottom: 12 }}>
              <GroupStandingsTable standings={standings} teamsById={teamsById} qualifyCount={tournament.qualifiersPerGroup} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {groupMatches.map((m) => <MatchCard key={m.id} match={m} teamsById={teamsById} />)}
            </div>
          </Section>
        );
      })}

      {(tournament.status === 'knockout' || tournament.status === 'completed') && (
        <Section title="Knockout stage">
          <KnockoutBracket matches={matches.filter((m) => m.stage === 'knockout')} teamsById={teamsById} />
        </Section>
      )}

      <p style={{ marginTop: 32, fontSize: 13 }}>
        Playing in this tournament? <Link to={`/t/${tournamentId}/join`}>Enter or log in as your team</Link>.
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
