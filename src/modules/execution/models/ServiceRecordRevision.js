import mongoose from 'mongoose';

const materialSchema = new mongoose.Schema({
  inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
  quantity: { type: Number, required: true, min: 0 }
}, { _id: false });

const deltaSchema = new mongoose.Schema({
  inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
  delta: { type: Number, required: true }
}, { _id: false });

const schema = new mongoose.Schema({
  serviceRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceRecord', required: true },
  recordVersion: { type: Number, required: true, min: 1 },
  previousActual: { type: [materialSchema], default: [] },
  newActual: { type: [materialSchema], default: [] },
  delta: { type: [deltaSchema], default: [] },
  professionalSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, default: null },
  finalizedAt: { type: Date, required: true, default: Date.now }
}, { timestamps: true });

schema.index({ serviceRecordId: 1, recordVersion: 1 }, { unique: true });

export default mongoose.models.ServiceRecordRevision || mongoose.model('ServiceRecordRevision', schema);
