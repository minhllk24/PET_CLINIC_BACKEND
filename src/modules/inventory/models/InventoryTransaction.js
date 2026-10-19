import mongoose from 'mongoose';

export const INVENTORY_TRANSACTION_TYPES = Object.freeze(['RECEIPT', 'ISSUE', 'ADJUSTMENT', 'TRANSFER']);
export const INVENTORY_SOURCE_TYPES = Object.freeze(['MANUAL', 'SERVICE_RECORD_REVISION', 'ORDER', 'TRANSFER']);
export const INVENTORY_TRANSFER_LEGS = Object.freeze(['OUT', 'IN']);

const schema = new mongoose.Schema({
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true, index: true },
  transactionType: { type: String, enum: INVENTORY_TRANSACTION_TYPES, required: true },
  beforeQty: { type: Number, required: true },
  changeQty: { type: Number, required: true },
  afterQty: { type: Number, required: true, min: 0 },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true, trim: true },
  sourceType: { type: String, enum: INVENTORY_SOURCE_TYPES, default: 'MANUAL', required: true },
  sourceId: { type: mongoose.Schema.Types.Mixed, default: null },
  recordVersion: { type: Number, default: null },
  transferId: { type: mongoose.Schema.Types.ObjectId, default: null },
  transferLeg: { type: String, enum: [...INVENTORY_TRANSFER_LEGS, null], default: null },
  idempotencyKey: { type: String, default: null }
}, { timestamps: true });

schema.index({ branchId: 1, inventoryItemId: 1, createdAt: -1 });
schema.index(
  { sourceType: 1, sourceId: 1, inventoryItemId: 1, transactionType: 1 },
  {
    unique: true,
    partialFilterExpression: { sourceType: 'ORDER', sourceId: { $type: 'objectId' } }
  }
);

const rejectLedgerMutation = function rejectLedgerMutation() {
  throw new Error('InventoryTransaction is append-only');
};

schema.pre('save', function rejectExistingLedgerSave() {
  if (!this.isNew) rejectLedgerMutation();
});

schema.pre('updateOne', rejectLedgerMutation);
schema.pre('updateMany', rejectLedgerMutation);
schema.pre('findOneAndUpdate', rejectLedgerMutation);
schema.pre('replaceOne', rejectLedgerMutation);
schema.pre('findOneAndReplace', rejectLedgerMutation);
schema.pre('deleteOne', rejectLedgerMutation);
schema.pre('deleteMany', rejectLedgerMutation);
schema.pre('findOneAndDelete', rejectLedgerMutation);
schema.index(
  { sourceType: 1, sourceId: 1, recordVersion: 1, inventoryItemId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sourceType: 'SERVICE_RECORD_REVISION',
      sourceId: { $type: 'objectId' },
      recordVersion: { $type: 'number' }
    }
  }
);
schema.index(
  { transferId: 1, transferLeg: 1 },
  {
    unique: true,
    partialFilterExpression: { transferId: { $type: 'objectId' }, transferLeg: { $type: 'string' } }
  }
);

export default mongoose.models.InventoryTransaction || mongoose.model('InventoryTransaction', schema);
