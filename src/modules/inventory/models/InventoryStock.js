import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem' },
  quantity: { type: Number, default: 0 },
  threshold: { type: Number, default: 0 },
  version: { type: Number, default: 1 }
}, { timestamps: true });

export default mongoose.model('InventoryStock', schema);