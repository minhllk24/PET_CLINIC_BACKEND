import mongoose from 'mongoose';

const SYSTEM_ROLES = ['ADMIN', 'MANAGER', 'STAFF', 'CUSTOMER'];
const STAFF_SUB_ROLES = ['RECEPTIONIST', 'CARE_STAFF_GROOMER', 'VETERINARIAN', 'NURSE'];
const ACCOUNT_STATUSES = ['PENDING_ACTIVATION', 'ACTIVE', 'BLOCKED', 'DEACTIVATED'];

const addressSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true },
  country: { type: String, default: 'Việt Nam' },
  province: { type: String, trim: true },
  addressDetail: { type: String, trim: true },
  isDefault: { type: Boolean, default: false },
}, { _id: true });

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true,
  },
  phone: {
    type: String,
    required: function () {
      return !this.googleId && !this.username;
    },
    unique: true,
    sparse: true,
    trim: true,
    match: [/^0[0-9]{9}$/, 'Phone must be a valid Vietnamese phone number (10 digits starting with 0)'],
  },
  email: {
    type: String,
    unique: true,
    sparse: true, // allow multiple null values
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
  },
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    minlength: [2, 'Full name must be at least 2 characters'],
    maxlength: [100, 'Full name must be at most 100 characters'],
  },
  passwordHash: {
    type: String,
    required: function () {
      return !this.googleId;
    },
  },

  // Role fields
  systemRole: {
    type: String,
    enum: {
      values: SYSTEM_ROLES,
      message: '{VALUE} is not a valid system role',
    },
    required: true,
    default: 'CUSTOMER',
  },
  staffSubRole: {
    type: String,
    enum: {
      values: STAFF_SUB_ROLES,
      message: '{VALUE} is not a valid staff sub-role',
    },
    default: null,
  },
  staffCode: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
  },
  assignedBranchIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
  }],

  // Account lifecycle
  accountStatus: {
    type: String,
    enum: {
      values: ACCOUNT_STATUSES,
      message: '{VALUE} is not a valid account status',
    },
    required: true,
    default: 'PENDING_ACTIVATION',
  },
  activatedAt: { type: Date, default: null },
  lastLoginAt: { type: Date, default: null },

  // Security: brute force protection
  failedLoginCount: { type: Number, default: 0 },
  lockedUntil: { type: Date, default: null },

  // Addresses
  addresses: [addressSchema],

  // Google OAuth
  googleId: {
    type: String,
    unique: true,
    sparse: true,
  },
  avatarUrl: { type: String, default: null },
}, {
  timestamps: true,
  toJSON: {
    transform: (doc, ret) => {
      delete ret.passwordHash;
      delete ret.__v;
      return ret;
    },
  },
});

userSchema.index({ systemRole: 1, accountStatus: 1 });
userSchema.index({ assignedBranchIds: 1 });

// Virtual: check if account is locked
userSchema.virtual('isLocked').get(function () {
  return this.lockedUntil && this.lockedUntil > new Date();
});

// Validate staffSubRole only when systemRole is STAFF
userSchema.pre('validate', function (next) {
  if (this.systemRole === 'STAFF' && !this.staffSubRole) {
    this.invalidate('staffSubRole', 'Staff sub-role is required when systemRole is STAFF');
  }
  if (this.systemRole !== 'STAFF' && this.staffSubRole) {
    this.staffSubRole = null;
  }
  next();
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;
export { SYSTEM_ROLES, STAFF_SUB_ROLES, ACCOUNT_STATUSES };
