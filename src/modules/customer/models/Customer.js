import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  activationStatus: { type: String, enum: ['NO_ACCOUNT', 'PENDING_ACTIVATION', 'ACTIVATED'], default: 'NO_ACCOUNT' },
  contactPhone: String,
  contactEmail: String,
  phoneVerifiedAt: Date,
  emailVerifiedAt: Date,
  activityBranchIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }]
}, { timestamps: true });

export default mongoose.model('Customer', schema);