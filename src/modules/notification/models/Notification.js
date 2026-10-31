import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ['APPOINTMENT_REMINDER', 'APPOINTMENT_UPDATE', 'ORDER_UPDATE', 'REFUND_UPDATE', 'SYSTEM'],
    default: 'SYSTEM',
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  body: {
    type: String,
    required: true,
    trim: true,
  },
  read: {
    type: Boolean,
    default: false,
    index: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, { timestamps: true });

schema.index({ recipientId: 1, createdAt: -1 });

export default mongoose.model('Notification', schema);
