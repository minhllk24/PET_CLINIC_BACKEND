import mongoose from 'mongoose';

const AUDIT_ACTIONS = [
  'LOGIN',
  'LOGIN_FAILED',
  'LOGOUT',
  'REGISTER',
  'OTP_SENT',
  'OTP_VERIFIED',
  'PASSWORD_CHANGED',
  'PASSWORD_RESET',
  'ACCOUNT_BLOCKED',
  'ACCOUNT_ACTIVATED',
  'ROLE_CHANGED',
  'TOKEN_REFRESHED',
  'TOKEN_REVOKED',
  'GOOGLE_LOGIN',
];

const auditLogSchema = new mongoose.Schema({
  actor: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    systemRole: {
      type: String,
      default: 'ANONYMOUS',
    },
    ipAddress: {
      type: String,
      default: '',
    },
  },
  action: {
    type: String,
    enum: {
      values: AUDIT_ACTIONS,
      message: '{VALUE} is not a valid audit action',
    },
    required: [true, 'Audit action is required'],
  },
  target: {
    type: {
      type: String,
      default: null,
    },
    id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  correlationId: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// TTL index: 90 days retention (90 * 24 * 3600 = 7,776,000 seconds)
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });
auditLogSchema.index({ 'actor.userId': 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
export { AUDIT_ACTIONS };
