import { Router } from 'express';
import bcrypt from 'bcryptjs';
import Tournament from '../models/Tournament.js';
import Team from '../models/Team.js';
import Match from '../models/Match.js';
import { generateTournamentId, randomAlphaNumeric } from '../utils/ids.js';
import { signOrganizerToken, signTeamToken, optionalAuth, requireOrganizer } from '../middleware/auth.js';
import { assignGroups, generateAllGroupFixtures, placeLateTeamAndGetNewFixtures } from '../lib/fixtures.js';
import { computeStandings } from '../lib/standings.js';
import { generateKnockoutBracket, getNextRoundMatches } from '../lib/knockout.js';
import {
  isDuplicateTeamName, canStartTournament, canStartKnockout, unevenGroupsWarning, findUnresolvedTies,
} from '../lib/validation.js';
import {
  submitScore, confirmScore, disputeScore, organizerResolveDispute, forfeitMatch, reopenMatch, autoConfirmIfDue,
} from '../lib/matchState.js';

const router = Router();

// ---------- Resolve :tournamentId (public "TRN92815" style id) on every nested route ----------
router.param('tournamentId', async (req, res, next, tournamentId) => {
  const tournament = await Tournament.findOne({ tournamentId });
  if (!tournament) return res.status(404).json({ error: 'Tournament not found.' });
  req.tournamentDoc = tournament;
  req.tournamentMongoId = String(tournament._id);
  next();
});

function publicTournament(t) {
  const { organizerPasswordHash, ...rest } = t.toObject();
  return rest;
}

// ================= Tournament =================

router.post('/', async (req, res) => {
  const { name, organizerName, location, organizerPassword, expectedTeams, logoUrl, tournamentType, allowLateEntry } = req.body;
  if (!name?.trim() || !organizerPassword) {
    return res.status(400).json({ error: 'Tournament name and organizer password are required.' });
  }

  let tournamentId;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateTournamentId();
    if (!(await Tournament.findOne({ tournamentId: candidate }))) { tournamentId = candidate; break; }
  }
  if (!tournamentId) return res.status(500).json({ error: 'Could not allocate a tournament ID, try again.' });

  const organizerPasswordHash = await bcrypt.hash(organizerPassword, 10);
  const tournament = await Tournament.create({
    tournamentId, name: name.trim(), organizerName, location, organizerPasswordHash,
    expectedTeams, logoUrl, tournamentType: tournamentType || 'group_knockout', allowLateEntry: !!allowLateEntry,
  });

  const token = signOrganizerToken(String(tournament._id));
  res.status(201).json({ tournamentId, organizerToken: token });
});

router.get('/:tournamentId', async (req, res) => {
  res.json(publicTournament(req.tournamentDoc));
});

router.post('/:tournamentId/organizer/login', async (req, res) => {
  const { password } = req.body;
  const ok = await bcrypt.compare(password || '', req.tournamentDoc.organizerPasswordHash);
  if (!ok) return res.status(401).json({ error: 'Incorrect organizer password.' });
  res.json({ organizerToken: signOrganizerToken(req.tournamentMongoId) });
});

router.patch('/:tournamentId/settings', requireOrganizer, async (req, res) => {
  const allowed = ['allowLateEntry', 'logoUrl', 'location', 'organizerName'];
  const updates = {};
  allowed.forEach((k) => { if (k in req.body) updates[k] = req.body[k]; });
  const t = await Tournament.findByIdAndUpdate(req.tournamentMongoId, updates, { new: true });
  res.json(publicTournament(t));
});

// ================= Teams =================

router.get('/:tournamentId/teams', optionalAuth, async (req, res) => {
  const isOrganizer = req.auth?.role === 'organizer' && req.auth.tournamentMongoId === req.tournamentMongoId;
  const isTeam = req.auth?.role === 'team' && req.auth.tournamentMongoId === req.tournamentMongoId;

  let filter = { tournament: req.tournamentMongoId };
  if (!isOrganizer) {
    // Everyone can see approved teams; a logged-in team can additionally always see
    // its OWN record even while still pending/rejected — otherwise a team's own
    // dashboard can never find itself before approval.
    filter = isTeam
      ? { tournament: req.tournamentMongoId, $or: [{ status: 'approved' }, { _id: req.auth.teamId }] }
      : { tournament: req.tournamentMongoId, status: 'approved' };
  }

  const teams = await Team.find(filter).select('-passwordHash');
  res.json(teams);
});

router.post('/:tournamentId/teams', async (req, res) => {
  const { name, captainName, password, contactNumber, logoUrl, jerseyColor } = req.body;
  if (!name?.trim() || !password) return res.status(400).json({ error: 'Team name and password are required.' });

  const existing = await Team.find({ tournament: req.tournamentMongoId, status: { $ne: 'rejected' } }).select('name');
  if (isDuplicateTeamName(existing, name)) {
    return res.status(409).json({ error: 'That team name is already taken in this tournament.' });
  }

  const tournamentStarted = req.tournamentDoc.status !== 'registration';
  if (tournamentStarted && !req.tournamentDoc.allowLateEntry) {
    return res.status(403).json({ error: 'This tournament has started and isn\u2019t accepting late entries.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const team = await Team.create({
    tournament: req.tournamentMongoId, name: name.trim(), captainName, passwordHash, contactNumber, logoUrl, jerseyColor,
  });

  const token = signTeamToken(req.tournamentMongoId, String(team._id));
  res.status(201).json({ teamId: team._id, teamToken: token });
});

router.post('/:tournamentId/teams/login', async (req, res) => {
  const { name, password } = req.body;
  const team = await Team.findOne({ tournament: req.tournamentMongoId, name: new RegExp(`^${escapeRegex(name || '')}$`, 'i') });
  if (!team) return res.status(404).json({ error: 'No team with that name in this tournament.' });
  const ok = await bcrypt.compare(password || '', team.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Incorrect team password.' });
  res.json({ teamId: team._id, teamToken: signTeamToken(req.tournamentMongoId, String(team._id)) });
});

router.patch('/:tournamentId/teams/:teamId/status', requireOrganizer, async (req, res) => {
  const { status } = req.body;
  if (!['approved', 'rejected', 'pending'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  const team = await Team.findOneAndUpdate(
    { _id: req.params.teamId, tournament: req.tournamentMongoId }, { status }, { new: true }
  ).select('-passwordHash');
  res.json(team);
});

/** Organizer relays this new password to the team directly (WhatsApp, in person) — there's no email to reset via. */
router.post('/:tournamentId/teams/:teamId/reset-password', requireOrganizer, async (req, res) => {
  const newPassword = randomAlphaNumeric(8);
  const passwordHash = await bcrypt.hash(newPassword, 10);
  const team = await Team.findOneAndUpdate(
    { _id: req.params.teamId, tournament: req.tournamentMongoId }, { passwordHash }, { new: true }
  ).select('-passwordHash');
  if (!team) return res.status(404).json({ error: 'Team not found.' });
  res.json({ team, newPassword });
});

router.post('/:tournamentId/late-entry/:teamId', requireOrganizer, async (req, res) => {
  const t = req.tournamentDoc;
  if (!t.allowLateEntry) return res.status(403).json({ error: 'Late entry is not enabled.' });

  const { updatedGroup, newMatches } = placeLateTeamAndGetNewFixtures(
    t.groups.map((g) => ({ id: g.id, name: g.name, teamIds: g.teamIds.map(String) })),
    req.params.teamId
  );
  const subdoc = t.groups.find((g) => g.id === updatedGroup.id);
  subdoc.teamIds = updatedGroup.teamIds;
  t.markModified('groups');
  await t.save();
  await Team.findByIdAndUpdate(req.params.teamId, { groupId: updatedGroup.id, status: 'approved' });

  await Match.insertMany(newMatches.map((m) => ({
    ...m, tournament: req.tournamentMongoId,
    matchKey: `group-${m.groupId}-late-${m.teamAId}-${m.teamBId}`,
  })));
  res.json({ ok: true });
});

// ================= Group stage =================

router.post('/:tournamentId/start', requireOrganizer, async (req, res) => {
  const numGroups = Number(req.body.numGroups);
  const approvedTeams = await Team.find({ tournament: req.tournamentMongoId, status: 'approved' });
  const check = canStartTournament(approvedTeams.length, numGroups);
  if (!check.ok) {
    console.log('[start] rejected:', { numGroups, approvedCount: approvedTeams.length, reason: check.message });
    return res.status(400).json({ error: check.message });
  }

  const groups = assignGroups(approvedTeams, numGroups);
  const fixtures = generateAllGroupFixtures(groups);

  await Promise.all(groups.map((g) =>
    Team.updateMany({ _id: { $in: g.teamIds } }, { groupId: g.id })
  ));

  await Match.insertMany(fixtures.map((m, i) => ({
    ...m, tournament: req.tournamentMongoId,
    matchKey: `group-${m.groupId}-r${m.round}-m${i}`,
  })));

  req.tournamentDoc.status = 'group_stage';
  req.tournamentDoc.numGroups = numGroups;
  req.tournamentDoc.groups = groups;
  await req.tournamentDoc.save();

  res.json({ groups, warning: unevenGroupsWarning(approvedTeams.length, numGroups) });
});

// ================= Matches =================

router.get('/:tournamentId/matches', async (req, res) => {
  const filter = { tournament: req.tournamentMongoId };
  if (req.query.stage) filter.stage = req.query.stage;
  if (req.query.groupId) filter.groupId = req.query.groupId;
  const matches = await Match.find(filter).sort({ round: 1 });
  res.json(matches.map((m) => autoConfirmIfDue(m.toObject())));
});

router.get('/:tournamentId/standings/:groupId', async (req, res) => {
  const group = req.tournamentDoc.groups.find((g) => g.id === req.params.groupId);
  if (!group) return res.status(404).json({ error: 'Group not found.' });
  const matches = (await Match.find({ tournament: req.tournamentMongoId, groupId: group.id })).map((m) => m.toObject());
  const standings = computeStandings(group.teamIds, matches);
  res.json({ standings, unresolvedTies: findUnresolvedTies(standings) });
});

async function loadMatchAndAuthorize(req, res, next) {
  const match = await Match.findOne({ _id: req.params.matchId, tournament: req.tournamentMongoId });
  if (!match) return res.status(404).json({ error: 'Match not found.' });
  const auth = req.auth;
  const isOrganizer = auth?.role === 'organizer' && auth.tournamentMongoId === req.tournamentMongoId;
  const isParticipant = auth?.role === 'team' && [String(match.teamAId), String(match.teamBId)].includes(auth.teamId);
  if (!isOrganizer && !isParticipant) return res.status(401).json({ error: 'Team or organizer session required.' });
  req.match = match;
  req.isOrganizer = isOrganizer;
  next();
}

router.post('/:tournamentId/matches/:matchId/submit', optionalAuth, loadMatchAndAuthorize, async (req, res) => {
  const { scoreA, scoreB } = req.body;

  if (req.isOrganizer) {
    // The organizer's word is final — no confirmation needed from either team.
    const submitted = submitScore(req.match.toObject(), { byTeamId: 'organizer', scoreA: Number(scoreA), scoreB: Number(scoreB) });
    const updated = confirmScore(submitted, 'organizer');
    await Match.updateOne({ _id: req.match._id }, updated);
    await maybeAdvanceKnockout(req.tournamentMongoId, updated);
    return res.json(updated);
  }

  const updated = submitScore(req.match.toObject(), { byTeamId: req.auth.teamId, scoreA: Number(scoreA), scoreB: Number(scoreB) });
  await Match.updateOne({ _id: req.match._id }, updated);
  res.json(updated);
});
router.post('/:tournamentId/matches/:matchId/confirm', optionalAuth, loadMatchAndAuthorize, async (req, res) => {
  const confirmerId = req.isOrganizer ? 'organizer' : req.auth.teamId;
  if (!req.isOrganizer && req.match.submittedBy === confirmerId) {
    return res.status(400).json({ error: 'Waiting for the other side to respond.' });
  }
  const updated = confirmScore(req.match.toObject(), confirmerId);
  await Match.updateOne({ _id: req.match._id }, updated);
  await maybeAdvanceKnockout(req.tournamentMongoId, updated);
  res.json(updated);
});

router.post('/:tournamentId/matches/:matchId/dispute', optionalAuth, loadMatchAndAuthorize, async (req, res) => {
  const { scoreA, scoreB } = req.body;
  const byTeamId = req.isOrganizer ? 'organizer' : req.auth.teamId;
  const updated = disputeScore(req.match.toObject(), { byTeamId, scoreA: Number(scoreA), scoreB: Number(scoreB) });
  await Match.updateOne({ _id: req.match._id }, updated);
  res.json(updated);
});

router.post('/:tournamentId/matches/:matchId/resolve-dispute', requireOrganizer, async (req, res) => {
  const match = await Match.findOne({ _id: req.params.matchId, tournament: req.tournamentMongoId });
  if (!match) return res.status(404).json({ error: 'Match not found.' });
  const { scoreA, scoreB } = req.body;
  const updated = organizerResolveDispute(match.toObject(), { scoreA: Number(scoreA), scoreB: Number(scoreB) });
  await Match.updateOne({ _id: match._id }, updated);
  await maybeAdvanceKnockout(req.tournamentMongoId, updated);
  res.json(updated);
});

router.post('/:tournamentId/matches/:matchId/forfeit', requireOrganizer, async (req, res) => {
  const match = await Match.findOne({ _id: req.params.matchId, tournament: req.tournamentMongoId });
  if (!match) return res.status(404).json({ error: 'Match not found.' });
  const updated = forfeitMatch(match.toObject(), req.body.winningTeamId);
  await Match.updateOne({ _id: match._id }, updated);
  await maybeAdvanceKnockout(req.tournamentMongoId, updated);
  res.json(updated);
});

router.post('/:tournamentId/matches/:matchId/reopen', requireOrganizer, async (req, res) => {
  const match = await Match.findOne({ _id: req.params.matchId, tournament: req.tournamentMongoId });
  if (!match) return res.status(404).json({ error: 'Match not found.' });
  const updated = reopenMatch(match.toObject());
  await Match.updateOne({ _id: match._id }, updated);
  res.json(updated);
});

/** Manual tiebreaker decider match, for the rare case standings stay tied after head-to-head. */
router.post('/:tournamentId/playoff', requireOrganizer, async (req, res) => {
  const { teamAId, teamBId, groupId } = req.body;
  const match = await Match.create({
    tournament: req.tournamentMongoId, stage: 'playoff', groupId, round: 'playoff', roundName: 'Playoff',
    teamAId, teamBId, status: 'not_played', matchKey: `playoff-${groupId}-${teamAId}-${teamBId}`,
  });
  res.status(201).json(match);
});

// ================= Knockout =================

router.post('/:tournamentId/knockout/generate', requireOrganizer, async (req, res) => {
  const { qualifiersPerGroup } = req.body;
  const t = req.tournamentDoc;
  const groups = t.groups.map((g) => ({ id: g.id, name: g.name, teamIds: g.teamIds.map(String) }));
  const check = canStartKnockout(groups, qualifiersPerGroup);
  if (!check.ok) return res.status(400).json({ error: check.message });

  const matches = (await Match.find({ tournament: req.tournamentMongoId, stage: 'group' })).map((m) => m.toObject());
  const standingsByGroupId = {};
  groups.forEach((g) => { standingsByGroupId[g.id] = computeStandings(g.teamIds, matches); });

  const { round1Matches } = generateKnockoutBracket(groups, standingsByGroupId, qualifiersPerGroup);
  await Match.insertMany(round1Matches.map((m) => ({ ...m, tournament: req.tournamentMongoId })));

  t.status = 'knockout';
  t.qualifiersPerGroup = qualifiersPerGroup;
  await t.save();

  // Covers the edge case where round 1 is entirely byes (e.g. only 3 qualifiers in
  // a 4-slot bracket) — nothing would otherwise trigger generating the next round.
  await maybeAdvanceKnockout(req.tournamentMongoId, { stage: 'knockout' });

  res.json({ round1Matches });
});

async function maybeAdvanceKnockout(tournamentMongoId, changedMatch) {
  if (changedMatch.stage !== 'knockout') return;
  const all = (await Match.find({ tournament: tournamentMongoId, stage: 'knockout' })).map((m) => m.toObject());
  const maxRound = Math.max(...all.map((m) => m.round));
  const currentRound = all.filter((m) => m.round === maxRound);
  const alreadyHasNext = all.some((m) => m.round === maxRound + 1);
  if (alreadyHasNext) return;

  const next = getNextRoundMatches(currentRound);
  if (next.length > 0) {
    await Match.insertMany(next.map((m) => ({ ...m, tournament: tournamentMongoId })));
  } else if (currentRound.length === 1 && currentRound[0].roundName === 'Final' &&
    (currentRound[0].status === 'confirmed' || currentRound[0].status === 'bye')) {
    await Tournament.findByIdAndUpdate(tournamentMongoId, { status: 'completed' });
  }
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default router;
