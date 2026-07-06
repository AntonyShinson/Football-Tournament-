import { useMemo, useRef, useState } from 'react';
import { colorForName, initialsForName } from '../lib/idGenerator.js';

const OUTER_RADIUS = 380;
const RING_STEP = 78;
const VIEW = 900; // svg viewBox is VIEW x VIEW, centered at (VIEW/2, VIEW/2)

function polar(radius, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: radius * Math.cos(rad), y: radius * Math.sin(rad) };
}

/**
 * Builds a radial tree layout: round-1 teams sit as leaves evenly spaced
 * around the full circle; each later round's match sits on a smaller
 * concentric ring at the angular midpoint of its two children, converging
 * to the champion at dead centre — same idea as the World Cup circular
 * bracket graphic, generalised to any bracket size.
 */
function useRadialLayout(rounds) {
  return useMemo(() => {
    if (rounds.length === 0) return { nodes: [], edges: [] };

    const leaves = [...rounds[0]]
      .sort((a, b) => a.slotIndex - b.slotIndex)
      .flatMap((m) => [
        { teamId: m.teamAId, match: m },
        { teamId: m.teamBId, match: m },
      ]);
    const leafCount = leaves.length;
    const leafAngle = (i) => (i / leafCount) * 360 - 90;

    // angle span of leaves covered by a given round/slot (round 0 covers 2 leaves per match,
    // round 1 covers 4, round 2 covers 8, ...)
    function angleForRound(roundIdx, slotIndex) {
      const spread = Math.pow(2, roundIdx + 1);
      const startIdx = slotIndex * spread;
      const midIdx = startIdx + spread / 2 - 0.5;
      return leafAngle(midIdx);
    }

    const nodes = [];
    const edges = [];
    const posByMatchId = {};

    rounds.forEach((roundMatches, roundIdx) => {
      const isFinal = roundIdx === rounds.length - 1 && roundMatches.length === 1;
      // Match nodes sit one ring inside the leaves for round 0, two rings in for round 1, etc.
      const radius = isFinal ? 0 : OUTER_RADIUS - (roundIdx + 1) * RING_STEP;

      roundMatches.forEach((m) => {
        const angle = isFinal ? -90 : angleForRound(roundIdx, m.slotIndex);
        const pos = isFinal ? { x: 0, y: 0 } : polar(radius, angle);
        posByMatchId[m.id] = { ...pos, angle, radius };
      });
    });

    // Leaves (round-1 team slots)
    rounds[0].forEach((m) => {
      const posM = posByMatchId[m.id];
      [m.teamAId, m.teamBId].forEach((teamId, side) => {
        const idx = m.slotIndex * 2 + side;
        const angle = leafAngle(idx);
        const pos = polar(OUTER_RADIUS, angle);
        nodes.push({ id: `${m.id}-${side}`, teamId, angle, x: pos.x, y: pos.y, isLeaf: true, match: m });
        edges.push({ x1: pos.x, y1: pos.y, x2: posM.x, y2: posM.y });
      });
    });

    // Inner rounds (match nodes + winner nodes feeding the next round)
    for (let r = 0; r < rounds.length; r++) {
      rounds[r].forEach((m) => {
        const pos = posByMatchId[m.id];
        const winnerId = m.status === 'confirmed' ? (m.scoreA > m.scoreB ? m.teamAId : m.teamBId) : m.status === 'bye' ? m.winnerId : null;
        nodes.push({ id: m.id, teamId: winnerId, angle: pos.angle, x: pos.x, y: pos.y, isLeaf: false, match: m, isChampion: r === rounds.length - 1 && !!winnerId });

        if (r < rounds.length - 1) {
          const nextRound = rounds[r + 1];
          const parent = nextRound.find((n) => Math.floor(m.slotIndex / 2) === n.slotIndex);
          if (parent) {
            const parentPos = posByMatchId[parent.id];
            edges.push({ x1: pos.x, y1: pos.y, x2: parentPos.x, y2: parentPos.y });
          }
        }
      });
    }

    return { nodes, edges };
  }, [rounds]);
}

export default function KnockoutBracket({ matches, teamsById }) {
  const rounds = useMemo(() => {
    const byRound = {};
    matches.forEach((m) => { (byRound[m.round] ??= []).push(m); });
    return Object.keys(byRound).sort((a, b) => a - b).map((r) => byRound[r]);
  }, [matches]);

  const { nodes, edges } = useRadialLayout(rounds);
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [selected, setSelected] = useState(null);
  const dragRef = useRef(null);

  if (rounds.length === 0) return <p style={{ fontSize: 13 }}>The bracket hasn't been generated yet.</p>;

  function onWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setTransform((t) => ({ ...t, scale: Math.min(3, Math.max(0.4, t.scale + delta)) }));
  }
  function onPointerDown(e) {
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: transform.x, origY: transform.y };
  }
  function onPointerMove(e) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setTransform((t) => ({ ...t, x: dragRef.current.origX + dx, y: dragRef.current.origY + dy }));
  }
  function onPointerUp() { dragRef.current = null; }

  function zoom(delta) {
    setTransform((t) => ({ ...t, scale: Math.min(3, Math.max(0.4, t.scale + delta)) }));
  }
  function resetView() { setTransform({ scale: 1, x: 0, y: 0 }); }

  return (
    <div className="ticket" style={{ padding: 0, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 2, display: 'flex', gap: 6 }}>
        <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => zoom(0.2)}>+</button>
        <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => zoom(-0.2)}>−</button>
        <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={resetView}>Reset</button>
      </div>

      <svg
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        style={{ width: '100%', height: 520, cursor: dragRef.current ? 'grabbing' : 'grab', touchAction: 'none' }}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <g transform={`translate(${VIEW / 2 + transform.x} ${VIEW / 2 + transform.y}) scale(${transform.scale})`}>
          {/* trophy / champion marker at centre */}
          <circle r="26" fill="var(--surface-2)" stroke="var(--amber)" strokeWidth="2" />
          <text textAnchor="middle" dy="6" fontSize="20">🏆</text>

          {edges.map((e, i) => (
            <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke="var(--line)" strokeWidth="1.5" />
          ))}

          {nodes.map((n) => {
            const name = n.teamId ? teamsById[n.teamId]?.name : null;
            const color = name ? colorForName(name) : 'var(--surface-2)';
            const initials = name ? initialsForName(name) : '?';
            const r = n.isLeaf ? 20 : n.isChampion ? 22 : 16;
            return (
              <g
                key={n.id}
                transform={`translate(${n.x} ${n.y})`}
                style={{ cursor: name ? 'pointer' : 'default' }}
                onClick={() => name && setSelected({ name, match: n.match, isChampion: n.isChampion })}
              >
                <circle r={r} fill={color} stroke={n.isChampion ? 'var(--amber)' : 'var(--bg)'} strokeWidth={n.isChampion ? 3 : 2} />
                <text textAnchor="middle" dy="5" fontSize={n.isLeaf ? 13 : 11} fontFamily="var(--font-display)" fontWeight="700" fill="#0e1712">
                  {initials}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {selected && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--bg-elevated)',
          borderTop: '1px solid var(--line)', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontWeight: 700 }}>{selected.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {selected.isChampion ? 'Champion' : selected.match?.roundName}
            </div>
          </div>
          <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setSelected(null)}>Close</button>
        </div>
      )}
    </div>
  );
}
