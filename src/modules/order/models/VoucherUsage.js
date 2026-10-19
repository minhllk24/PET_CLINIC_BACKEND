import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  voucherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Voucher',
    required: true,
    index: true
  },
  targetType: {
    type: String,
    enum: ['ORDER', 'APPOINTMENT'],
    required: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  discountApplied: {
    type: Number,
    default: 0
  },
  consumedAt: {
    type: Date,
    default: Date.now
  },
  restoredAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

schema.index({ voucherId: 1, targetType: 1, targetId: 1 }, { unique: true });

export default mongoose.model('VoucherUsage', schema);