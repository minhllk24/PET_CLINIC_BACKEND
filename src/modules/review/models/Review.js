import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  sourceType: { type: String, enum: ['ORDER', 'APPOINTMENT'], default: 'ORDER' },
  sourceId: { type: mongoose.Schema.Types.ObjectId, index: true },
  targetType: { type: String, enum: ['PRODUCT', 'SERVICE'], required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, maxlength: 2000, default: '' },
  anonymous: { type: Boolean, default: false },
  displayName: { type: String, default: null },
  hidden: { type: Boolean, default: false, index: true },
  hiddenReason: { type: String, default: null },
  hiddenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  hiddenAt: { type: Date, default: null },
  status: { type: String, enum: ['ACTIVE', 'HIDDEN', 'DELETED'], default: 'ACTIVE', index: true },
}, { timestamps: true });

schema.index(
  { customerId: 1, sourceType: 1, sourceId: 1, targetId: 1 },
  { unique: true, partialFilterExpression: { sourceId: { $exists: true } } }
);

schema.virtual('isAnonymous')
  .get(function () { return this.anonymous; })
  .set(function (val) { this.anonymous = val; });

schema.virtual('isHidden')
  .get(function () { return this.hidden; })
  .set(function (val) { this.hidden = val; });

export default mongoose.models.Review || mongoose.model('Review', schema);