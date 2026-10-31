import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  staffCode: { type: String, unique: true, sparse: true, trim: true },
  staffSubRole: {
    type: String,
    enum: ['RECEPTIONIST', 'CARE_STAFF_GROOMER', 'VETERINARIAN', 'NURSE'],
    required: true,
    index: true
  },
  authorizedBranchIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true }],
  homeBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  hireDate: { type: Date },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
  version: { type: Number, default: 1 }
}, {
  timestamps: true,
  optimisticConcurrency: true,
  versionKey: 'version'
});

export default mongoose.models.StaffProfile || mongoose.model('StaffProfile', schema);
