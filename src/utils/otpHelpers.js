import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import config from '../shared/config';

/**
 * Generate a 6-digit cryptographically secure OTP code
 * @returns {string} 6-digit OTP string (100000 - 999999)
 */
export const generateOtpCode = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

/**
 * Hash an OTP code with SHA-256 before storing in DB
 * @param {string} code - Raw OTP code
 * @returns {string} SHA-256 hex string
 */
export const hashOtp = (code) => {
  if (!code || typeof code !== 'string') {
    throw new Error('OTP code must be a string');
  }
  return crypto.createHash('sha256').update(code).digest('hex');
};

/**
 * Verify an OTP code against its SHA-256 hash using timing-safe comparison
 * @param {string} code - Raw OTP code
 * @param {string} hash - Stored SHA-256 hash
 * @returns {boolean}
 */
export const verifyOtp = (code, hash) => {
  if (!code || !hash) return false;
  const computedHash = hashOtp(code);
  try {
    return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(hash));
  } catch (err) {
    return false;
  }
};

/**
 * Generate a reset password token (JWT valid for 10 minutes)
 * @param {Object} payload - Token payload
 * @returns {string} JWT reset token
 */
export const generateResetToken = (payload) => {
  const secret = config.jwt.resetSecret || config.jwt.accessSecret;
  return jwt.sign(
    { ...payload, purpose: 'reset_password' },
    secret,
    { expiresIn: '10m' }
  );
};

/**
 * Verify a reset password token
 * @param {string} token - JWT reset token
 * @returns {Object|null} Decoded payload or null
 */
export const verifyResetToken = (token) => {
  try {
    const secret = config.jwt.resetSecret || config.jwt.accessSecret;
    const decoded = jwt.verify(token, secret);
    if (decoded.purpose !== 'reset_password') {
      return null;
    }
    return decoded;
  } catch (error) {
    return null;
  }
};

export default {
  generateOtpCode,
  hashOtp,
  verifyOtp,
  generateResetToken,
  verifyResetToken,
};
