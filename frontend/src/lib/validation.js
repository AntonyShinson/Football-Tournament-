export function validateGroupCount(numApprovedTeams, numGroups) {
  if (!Number.isFinite(numGroups) || numGroups < 1) return { ok: false, message: 'Choose at least 1 group.' };
  if (numApprovedTeams < numGroups * 2) {
    return { ok: false, message: `${numGroups} groups needs at least ${numGroups * 2} approved teams (2 per group). You have ${numApprovedTeams}.` };
  }
  return { ok: true };
}

export function unevenGroupsWarning(numApprovedTeams, numGroups) {
  const base = Math.floor(numApprovedTeams / numGroups);
  const remainder = numApprovedTeams % numGroups;
  if (remainder === 0) return null;
  const biggerGroups = remainder;
  const smallerGroups = numGroups - remainder;
  return `You'll have ${biggerGroups} group${biggerGroups > 1 ? 's' : ''} of ${base + 1} and ${smallerGroups} group${smallerGroups > 1 ? 's' : ''} of ${base} — continue?`;
}

export function canStartKnockout(groups, qualifiersPerGroup) {
  if (!groups?.length) return { ok: false, message: 'No groups yet.' };
  if (qualifiersPerGroup < 1) return { ok: false, message: 'At least 1 team must qualify per group.' };
  const smallestGroup = Math.min(...groups.map((g) => g.teamIds.length));
  if (qualifiersPerGroup > smallestGroup) {
    return { ok: false, message: `Your smallest group only has ${smallestGroup} team(s) — can't qualify ${qualifiersPerGroup} per group.` };
  }
  return { ok: true };
}
