import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffProfile', required: true, index: true },
  serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', index: true, default: null },
  kind: { type: String, enum: ['STAFF', 'CAPACITY'], default: 'STAFF' },
  status: { type: String, enum: ['HELD', 'CONFIRMED'], default: 'HELD' },
  slotStartUnit: { type: Number, required: true }, // Epoch in 15-minute intervals
  unitIndex: { type: Number, required: true, default: 0 },
  holdExpiresAt: { type: Date, default: null, index: { expireAfterSeconds: 0 } },
}, { timestamps: true });

// Compound unique index ensuring zero double-booking at DB engine level
schema.index({ branchId: 1, staffId: 1, slotStartUnit: 1, unitIndex: 1 }, { unique: true });

export default mongoose.model('SlotReservation', schema);