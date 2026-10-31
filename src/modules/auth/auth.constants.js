export const ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_EXPIRES_IN || process.env.JWT_ACCESS_TOKEN_EXPIRY || '8h';
export const REFRESH_TOKEN_SHORT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const REFRESH_TOKEN_LONG_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const OTP_COOLDOWN_MS = 30 * 1000; // 30 seconds
export const MAX_OTP_ATTEMPTS = 5;

export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const ACCOUNT_LOCKOUT_MS = 30 * 60 * 1000; // 30 minutes

export const RESET_TOKEN_EXPIRY = '10m';

export const REFRESH_COOKIE_NAME = 'refreshToken';
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

export default {
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_SHORT_TTL_MS,
  REFRESH_TOKEN_LONG_TTL_MS,
  OTP_TTL_MS,
  OTP_COOLDOWN_MS,
  MAX_OTP_ATTEMPTS,
  MAX_FAILED_LOGIN_ATTEMPTS,
  ACCOUNT_LOCKOUT_MS,
  RESET_TOKEN_EXPIRY,
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
};
