import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, trim: true, default: null },
  phone: { type: String, trim: true, default: null },
  gender: { type: String, enum: ['male', 'female', 'other', null], default: null },
  sourceCode: { type: String, default: 'CONTACT_FORM' },
  subject: { type: String, required: true, trim: true },
  message: { type: String, required: true, maxlength: 5000 },
  category: {
    type: String,
    enum: ['GENERAL', 'COMPLAINT', 'SUGGESTION', 'INQUIRY', 'OTHER'],
    default: 'GENERAL',
  },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null, index: true },
  status: {
    type: String,
    enum: ['NEW', 'READ', 'PROCESSING', 'PROCESSED', 'REJECTED', 'NEED_CONTACT'],
    default: 'NEW',
    index: true,
  },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  processingNotes: { type: String, default: null },
  responseMessage: { type: String, default: null },
  processedAt: { type: Date, default: null },
  statusHistory: [{
    status: { type: String, required: true },
    notes: { type: String, default: null },
    reason: { type: String, default: null },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    at: { type: Date, default: Date.now },
  }],
  replyDelivery: {
    subject: { type: String, default: null },
    message: { type: String, default: null },
    deliveryStatus: { type: String, enum: ['SENT', 'FAILED', 'QUEUED', null], default: null },
    sentAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    providerMessageId: { type: String, default: null },
    errorMessage: { type: String, default: null },
    outboxId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailOutbox', default: null },
  },
}, { timestamps: true });

export default mongoose.models.Feedback || mongoose.model('Feedback', schema);
