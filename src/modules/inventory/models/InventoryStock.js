import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true, index: true },
  quantity: { type: Number, required: true, default: 0, min: 0 },
  lowStockThreshold: { type: Number, required: true, default: 0, min: 0 },
  thresholdConfigured: { type: Boolean, default: false },
  version: { type: Number, required: true, default: 1, min: 1 }
}, { timestamps: true });

// Unique inventory location projection
schema.index({ branchId: 1, inventoryItemId: 1 }, { unique: true });
schema.index({ branchId: 1, quantity: 1 });

export default mongoose.models.InventoryStock || mongoose.model('InventoryStock', schema);
