import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  sku: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  kind: { type: String, enum: ['PRODUCT', 'MATERIAL'], required: true, index: true },
  unit: { type: String, default: 'cái' },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' }
}, { timestamps: true });

schema.index({ kind: 1, status: 1 });

export default mongoose.models.InventoryItem || mongoose.model('InventoryItem', schema);