import TeamBadge from './TeamBadge.jsx';

export default function GroupStandingsTable({ standings, teamsById, qualifyCount = 0 }) {
  return (
    <div className="ticket" style={{ padding: 0, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
            <Th align="left" style={{ paddingLeft: 16 }}>#</Th>
            <Th align="left">Team</Th>
            <Th>P</Th>
            <Th>W</Th>
            <Th>D</Th>
            <Th>L</Th>
            <Th>GD</Th>
            <Th style={{ paddingRight: 16 }}>Pts</Th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row) => {
            const qualifies = qualifyCount > 0 && row.rank <= qualifyCount;
            return (
              <tr
                key={row.teamId}
                style={{
                  borderTop: '1px solid var(--line)',
                  background: qualifies ? 'rgba(76, 175, 95, 0.08)' : 'transparent',
                }}
              >
                <Td align="left" style={{ paddingLeft: 16, color: 'var(--text-muted)' }}>{row.rank}</Td>
                <Td align="left">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TeamBadge name={teamsById[row.teamId]?.name ?? '?'} size={24} />
                    <span style={{ fontWeight: 600 }}>{teamsById[row.teamId]?.name ?? 'Unknown'}</span>
                  </div>
                </Td>
                <Td>{row.played}</Td>
                <Td>{row.won}</Td>
                <Td>{row.drawn}</Td>
                <Td>{row.lost}</Td>
                <Td>{row.gd > 0 ? `+${row.gd}` : row.gd}</Td>
                <Td style={{ paddingRight: 16, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{row.points}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {qualifyCount > 0 && (
        <div style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-muted)', borderTop: '1px solid var(--line)' }}>
          Top {qualifyCount} advance to the knockout stage
        </div>
      )}
    </div>
  );
}

function Th({ children, align = 'center', style }) {
  return <th style={{ padding: '10px 6px', textAlign: align, fontWeight: 600, ...style }}>{children}</th>;
}
function Td({ children, align = 'center', style }) {
  return <td style={{ padding: '10px 6px', textAlign: align, ...style }}>{children}</td>;
}
