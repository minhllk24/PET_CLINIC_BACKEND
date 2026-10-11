import mongoose from 'mongoose';

const variantSchema = new mongoose.Schema({
  sku: { type: String, required: true, trim: true },
  label: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true }
}, { _id: true });

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
  origin: { type: String, default: null },
  expiryInfo: { type: String, default: null },
  images: [{ type: String }],
  variants: {
    type: [variantSchema],
    validate: [v => Array.isArray(v) && v.length > 0, 'Product must have at least one variant']
  },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'], default: 'ACTIVE', index: true }
}, { timestamps: true });

// Full text search on name and description
schema.index({ name: 'text', description: 'text' });
// Compound index for catalog browsing and sorting
schema.index({ status: 1, categoryId: 1, createdAt: -1 });
schema.index({ 'variants.sku': 1 });

export default mongoose.models.Product || mongoose.model('Product', schema);