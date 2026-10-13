import bcrypt from 'bcryptjs';

const BCRYPT_SALT_ROUNDS = 12;

/**
 * Validate password strength against policy
 * Requirements: >= 8 characters, at least 1 uppercase letter, at least 1 digit
 * @param {string} password 
 * @returns {boolean}
 */
export const validatePasswordPolicy = (password) => {
  if (!password || typeof password !== 'string') return false;
  const policyRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
  return policyRegex.test(password);
};

/**
 * Hash password asynchronously with 12 salt rounds
 * @param {string} password - Raw password
 * @returns {Promise<string>} Hashed password
 */
export const hashPassword = async (password) => {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
  return bcrypt.hash(password, salt);
};

/**
 * Compare plain text password against hash asynchronously
 * @param {string} password - Raw password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} Match result
 */
export const comparePassword = async (password, hash) => {
  if (!password || !hash) return false;
  return bcrypt.compare(password, hash);
};

export default {
  validatePasswordPolicy,
  hashPassword,
  comparePassword,
};
