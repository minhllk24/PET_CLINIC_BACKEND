import mongoose from 'mongoose';

const serviceSegmentSchema = new mongoose.Schema({
  serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
  serviceName: String,
  serviceType: String,
  variantLabel: String,
  unitPrice: Number,
  durationMinutes: Number,
  requiredStaffRole: String,
  bookingMode: String,
  depositConfig: Object,
  sequence: Number,
  scheduledStart: Date,
  scheduledEnd: Date,
  assignedStaffId: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffProfile' },
  executionStatus: { type: String, enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'], required: true, default: 'NOT_STARTED' },
  executionStartedAt: Date,
  executionCompletedAt: Date
});

const schema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  guestContactId: { type: mongoose.Schema.Types.ObjectId, ref: 'GuestContact' },
  petId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pet' },
  petSnapshot: Object,
  customerSnapshot: Object,
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  serviceType: { type: String, enum: ['GROOMING', 'MEDICAL', 'MIXED_SERVICE_TYPES'] },
  paymentMethod: { type: String, enum: ['ONLINE_MOCK', 'PAY_AT_STORE'] },
  services: [serviceSegmentSchema],
  scheduledStart: Date,
  scheduledEnd: Date,
  scheduledDurationMinutes: Number,
  pricing: {
    subtotal: Number,
    voucherId: mongoose.Schema.Types.ObjectId,
    voucherDiscount: Number,
    finalAmount: Number,
    depositAmount: Number,
    balanceAmount: Number,
    paidAmount: { type: Number, default: 0 }
  },
  deposit: {
    status: String,
    paymentId: mongoose.Schema.Types.ObjectId
  },
  status: { type: String, enum: ['PENDING_PAYMENT', 'PENDING_CONFIRMATION', 'CONFIRMED', 'CANCELLED', 'COMPLETED'] },
  rescheduleCount: { type: Number, default: 0 },
  cancel: {
    by: String,
    at: Date,
    actorId: mongoose.Schema.Types.ObjectId,
    reason: String,
    hoursBeforeStart: Number,
    prepaidOutcome: String
  },
  holdExpiresAt: Date,
  source: String,
  version: { type: Number, default: 1 }
}, { timestamps: true, optimisticConcurrency: true, versionKey: 'version' });

export default mongoose.model('Appointment', schema);