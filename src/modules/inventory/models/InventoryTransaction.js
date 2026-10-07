import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem' },
  transactionType: { type: String, enum: ['RECEIPT', 'ISSUE', 'ADJUSTMENT', 'TRANSFER'] },
  beforeQty: Number,
  changeQty: Number,
  afterQty: Number,
  actorId: mongoose.Schema.Types.ObjectId,
  reason: String,
  sourceType: { type: String, enum: ['MANUAL', 'SERVICE_RECORD_REVISION', 'ORDER', 'TRANSFER'] },
  sourceId: mongoose.Schema.Types.ObjectId,
  recordVersion: Number,
  transferId: mongoose.Schema.Types.ObjectId,
  transferLeg: String,
  idempotencyKey: String
}, { timestamps: true });

export default mongoose.model('InventoryTransaction', schema);