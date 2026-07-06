export function isDuplicateTeamName(existingTeams, candidateName) {
  const normalized = candidateName.trim().toLowerCase();
  return existingTeams.some((t) => t.name.trim().toLowerCase() === normalized);
}

export function validateGroupCount(numApprovedTeams, numGroups) {
  if (!Number.isFinite(numGroups) || numGroups < 1) return { ok: false, message: 'Choose at least 1 group.' };
  if (numApprovedTeams < numGroups * 2) {
    return {
      ok: false,
      message: `${numGroups} groups needs at least ${numGroups * 2} approved teams (2 per group). You have ${numApprovedTeams}.`,
    };
  }
  return { ok: true };
}

export function unevenGroupsWarning(numApprovedTeams, numGroups) {
  const base = Math.floor(numApprovedTeams / numGroups);
  const remainder = numApprovedTeams % numGroups;
  if (remainder === 0) return null;
  const biggerGroups = remainder;
  const smallerGroups = numGroups - remainder;
  return `You'll have ${biggerGroups} group${biggerGroups > 1 ? 's' : ''} of ${base + 1} and ${smallerGroups} group${smallerGroups > 1 ? 's' : ''} of ${base}.`;
}

export function canStartTournament(numApprovedTeams, numGroups) {
  return validateGroupCount(numApprovedTeams, numGroups);
}

export function canStartKnockout(groups, qualifiersPerGroup) {
  if (qualifiersPerGroup < 1) return { ok: false, message: 'At least 1 team must qualify per group.' };
  const smallestGroup = Math.min(...groups.map((g) => g.teamIds.length));
  if (qualifiersPerGroup > smallestGroup) {
    return { ok: false, message: `Your smallest group only has ${smallestGroup} team(s) — can't qualify ${qualifiersPerGroup} per group.` };
  }
  return { ok: true };
}

/**
 * Detects standings rows that are still perfectly tied after every automatic
 * tiebreaker (points, GD, GF, head-to-head) — the only case the blueprint's
 * "Playoff Match" tiebreaker applies to. The organizer resolves this by
 * manually scheduling a one-off decider (see POST /matches/playoff).
 */
export function findUnresolvedTies(standings) {
  const groups = new Map();
  standings.forEach((row) => {
    const key = `${row.rank <= 0 ? 0 : row.points}-${row.gd}-${row.gf}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });
  return [...groups.values()].filter((g) => g.length > 1);
}
