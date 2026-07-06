import mongoose from 'mongoose';

const MatchSchema = new mongoose.Schema({
  tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true, index: true },
  matchKey: { type: String, required: true }, // stable id used for knockout round-advancement logic

  stage: { type: String, enum: ['group', 'knockout', 'playoff'], required: true },
  groupId: String,
  round: mongoose.Schema.Types.Mixed, // number for normal rounds, 'late-entry' string for late-entry fixtures
  roundName: String,
  slotIndex: Number, // knockout bracket position

  teamAId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  teamBId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },

  venue: String,
  date: String,
  time: String,

  scoreA: { type: Number, default: null },
  scoreB: { type: Number, default: null },
  winnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null }, // used for knockout byes

  status: {
    type: String,
    enum: ['not_played', 'pending_confirmation', 'disputed', 'confirmed', 'bye'],
    default: 'not_played',
  },
  submittedBy: mongoose.Schema.Types.Mixed, // teamId or 'organizer'
  confirmedBy: mongoose.Schema.Types.Mixed, // teamId, 'organizer', or 'auto-timeout'
  pendingSince: Date,
  disputedBy: mongoose.Schema.Types.Mixed,
  disputedScoreA: Number,
  disputedScoreB: Number,
  resolvedDispute: Boolean,
  forfeit: Boolean,

  createdAt: { type: Date, default: Date.now },
});

MatchSchema.index({ tournament: 1, matchKey: 1 }, { unique: true });

export default mongoose.model('Match', MatchSchema);
