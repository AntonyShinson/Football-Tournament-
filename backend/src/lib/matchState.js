export const AUTO_CONFIRM_WINDOW_MS = 30 * 60 * 1000;

export function submitScore(match, { byTeamId, scoreA, scoreB }) {
  return { ...match, scoreA, scoreB, submittedBy: byTeamId, status: 'pending_confirmation', pendingSince: new Date() };
}

export function confirmScore(match, confirmerId) {
  return { ...match, status: 'confirmed', confirmedBy: confirmerId };
}

export function disputeScore(match, { byTeamId, scoreA, scoreB }) {
  return { ...match, status: 'disputed', disputedBy: byTeamId, disputedScoreA: scoreA, disputedScoreB: scoreB };
}

export function organizerResolveDispute(match, { scoreA, scoreB }) {
  return { ...match, scoreA, scoreB, status: 'confirmed', confirmedBy: 'organizer', resolvedDispute: true };
}

export function forfeitMatch(match, winningTeamId) {
  const teamAWins = String(winningTeamId) === String(match.teamAId);
  return { ...match, scoreA: teamAWins ? 3 : 0, scoreB: teamAWins ? 0 : 3, status: 'confirmed', confirmedBy: 'organizer', forfeit: true };
}

export function reopenMatch(match) {
  return { ...match, status: 'not_played', scoreA: null, scoreB: null, submittedBy: null, confirmedBy: null, pendingSince: null };
}

export function isAutoConfirmDue(match, now = Date.now()) {
  return match.status === 'pending_confirmation' && match.pendingSince && now - new Date(match.pendingSince).getTime() >= AUTO_CONFIRM_WINDOW_MS;
}

export function autoConfirmIfDue(match, now = Date.now()) {
  return isAutoConfirmDue(match, now) ? confirmScore(match, 'auto-timeout') : match;
}

export function minutesRemaining(match, now = Date.now()) {
  if (match.status !== 'pending_confirmation' || !match.pendingSince) return 0;
  const elapsed = now - new Date(match.pendingSince).getTime();
  return Math.max(0, Math.ceil((AUTO_CONFIRM_WINDOW_MS - elapsed) / 60000));
}
