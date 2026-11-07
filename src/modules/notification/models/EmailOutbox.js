import mongoose from 'mongoose';

const emailOutboxSchema = new mongoose.Schema(
  {
    recipient: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    targetType: {
      type: String,
      enum: ['FEEDBACK', 'ORDER', 'APPOINTMENT', 'SYSTEM'],
      default: 'FEEDBACK',
      index: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['QUEUED', 'SENDING', 'SENT', 'FAILED'],
      default: 'QUEUED',
      index: true,
    },
    provider: {
      type: String,
      default: 'NODEMAILER',
    },
    providerMessageId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastError: {
      type: String,
      default: null,
    },
    idempotencyKey: {
      type: String,
      sparse: true,
      unique: true,
      index: true,
      trim: true,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

emailOutboxSchema.index({ status: 1, createdAt: -1 });

export default mongoose.models.EmailOutbox || mongoose.model('EmailOutbox', emailOutboxSchema);

