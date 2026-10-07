import mongoose from 'mongoose';

const variantSchema = new mongoose.Schema({
  sku: { type: String, required: true, unique: true },
  label: { type: String, required: true },
  price: { type: Number, required: true },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem' }
});

const schema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  origin: String,
  expiryInfo: String,
  images: [String],
  variants: [variantSchema],
  status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'], default: 'ACTIVE' }
}, { timestamps: true });

export default mongoose.model('Product', schema);