import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, required: true },
  variantId: { type: mongoose.Schema.Types.ObjectId },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true }
}, { _id: true });

const schema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  tokenHash: { type: String }, // For guest cart
  items: [cartItemSchema],
  expiresAt: { type: Date }
}, { timestamps: true });

export default mongoose.models.Cart || mongoose.model('Cart', schema);
