import mongoose from 'mongoose';

const GroupSchema = new mongoose.Schema(
  {
    id: String,
    name: String,
    teamIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],
  },
  { _id: false }
);

const TournamentSchema = new mongoose.Schema({
  tournamentId: { type: String, unique: true, index: true }, // e.g. "TRN92815"
  name: { type: String, required: true },
  organizerName: String,
  location: String,
  organizerPasswordHash: { type: String, required: true },
  expectedTeams: Number,
  logoUrl: String,
  tournamentType: { type: String, enum: ['group_knockout', 'knockout_only'], default: 'group_knockout' },

  status: { type: String, enum: ['registration', 'group_stage', 'knockout', 'completed'], default: 'registration' },
  numGroups: Number,
  qualifiersPerGroup: Number,
  groups: [GroupSchema],
  allowLateEntry: { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Tournament', TournamentSchema);
