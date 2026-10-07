import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  orderItemId: String,
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  variantId: mongoose.Schema.Types.ObjectId,
  nameSnapshot: String,
  unitPrice: Number,
  quantity: Number,
  lineSubtotal: Number,
  allocatedDiscount: Number,
  lineNet: Number,
  returnReservedQty: { type: Number, default: 0 },
  returnedQty: { type: Number, default: 0 },
  refundedNet: { type: Number, default: 0 }
});

const schema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  guestContactId: { type: mongoose.Schema.Types.ObjectId, ref: 'GuestContact' },
  contactSnapshot: Object,
  shippingAddress: Object,
  fulfillmentBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  status: { type: String, enum: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED'] },
  paymentMethod: { type: String, enum: ['ONLINE_MOCK', 'COD'] },
  payment: {
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    status: String
  },
  items: [orderItemSchema],
  pricing: {
    merchandiseSubtotal: Number,
    voucherDiscount: Number,
    shippingFee: Number,
    totalAmount: Number
  },
  voucher: {
    voucherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher' },
    code: String
  },
  deliveredAt: Date,
  statusHistory: [{
    status: String,
    at: Date,
    actorId: mongoose.Schema.Types.ObjectId,
    note: String
  }],
  version: { type: Number, default: 1 }
}, { timestamps: true, optimisticConcurrency: true, versionKey: 'version' });

export default mongoose.model('Order', schema);