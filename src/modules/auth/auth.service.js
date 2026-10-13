import jwt from 'jsonwebtoken';
import https from 'https';
import User from '../../models/User.js';
import OtpChallenge from '../../models/OtpChallenge.js';
import RefreshSession from '../../models/RefreshSession.js';
import AppError from '../../utils/AppError.js';
import config from '../../shared/config.js';
import { generateOtpCode, hashOtp, verifyOtp, generateResetToken, verifyResetToken } from '../../utils/otpHelpers.js';
import { hashPassword, comparePassword, validatePasswordPolicy } from '../../utils/passwordHelpers.js';
import { generateOpaqueToken, hashToken } from '../../utils/tokenHelpers.js';
import { recordAuditLog } from '../../utils/auditLogger.js';
import {
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_SHORT_TTL_MS,
  REFRESH_TOKEN_LONG_TTL_MS,
  OTP_TTL_MS,
  OTP_COOLDOWN_MS,
  MAX_OTP_ATTEMPTS,
  MAX_FAILED_LOGIN_ATTEMPTS,
  ACCOUNT_LOCKOUT_MS,
} from './auth.constants.js';

/**
 * Register a new customer
 */
export const register = async ({ phone, fullName, email, password, confirmPassword }, meta = {}) => {
  if (!password || !confirmPassword) {
    throw new AppError(400, 'Bad Request', 'MISSING_FIELDS', 'Password and confirmPassword are required');
  }

  if (password !== confirmPassword) {
    throw new AppError(400, 'Bad Request', 'PASSWORD_MISMATCH', 'Passwords do not match');
  }

  if (!validatePasswordPolicy(password)) {
    throw new AppError(
      400,
      'Bad Request',
      'PASSWORD_TOO_WEAK',
      'Password must be at least 8 characters long and contain at least one uppercase letter and one digit'
    );
  }

  // Validate phone format
  if (!phone || !/^0[0-9]{9}$/.test(phone)) {
    throw new AppError(400, 'Bad Request', 'INVALID_PHONE', 'Phone must be a valid 10-digit Vietnamese number');
  }

  // Check phone uniqueness
  const existingPhone = await User.findOne({ phone });
  if (existingPhone) {
    throw new AppError(409, 'Conflict', 'PHONE_ALREADY_EXISTS', 'This phone number is already registered');
  }

  // Check email uniqueness if email provided
  if (email) {
    const existingEmail = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingEmail) {
      throw new AppError(409, 'Conflict', 'EMAIL_ALREADY_EXISTS', 'This email is already registered');
    }
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user with strict default privileges
  const user = await User.create({
    phone,
    fullName: fullName.trim(),
    email: email ? email.toLowerCase().trim() : null,
    passwordHash,
    systemRole: 'CUSTOMER',
    accountStatus: 'PENDING_ACTIVATION',
    staffSubRole: null,
    assignedBranchIds: [],
  });

  // Generate and store OTP
  const rawOtp = generateOtpCode();
  const hashedOtp = hashOtp(rawOtp);

  await OtpChallenge.deleteMany({ identifier: phone, purpose: 'REGISTER' });
  await OtpChallenge.create({
    identifier: phone,
    otpHash: hashedOtp,
    purpose: 'REGISTER',
    attemptCount: 0,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
    lastSentAt: new Date(),
  });

  // Record audit log
  await recordAuditLog({
    actor: { userId: user._id, systemRole: 'CUSTOMER', ipAddress: meta.ip || '' },
    action: 'REGISTER',
    target: { type: 'User', id: user._id },
    correlationId: meta.correlationId || null,
  });

  return {
    message: 'OTP has been sent',
    identifier: phone,
    ...(config.env !== 'production' ? { debugOtp: rawOtp } : {}),
  };
};

/**
 * Authenticate customer or staff user
 */
export const login = async ({ identifier, phone, password, rememberMe = false }, meta = {}) => {
  const loginId = (identifier || phone || '').trim();
  if (!loginId || !password) {
    throw new AppError(400, 'Bad Request', 'MISSING_FIELDS', 'Identifier and password are required');
  }

  const user = await User.findOne({
    $or: [{ phone: loginId }, { email: loginId.toLowerCase() }],
  });

  // Generic 401 response for non-existent users (prevents enumeration)
  if (!user) {
    await recordAuditLog({
      action: 'LOGIN_FAILED',
      actor: { ipAddress: meta.ip || '' },
      metadata: { identifier: loginId, reason: 'USER_NOT_FOUND' },
      correlationId: meta.correlationId || null,
    });
    throw new AppError(401, 'Unauthorized', 'INVALID_CREDENTIALS', 'Invalid credentials');
  }

  // Account status check
  if (user.accountStatus === 'PENDING_ACTIVATION') {
    throw new AppError(403, 'Forbidden', 'ACCOUNT_NOT_ACTIVATED', 'Account is not activated. Please verify OTP.');
  }

  if (user.accountStatus === 'BLOCKED') {
    throw new AppError(403, 'Forbidden', 'ACCOUNT_BLOCKED', 'Account has been blocked. Please contact support.');
  }

  if (user.accountStatus === 'DEACTIVATED') {
    throw new AppError(403, 'Forbidden', 'ACCOUNT_DEACTIVATED', 'Account is deactivated.');
  }

  // Check temporary lockout
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError(
      423,
      'Locked',
      'ACCOUNT_LOCKED',
      'Account is temporarily locked due to multiple failed login attempts. Please try again later.'
    );
  }

  // Compare password
  const isMatch = await comparePassword(password, user.passwordHash);

  if (!isMatch) {
    user.failedLoginCount = (user.failedLoginCount || 0) + 1;
    if (user.failedLoginCount >= MAX_FAILED_LOGIN_ATTEMPTS) {
      user.lockedUntil = new Date(Date.now() + ACCOUNT_LOCKOUT_MS);
      await recordAuditLog({
        actor: { userId: user._id, systemRole: user.systemRole, ipAddress: meta.ip || '' },
        action: 'ACCOUNT_BLOCKED',
        target: { type: 'User', id: user._id },
        metadata: { reason: 'Exceeded maximum failed login attempts' },
        correlationId: meta.correlationId || null,
      });
    }
    await user.save();

    await recordAuditLog({
      actor: { userId: user._id, systemRole: user.systemRole, ipAddress: meta.ip || '' },
      action: 'LOGIN_FAILED',
      target: { type: 'User', id: user._id },
      metadata: { failedAttempts: user.failedLoginCount },
      correlationId: meta.correlationId || null,
    });

    throw new AppError(401, 'Unauthorized', 'INVALID_CREDENTIALS', 'Invalid phone number or password');
  }

  // Successful login: reset failed counters
  user.failedLoginCount = 0;
  user.lockedUntil = null;
  user.lastLoginAt = new Date();
  await user.save();

  // Generate short-lived Access JWT (15 minutes)
  const accessToken = jwt.sign(
    {
      id: user._id.toString(),
      systemRole: user.systemRole,
      staffSubRole: user.staffSubRole,
      assignedBranchIds: (user.assignedBranchIds || []).map((id) => id.toString()),
    },
    config.jwt.accessSecret,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  // Generate stateful opaque refresh token
  const rawRefreshToken = generateOpaqueToken();
  const tokenHash = hashToken(rawRefreshToken);
  const ttlMs = rememberMe ? REFRESH_TOKEN_LONG_TTL_MS : REFRESH_TOKEN_SHORT_TTL_MS;
  const expiresAt = new Date(Date.now() + ttlMs);

  await RefreshSession.create({
    userId: user._id,
    tokenHash,
    userAgent: meta.userAgent || '',
    ipAddress: meta.ip || '',
    rememberMe: Boolean(rememberMe),
    expiresAt,
  });

  // Record audit log
  await recordAuditLog({
    actor: { userId: user._id, systemRole: user.systemRole, ipAddress: meta.ip || '' },
    action: 'LOGIN',
    target: { type: 'User', id: user._id },
    correlationId: meta.correlationId || null,
  });

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    expiresAt,
    user: {
      id: user._id.toString(),
      phone: user.phone,
      fullName: user.fullName,
      email: user.email,
      systemRole: user.systemRole,
      staffSubRole: user.staffSubRole,
      avatarUrl: user.avatarUrl,
      accountStatus: user.accountStatus,
      activatedAt: user.activatedAt,
      lastLoginAt: user.lastLoginAt,
      assignedBranchIds: user.assignedBranchIds || [],
    },
  };
};

/**
 * Rotate refresh token with reuse detection
 */
export const refreshToken = async (rawToken, meta = {}) => {
  if (!rawToken || typeof rawToken !== 'string') {
    throw new AppError(401, 'Unauthorized', 'REFRESH_TOKEN_REQUIRED', 'Refresh token is required');
  }

  const incomingHash = hashToken(rawToken);
  const session = await RefreshSession.findOne({ tokenHash: incomingHash });

  if (!session) {
    throw new AppError(401, 'Unauthorized', 'INVALID_REFRESH_TOKEN', 'Invalid refresh token');
  }

  // Reuse Detection: If this session was already revoked, a breach occurred!
  if (session.revokedAt) {
    // Revoke all sessions for this user immediately
    await RefreshSession.updateMany(
      { userId: session.userId, revokedAt: null },
      { revokedAt: new Date() }
    );

    await recordAuditLog({
      actor: { userId: session.userId, ipAddress: meta.ip || '' },
      action: 'TOKEN_REVOKED',
      target: { type: 'User', id: session.userId },
      metadata: { reason: 'Refresh token reuse detected', compromisedSessionId: session._id },
      correlationId: meta.correlationId || null,
    });

    throw new AppError(
      401,
      'Unauthorized',
      'TOKEN_REUSE_DETECTED',
      'Suspicious token reuse detected. All sessions have been revoked.'
    );
  }

  // Check expiration
  if (session.expiresAt <= new Date()) {
    session.revokedAt = new Date();
    await session.save();
    throw new AppError(401, 'Unauthorized', 'REFRESH_TOKEN_EXPIRED', 'Refresh token has expired');
  }

  // Check user status in database
  const user = await User.findById(session.userId);
  if (!user || user.accountStatus !== 'ACTIVE') {
    session.revokedAt = new Date();
    await session.save();
    throw new AppError(401, 'Unauthorized', 'ACCOUNT_INACTIVE', 'Account is no longer active');
  }

  // Generate new tokens (Rotation)
  const newAccessToken = jwt.sign(
    {
      id: user._id.toString(),
      systemRole: user.systemRole,
      staffSubRole: user.staffSubRole,
      assignedBranchIds: (user.assignedBranchIds || []).map((id) => id.toString()),
    },
    config.jwt.accessSecret,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  const newRawRefreshToken = generateOpaqueToken();
  const newHash = hashToken(newRawRefreshToken);
  const ttlMs = session.rememberMe ? REFRESH_TOKEN_LONG_TTL_MS : REFRESH_TOKEN_SHORT_TTL_MS;
  const newExpiresAt = new Date(Date.now() + ttlMs);

  // Invalidate current session and link to new one
  session.revokedAt = new Date();
  session.replacedByTokenHash = newHash;
  await session.save();

  // Create new active session
  await RefreshSession.create({
    userId: user._id,
    tokenHash: newHash,
    userAgent: meta.userAgent || session.userAgent,
    ipAddress: meta.ip || session.ipAddress,
    rememberMe: session.rememberMe,
    expiresAt: newExpiresAt,
  });

  await recordAuditLog({
    actor: { userId: user._id, systemRole: user.systemRole, ipAddress: meta.ip || '' },
    action: 'TOKEN_REFRESHED',
    target: { type: 'User', id: user._id },
    correlationId: meta.correlationId || null,
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRawRefreshToken,
    expiresAt: newExpiresAt,
  };
};

/**
 * Logout and revoke current refresh session
 */
export const logout = async (rawToken, actor = null, meta = {}) => {
  if (rawToken) {
    try {
      const tokenHash = hashToken(rawToken);
      await RefreshSession.updateOne(
        { tokenHash, revokedAt: null },
        { revokedAt: new Date() }
      );
    } catch (err) {
      // ignore hash errors on malformed cookies during logout
    }
  }

  if (actor) {
    await recordAuditLog({
      actor: { userId: actor.id, systemRole: actor.systemRole, ipAddress: meta.ip || '' },
      action: 'LOGOUT',
      target: { type: 'User', id: actor.id },
      correlationId: meta.correlationId || null,
    });
  }

  return true;
};

/**
 * Verify OTP for registration or password reset
 */
export const verifyOtpCode = async ({ identifier, otpCode, purpose }, meta = {}) => {
  if (!identifier || !otpCode || !purpose) {
    throw new AppError(400, 'Bad Request', 'MISSING_FIELDS', 'Identifier, otpCode, and purpose are required');
  }

  const cleanIdentifier = identifier.toLowerCase().trim();
  const challenge = await OtpChallenge.findOne({ identifier: cleanIdentifier, purpose });

  if (!challenge) {
    throw new AppError(400, 'Bad Request', 'INVALID_OTP', 'No pending OTP challenge found');
  }

  if (challenge.expiresAt <= new Date()) {
    await OtpChallenge.deleteOne({ _id: challenge._id });
    throw new AppError(400, 'Bad Request', 'OTP_EXPIRED', 'OTP code has expired. Please request a new one.');
  }

  if (challenge.attemptCount >= MAX_OTP_ATTEMPTS) {
    throw new AppError(
      429,
      'Too Many Requests',
      'MAX_OTP_ATTEMPTS_EXCEEDED',
      'Maximum verification attempts exceeded. Please request a new OTP.'
    );
  }

  const isValid = verifyOtp(otpCode, challenge.otpHash);

  if (!isValid) {
    challenge.attemptCount += 1;
    await challenge.save();
    throw new AppError(400, 'Bad Request', 'INVALID_OTP', 'Invalid OTP code');
  }

  // OTP is valid - consume challenge
  await OtpChallenge.deleteOne({ _id: challenge._id });

  if (purpose === 'REGISTER') {
    const user = await User.findOne({
      $or: [{ phone: cleanIdentifier }, { email: cleanIdentifier }],
    });

    if (user) {
      user.accountStatus = 'ACTIVE';
      user.activatedAt = new Date();
      await user.save();

      await recordAuditLog({
        actor: { userId: user._id, systemRole: user.systemRole, ipAddress: meta.ip || '' },
        action: 'OTP_VERIFIED',
        target: { type: 'User', id: user._id },
        metadata: { purpose },
        correlationId: meta.correlationId || null,
      });

      await recordAuditLog({
        actor: { userId: user._id, systemRole: user.systemRole, ipAddress: meta.ip || '' },
        action: 'ACCOUNT_ACTIVATED',
        target: { type: 'User', id: user._id },
        correlationId: meta.correlationId || null,
      });
    }

    return { message: 'Account activated successfully' };
  }

  if (purpose === 'FORGOT_PASSWORD') {
    const user = await User.findOne({
      $or: [{ phone: cleanIdentifier }, { email: cleanIdentifier }],
    });

    if (!user) {
      throw new AppError(404, 'Not Found', 'USER_NOT_FOUND', 'User not found');
    }

    const resetToken = generateResetToken({
      id: user._id.toString(),
      phone: user.phone,
    });

    await recordAuditLog({
      actor: { userId: user._id, systemRole: user.systemRole, ipAddress: meta.ip || '' },
      action: 'OTP_VERIFIED',
      target: { type: 'User', id: user._id },
      metadata: { purpose },
      correlationId: meta.correlationId || null,
    });

    return { resetToken };
  }

  return { verified: true };
};

/**
 * Resend OTP with cooldown enforcement
 */
export const resendOtp = async ({ identifier, purpose }, meta = {}) => {
  if (!identifier || !purpose) {
    throw new AppError(400, 'Bad Request', 'MISSING_FIELDS', 'Identifier and purpose are required');
  }

  const cleanIdentifier = identifier.toLowerCase().trim();
  const challenge = await OtpChallenge.findOne({ identifier: cleanIdentifier, purpose });

  if (challenge && challenge.lastSentAt) {
    const elapsed = Date.now() - challenge.lastSentAt.getTime();
    if (elapsed < OTP_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((OTP_COOLDOWN_MS - elapsed) / 1000);
      throw new AppError(
        429,
        'Too Many Requests',
        'OTP_COOLDOWN',
        `Please wait ${waitSeconds} seconds before requesting a new OTP.`
      );
    }
  }

  const rawOtp = generateOtpCode();
  const hashedOtp = hashOtp(rawOtp);

  await OtpChallenge.findOneAndUpdate(
    { identifier: cleanIdentifier, purpose },
    {
      otpHash: hashedOtp,
      attemptCount: 0,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      lastSentAt: new Date(),
    },
    { upsert: true, new: true }
  );

  await recordAuditLog({
    action: 'OTP_SENT',
    actor: { ipAddress: meta.ip || '' },
    metadata: { identifier: cleanIdentifier, purpose },
    correlationId: meta.correlationId || null,
  });

  return {
    message: 'OTP has been resent',
    identifier,
    ...(config.env !== 'production' ? { debugOtp: rawOtp } : {}),
  };
};

/**
 * Request password reset OTP (Anti-enumeration: always returns 200)
 */
export const forgotPassword = async ({ identifier }, meta = {}) => {
  if (!identifier) {
    throw new AppError(400, 'Bad Request', 'MISSING_FIELDS', 'Identifier is required');
  }

  const cleanIdentifier = identifier.toLowerCase().trim();
  const user = await User.findOne({
    $or: [{ phone: cleanIdentifier }, { email: cleanIdentifier }],
  });

  let rawOtp = null;
  if (user && user.accountStatus === 'ACTIVE') {
    rawOtp = generateOtpCode();
    const hashedOtp = hashOtp(rawOtp);

    await OtpChallenge.findOneAndUpdate(
      { identifier: cleanIdentifier, purpose: 'FORGOT_PASSWORD' },
      {
        otpHash: hashedOtp,
        attemptCount: 0,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        lastSentAt: new Date(),
      },
      { upsert: true, new: true }
    );

    await recordAuditLog({
      actor: { userId: user._id, systemRole: user.systemRole, ipAddress: meta.ip || '' },
      action: 'OTP_SENT',
      target: { type: 'User', id: user._id },
      metadata: { purpose: 'FORGOT_PASSWORD' },
      correlationId: meta.correlationId || null,
    });
  }

  return {
    message: 'If an account exists with this identifier, an OTP has been sent',
    ...(config.env !== 'production' && rawOtp ? { debugOtp: rawOtp } : {}),
  };
};

/**
 * Reset password using valid resetToken
 */
export const resetPassword = async ({ resetToken, newPassword, confirmPassword }, meta = {}) => {
  if (!resetToken || !newPassword || !confirmPassword) {
    throw new AppError(400, 'Bad Request', 'MISSING_FIELDS', 'All fields are required');
  }

  if (newPassword !== confirmPassword) {
    throw new AppError(400, 'Bad Request', 'PASSWORD_MISMATCH', 'Passwords do not match');
  }

  if (!validatePasswordPolicy(newPassword)) {
    throw new AppError(
      400,
      'Bad Request',
      'PASSWORD_TOO_WEAK',
      'Password must be at least 8 characters long and contain at least one uppercase letter and one digit'
    );
  }

  const decoded = verifyResetToken(resetToken);
  if (!decoded || !decoded.id) {
    throw new AppError(400, 'Bad Request', 'INVALID_RESET_TOKEN', 'Reset token is invalid or expired');
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    throw new AppError(404, 'Not Found', 'USER_NOT_FOUND', 'User not found');
  }

  user.passwordHash = await hashPassword(newPassword);
  user.failedLoginCount = 0;
  user.lockedUntil = null;
  await user.save();

  // Invalidate all refresh sessions
  await RefreshSession.updateMany(
    { userId: user._id, revokedAt: null },
    { revokedAt: new Date() }
  );

  await recordAuditLog({
    actor: { userId: user._id, systemRole: user.systemRole, ipAddress: meta.ip || '' },
    action: 'PASSWORD_RESET',
    target: { type: 'User', id: user._id },
    correlationId: meta.correlationId || null,
  });

  return { message: 'Password reset successfully' };
};

/**
 * Change password for authenticated actor
 */
export const changePassword = async (
  userId,
  { oldPassword, newPassword, confirmPassword },
  currentRefreshToken = null,
  meta = {}
) => {
  if (!oldPassword || !newPassword || !confirmPassword) {
    throw new AppError(400, 'Bad Request', 'MISSING_FIELDS', 'All fields are required');
  }

  if (newPassword !== confirmPassword) {
    throw new AppError(400, 'Bad Request', 'PASSWORD_MISMATCH', 'Passwords do not match');
  }

  if (!validatePasswordPolicy(newPassword)) {
    throw new AppError(
      400,
      'Bad Request',
      'PASSWORD_TOO_WEAK',
      'Password must be at least 8 characters long and contain at least one uppercase letter and one digit'
    );
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(404, 'Not Found', 'USER_NOT_FOUND', 'User not found');
  }

  const isMatch = await comparePassword(oldPassword, user.passwordHash);
  if (!isMatch) {
    throw new AppError(400, 'Bad Request', 'INVALID_OLD_PASSWORD', 'Old password is incorrect');
  }

  user.passwordHash = await hashPassword(newPassword);
  await user.save();

  // Revoke all OTHER refresh sessions (keep current session active if provided)
  let currentTokenHash = null;
  if (currentRefreshToken) {
    try {
      currentTokenHash = hashToken(currentRefreshToken);
    } catch (e) {}
  }

  const filter = { userId: user._id, revokedAt: null };
  if (currentTokenHash) {
    filter.tokenHash = { $ne: currentTokenHash };
  }
  await RefreshSession.updateMany(filter, { revokedAt: new Date() });

  await recordAuditLog({
    actor: { userId: user._id, systemRole: user.systemRole, ipAddress: meta.ip || '' },
    action: 'PASSWORD_CHANGED',
    target: { type: 'User', id: user._id },
    correlationId: meta.correlationId || null,
  });

  return { message: 'Password changed successfully' };
};

/**
 * Verify Google ID Token via Google's tokeninfo API
 */
const verifyGoogleIdToken = (credential) => {
  return new Promise((resolve, reject) => {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            return reject(new Error('Invalid Google credential'));
          }
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (e) {
            reject(new Error('Failed to parse Google response'));
          }
        });
      })
      .on('error', (err) => {
        reject(err);
      });
  });
};

/**
 * Google OAuth Sign-in / Registration
 */
export const googleLogin = async ({ credential }, meta = {}) => {
  if (!credential) {
    throw new AppError(400, 'Bad Request', 'MISSING_CREDENTIAL', 'Google credential is required');
  }

  let payload;
  try {
    payload = await verifyGoogleIdToken(credential);
  } catch (err) {
    throw new AppError(401, 'Unauthorized', 'INVALID_GOOGLE_TOKEN', 'Google ID token verification failed');
  }

  const { sub, email, name, picture } = payload;

  if (!email) {
    throw new AppError(400, 'Bad Request', 'GOOGLE_EMAIL_MISSING', 'Google account does not provide an email');
  }

  let user = await User.findOne({
    $or: [{ googleId: sub }, { email: email.toLowerCase().trim() }],
  });

  if (!user) {
    // Register new Customer via Google
    user = await User.create({
      fullName: name || 'Google User',
      email: email.toLowerCase().trim(),
      googleId: sub,
      avatarUrl: picture || null,
      systemRole: 'CUSTOMER',
      accountStatus: 'ACTIVE',
      activatedAt: new Date(),
    });
  } else {
    // Existing user: bind Google ID if not yet bound
    if (!user.googleId) {
      user.googleId = sub;
    }
    if (picture && !user.avatarUrl) {
      user.avatarUrl = picture;
    }
    if (user.accountStatus === 'PENDING_ACTIVATION') {
      user.accountStatus = 'ACTIVE';
      user.activatedAt = new Date();
    }
    await user.save();
  }

  if (user.accountStatus !== 'ACTIVE') {
    throw new AppError(403, 'Forbidden', 'ACCOUNT_INACTIVE', `Account status is ${user.accountStatus}`);
  }

  user.lastLoginAt = new Date();
  await user.save();

  // Create JWT and refresh session
  const accessToken = jwt.sign(
    {
      id: user._id.toString(),
      systemRole: user.systemRole,
      staffSubRole: user.staffSubRole,
      assignedBranchIds: (user.assignedBranchIds || []).map((id) => id.toString()),
    },
    config.jwt.accessSecret,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  const rawRefreshToken = generateOpaqueToken();
  const tokenHash = hashToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_SHORT_TTL_MS);

  await RefreshSession.create({
    userId: user._id,
    tokenHash,
    userAgent: meta.userAgent || '',
    ipAddress: meta.ip || '',
    rememberMe: false,
    expiresAt,
  });

  await recordAuditLog({
    actor: { userId: user._id, systemRole: user.systemRole, ipAddress: meta.ip || '' },
    action: 'GOOGLE_LOGIN',
    target: { type: 'User', id: user._id },
    correlationId: meta.correlationId || null,
  });

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    expiresAt,
    user: {
      id: user._id.toString(),
      phone: user.phone,
      fullName: user.fullName,
      email: user.email,
      systemRole: user.systemRole,
      staffSubRole: user.staffSubRole,
      avatarUrl: user.avatarUrl,
    },
  };
};

/**
 * Get profile of authenticated actor
 */
export const getMe = async (userId) => {
  const user = await User.findById(userId).select('-passwordHash -__v');
  if (!user) {
    throw new AppError(404, 'Not Found', 'USER_NOT_FOUND', 'User not found');
  }
  return user;
};

/**
 * Update profile of authenticated actor (Strict whitelist against mass assignment)
 */
export const updateMe = async (userId, { fullName, email, avatarUrl }, meta = {}) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(404, 'Not Found', 'USER_NOT_FOUND', 'User not found');
  }

  if (fullName !== undefined) {
    const trimmed = fullName.trim();
    if (trimmed.length < 2 || trimmed.length > 100) {
      throw new AppError(400, 'Bad Request', 'INVALID_FULLNAME', 'Full name must be between 2 and 100 characters');
    }
    user.fullName = trimmed;
  }

  if (email !== undefined && email !== null) {
    const trimmedEmail = email.toLowerCase().trim();
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      throw new AppError(400, 'Bad Request', 'INVALID_EMAIL', 'Please provide a valid email address');
    }
    const duplicate = await User.findOne({ email: trimmedEmail, _id: { $ne: user._id } });
    if (duplicate) {
      throw new AppError(409, 'Conflict', 'EMAIL_ALREADY_EXISTS', 'Email is already taken by another account');
    }
    user.email = trimmedEmail;
  }

  if (avatarUrl !== undefined) {
    user.avatarUrl = avatarUrl;
  }

  // Save changes (Privilege fields like systemRole, staffSubRole, accountStatus are NEVER updated here)
  await user.save();

  return user;
};

export default {
  register,
  login,
  refreshToken,
  logout,
  verifyOtpCode,
  resendOtp,
  forgotPassword,
  resetPassword,
  changePassword,
  googleLogin,
  getMe,
  updateMe,
};
