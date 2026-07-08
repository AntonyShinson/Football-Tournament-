import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import MatchCard from './MatchCard.jsx';
import MatchActionPanel from './MatchActionPanel.jsx';
import { colorForName } from '../lib/idGenerator.js';

// Helper to get initials for inner nodes
function getInitials(name) {
  if (!name || name === "TBD") return "";
  return name.substring(0, 2).toUpperCase();
}

/**
 * Builds the FULL theoretical Team-Based Hierarchy.
 * We calculate the total rounds from Round 1, ensuring all leaves 
 * are always drawn, even if future matches aren't generated yet.
 */
function buildTeamHierarchy(matches, teamsById) {
  if (!matches || matches.length === 0) return { name: "TBD" };

  // Group matches by round to easily find them
  const byRound = {};
  matches.forEach(m => {
    byRound[m.round] ??= [];
    byRound[m.round].push(m);
  });

  // Round 1 defines the entire structure of the bracket
  const round1Matches = byRound[1];
  if (!round1Matches || round1Matches.length === 0) return { name: "TBD" };

  // Mathematically calculate total rounds (e.g., 8 matches = 16 teams = 4 rounds)
  const totalRounds = Math.log2(round1Matches.length * 2);

  // Helper to resolve the winner of a match
  function getWinner(m) {
    if (!m) return null;
    if (m.status === 'confirmed' || m.status === 'bye') {
       if (m.scoreA > m.scoreB) return m.teamAId;
       if (m.scoreB > m.scoreA) return m.teamBId;
       return m.winnerId || m.teamAId;
    }
    return null;
  }

  // Recursively build the tree from the Final (center) out to the Leaves
  function buildNode(round, slotIndex) {
    // Find the real match if it has been generated in the DB
    const realMatch = (byRound[round] || []).find(m => m.slotIndex === slotIndex);
    const winnerId = getWinner(realMatch);

    const node = {
      match: realMatch, 
      teamId: winnerId,
      name: winnerId ? teamsById[winnerId]?.name : "TBD",
      isLeaf: false
    };

    if (round === 1) {
      // Base Case: Round 1 splits into the actual starting Team Leaves
      const teamAId = realMatch?.teamAId;
      const teamBId = realMatch?.teamBId;
      
      node.children = [
        { name: teamAId ? teamsById[teamAId]?.name : "TBD", teamId: teamAId, isLeaf: true, match: realMatch },
        { name: teamBId ? teamsById[teamBId]?.name : "TBD", teamId: teamBId, isLeaf: true, match: realMatch }
      ];
    } else {
      // Recursive Case: Splits into two future match slots
      node.children = [
        buildNode(round - 1, slotIndex * 2),
        buildNode(round - 1, slotIndex * 2 + 1)
      ];
    }
    return node;
  }

  // The absolute center is the Final match
  const rootNode = buildNode(totalRounds, 0);
  rootNode.isChampion = true;
  return rootNode;
}

export default function KnockoutBracket({ matches, teamsById, viewer, tournamentId, onChanged }) {
  const [view, setView] = useState('radial'); 
  const [selectedMatch, setSelectedMatch] = useState(null);
  
  const containerRef = useRef(null);
  const svgRef = useRef(null);

  const data = useMemo(() => buildTeamHierarchy(matches, teamsById), [matches, teamsById]);

  // Determine if the absolute final has been played to light up the center connections
  const finalMatch = data?.match;
  const isFinalPlayed = finalMatch && (finalMatch.status === 'confirmed' || finalMatch.status === 'bye');
  const championTeam = data?.teamId ? teamsById[data.teamId] : null;

  useEffect(() => {
    if (view !== 'radial' || !svgRef.current || !containerRef.current || matches.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); 

    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;
    
    // Scale correctly based on screen size
    const radius = Math.min(w, h) / 2 - 110; 
    const nodeRadius = Math.max(14, Math.min(w, h) / 40); 
    
    const root = d3.hierarchy(data);
    const cluster = d3.cluster().size([2 * Math.PI, radius]);
    cluster(root);

    // Shift all structural nodes outward by 55px to create the center gap and arcs
    root.descendants().forEach(d => {
        d.y = d.y + 55; 
    });

    const g = svg.append("g");

    // Dynamic Zooming Logic
    const zoom = d3.zoom()
      .scaleExtent([0.15, 8])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        
        const k = event.transform.k;
        const dampening = Math.pow(k, 0.65); 

        g.selectAll(".link")
            .attr("stroke-width", d => {
                const isWinnerPath = d.source.data.teamId && d.target.data.teamId && d.source.data.teamId === d.target.data.teamId;
                const isFinalArc = d.source.depth === 0;
                return ((isFinalArc && isFinalPlayed) || isWinnerPath ? 2.5 : 1) / dampening; 
            });
            
        g.selectAll(".elbow-dot")
            .attr("r", d => {
                const isWinnerPath = d.source.data.teamId && d.target.data.teamId && d.source.data.teamId === d.target.data.teamId;
                const isFinalArc = d.source.depth === 0;
                return ((isFinalArc && isFinalPlayed) || isWinnerPath ? 3 : 2.5) / dampening;
            });
      });

    svg.call(zoom);

    // --- SVG GLOW FILTER ---
    const defs = g.append("defs");
    const filter = defs.append("filter").attr("id", "gold-glow");
    filter.append("feGaussianBlur").attr("stdDeviation", "1.5").attr("result", "coloredBlur"); 
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // --- ELBOW LINES (WITH ARCS) ---
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
        .attr("d", elbow)
        .attr("fill", "none")
        .attr("stroke", d => {
            const isWinnerPath = d.source.data.teamId && d.target.data.teamId && d.source.data.teamId === d.target.data.teamId;
            if (d.source.depth === 0) return isFinalPlayed ? "#FFD700" : "rgba(255, 255, 255, 0.15)"; 
            return isWinnerPath ? "#FFD700" : "rgba(255, 255, 255, 0.15)"; 
        })
        .attr("stroke-width", d => {
            const isWinnerPath = d.source.data.teamId && d.target.data.teamId && d.source.data.teamId === d.target.data.teamId;
            if (d.source.depth === 0) return isFinalPlayed ? 2.5 : 1;
            return isWinnerPath ? 2.5 : 1;
        })
        .attr("filter", d => {
            const isWinnerPath = d.source.data.teamId && d.target.data.teamId && d.source.data.teamId === d.target.data.teamId;
            if (d.source.depth === 0) return isFinalPlayed ? "url(#gold-glow)" : null;
            return isWinnerPath ? "url(#gold-glow)" : null;
        });

    // --- ELBOW DOTS ---
    g.selectAll(".elbow-dot")
        .data(root.links())
        .enter()
        .append("circle")
        .attr("class", "elbow-dot")
        .attr("r", d => {
            const isWinnerPath = d.source.data.teamId && d.target.data.teamId && d.source.data.teamId === d.target.data.teamId;
            return (d.source.depth === 0 && isFinalPlayed) || isWinnerPath ? 3 : 2.5;
        })
        .attr("cx", d => d.source.y * Math.cos(d.target.x - Math.PI / 2))
        .attr("cy", d => d.source.y * Math.sin(d.target.x - Math.PI / 2))
        .attr("fill", d => {
            const isWinnerPath = d.source.data.teamId && d.target.data.teamId && d.source.data.teamId === d.target.data.teamId;
            if (d.source.depth === 0) return isFinalPlayed ? "#FFD700" : "rgba(255, 255, 255, 0.25)";
            return isWinnerPath ? "#FFD700" : "rgba(255, 255, 255, 0.25)"; 
        })
        .style("opacity", d => d.source.depth === 0 ? 0 : 1); 

    // --- STANDALONE CENTER CHAMPION NODE ---
    const centerGroup = g.append("g")
        .attr("class", "node")
        .attr("transform", "translate(0,0)"); 

    // Center Click -> Opens Final Match Panel
    centerGroup.on("click", () => {
        if (finalMatch) setSelectedMatch(finalMatch);
    });

    const champColor = championTeam?.jerseyColor || colorForName(championTeam?.name || "TBD");
    
    centerGroup.append("circle")
        .attr("r", 35) 
        .attr("fill", isFinalPlayed ? champColor : "#FFD700")
        .attr("filter", "url(#gold-glow)");

    centerGroup.append("text")
        .attr("class", "initials")
        .text(isFinalPlayed ? getInitials(championTeam?.name) : "");

    centerGroup.append("text")
        .attr("class", "full-name")
        .attr("dy", "0.31em")
        .attr("x", 48) // Offset to the right
        .style("text-anchor", "start")
        .text(isFinalPlayed ? championTeam?.name : (viewer?.type === 'organizer' ? "Click to Edit Final" : "Final TBD"));

    // --- STRUCTURAL MATCH NODES ---
    const node = g.selectAll(".tree-node")
        .data(root.descendants())
        .enter()
        .append("g")
        .attr("class", "node tree-node")
        .attr("transform", d => `translate(${d.y * Math.cos(d.x - Math.PI / 2)},${d.y * Math.sin(d.x - Math.PI / 2)})`)
        .style("opacity", d => d.depth === 0 ? 0 : 1) 
        .style("pointer-events", d => d.depth === 0 ? "none" : "all"); 

    node.on("click", function(event, d) {
        if (d.data.match) setSelectedMatch(d.data.match);
    });

    node.append("circle")
        .attr("r", nodeRadius)
        .attr("fill", d => {
            if (!d.data.teamId) return "#222"; 
            const t = teamsById[d.data.teamId];
            return t?.jerseyColor || colorForName(t?.name || "TBD");
        });

    node.append("text")
        .attr("class", "initials")
        .text(d => getInitials(d.data.name));

    // Full Names
    node.append("text")
        .attr("class", "full-name")
        .attr("dy", "0.31em")
        .attr("x", d => d.x < Math.PI ? nodeRadius + 12 : -(nodeRadius + 12)) 
        .style("text-anchor", d => d.x < Math.PI ? "start" : "end") 
        .attr("transform", d => d.x >= Math.PI ? "rotate(180)" : null) 
        .text(d => d.data.name); 

    svg.call(zoom.transform, d3.zoomIdentity.translate(w / 2, h / 2).scale(1));

    const handleResize = () => {
      svg.call(zoom.transform, d3.zoomIdentity.translate(containerRef.current.clientWidth / 2, containerRef.current.clientHeight / 2).scale(1));
    };
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);

  }, [data, matches.length, teamsById, view, isFinalPlayed, championTeam, finalMatch, viewer]);

  if (matches.length === 0) {
     return <div className="ticket" style={{ padding: 18 }}><p style={{ fontSize: 13, margin: 0 }}>The bracket hasn't been generated yet.</p></div>;
  }

  const isMobile = window.innerWidth < 768;
  const bracketHeight = isMobile ? '55vh' : '75vh';

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      
      <style>{`
        .bracket-svg .node { cursor: pointer; }
        .bracket-svg .node circle { stroke: none; transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .bracket-svg .node text.initials { font-size: 12px; font-weight: bold; fill: #ffffff; text-anchor: middle; dominant-baseline: central; pointer-events: none; }
        .bracket-svg .node text.full-name { font-size: 14px; fill: #ffffff; font-weight: 600; opacity: 0; transition: opacity 0.2s ease; pointer-events: none; text-shadow: 0px 2px 4px rgba(0,0,0,0.8); }
        
        @media (hover: hover) and (pointer: fine) {
            .bracket-svg .node:hover circle { transform: scale(1.35); }
            .bracket-svg .node:hover text.full-name { opacity: 1; }
        }
      `}</style>

      {/* HEADER: Instructions & Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
           {viewer?.type === 'organizer' 
             ? 'Click any match node below to edit scores.' 
             : 'Drag and scroll to zoom. Hover over nodes to see team names.'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
           <button className={`btn ${view === 'radial' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('radial')}>Radial</button>
           <button className={`btn ${view === 'normal' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('normal')}>Normal</button>
        </div>
      </div>

      {view === 'radial' ? (
        <div 
          ref={containerRef}
          style={{ 
            width: '100%', 
            height: bracketHeight, 
            minHeight: '400px',
            background: '#111111', 
            borderRadius: '12px',
            overflow: 'hidden', 
            position: 'relative',
            border: '1px solid rgba(255,255,255,0.05)' 
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