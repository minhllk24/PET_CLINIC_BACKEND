import mongoose from 'mongoose';

const refreshSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true,
  },
  tokenHash: {
    type: String,
    required: [true, 'Token hash is required'],
    unique: true,
  },
  userAgent: {
    type: String,
    default: '',
  },
  ipAddress: {
    type: String,
    default: '',
  },
  rememberMe: {
    type: Boolean,
    default: false,
  },
  expiresAt: {
    type: Date,
    required: [true, 'Expiration date is required'],
  },
  revokedAt: {
    type: Date,
    default: null,
  },
  replacedByTokenHash: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
});

// TTL index to automatically purge expired sessions
refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for querying user's active/revoked sessions
refreshSessionSchema.index({ userId: 1, revokedAt: 1 });

const RefreshSession = mongoose.model('RefreshSession', refreshSessionSchema);

export default RefreshSession;
