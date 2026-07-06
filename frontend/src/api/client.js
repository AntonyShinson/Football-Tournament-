const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function normalizeIds(obj) {
  if (Array.isArray(obj)) return obj.map(normalizeIds);
  if (obj && typeof obj === 'object') {
    const out = { ...obj };
    if (out._id && !out.id) out.id = String(out._id);
    ['teamAId', 'teamBId', 'winnerId', 'tournament'].forEach((k) => {
      if (out[k] && typeof out[k] !== 'string') out[k] = String(out[k]);
    });
    return out;
  }
  return obj;
}

// ---------- auth token storage (no accounts — a password verification issues a scoped token) ----------
// Organizer sessions use sessionStorage on purpose: it's cleared when the tab/browser closes, so
// opening the organizer link fresh always asks for the password again, as requested.
export function saveOrganizerToken(tournamentId, token) {
  sessionStorage.setItem(`fh_org_${tournamentId}`, token);
}
export function getOrganizerToken(tournamentId) {
  return sessionStorage.getItem(`fh_org_${tournamentId}`);
}
export function clearOrganizerToken(tournamentId) {
  sessionStorage.removeItem(`fh_org_${tournamentId}`);
}

// Team sessions use localStorage so a team doesn't have to re-log-in every time they revisit.
export function saveTeamSession(tournamentId, teamId, token) {
  localStorage.setItem(`fh_team_${tournamentId}`, JSON.stringify({ teamId, token }));
}
export function getTeamSession(tournamentId) {
  const raw = localStorage.getItem(`fh_team_${tournamentId}`);
  return raw ? JSON.parse(raw) : null;
}
export function clearTeamSession(tournamentId) {
  localStorage.removeItem(`fh_team_${tournamentId}`);
}

async function request(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return normalizeIds(data);
}

// ---------- Tournament ----------
export const createTournament = (payload) => request('/tournaments', { method: 'POST', body: payload });
export const getTournament = (tournamentId) => request(`/tournaments/${tournamentId}`);
export const organizerLogin = (tournamentId, password) =>
  request(`/tournaments/${tournamentId}/organizer/login`, { method: 'POST', body: { password } });
export const updateSettings = (tournamentId, token, updates) =>
  request(`/tournaments/${tournamentId}/settings`, { method: 'PATCH', body: updates, token });

// ---------- Teams ----------
export const listTeams = (tournamentId, token) => request(`/tournaments/${tournamentId}/teams`, { token });
export const registerTeam = (tournamentId, payload) =>
  request(`/tournaments/${tournamentId}/teams`, { method: 'POST', body: payload });
export const teamLogin = (tournamentId, name, password) =>
  request(`/tournaments/${tournamentId}/teams/login`, { method: 'POST', body: { name, password } });
export const setTeamStatus = (tournamentId, token, teamId, status) =>
  request(`/tournaments/${tournamentId}/teams/${teamId}/status`, { method: 'PATCH', body: { status }, token });
export const resetTeamPassword = (tournamentId, token, teamId) =>
  request(`/tournaments/${tournamentId}/teams/${teamId}/reset-password`, { method: 'POST', token });
export const addLateEntry = (tournamentId, token, teamId) =>
  request(`/tournaments/${tournamentId}/late-entry/${teamId}`, { method: 'POST', token });

// ---------- Group stage ----------
export const startTournament = (tournamentId, token, numGroups) =>
  request(`/tournaments/${tournamentId}/start`, { method: 'POST', body: { numGroups }, token });
export const getStandings = (tournamentId, groupId) =>
  request(`/tournaments/${tournamentId}/standings/${groupId}`);

// ---------- Matches ----------
export const listMatches = (tournamentId, filters = {}) => {
  const qs = new URLSearchParams(filters).toString();
  return request(`/tournaments/${tournamentId}/matches${qs ? `?${qs}` : ''}`);
};
export const submitMatchScore = (tournamentId, token, matchId, scoreA, scoreB) =>
  request(`/tournaments/${tournamentId}/matches/${matchId}/submit`, { method: 'POST', body: { scoreA, scoreB }, token });
export const confirmMatchScore = (tournamentId, token, matchId) =>
  request(`/tournaments/${tournamentId}/matches/${matchId}/confirm`, { method: 'POST', token });
export const disputeMatchScore = (tournamentId, token, matchId, scoreA, scoreB) =>
  request(`/tournaments/${tournamentId}/matches/${matchId}/dispute`, { method: 'POST', body: { scoreA, scoreB }, token });
export const resolveDispute = (tournamentId, token, matchId, scoreA, scoreB) =>
  request(`/tournaments/${tournamentId}/matches/${matchId}/resolve-dispute`, { method: 'POST', body: { scoreA, scoreB }, token });
export const forfeitMatch = (tournamentId, token, matchId, winningTeamId) =>
  request(`/tournaments/${tournamentId}/matches/${matchId}/forfeit`, { method: 'POST', body: { winningTeamId }, token });
export const reopenMatch = (tournamentId, token, matchId) =>
  request(`/tournaments/${tournamentId}/matches/${matchId}/reopen`, { method: 'POST', token });
export const schedulePlayoff = (tournamentId, token, teamAId, teamBId, groupId) =>
  request(`/tournaments/${tournamentId}/playoff`, { method: 'POST', body: { teamAId, teamBId, groupId }, token });

// ---------- Knockout ----------
export const generateKnockout = (tournamentId, token, qualifiersPerGroup) =>
  request(`/tournaments/${tournamentId}/knockout/generate`, { method: 'POST', body: { qualifiersPerGroup }, token });
