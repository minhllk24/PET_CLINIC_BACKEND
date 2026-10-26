import mongoose from 'mongoose';

const serviceSegmentSchema = new mongoose.Schema({
  serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  serviceName: { type: String, required: true },
  serviceType: { type: String, required: true, enum: ['GROOMING', 'MEDICAL'] },
  variantLabel: { type: String, default: null },
  unitPrice: { type: Number, required: true, default: 0 },
  durationMinutes: { type: Number, required: true },
  requiredStaffRole: {
    type: String,
    required: true,
    enum: ['CARE_STAFF_GROOMER', 'VETERINARIAN', 'NURSE'],
  },
  bookingMode: {
    type: String,
    required: true,
    enum: ['BOOKABLE', 'REQUEST_ONLY', 'CONTACT_ONLY'],
    default: 'BOOKABLE',
  },
  sequence: { type: Number, required: true, default: 1 },
  scheduledStart: { type: Date, required: true },
  scheduledEnd: { type: Date, required: true },
  assignedStaffId: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffProfile', required: true },
  executionStatus: {
    type: String,
    enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'],
    required: true,
    default: 'NOT_STARTED',
  },
  executionStartedAt: { type: Date, default: null },
  executionCompletedAt: { type: Date, default: null },
});

const schema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    guestContactId: { type: mongoose.Schema.Types.ObjectId, ref: 'GuestContact', default: null },
    contactSnapshot: { type: Object, default: null },
    petId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pet', default: null },
    petSnapshot: { type: Object, default: null },
    customerSnapshot: { type: Object, default: null },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    serviceType: { type: String, required: true, enum: ['GROOMING', 'MEDICAL'] },
    paymentMethod: {
      type: String,
      required: true,
      enum: ['ONLINE_MOCK', 'PAY_AT_STORE'],
    },
    services: [serviceSegmentSchema],
    scheduledStart: { type: Date, required: true },
    scheduledEnd: { type: Date, required: true },
    scheduledDurationMinutes: { type: Number, required: true },
    pricing: {
      subtotal: { type: Number, required: true, default: 0 },
      voucherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher', default: null },
      voucherDiscount: { type: Number, default: 0 },
      finalAmount: { type: Number, required: true, default: 0 },
      depositAmount: { type: Number, default: 0 },
      balanceAmount: { type: Number, default: 0 },
      paidAmount: { type: Number, default: 0 },
    },
    deposit: {
      status: {
        type: String,
        enum: ['NOT_REQUIRED', 'PENDING', 'HELD', 'APPLIED', 'REFUNDED', 'FORFEITED'],
        default: 'NOT_REQUIRED',
      },
      paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
    },
    status: {
      type: String,
      required: true,
      enum: [
        'PENDING_PAYMENT',
        'PENDING_CONFIRMATION',
        'CONFIRMED',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED',
        'NO_SHOW',
      ],
      default: 'PENDING_CONFIRMATION',
    },
    rescheduleCount: { type: Number, default: 0, min: 0, max: 2 },
    cancel: {
      by: { type: String, enum: ['CUSTOMER', 'STORE', 'SYSTEM'], default: null },
      at: { type: Date, default: null },
      actorId: { type: mongoose.Schema.Types.ObjectId, default: null },
      reason: { type: String, default: null },
      hoursBeforeStart: { type: Number, default: null },
      prepaidOutcome: { type: String, default: null },
    },
    holdExpiresAt: { type: Date, default: null },
    prepaymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
    reviewerStaffId: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffProfile', default: null },
    source: { type: String, default: 'ONLINE' },
    note: { type: String, default: null },
    conditionDescription: { type: String, default: null },
    version: { type: Number, default: 1 },
  },
  { timestamps: true, optimisticConcurrency: true, versionKey: 'version' }
);

export default mongoose.model('Appointment', schema);