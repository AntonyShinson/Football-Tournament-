// Codes avoid ambiguous characters (0/O, 1/I/L) since people read & type these by hand.
const SAFE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Short human-typeable code shown to a team creator (e.g. "K7M4QT"). */
export function generateTeamCode(length = 6) {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)];
  }
  return out;
}

/** Long unguessable token embedded in private links (organizer dashboard, team access page). */
export function generateAccessToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** One-time backup admin code, shown once at tournament creation, used to recover a lost dashboard link. */
export function generateBackupAdminCode() {
  return `${generateTeamCode(4)}-${generateTeamCode(4)}`;
}

/** Deterministic color for a team's initials badge, derived from its name (so it's stable, not random per render). */
export function colorForName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 62%, 58%)`;
}

export function initialsForName(name) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '??';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
