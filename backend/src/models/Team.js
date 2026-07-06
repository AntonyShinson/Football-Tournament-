import mongoose from 'mongoose';

const TeamSchema = new mongoose.Schema({
  tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true, index: true },
  name: { type: String, required: true },
  captainName: String,
  passwordHash: { type: String, required: true },
  contactNumber: String,
  logoUrl: String,
  jerseyColor: String,

  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  groupId: String,

  createdAt: { type: Date, default: Date.now },
});

TeamSchema.index({ tournament: 1, name: 1 });

export default mongoose.model('Team', TeamSchema);
