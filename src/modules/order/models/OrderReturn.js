import mongoose from 'mongoose';

const returnItemSchema = new mongoose.Schema({
  orderItemId: { type: String, required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productName: { type: String, required: true },
  orderedQty: { type: Number, required: true },
  alreadyReturnedQty: { type: Number, default: 0 },
  requestedQty: { type: Number, required: true, min: 1 },
  refundAmount: { type: Number, required: true, min: 0 },
  receivedQty: { type: Number, default: 0 },
  quality: { type: String, enum: ['RESELLABLE', 'DAMAGED', 'DISCARDED'], default: 'RESELLABLE' }
}, { _id: false });

const schema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', index: true },
  guestContactId: { type: mongoose.Schema.Types.ObjectId, ref: 'GuestContact' },
  status: {
    type: String,
    enum: ['REQUESTED', 'PROCESSING', 'RECEIVED', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED'],
    default: 'REQUESTED',
    index: true
  },
  reason: { type: String, required: true },
  evidenceUrls: [{ type: String }],
  items: [returnItemSchema],
  refundBreakdown: {
    merchandiseNet: { type: Number, required: true, min: 0 },
    shippingRefunded: { type: Number, default: 0 },
    total: { type: Number, required: true, min: 0 }
  },
  refundId: { type: mongoose.Schema.Types.ObjectId, ref: 'OrderRefund' },
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

schema.index({ orderId: 1, status: 1 });

export default mongoose.model('OrderReturn', schema);