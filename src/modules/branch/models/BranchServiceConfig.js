import mongoose from 'mongoose';

const availabilityWindowSchema = new mongoose.Schema({
  dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
  open: { type: String, required: true },
  close: { type: String, required: true }
}, { _id: false });

const schema = new mongoose.Schema({
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
  enabled: { type: Boolean, default: true, index: true },
  capacity: { type: Number, required: true, min: 1, default: 1 }, // maxConcurrentSegments
  availability: { type: [availabilityWindowSchema], default: [] },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  version: { type: Number, default: 1 }
}, {
  timestamps: true,
  optimisticConcurrency: true,
  versionKey: 'version'
});

schema.index({ branchId: 1, serviceId: 1 }, { unique: true });

export default mongoose.models.BranchServiceConfig || mongoose.model('BranchServiceConfig', schema);