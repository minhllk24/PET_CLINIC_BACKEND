import crypto from 'crypto';

/**
 * Generate a cryptographically secure 256-bit (32 bytes) opaque token as a 64-char hex string
 * @returns {string} 64-character hex string
 */
export const generateOpaqueToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Hash a token using SHA-256 for secure database lookup / storage
 * @param {string} token - The raw token string
 * @returns {string} 64-character hex hash string
 */
export const hashToken = (token) => {
  if (!token || typeof token !== 'string') {
    throw new Error('Token must be a non-empty string');
  }
  return crypto.createHash('sha256').update(token).digest('hex');
};

export default {
  generateOpaqueToken,
  hashToken,
};
