import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
  itemId: { type: String, required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, required: true },
  quantity: { type: Number, required: true, min: 1 }
});

const schema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', unique: true, sparse: true },
  tokenHash: { type: String, unique: true, sparse: true },
  items: [itemSchema],
  expiresAt: { type: Date }
}, { timestamps: true });

export default mongoose.model('Cart', schema);