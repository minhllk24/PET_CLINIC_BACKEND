import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffProfile', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  startAt: { type: Date, required: true },
  endAt: { type: Date, required: true },
  status: { type: String, enum: ['ACTIVE', 'CANCELLED'], default: 'ACTIVE', index: true },
  version: { type: Number, default: 1 }
}, {
  timestamps: true,
  optimisticConcurrency: true,
  versionKey: 'version'
});

schema.index({ staffId: 1, status: 1, startAt: 1, endAt: 1 });
schema.index({ branchId: 1, status: 1, startAt: 1 });

export default mongoose.models.Shift || mongoose.model('Shift', schema);