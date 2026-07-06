import TeamBadge from './TeamBadge.jsx';
import CountdownTimer from './CountdownTimer.jsx';

const STATUS_LABEL = {
  not_played: { text: 'Not played', cls: 'badge-muted' },
  pending_confirmation: { text: 'Pending confirmation', cls: 'badge-amber' },
  disputed: { text: 'Score disputed', cls: 'badge-danger' },
  confirmed: { text: 'Final', cls: 'badge-turf' },
  bye: { text: 'Bye', cls: 'badge-muted' },
};

function teamLabel(id, teamsById) {
  if (!id) return 'TBD';
  return teamsById[id]?.name ?? 'Unknown team';
}

/**
 * `footer` — optional extra node (action buttons, dispute banner) rendered below the divider.
 * `compact` — smaller, used for share-card rendering / dense lists.
 */
export default function MatchCard({ match, teamsById, footer = null, subtitle = null, compact = false }) {
  const status = STATUS_LABEL[match.status] ?? STATUS_LABEL.not_played;
  const nameA = teamLabel(match.teamAId, teamsById);
  const nameB = teamLabel(match.teamBId, teamsById);
  const played = match.status === 'confirmed' || match.status === 'bye';

  return (
    <div className="ticket" style={{ padding: compact ? '14px' : '18px' }}>
      {subtitle && <div className="eyebrow" style={{ marginBottom: 10 }}>{subtitle}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <TeamBadge name={nameA} size={compact ? 32 : 40} />
          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {nameA}
          </span>
        </div>

        <div className="mono" style={{ fontSize: compact ? 18 : 22, fontWeight: 700, minWidth: 64, textAlign: 'center' }}>
          {played ? `${match.scoreA} – ${match.scoreB}` : match.status === 'not_played' ? 'vs' : `${match.scoreA ?? '?'} – ${match.scoreB ?? '?'}`}
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end', minWidth: 0 }}>
          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>
            {nameB}
          </span>
          <TeamBadge name={nameB} size={compact ? 32 : 40} />
        </div>
      </div>

      <div className="ticket-divider" style={{ margin: '14px 16px' }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <span className={`badge ${status.cls}`}>{status.text}</span>
        <CountdownTimer match={match} />
      </div>

      {footer && <div style={{ marginTop: 14 }}>{footer}</div>}
    </div>
  );
}
