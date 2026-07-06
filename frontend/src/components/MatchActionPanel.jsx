import { useState } from 'react';
import {
  submitMatchScore, confirmMatchScore, disputeMatchScore,
  resolveDispute, forfeitMatch, reopenMatch,
} from '../api/client.js';

/** viewer: { type: 'team', teamId, token } | { type: 'organizer', token } */
export default function MatchActionPanel({ tournamentId, match, teamsById, viewer, onChanged }) {
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [busy, setBusy] = useState(false);
  const isOrganizer = viewer.type === 'organizer';
  const isParticipant = viewer.type === 'team' && (viewer.teamId === match.teamAId || viewer.teamId === match.teamBId);

  if (!isOrganizer && !isParticipant) return null;
  if (match.status === 'bye') return null;

  async function run(fn) {
    setBusy(true);
    try { await fn(); onChanged?.(); }
    catch (err) { alert(err.message ?? 'Something went wrong.'); }
    finally { setBusy(false); }
  }

  const scoreInputs = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <input className="input mono" style={{ width: 64, textAlign: 'center' }} type="number" min="0"
        value={scoreA} onChange={(e) => setScoreA(e.target.value)} placeholder="0" />
      <span style={{ color: 'var(--text-muted)' }}>–</span>
      <input className="input mono" style={{ width: 64, textAlign: 'center' }} type="number" min="0"
        value={scoreB} onChange={(e) => setScoreB(e.target.value)} placeholder="0" />
    </div>
  );

  if (match.status === 'not_played') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ fontSize: 13 }}>Enter the final score:</p>
        {scoreInputs}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" disabled={busy || scoreA === '' || scoreB === ''}
            onClick={() => run(() => submitMatchScore(tournamentId, viewer.token, match.id, Number(scoreA), Number(scoreB)))}>
            Submit score
          </button>
          {isOrganizer && <ForfeitButton {...{ tournamentId, match, teamsById, viewer, run, busy }} />}
        </div>
      </div>
    );
  }

  if (match.status === 'pending_confirmation') {
    const submittedByThisViewer = isParticipant && match.submittedBy === viewer.teamId;

    if (isOrganizer) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 13 }}>Submitted score: <strong className="mono">{match.scoreA} – {match.scoreB}</strong></p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" disabled={busy} onClick={() => run(() => confirmMatchScore(tournamentId, viewer.token, match.id))}>
              Approve score
            </button>
            <ForfeitButton {...{ tournamentId, match, teamsById, viewer, run, busy }} />
          </div>
        </div>
      );
    }

    if (submittedByThisViewer) {
      return <p style={{ fontSize: 13 }}>Waiting for the other team (or the organizer) to confirm this score.</p>;
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ fontSize: 13 }}>The other team reported <strong className="mono">{match.scoreA} – {match.scoreB}</strong>. Agree?</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" disabled={busy} onClick={() => run(() => confirmMatchScore(tournamentId, viewer.token, match.id))}>
            Yes, confirm
          </button>
        </div>
        <details>
          <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)' }}>That's not right — enter a different score</summary>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {scoreInputs}
            <button className="btn btn-danger" disabled={busy || scoreA === '' || scoreB === ''}
              onClick={() => run(() => disputeMatchScore(tournamentId, viewer.token, match.id, Number(scoreA), Number(scoreB)))}>
              Flag as disputed
            </button>
          </div>
        </details>
      </div>
    );
  }

  if (match.status === 'disputed') {
    if (!isOrganizer) {
      return <p style={{ fontSize: 13, color: 'var(--danger)' }}>This score is disputed — the organizer will decide the final result.</p>;
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ fontSize: 13 }}>
          One side said <strong className="mono">{match.scoreA} – {match.scoreB}</strong>, the other said{' '}
          <strong className="mono">{match.disputedScoreA} – {match.disputedScoreB}</strong>. Set the final score:
        </p>
        {scoreInputs}
        <button className="btn btn-primary" disabled={busy || scoreA === '' || scoreB === ''}
          onClick={() => run(() => resolveDispute(tournamentId, viewer.token, match.id, Number(scoreA), Number(scoreB)))}>
          Set final score
        </button>
      </div>
    );
  }

  if (match.status === 'confirmed' && isOrganizer) {
    return (
      <button className="btn btn-secondary" disabled={busy} onClick={() => run(() => reopenMatch(tournamentId, viewer.token, match.id))}>
        Reopen match
      </button>
    );
  }

  return null;
}

function ForfeitButton({ tournamentId, match, teamsById, viewer, run, busy }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button className="btn btn-secondary" disabled={busy} onClick={() => setOpen(true)}>Mark forfeit</button>;
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <button className="btn btn-secondary" disabled={busy} onClick={() => run(() => forfeitMatch(tournamentId, viewer.token, match.id, match.teamAId))}>
        {teamsById[match.teamAId]?.name ?? 'Team A'} wins
      </button>
      <button className="btn btn-secondary" disabled={busy} onClick={() => run(() => forfeitMatch(tournamentId, viewer.token, match.id, match.teamBId))}>
        {teamsById[match.teamBId]?.name ?? 'Team B'} wins
      </button>
    </div>
  );
}
