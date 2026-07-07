import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import MatchCard from './MatchCard.jsx';
import MatchActionPanel from './MatchActionPanel.jsx';

// Helper to convert linear rounds into a D3 hierarchical tree format
function buildHierarchy(matches, teamsById) {
  if (!matches || matches.length === 0) return { name: "TBD" };
  const rounds = {};
  matches.forEach(m => {
    rounds[m.round] ??= [];
    rounds[m.round].push(m);
  });
  
  const maxRound = Math.max(...Object.keys(rounds).map(Number));
  const finalMatch = rounds[maxRound]?.[0];
  if (!finalMatch) return { name: "Root" };

  function buildNode(match) {
    if (!match) return { name: "TBD" };
    const prevRoundMatches = rounds[match.round - 1] || [];
    
    // Find child matches feeding into this one
    const child1 = prevRoundMatches.find(m => m.slotIndex === match.slotIndex * 2);
    const child2 = prevRoundMatches.find(m => m.slotIndex === match.slotIndex * 2 + 1);

    const teamA = teamsById[match.teamAId]?.name || "TBD";
    const teamB = teamsById[match.teamBId]?.name || "TBD";

    return {
      name: `M${match.id}`,
      match: match,
      children: [
        child1 ? buildNode(child1) : { name: teamA, isLeaf: true, teamId: match.teamAId },
        child2 ? buildNode(child2) : { name: teamB, isLeaf: true, teamId: match.teamBId }
      ]
    };
  }

  // The champion sits at the center root
  return {
    name: "Champion",
    isRoot: true,
    children: [buildNode(finalMatch)]
  };
}

export default function KnockoutBracket({ matches, teamsById, viewer, tournamentId, onChanged }) {
  const [view, setView] = useState('radial'); // 'radial' | 'normal'
  const [selectedMatch, setSelectedMatch] = useState(null);
  const svgRef = useRef(null);

  const data = useMemo(() => buildHierarchy(matches, teamsById), [matches, teamsById]);

  useEffect(() => {
    if (view !== 'radial' || !svgRef.current || matches.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // clear on re-render

    const w = svgRef.current.clientWidth || 800;
    const h = svgRef.current.clientHeight || 600;
    
    // Scale bracket correctly for screen size
    const radius = Math.min(w, h) / 2 - 50;
    const nodeRadius = Math.max(6, Math.min(w, h) / 50);
    const rootRadius = nodeRadius * 2;

    const g = svg.append("g");

    const zoom = d3.zoom()
      .scaleExtent([0.15, 8])
      .on("zoom", (event) => {
        const k = event.transform.k;
        g.attr("transform", event.transform);
        const dampening = Math.sqrt(k);
        g.selectAll(".node circle").attr("r", d => ((d.depth === 0 ? rootRadius : nodeRadius) / dampening));
        g.selectAll(".dot").attr("r", 2 / dampening);
        g.selectAll(".link").attr("stroke-width", 1.5 / dampening);
      });

    svg.call(zoom);

    const root = d3.hierarchy(data);
    const cluster = d3.cluster().size([2 * Math.PI, radius]);
    cluster(root);

    // D3 Elbow Line logic for clean right angles
    function elbow(d) {
      const r0 = d.source.y;
      const r1 = d.target.y;
      const a0 = d.source.x - Math.PI / 2;
      const a1 = d.target.x - Math.PI / 2;
      
      const sx = r0 * Math.cos(a0);
      const sy = r0 * Math.sin(a0);
      const arcX = r0 * Math.cos(a1);
      const arcY = r0 * Math.sin(a1);
      const ex = r1 * Math.cos(a1);
      const ey = r1 * Math.sin(a1);
      
      let sweep = a1 > a0 ? 1 : 0;
      if (a1 - a0 > Math.PI) sweep = 0;
      if (a0 - a1 > Math.PI) sweep = 1;
      
      return `M ${sx} ${sy} A ${r0} ${r0} 0 0 ${sweep} ${arcX} ${arcY} L ${ex} ${ey}`;
    }

    g.selectAll(".link")
      .data(root.links())
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("fill", "none")
      .attr("stroke", "var(--amber, #A08C5B)")
      .attr("stroke-width", 1.5)
      .attr("d", elbow);

    g.selectAll(".dot")
      .data(root.links())
      .enter()
      .append("circle")
      .attr("class", "dot")
      .attr("fill", "var(--amber, #A08C5B)")
      .attr("r", 2)
      .attr("cx", d => d.source.y * Math.cos(d.target.x - Math.PI / 2))
      .attr("cy", d => d.source.y * Math.sin(d.target.x - Math.PI / 2));

    const node = g.selectAll(".node")
      .data(root.descendants())
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", d => `translate(${d.y * Math.cos(d.x - Math.PI / 2)},${d.y * Math.sin(d.x - Math.PI / 2)})`)
      .style("cursor", d => d.data.match ? "pointer" : "default")
      .on("click", (event, d) => {
          if (d.data.match) setSelectedMatch(d.data.match);
      });

    node.append("circle")
      .attr("r", d => d.depth === 0 ? rootRadius : nodeRadius)
      .attr("fill", d => {
          if (d.depth === 0) return "#D4AF37"; // Gold Root
          if (d.data.isLeaf && d.data.teamId && teamsById[d.data.teamId]?.jerseyColor) {
             return teamsById[d.data.teamId].jerseyColor;
          }
          return `hsl(${d.x * 180 / Math.PI}, 70%, 50%)`;
      })
      .attr("stroke", "var(--bg, #121212)")
      .attr("stroke-width", 1.5);

    node.append("text")
      .attr("dy", "0.31em")
      .attr("x", d => d.x < Math.PI ? 12 : -12)
      .style("text-anchor", d => d.x < Math.PI ? "start" : "end")
      .style("font-size", "11px")
      .style("font-family", "var(--font-display)")
      .style("font-weight", "600")
      .style("fill", "var(--text, #fff)")
      .attr("transform", d => d.x >= Math.PI ? "rotate(180)" : null)
      .text(d => d.data.isLeaf ? d.data.name : "");

    // Center the bracket on load
    svg.call(zoom.transform, d3.zoomIdentity.translate(w / 2, h / 2).scale(1));

  }, [data, matches.length, teamsById, view]);

  if (matches.length === 0) {
     return <div className="ticket" style={{ padding: 18 }}><p style={{ fontSize: 13, margin: 0 }}>The bracket hasn't been generated yet.</p></div>;
  }

  return (
    <div style={{ position: 'relative' }}>
      
      {/* HEADER: Instructions & Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
           {viewer?.type === 'organizer' 
             ? 'Click a match node below to edit scores.' 
             : 'Drag and scroll to zoom around the bracket.'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
           <button className={`btn ${view === 'radial' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('radial')}>Radial View</button>
           <button className={`btn ${view === 'normal' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('normal')}>Normal View</button>
        </div>
      </div>

      {view === 'radial' ? (
        <div className="ticket" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
          <svg ref={svgRef} style={{ width: '100%', height: '65vh', display: 'block', background: 'var(--surface, #121212)' }} />

          {/* SCORE ENTRY / MATCH DETAILS POPUP */}
          {selectedMatch && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--bg-elevated)',
              borderTop: '1px solid var(--line)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14,
              boxShadow: '0 -4px 12px rgba(0,0,0,0.2)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>
                    {teamsById[selectedMatch.teamAId]?.name || 'TBD'} vs {teamsById[selectedMatch.teamBId]?.name || 'TBD'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{selectedMatch.roundName}</div>
                </div>
                <button className="btn btn-secondary" onClick={() => setSelectedMatch(null)}>Close</button>
              </div>
              
              {/* If Organizer, show full editing panel. If Team, just show static score. */}
              {viewer?.type === 'organizer' ? (
                 <MatchActionPanel tournamentId={tournamentId} match={selectedMatch} teamsById={teamsById} viewer={viewer} onChanged={() => {
                     if (onChanged) onChanged();
                 }} />
              ) : (
                 <div style={{ fontSize: 14 }}>
                    Status: <strong>{selectedMatch.status.replace('_', ' ')}</strong> <br/>
                    Score: <strong>{selectedMatch.scoreA} - {selectedMatch.scoreB}</strong>
                 </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {matches.filter((m) => m.status !== 'bye').map((m) => (
            <MatchCard key={m.id} match={m} teamsById={teamsById} subtitle={m.roundName}
              footer={viewer?.type === 'organizer' ? <MatchActionPanel tournamentId={tournamentId} match={m} teamsById={teamsById} viewer={viewer} onChanged={onChanged} /> : null} />
          ))}
        </div>
      )}
    </div>
  );
}