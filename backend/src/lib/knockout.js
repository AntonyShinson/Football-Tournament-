export function nextPowerOfTwo(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export function roundName(sizeAtStartOfRound) {
  if (sizeAtStartOfRound === 2) return 'Final';
  if (sizeAtStartOfRound === 4) return 'Semi-Final';
  if (sizeAtStartOfRound === 8) return 'Quarter-Final';
  if (sizeAtStartOfRound === 16) return 'Round of 16';
  return `Round of ${sizeAtStartOfRound}`;
}

/** Strongest-to-weakest seed list: all group winners first (ranked among themselves), then all runners-up, etc. */
export function buildSeedList(groups, standingsByGroupId, qualifiersPerGroup) {
  const seeds = [];
  for (let rank = 1; rank <= qualifiersPerGroup; rank++) {
    const tier = groups
      .map((g) => {
        const row = standingsByGroupId[g.id]?.[rank - 1];
        return row ? { ...row, groupId: g.id } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
    seeds.push(...tier);
  }
  return seeds;
}

function seedOrder(size) {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    const next = [];
    order.forEach((seed) => { next.push(seed); next.push(n + 1 - seed); });
    order = next;
  }
  return order;
}

/** Best-effort pass to avoid same-group opponents in round 1. */
function avoidSameGroupFirstRound(slots) {
  const pairCount = slots.length / 2;
  for (let i = 0; i < pairCount; i++) {
    const a = slots[i * 2]; const b = slots[i * 2 + 1];
    if (a && b && a.groupId === b.groupId) {
      for (let j = 0; j < pairCount; j++) {
        if (j === i) continue;
        const c = slots[j * 2]; const d = slots[j * 2 + 1];
        if (c && d && c.groupId !== a.groupId && d.groupId !== b.groupId) {
          slots[i * 2 + 1] = d; slots[j * 2 + 1] = b;
          break;
        }
      }
    }
  }
  return slots;
}

/**
 * Generates Round 1 of the knockout bracket. Extra slots needed to reach a
 * power-of-two bracket are given to the TOP seeds as byes (standard
 * tournament convention), achieved by seeding empty slots against them.
 */
export function generateKnockoutBracket(groups, standingsByGroupId, qualifiersPerGroup) {
  const seeds = buildSeedList(groups, standingsByGroupId, qualifiersPerGroup);
  const bracketSize = nextPowerOfTwo(seeds.length);
  const padded = [...seeds, ...Array(bracketSize - seeds.length).fill(null)];
  const order = seedOrder(bracketSize);
  let slots = order.map((seedNum) => padded[seedNum - 1] ?? null);
  slots = avoidSameGroupFirstRound(slots);

  const matches = [];
  for (let i = 0; i < bracketSize / 2; i++) {
    const teamA = slots[i * 2];
    const teamB = slots[i * 2 + 1];
    if (!teamA && !teamB) continue;
    const isBye = !teamA || !teamB;
    matches.push({
      matchKey: `ko-r1-m${i + 1}`,
      stage: 'knockout',
      round: 1,
      roundName: roundName(bracketSize),
      slotIndex: i,
      teamAId: teamA?.teamId ?? null,
      teamBId: teamB?.teamId ?? null,
      status: isBye ? 'bye' : 'not_played',
      winnerId: isBye ? teamA?.teamId ?? teamB?.teamId : null,
    });
  }
  return { bracketSize, totalQualifiers: seeds.length, round1Matches: matches };
}

export function getWinnerId(match) {
  if (match.status === 'bye') return match.winnerId;
  if (match.status !== 'confirmed') return null;
  return match.scoreA > match.scoreB ? match.teamAId : match.teamBId;
}

/** Once a round is fully decided (confirmed or bye), builds the next round by pairing winners in bracket order. */
export function getNextRoundMatches(currentRoundMatches) {
  if (currentRoundMatches.length === 0) return [];
  if (currentRoundMatches.length === 1 && currentRoundMatches[0].roundName === 'Final') return [];
  const allDecided = currentRoundMatches.every((m) => m.status === 'confirmed' || m.status === 'bye');
  if (!allDecided) return [];

  const sorted = [...currentRoundMatches].sort((a, b) => a.slotIndex - b.slotIndex);
  const nextRoundNum = sorted[0].round + 1;
  const nextSize = sorted.length;
  const nextRoundName = roundName(nextSize);

  const next = [];
  for (let i = 0; i < sorted.length; i += 2) {
    const winnerA = getWinnerId(sorted[i]);
    const winnerB = sorted[i + 1] ? getWinnerId(sorted[i + 1]) : null;
    next.push({
      matchKey: `ko-r${nextRoundNum}-m${i / 2 + 1}`,
      stage: 'knockout',
      round: nextRoundNum,
      roundName: nextRoundName,
      slotIndex: i / 2,
      teamAId: winnerA,
      teamBId: winnerB,
      status: 'not_played',
      winnerId: null,
    });
  }
  return next;
}
