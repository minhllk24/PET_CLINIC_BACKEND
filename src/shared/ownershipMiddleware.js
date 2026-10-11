import AppError from '../utils/AppError.js';

/**
 * Enforce resource ownership.
 * Checks if req.actor.id matches the target user id from params/query/body.
 * ADMIN and optionally MANAGER can bypass this check.
 * 
 * @param {string} [idParam='userId'] - Parameter name containing the owner's user ID
 * @param {Object} [options={}]
 * @param {boolean} [options.allowAdmin=true] - Allow ADMIN to bypass
 * @param {Array<string>} [options.bypassRoles=['ADMIN']] - Roles that bypass ownership
 */
export const requireOwnership = (idParam = 'userId', options = {}) => {
  const { bypassRoles = ['ADMIN'] } = options;

  return (req, res, next) => {
    if (!req.actor) {
      return next(new AppError(401, 'Unauthenticated', 'AUTHENTICATION_ERROR', 'Authentication required'));
    }

    if (bypassRoles.includes(req.actor.systemRole)) {
      return next();
    }

    const targetId = req.params[idParam] || req.body[idParam] || req.query[idParam];

    if (!targetId) {
      return next(
        new AppError(400, 'Bad Request', 'MISSING_RESOURCE_ID', `Target identifier '${idParam}' is missing`)
      );
    }

    if (targetId.toString() !== req.actor.id.toString()) {
      return next(
        new AppError(403, 'Forbidden', 'OWNERSHIP_VIOLATION', 'You do not have permission to access or modify this resource')
      );
    }

    next();
  };
};

export default {
  requireOwnership,
};
