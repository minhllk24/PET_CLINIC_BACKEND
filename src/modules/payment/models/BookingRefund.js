import mongoose from 'mongoose';

const refundHistorySchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['REQUESTED', 'PROCESSING', 'APPROVED', 'REJECTED', 'REFUNDED'],
    required: true,
  },
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  note: {
    type: String,
    default: '',
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
}, { _id: false });

const schema = new mongoose.Schema({
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    required: true,
    index: true,
  },
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true,
    index: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  rule: {
    type: String,
    enum: ['CUSTOMER_EARLY_FULL', 'CUSTOMER_LATE_RETAIN_30', 'SYSTEM_FULL'],
    required: true,
  },
  reason: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['REQUESTED', 'PROCESSING', 'APPROVED', 'REJECTED', 'REFUNDED'],
    default: 'REQUESTED',
    index: true,
  },
  history: [refundHistorySchema],
  rejectedReason: {
    type: String,
    default: null,
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  processedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret._id;
      delete ret.__v;
      return ret;
    },
  },
});

schema.index({ appointmentId: 1, status: 1 });

export default mongoose.model('BookingRefund', schema);