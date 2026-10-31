import * as authService from './auth.service.js';
import { sendSuccess, sendCreated, sendNoContent } from '../../shared/responseHelpers.js';
import config from '../../shared/config.js';
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from './auth.constants.js';
import { formatMe, formatAuthTokens } from './auth.serializer.js';

const getMeta = (req) => ({
  ip: req.ip || req.connection?.remoteAddress || '',
  userAgent: req.headers['user-agent'] || '',
  correlationId: req.id || req.headers['x-correlation-id'] || null,
});

const isSecureCookie = config.env === 'production' || process.env.COOKIE_SECURE === 'true';

const setRefreshCookie = (res, token, expiresAt) => {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecureCookie,
    sameSite: isSecureCookie ? 'none' : 'lax',
    path: REFRESH_COOKIE_PATH,
    expires: expiresAt,
  });
};

const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: isSecureCookie,
    sameSite: isSecureCookie ? 'none' : 'lax',
    path: REFRESH_COOKIE_PATH,
  });
};

export const register = async (req, res, next) => {
  try {
    const meta = getMeta(req);
    const result = await authService.register(req.body, meta);
    return sendCreated(res, result);
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const meta = getMeta(req);
    const { accessToken, refreshToken, expiresAt, user } = await authService.login(req.body, meta);
    setRefreshCookie(res, refreshToken, expiresAt);
    return sendSuccess(res, formatAuthTokens({
      accessToken,
      refreshToken,
      expiresIn: parseInt(process.env.JWT_EXPIRES_IN_SEC || '900', 10),
      user,
    }));
  } catch (err) {
    next(err);
  }
};

export const refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
    const meta = getMeta(req);
    const { accessToken, refreshToken: newRefreshToken, expiresAt } = await authService.refreshToken(token, meta);
    setRefreshCookie(res, newRefreshToken, expiresAt);
    return sendSuccess(res, formatAuthTokens({
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: parseInt(process.env.JWT_EXPIRES_IN_SEC || '900', 10),
    }));
  } catch (err) {
    next(err);
  }
};

export const logout = async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
    const meta = getMeta(req);
    await authService.logout(token, req.actor, meta);
    clearRefreshCookie(res);
    return sendNoContent(res);
  } catch (err) {
    next(err);
  }
};

export const verifyOtp = async (req, res, next) => {
  try {
    const meta = getMeta(req);
    const result = await authService.verifyOtpCode(req.body, meta);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const resendOtp = async (req, res, next) => {
  try {
    const meta = getMeta(req);
    const result = await authService.resendOtp(req.body, meta);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const meta = getMeta(req);
    const result = await authService.forgotPassword(req.body, meta);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const meta = getMeta(req);
    const result = await authService.resetPassword(req.body, meta);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const meta = getMeta(req);
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    const result = await authService.changePassword(req.actor.id, req.body, token, meta);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const googleLogin = async (req, res, next) => {
  try {
    const meta = getMeta(req);
    const { accessToken, refreshToken, expiresAt, user } = await authService.googleLogin(req.body, meta);
    setRefreshCookie(res, refreshToken, expiresAt);
    return sendSuccess(res, formatAuthTokens({
      accessToken,
      refreshToken,
      expiresIn: parseInt(process.env.JWT_EXPIRES_IN_SEC || '900', 10),
      user,
    }));
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const user = await authService.getMe(req.actor.id);
    return sendSuccess(res, formatMe(user));
  } catch (err) {
    next(err);
  }
};

export const updateMe = async (req, res, next) => {
  try {
    const meta = getMeta(req);
    const updated = await authService.updateMe(req.actor.id, req.body, meta);
    return sendSuccess(res, formatMe(updated));
  } catch (err) {
    next(err);
  }
};

export default {
  register,
  login,
  refreshToken,
  logout,
  verifyOtp,
  resendOtp,
  forgotPassword,
  resetPassword,
  changePassword,
  googleLogin,
  getMe,
  updateMe,
};
