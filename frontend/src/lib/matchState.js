/*
  Match status lifecycle:

    not_played
        |  submitScore()
        v
    pending_confirmation ----(other side confirms)----> confirmed
        |         |
        |         |--(30 min elapse, no response)-----> confirmed (auto)
        |         |--(organizer approves, any time)---> confirmed
        |
        --(other side submits a DIFFERENT score)------> disputed
                                                              |
                                        (organizer sets final score) -> confirmed

  Whoever confirms is recorded in `confirmedBy` ('organizer' or a teamId) so the
  UI can show e.g. "Confirmed by organizer" vs "Confirmed by both teams".
*/

export const AUTO_CONFIRM_WINDOW_MS = 30 * 60 * 1000;

export function submitScore(match, { byTeamId, scoreA, scoreB }) {
  return {
    ...match,
    scoreA,
    scoreB,
    submittedBy: byTeamId,
    status: 'pending_confirmation',
    pendingSince: Date.now(),
  };
}

/** The OTHER team (or organizer, any time) agrees with the submitted score. */
export function confirmScore(match, confirmerId) {
  return { ...match, status: 'confirmed', confirmedBy: confirmerId };
}

/** The other team submits a different score before confirming -> dispute, only the organizer can resolve it now. */
export function disputeScore(match, { byTeamId, scoreA, scoreB }) {
  return {
    ...match,
    status: 'disputed',
    disputedBy: byTeamId,
    disputedScoreA: scoreA,
    disputedScoreB: scoreB,
  };
}

/** Organizer has final say on a dispute (or can also just approve the original submission outright). */
export function organizerResolveDispute(match, { scoreA, scoreB }) {
  return {
    ...match,
    scoreA,
    scoreB,
    status: 'confirmed',
    confirmedBy: 'organizer',
    resolvedDispute: true,
  };
}

/** Organizer marks a team as forfeiting (no-show); the other team is awarded the win. */
export function forfeitMatch(match, winningTeamId) {
  const teamAWins = winningTeamId === match.teamAId;
  return {
    ...match,
    scoreA: teamAWins ? 3 : 0,
    scoreB: teamAWins ? 0 : 3,
    status: 'confirmed',
    confirmedBy: 'organizer',
    forfeit: true,
  };
}

/** Organizer can reopen a wrongly-confirmed match back to scratch. */
export function reopenMatch(match) {
  return {
    ...match,
    status: 'not_played',
    scoreA: null,
    scoreB: null,
    submittedBy: null,
    confirmedBy: null,
    pendingSince: null,
  };
}

export function isAutoConfirmDue(match, now = Date.now()) {
  return match.status === 'pending_confirmation' && now - match.pendingSince >= AUTO_CONFIRM_WINDOW_MS;
}

/** Called opportunistically (on page load / periodic check) since there's no server cron in this MVP. */
export function autoConfirmIfDue(match, now = Date.now()) {
  return isAutoConfirmDue(match, now) ? confirmScore(match, 'auto-timeout') : match;
}

export function minutesRemaining(match, now = Date.now()) {
  if (match.status !== 'pending_confirmation') return 0;
  const elapsed = now - match.pendingSince;
  return Math.max(0, Math.ceil((AUTO_CONFIRM_WINDOW_MS - elapsed) / 60000));
}
