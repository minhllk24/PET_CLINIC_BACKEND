import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  key: { type: String, required: true },
  actorScope: { type: String, default: 'GLOBAL' },
  operationId: { type: String, default: '' },
  requestHash: { type: String, required: true },
  responseStatus: { type: Number },
  responseHeaders: { type: Object, default: {} },
  responseBody: { type: mongoose.Schema.Types.Mixed },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) }
}, { timestamps: true });

schema.index({ actorScope: 1, key: 1 }, { unique: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.IdempotencyKey || mongoose.model('IdempotencyKey', schema);