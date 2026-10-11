import AppError from '../utils/AppError.js';

/**
 * Enforce branch-scoped access for MANAGER and STAFF.
 * ADMIN has global scope and bypasses this check.
 * 
 * @param {string} [branchParam='branchId'] - Parameter name containing the target branch ID
 */
export const requireBranchScope = (branchParam = 'branchId') => {
  return (req, res, next) => {
    if (!req.actor) {
      return next(new AppError(401, 'Unauthenticated', 'AUTHENTICATION_ERROR', 'Authentication required'));
    }

    // ADMIN has universal multi-branch access
    if (req.actor.systemRole === 'ADMIN') {
      return next();
    }

    const targetBranchId = req.params[branchParam] || req.body[branchParam] || req.query[branchParam];

    if (!targetBranchId) {
      return next(
        new AppError(400, 'Bad Request', 'MISSING_BRANCH_ID', `Branch identifier '${branchParam}' is missing`)
      );
    }

    const assigned = (req.actor.assignedBranchIds || []).map((id) => id.toString());
    const hasBranchAccess = assigned.includes(targetBranchId.toString());

    if (!hasBranchAccess) {
      return next(
        new AppError(403, 'Forbidden', 'BRANCH_SCOPE_VIOLATION', 'You are not assigned to this branch')
      );
    }

    next();
  };
};

export default {
  requireBranchScope,
};
