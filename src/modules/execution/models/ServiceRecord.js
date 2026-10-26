import mongoose from 'mongoose';

const materialSchema = new mongoose.Schema({
  inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, default: null },
  notes: { type: String, default: null }
}, { _id: false });

const schema = new mongoose.Schema({
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true, unique: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  petId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pet', default: null },
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
  version: { type: Number, default: 1, min: 1 }
}, { timestamps: true });

export default mongoose.models.ServiceRecord || mongoose.model('ServiceRecord', schema);
