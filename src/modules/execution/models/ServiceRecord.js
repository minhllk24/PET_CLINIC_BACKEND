import mongoose from 'mongoose';

const materialSchema = new mongoose.Schema({
  inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, default: null },
  notes: { type: String, default: null },
  isDefault: { type: Boolean, default: true },
  isExtra: { type: Boolean, default: false }
}, { _id: false });

const schema = new mongoose.Schema({
  code: { type: String, unique: true, sparse: true, trim: true, index: true },
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  petId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pet', default: null },
  segmentGroupKey: { type: String, default: null },
  serviceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }],
  assignedStaffIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  reviewerStaffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  recordType: { type: String, enum: ['GROOMING', 'MEDICAL'], required: true },
  status: {
    type: String,
    enum: ['DRAFT', 'IN_PROGRESS', 'WAITING_VET_REVIEW', 'FINALIZED', 'REOPENED'],
    default: 'IN_PROGRESS'
  },
  recordVersion: { type: Number, default: 0, min: 0 },
  plannedMaterials: { type: [materialSchema], default: [] },
  actualMaterials: { type: [materialSchema], default: [] },
  lastFinalizedActual: { type: [materialSchema], default: [] },
  professional: {
    diagnosis: String,
    treatment: String,
    result: String,
    professionalNote: String
  },
  reopenedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reopenedAt: { type: Date, default: null },
  reopenReason: { type: String, default: null },
  actualStartAt: { type: Date, default: Date.now },
  actualEndAt: { type: Date, default: null },
  finalizedAt: { type: Date, default: null },
  updatedBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    name: { type: String, default: null },
    role: { type: String, default: null },
  },
  materialsUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  materialsUpdatedAt: { type: Date, default: null },
  materialAudit: [
    {
      actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      actorName: { type: String, default: null },
      actorRole: { type: String, default: null },
      at: { type: Date, default: Date.now },
      materialsCount: { type: Number, default: 0 },
    },
  ],
  version: { type: Number, default: 1, min: 1 }
}, { timestamps: true });

schema.index(
  { appointmentId: 1, petId: 1, recordType: 1, segmentGroupKey: 1 },
  { unique: true, sparse: false, name: 'appointment_pet_recordtype_segment_idx' }
);

export default mongoose.models.ServiceRecord || mongoose.model('ServiceRecord', schema);
