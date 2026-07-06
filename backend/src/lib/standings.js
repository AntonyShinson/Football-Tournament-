function emptyRow(teamId) {
  return { teamId, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 };
}

function applyMatch(row, gf, ga) {
  row.played += 1;
  row.gf += gf;
  row.ga += ga;
  row.gd = row.gf - row.ga;
  if (gf > ga) { row.won += 1; row.points += 3; }
  else if (gf === ga) { row.drawn += 1; row.points += 1; }
  else { row.lost += 1; }
}

/** Tiebreak order: Points -> Goal Difference -> Goals For -> Head-to-head (last resort, exact ties only). */
export function computeStandings(teamIds, matches) {
  const ids = teamIds.map(String);
  const rows = new Map(ids.map((id) => [id, emptyRow(id)]));

  matches
    .filter((m) => m.status === 'confirmed' && ids.includes(String(m.teamAId)) && ids.includes(String(m.teamBId)))
    .forEach((m) => {
      applyMatch(rows.get(String(m.teamAId)), m.scoreA, m.scoreB);
      applyMatch(rows.get(String(m.teamBId)), m.scoreB, m.scoreA);
    });

  let sorted = [...rows.values()].sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
  sorted = resolveHeadToHeadTies(sorted, matches);
  return sorted.map((row, i) => ({ ...row, rank: i + 1 }));
}

function resolveHeadToHeadTies(sorted, matches) {
  const result = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && sorted[j].points === sorted[i].points && sorted[j].gd === sorted[i].gd && sorted[j].gf === sorted[i].gf) j++;
    const cluster = sorted.slice(i, j);
    result.push(...(cluster.length > 1 ? miniHeadToHeadSort(cluster, matches) : cluster));
    i = j;
  }
  return result;
}

function miniHeadToHeadSort(cluster, matches) {
  const ids = cluster.map((r) => r.teamId);
  const mini = new Map(ids.map((id) => [id, emptyRow(id)]));
  matches
    .filter((m) => m.status === 'confirmed' && ids.includes(String(m.teamAId)) && ids.includes(String(m.teamBId)))
    .forEach((m) => {
      applyMatch(mini.get(String(m.teamAId)), m.scoreA, m.scoreB);
      applyMatch(mini.get(String(m.teamBId)), m.scoreB, m.scoreA);
    });
  return [...cluster].sort((a, b) => {
    const ma = mini.get(a.teamId); const mb = mini.get(b.teamId);
    return mb.points - ma.points || mb.gd - ma.gd || mb.gf - ma.gf;
  });
}
