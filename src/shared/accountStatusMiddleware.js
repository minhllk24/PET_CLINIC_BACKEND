import AppError from '../utils/AppError.js';

/**
 * Middleware to enforce that the authenticated actor's account is in ACTIVE status
 */
export const requireActiveAccount = (req, res, next) => {
  if (!req.actor) {
    return next(new AppError(401, 'Unauthenticated', 'AUTHENTICATION_ERROR', 'Authentication required'));
  }

  if (req.actor.accountStatus !== 'ACTIVE') {
    return next(
      new AppError(403, 'Forbidden', 'ACCOUNT_INACTIVE', `Your account is currently ${req.actor.accountStatus}`)
    );
  }

  next();
};

export default {
  requireActiveAccount,
};
