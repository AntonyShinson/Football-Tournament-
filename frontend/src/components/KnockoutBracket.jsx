import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import MatchCard from './MatchCard.jsx';
import MatchActionPanel from './MatchActionPanel.jsx';

// Helper to get initials for inner nodes
function getInitials(name) {
  if (!name || name === "TBD") return "";
  return name.substring(0, 2).toUpperCase();
}

/**
 * Builds a Team-Based Hierarchy from the Matches array.
 * Leaves = Starting Teams.
 * Joints = The Winner of the match between the two branches.
 * Root = Overall Champion.
 */
function buildTeamHierarchy(matches, teamsById) {
  if (!matches || matches.length === 0) return { name: "TBD" };

  const byRound = {};
  matches.forEach(m => {
    byRound[m.round] ??= [];
    byRound[m.round].push(m);
  });

  const maxRound = Math.max(...Object.keys(byRound).map(Number));
  const finalMatch = byRound[maxRound]?.[0];

  if (!finalMatch) return { name: "TBD" };

  // Determines if a match has a winner yet
  function getWinner(m) {
    if (!m) return null;
    if (m.status === 'confirmed' || m.status === 'bye') {
       if (m.scoreA > m.scoreB) return m.teamAId;
       if (m.scoreB > m.scoreA) return m.teamBId;
       return m.winnerId || m.teamAId;
    }
    return null;
  }

  // Recursively build the tree from the final match outwards to the leaves
  function buildNode(match, round) {
    if (!match) return { name: "TBD", isLeaf: round === 0 };

    const winnerId = getWinner(match);
    const node = {
      match: match,
      teamId: winnerId,
      name: winnerId ? teamsById[winnerId]?.name : "TBD",
      isLeaf: false
    };

    if (round === 1) {
      // Base case: The children are the two starting teams in Round 1
      node.children = [
        { name: teamsById[match.teamAId]?.name || "TBD", teamId: match.teamAId, isLeaf: true, match },
        { name: teamsById[match.teamBId]?.name || "TBD", teamId: match.teamBId, isLeaf: true, match }
      ];
    } else {
      // Recursive case: The children are the matches from the previous round
      const prevRound = byRound[round - 1] || [];
      const childA = prevRound.find(m => m.slotIndex === match.slotIndex * 2);
      const childB = prevRound.find(m => m.slotIndex === match.slotIndex * 2 + 1);
      
      node.children = [
        buildNode(childA, round - 1),
        buildNode(childB, round - 1)
      ];
    }
    return node;
  }

  const rootNode = buildNode(finalMatch, maxRound);
  rootNode.isChampion = true;
  return rootNode;
}

export default function KnockoutBracket({ matches, teamsById, viewer, tournamentId, onChanged }) {
  const [view, setView] = useState('radial'); // 'radial' | 'normal'
  const [selectedMatch, setSelectedMatch] = useState(null);
  
  const containerRef = useRef(null);
  const svgRef = useRef(null);

  const data = useMemo(() => buildTeamHierarchy(matches, teamsById), [matches, teamsById]);

  useEffect(() => {
    if (view !== 'radial' || !svgRef.current || !containerRef.current || matches.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render

    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;
    
    // Scale correctly based on the user's specific logic
    const radius = Math.min(w, h) / 2 - 40;
    const nodeRadius = Math.max(8, Math.min(w, h) / 45);
    const rootRadius = nodeRadius * 1.8;

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
        
        // Scale text size on zoom
        g.selectAll(".node text").style("font-size", `${10 / dampening}px`);
      });

    svg.call(zoom);

    const root = d3.hierarchy(data);
    const cluster = d3.cluster().size([2 * Math.PI, radius]);
    cluster(root);

    // Exact elbow logic provided in the prompt
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
      
      return `
        M ${sx} ${sy}
        A ${r0} ${r0} 0 0 ${sweep} ${arcX} ${arcY}
        L ${ex} ${ey}
      `;
    }

    // Links
    g.selectAll(".link")
      .data(root.links())
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("d", elbow);

    // Dots at corners
    g.selectAll(".dot")
      .data(root.links())
      .enter()
      .append("circle")
      .attr("class", "dot")
      .attr("r", 2)
      .attr("cx", d => d.source.y * Math.cos(d.target.x - Math.PI / 2))
      .attr("cy", d => d.source.y * Math.sin(d.target.x - Math.PI / 2));

    // Nodes (Teams)
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

    // Node Circles
    node.append("circle")
      .attr("r", d => d.depth === 0 ? rootRadius : nodeRadius)
      .attr("fill", d => {
          if (d.data.isChampion && d.data.teamId) return "#D4AF37"; // Gold for absolute champion
          if (!d.data.teamId) return "#222"; // Empty dark gray for unplayed joints
          
          // Use jersey color if available, otherwise fallback dynamic color
          if (d.data.teamId && teamsById[d.data.teamId]?.jerseyColor) {
             return teamsById[d.data.teamId].jerseyColor;
          }
          return `hsl(${d.x * 180 / Math.PI}, 70%, 60%)`;
      })
      .attr("stroke", "#121212")
      .attr("stroke-width", 2);

    // Node Text (Names on leaves, initials on inner joints)
    node.append("text")
      .attr("dy", "0.31em")
      .attr("x", d => d.data.isLeaf ? (d.x < Math.PI ? 14 : -14) : 0)
      .style("text-anchor", d => d.data.isLeaf ? (d.x < Math.PI ? "start" : "end") : "middle")
      .style("font-size", "10px")
      .style("font-family", "Arial, sans-serif")
      .style("font-weight", "bold")
      .style("fill", d => d.data.isLeaf ? "#fff" : "#121212") // Leaves text is white, inner text is dark over colors
      .attr("transform", d => d.data.isLeaf && d.x >= Math.PI ? "rotate(180)" : null)
      .text(d => d.data.isLeaf ? d.data.name : getInitials(d.data.name));

    // Center on load
    svg.call(zoom.transform, d3.zoomIdentity.translate(w / 2, h / 2).scale(1));

    // Handle Resize
    const handleResize = () => {
      svg.call(zoom.transform, d3.zoomIdentity.translate(containerRef.current.clientWidth / 2, containerRef.current.clientHeight / 2).scale(1));
    };
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);

  }, [data, matches.length, teamsById, view]);

  if (matches.length === 0) {
     return <p style={{ fontSize: 13, margin: '20px 0' }}>The bracket hasn't been generated yet.</p>;
  }

  // Calculate dynamic responsive height based on screen size
  const isMobile = window.innerWidth < 768;
  const bracketHeight = isMobile ? '55vh' : '75vh';

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      
      {/* Injecting CSS exactly as provided for the SVG elements */}
      <style>{`
        .bracket-svg .link { fill: none; stroke: #A08C5B; }
        .bracket-svg .dot { fill: #A08C5B; stroke: none; }
        .bracket-svg .node circle { stroke: none; }
      `}</style>

      {/* HEADER: Instructions & Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
           {viewer?.type === 'organizer' 
             ? 'Click any match node below to edit scores.' 
             : 'Drag and scroll to zoom around the bracket.'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
           <button className={`btn ${view === 'radial' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('radial')}>Radial</button>
           <button className={`btn ${view === 'normal' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('normal')}>Normal</button>
        </div>
      </div>

      {view === 'radial' ? (
        // REMOVED `ticket` class. Blended directly with #121212 background.
        <div 
          ref={containerRef}
          style={{ 
            width: '100%', 
            height: bracketHeight, 
            minHeight: '400px',
            background: '#121212', 
            borderRadius: '12px',
            overflow: 'hidden', 
            position: 'relative',
            border: '1px solid rgba(255,255,255,0.1)' // subtle border to separate from page bg if needed
          }}
        >
          <svg className="bracket-svg" ref={svgRef} style={{ width: '100%', height: '100%', display: 'block' }} />

          {/* SCORE ENTRY POPUP OVERLAY */}
          {selectedMatch && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--bg-elevated)',
              borderTop: '1px solid var(--line)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14,
              boxShadow: '0 -4px 12px rgba(0,0,0,0.5)', zIndex: 10
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
              
              {viewer?.type === 'organizer' ? (
                 <MatchActionPanel tournamentId={tournamentId} match={selectedMatch} teamsById={teamsById} viewer={viewer} onChanged={() => {
                     if (onChanged) onChanged();
                 }} />
              ) : (
                 <div style={{ fontSize: 14 }}>
                    Status: <strong>{selectedMatch.status.replace('_', ' ')}</strong> <br/>
                    Score: <strong>{selectedMatch.scoreA ?? 0} - {selectedMatch.scoreB ?? 0}</strong>
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