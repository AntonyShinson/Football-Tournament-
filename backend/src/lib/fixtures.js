const BYE = null;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Randomly splits approved teams into `numGroups` groups, as evenly sized as possible. */
export function assignGroups(teams, numGroups) {
  const shuffled = shuffle(teams);
  const groups = Array.from({ length: numGroups }, (_, i) => ({
    id: `group-${i + 1}`,
    name: `Group ${String.fromCharCode(65 + i)}`,
    teamIds: [],
  }));
  shuffled.forEach((team, index) => {
    groups[index % numGroups].teamIds.push(String(team._id));
  });
  return groups;
}

/**
 * Standard "circle method" round-robin scheduler. Odd team counts get a
 * rotating BYE slot; any match against BYE is simply dropped, so that team
 * has no fixture that round instead of breaking the algorithm.
 */
export function generateRoundRobinFixtures(groupId, teamIds) {
  const ids = [...teamIds];
  if (ids.length < 2) return [];
  if (ids.length % 2 !== 0) ids.push(BYE);

  const n = ids.length;
  const totalRounds = n - 1;
  const half = n / 2;
  const rounds = [];

  let arr = [...ids];
  for (let r = 0; r < totalRounds; r++) {
    const matches = [];
    for (let i = 0; i < half; i++) {
      const teamA = arr[i];
      const teamB = arr[n - 1 - i];
      if (teamA !== BYE && teamB !== BYE) {
        const [first, second] = r % 2 === 0 ? [teamA, teamB] : [teamB, teamA];
        matches.push({ groupId, round: r + 1, teamAId: first, teamBId: second });
      }
    }
    rounds.push({ round: r + 1, matches });
    arr = [arr[0], ...arr.slice(-1), ...arr.slice(1, -1)];
  }
  return rounds;
}

export function generateAllGroupFixtures(groups) {
  const all = [];
  groups.forEach((group) => {
    const rounds = generateRoundRobinFixtures(group.id, group.teamIds);
    rounds.forEach((round) => {
      round.matches.forEach((m) => all.push({ ...m, stage: 'group' }));
    });
  });
  return all;
}

/** Late-entry placement: adds a team to whichever group currently has the fewest teams. */
export function placeLateTeamAndGetNewFixtures(groups, newTeamId) {
  const smallest = groups.reduce((min, g) => (g.teamIds.length < min.teamIds.length ? g : min), groups[0]);
  const opponents = smallest.teamIds.filter((id) => id !== newTeamId);
  smallest.teamIds.push(newTeamId);
  const newMatches = opponents.map((opponentId, i) => ({
    groupId: smallest.id,
    stage: 'group',
    round: 'late-entry',
    teamAId: i % 2 === 0 ? newTeamId : opponentId,
    teamBId: i % 2 === 0 ? opponentId : newTeamId,
  }));
  return { updatedGroup: smallest, newMatches };
}
