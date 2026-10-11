import mongoose from 'mongoose';

const OTP_PURPOSES = ['REGISTER', 'FORGOT_PASSWORD', 'LOGIN_VERIFICATION'];

const otpChallengeSchema = new mongoose.Schema({
  identifier: {
    type: String,
    required: [true, 'Identifier (phone or email) is required'],
    trim: true,
    lowercase: true,
  },
  otpHash: {
    type: String,
    required: [true, 'OTP hash is required'],
  },
  purpose: {
    type: String,
    enum: {
      values: OTP_PURPOSES,
      message: '{VALUE} is not a valid OTP purpose',
    },
    required: [true, 'Purpose is required'],
  },
  attemptCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  expiresAt: {
    type: Date,
    required: [true, 'Expiration time is required'],
  },
  lastSentAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// TTL index: MongoDB automatically removes expired challenges
otpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index to quickly look up active challenges by identifier and purpose
otpChallengeSchema.index({ identifier: 1, purpose: 1 });

const OtpChallenge = mongoose.model('OtpChallenge', otpChallengeSchema);

export default OtpChallenge;
export { OTP_PURPOSES };
