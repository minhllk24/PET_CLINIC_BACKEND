import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  serviceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true }],
  status: {
    type: String,
    enum: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'],
    default: 'SUBMITTED',
  },
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  guestContactId: { type: mongoose.Schema.Types.ObjectId, ref: 'GuestContact', default: null },
  preferredBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  preferredWindow: { type: String, default: null },
  petId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pet', default: null },
  pet: { type: Object, default: null },
  contactSnapshot: { type: Object, default: null },
  note: { type: String, default: null },
  version: { type: Number, default: 1 },
}, { timestamps: true, optimisticConcurrency: true, versionKey: 'version' });

export default mongoose.model('AppointmentRequest', schema);