import AppError from '../../utils/AppError';
import { ErrorCodes } from '../errorCodes';

/**
 * Resolves the authorized branch IDs for an actor.
 * Returns null if the actor is ADMIN (all branches authorized).
 * Returns array of branch ID strings for MANAGER / Staff.
 */
export const getActorBranchScope = (actor) => {
  if (!actor) return [];
  if (actor.systemRole === 'ADMIN') {
    return null; // Global access
  }

  const list = [
    ...(actor.assignedBranchIds || []),
    ...(actor.authorizedBranchIds || [])
  ];

  const uniqueIds = Array.from(
    new Set(list.map((b) => (b?._id || b).toString()).filter(Boolean))
  );

  return uniqueIds;
};

/**
 * Checks if actor has access to a specific branch.
 * Throws 403 if scope is empty or branch not in scope.
 */
export const assertBranchAccess = (actor, branchId) => {
  if (!actor) {
    throw new AppError(401, 'Unauthorized', ErrorCodes.AUTHENTICATION_ERROR, 'Authentication required');
  }

  if (actor.systemRole === 'ADMIN') {
    return true;
  }

  const scope = getActorBranchScope(actor);
  if (!scope || scope.length === 0) {
    throw new AppError(403, 'Forbidden', 'BRANCH_SCOPE_EMPTY', 'Staff/Manager does not have any assigned branch');
  }

  if (branchId) {
    const targetIdStr = (branchId?._id || branchId).toString();
    if (!scope.includes(targetIdStr)) {
      throw new AppError(403, 'Forbidden', 'BRANCH_ACCESS_DENIED', 'You do not have access to this branch');
    }
  }

  return true;
};

/**
 * Express middleware to enforce branch scope.
 * Fails closed if MANAGER/STAFF has empty branch scope.
 */
export const enforceBranchScope = (req, res, next) => {
  try {
    if (!req.actor) {
      return next(new AppError(401, 'Unauthorized', ErrorCodes.AUTHENTICATION_ERROR, 'Authentication required'));
    }

    if (req.actor.systemRole === 'ADMIN') {
      req.branchScope = null;
      return next();
    }

    const scope = getActorBranchScope(req.actor);
    if (!scope || scope.length === 0) {
      return next(new AppError(403, 'Forbidden', 'BRANCH_SCOPE_EMPTY', 'Staff/Manager does not have any assigned branch'));
    }

    req.branchScope = scope;

    const requestedBranchId = req.params?.branchId || req.query?.branchId || req.body?.branchId;
    if (requestedBranchId) {
      assertBranchAccess(req.actor, requestedBranchId);
    }

    next();
  } catch (err) {
    next(err);
  }
};

