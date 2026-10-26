import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  phone: {
    type: String,
    sparse: true,
    index: true,
    trim: true,
    required: [
      function () {
        return !this.email;
      },
      'At least one of phone or email is required',
    ],
  },
  email: {
    type: String,
    sparse: true,
    index: true,
    lowercase: true,
    trim: true,
    required: [
      function () {
        return !this.phone;
      },
      'At least one of phone or email is required',
    ],
  },
  fullName: {
    type: String,
    required: true,
    trim: true,
  },
  activationStatus: {
    type: String,
    enum: ['NO_ACCOUNT', 'PENDING_ACTIVATION', 'ACTIVATED'],
    default: 'NO_ACCOUNT',
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    sparse: true,
    index: true,
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    default: null,
    sparse: true,
    index: true,
  },
  activationInviteSentAt: {
    type: Date,
    default: null,
  },
  activationCompletedAt: {
    type: Date,
    default: null,
  },
  activationToken: {
    type: String,
    default: null,
    index: true,
  },
  activationExpiresAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret._id;
      delete ret.__v;
      return ret;
    },
  },
});

schema.pre('validate', function () {
  if (!this.phone && !this.email) {
    this.invalidate('phone', 'At least one of phone or email is required');
  }
});

export default mongoose.model('GuestContact', schema);