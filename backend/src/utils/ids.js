import crypto from 'crypto';

const SAFE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Public-facing tournament ID, e.g. "TRN92815" — short enough to say out loud, unique per tournament. */
export function generateTournamentId() {
  const digits = crypto.randomInt(10000, 99999);
  return `TRN${digits}`;
}

export function randomAlphaNumeric(length = 6) {
  let out = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    out += SAFE_CHARS[bytes[i] % SAFE_CHARS.length];
  }
  return out;
}
