import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  cause: { type: String, enum: ['RETURN', 'CANCELLATION'], required: true, index: true },
  orderReturnId: { type: mongoose.Schema.Types.ObjectId, ref: 'OrderReturn', sparse: true, index: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  amount: { type: Number, required: true, min: 0 },
  provider: { type: String, default: 'MOCK' },
  status: {
    type: String,
    enum: ['PENDING', 'REFUNDED', 'FAILED'],
    default: 'PENDING',
    index: true
  },
  refundedAt: { type: Date },
  idempotencyKey: { type: String },
  history: [{
    status: { type: String, required: true },
    at: { type: Date, default: Date.now },
    actorId: { type: mongoose.Schema.Types.ObjectId },
    note: { type: String, default: '' }
  }],
  version: { type: Number, default: 1 }
}, {
  timestamps: true,
  optimisticConcurrency: true,
  versionKey: 'version'
});

schema.index({ orderId: 1, cause: 1 });

export default mongoose.model('OrderRefund', schema);