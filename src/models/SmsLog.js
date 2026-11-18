import mongoose from 'mongoose';

const smsLogSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    brandName: {
      type: String,
      default: 'DRPETSHOUSE',
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    otp: {
      type: String,
      trim: true,
    },
    purpose: {
      type: String,
      default: 'OTP_VERIFICATION',
      trim: true,
    },
    channel: {
      type: String,
      default: 'SMS_BRANDNAME',
    },
    provider: {
      type: String,
      enum: ['esms', 'speedsms', 'twilio', 'simulator', 'custom'],
      default: 'simulator',
    },
    status: {
      type: String,
      enum: ['SENT', 'SIMULATED', 'FAILED'],
      default: 'SENT',
    },
    providerResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    error: {
      type: String,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 30 * 24 * 60 * 60, // Auto remove after 30 days
    },
  },
  {
    timestamps: true,
  }
);

smsLogSchema.index({ phone: 1, createdAt: -1 });

const SmsLog = mongoose.models.SmsLog || mongoose.model('SmsLog', smsLogSchema);

export default SmsLog;
