import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  systemRole: { type: String, required: true, enum: ['ADMIN', 'MANAGER', 'STAFF', 'CUSTOMER'] },
  fullName: { type: String, required: true },
  email: { type: String, unique: true, sparse: true },
  phone: { type: String, unique: true, sparse: true },
  passwordHash: { type: String },
  accountStatus: { type: String, enum: ['ACTIVE', 'BLOCKED'], default: 'ACTIVE' },
  blockedReason: String,
  blockedAt: Date,
  blockedBy: mongoose.Schema.Types.ObjectId,
  failedLoginCount: { type: Number, default: 0 },
  lockedUntil: Date,
  lastLogin: Date,
  assignedBranchIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }],
  version: { type: Number, default: 1 }
}, { timestamps: true, optimisticConcurrency: true, versionKey: 'version' });

export default mongoose.model('User', schema);