import mongoose from 'mongoose';

const auditEntrySchema = new mongoose.Schema({
  action: { type: String, required: true },
  reason: { type: String, default: '' },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  performedAt: { type: Date, default: Date.now },
}, { _id: false });

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  activationStatus: {
    type: String,
    enum: ['NO_ACCOUNT', 'PENDING_ACTIVATION', 'ACTIVATED'],
    default: 'NO_ACCOUNT',
    index: true,
  },
  accountStatus: {
    type: String,
    enum: ['ACTIVE', 'BLOCKED'],
    default: 'ACTIVE',
    index: true,
  },
  contactPhone: { type: String, index: true },
  contactEmail: { type: String, index: true },
  phoneVerifiedAt: Date,
  emailVerifiedAt: Date,
  activityBranchIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }],
  blockReason: { type: String, default: null },
  blockedAt: { type: Date, default: null },
  blockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  auditHistory: [auditEntrySchema],
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret._id;
      delete ret.__v;
      return ret;
    },
  },
});

export default mongoose.model('Customer', schema);