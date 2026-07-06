import jwt from 'jsonwebtoken';

const SECRET = () => process.env.JWT_SECRET || 'dev-secret-change-me';

/** Issued once the organizer password is verified; scoped to a single tournament. */
export function signOrganizerToken(tournamentMongoId) {
  return jwt.sign({ role: 'organizer', tournamentMongoId }, SECRET(), { expiresIn: '30d' });
}

/** Issued once a team's password is verified; scoped to a single team within a tournament. */
export function signTeamToken(tournamentMongoId, teamId) {
  return jwt.sign({ role: 'team', tournamentMongoId, teamId }, SECRET(), { expiresIn: '30d' });
}

function readToken(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try { return jwt.verify(header.slice(7), SECRET()); }
  catch { return null; }
}

/** Attaches req.auth if a valid token is present; does not block the request either way. */
export function optionalAuth(req, _res, next) {
  req.auth = readToken(req);
  next();
}

/** Requires a valid organizer session for THIS tournament (tournament looked up by :tournamentId param via req.tournamentMongoId, set by an earlier middleware). */
export function requireOrganizer(req, res, next) {
  const auth = readToken(req);
  if (!auth || auth.role !== 'organizer' || auth.tournamentMongoId !== req.tournamentMongoId) {
    return res.status(401).json({ error: 'Organizer session required.' });
  }
  req.auth = auth;
  next();
}

/** Requires either the organizer OR the specific team named in req.params.teamId to be logged in. */
export function requireTeamOrOrganizer(req, res, next) {
  const auth = readToken(req);
  const isOrganizer = auth?.role === 'organizer' && auth.tournamentMongoId === req.tournamentMongoId;
  const isThisTeam = auth?.role === 'team' && auth.tournamentMongoId === req.tournamentMongoId && auth.teamId === req.params.teamId;
  if (!isOrganizer && !isThisTeam) {
    return res.status(401).json({ error: 'Team or organizer session required.' });
  }
  req.auth = auth;
  next();
}
