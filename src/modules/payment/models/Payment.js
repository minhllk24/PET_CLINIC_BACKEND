import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  code: { type: String, unique: true },
  target: {
    type: { type: String, enum: ['APPOINTMENT', 'ORDER'] },
    id: mongoose.Schema.Types.ObjectId
  },
  kind: { type: String, enum: ['DEPOSIT', 'BALANCE', 'FULL', 'ORDER'] },
  method: { type: String, enum: ['ONLINE_MOCK', 'PAY_AT_STORE', 'COD'] },
  expiresAt: Date,
  amount: Number,
  refundedAmount: { type: Number, default: 0 },
  provider: { type: String, default: 'MOCK' },
  providerRef: String,
  status: { type: String, enum: ['PENDING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUND_PENDING', 'REFUNDED'] },
  paidAt: Date,
  idempotencyKey: String,
  version: { type: Number, default: 1 }
}, { timestamps: true, optimisticConcurrency: true, versionKey: 'version' });

export default mongoose.model('Payment', schema);