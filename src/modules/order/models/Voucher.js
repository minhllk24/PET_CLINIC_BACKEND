import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  discountType: {
    type: String,
    enum: ['PERCENTAGE', 'FIXED'],
    required: true
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0
  },
  scope: {
    type: String,
    enum: ['ORDER', 'PRODUCT', 'SERVICE'],
    required: true
  },
  scopeRefs: [{
    type: mongoose.Schema.Types.ObjectId
  }],
  effectiveFrom: {
    type: Date,
    required: true
  },
  effectiveTo: {
    type: Date,
    required: true
  },
  quota: {
    type: Number,
    required: true,
    min: 1
  },
  usedCount: {
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE',
    index: true
  },
  minOrderAmount: {
    type: Number,
    min: 0,
    default: 0
  },
  maxDiscountAmount: {
    type: Number,
    min: 0
  },
  version: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true,
  optimisticConcurrency: true,
  versionKey: 'version'
});

schema.index({ status: 1, effectiveFrom: 1, effectiveTo: 1 });

export default mongoose.model('Voucher', schema);