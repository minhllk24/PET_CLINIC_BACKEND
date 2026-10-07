import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
  branchId: mongoose.Schema.Types.ObjectId,
  customerId: mongoose.Schema.Types.ObjectId,
  petId: mongoose.Schema.Types.ObjectId,
  serviceType: String, // 'GROOMING' | 'MEDICAL'
  status: String, // 'IN_PROGRESS' | 'WAITING_VET_REVIEW' | 'FINALIZED'
  actualMaterials: [{ inventoryItemId: mongoose.Schema.Types.ObjectId, quantity: Number }],
  professional: { diagnosis: String, treatment: String, result: String, professionalNote: String },
  version: { type: Number, default: 1 }
}, { timestamps: true });
export default mongoose.model('ServiceRecord', schema);