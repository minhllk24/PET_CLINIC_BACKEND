import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true, index: true },
  quantity: { type: Number, required: true, default: 0, min: 0 },
  lowStockThreshold: { type: Number, default: 0, min: 0 },
  threshold: { type: Number, default: 0, min: 0 }, // Backward compatibility
  version: { type: Number, default: 1 }
}, { timestamps: true });

// Unique inventory location projection
schema.index({ branchId: 1, inventoryItemId: 1 }, { unique: true });

export default mongoose.models.InventoryStock || mongoose.model('InventoryStock', schema);