import mongoose from 'mongoose';

const outboxMessageSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['EMAIL', 'SMS', 'PUSH']
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
    default: 'PENDING'
  },
  error: String,
  attempts: {
    type: Number,
    default: 0
  },
  nextAttemptAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

outboxMessageSchema.index({ status: 1, nextAttemptAt: 1 });

export default mongoose.models.OutboxMessage || mongoose.model('OutboxMessage', outboxMessageSchema);
