import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true, index: true },
  transactionType: { type: String, enum: ['RECEIPT', 'ISSUE', 'ADJUSTMENT', 'TRANSFER'], required: true },
  beforeQty: { type: Number, required: true },
  changeQty: { type: Number, required: true },
  afterQty: { type: Number, required: true, min: 0 },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true, trim: true },
  sourceType: { type: String, enum: ['MANUAL', 'SERVICE_RECORD_REVISION', 'ORDER', 'TRANSFER'], default: 'MANUAL', required: true },
  sourceId: { type: mongoose.Schema.Types.Mixed, default: null },
  recordVersion: { type: Number, default: null },
  transferId: { type: mongoose.Schema.Types.ObjectId, default: null },
  transferLeg: { type: String, default: null },
  idempotencyKey: { type: String, default: null }
}, { timestamps: true });

schema.index({ branchId: 1, inventoryItemId: 1, createdAt: -1 });

export default mongoose.models.InventoryTransaction || mongoose.model('InventoryTransaction', schema);