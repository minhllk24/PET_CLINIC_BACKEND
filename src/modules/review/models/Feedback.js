import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, trim: true, default: null },
  phone: { type: String, trim: true, default: null },
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
}, { timestamps: true });

export default mongoose.models.Feedback || mongoose.model('Feedback', schema);
