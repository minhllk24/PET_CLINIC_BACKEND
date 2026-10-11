import jwt from 'jsonwebtoken';
import AppError from '../utils/AppError.js';
import config from './config.js';
import User from '../models/User.js';

const extractToken = (req) => {
  if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
    return req.headers.authorization.split(' ')[1];
  }
  return null;
};

/**
 * Authenticate request using Bearer JWT and verify actor against database
 */
export const authenticate = async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return next(new AppError(401, 'Unauthenticated', 'AUTHENTICATION_ERROR', 'Missing authentication token'));
  }

  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret);

    // Defense-in-depth: lookup user in DB to ensure account is still active and claims are fresh
    const user = await User.findById(decoded.id).select(
      'phone fullName email systemRole staffSubRole assignedBranchIds accountStatus lockedUntil'
    );

    if (!user) {
      return next(new AppError(401, 'Unauthenticated', 'AUTHENTICATION_ERROR', 'Account not found or deleted'));
    }

    if (user.accountStatus !== 'ACTIVE') {
      return next(new AppError(403, 'Forbidden', 'ACCOUNT_INACTIVE', `Account status is ${user.accountStatus}`));
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return next(new AppError(423, 'Locked', 'ACCOUNT_LOCKED', 'Account is temporarily locked'));
    }

    const assignedBranches = (user.assignedBranchIds || []).map((id) => id.toString());

    req.actor = {
      id: user._id.toString(),
      phone: user.phone,
      fullName: user.fullName,
      email: user.email,
      systemRole: user.systemRole,
      staffSubRole: user.staffSubRole,
      assignedBranchIds: assignedBranches,
      authorizedBranchIds: assignedBranches,
      accountStatus: user.accountStatus,
    };
    req.user = user;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new AppError(401, 'Unauthenticated', 'TOKEN_EXPIRED', 'Token has expired'));
    }
    return next(new AppError(401, 'Unauthenticated', 'AUTHENTICATION_ERROR', 'Token is invalid or malformed'));
  }
};

/**
 * Optional authentication: attaches req.actor if valid Bearer token provided, otherwise req.actor = null
 */
export const optionalAuth = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    req.actor = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret);
    const user = await User.findById(decoded.id).select(
      'phone fullName email systemRole staffSubRole assignedBranchIds accountStatus lockedUntil'
    );

    if (user && user.accountStatus === 'ACTIVE' && (!user.lockedUntil || user.lockedUntil <= new Date())) {
      const assignedBranches = (user.assignedBranchIds || []).map((id) => id.toString());
      req.actor = {
        id: user._id.toString(),
        phone: user.phone,
        fullName: user.fullName,
        email: user.email,
        systemRole: user.systemRole,
        staffSubRole: user.staffSubRole,
        assignedBranchIds: assignedBranches,
        authorizedBranchIds: assignedBranches,
        accountStatus: user.accountStatus,
      };
      req.user = user;
    } else {
      req.actor = null;
    }
  } catch (error) {
    req.actor = null;
  }

  next();
};

/**
 * Enforce role & staff sub-role authorization
 * @param {Array<string>} allowedSystemRoles
 * @param {Array<string>} [allowedStaffSubRoles=[]]
 */
export const requireRole = (allowedSystemRoles, allowedStaffSubRoles = []) => {
  return (req, res, next) => {
    if (!req.actor) {
      return next(new AppError(401, 'Unauthenticated', 'AUTHENTICATION_ERROR', 'Not logged in'));
    }

    const hasSystemRole = allowedSystemRoles.includes(req.actor.systemRole);

    let hasStaffSubRole = true;
    if (allowedStaffSubRoles.length > 0 && req.actor.systemRole === 'STAFF') {
      hasStaffSubRole = allowedStaffSubRoles.includes(req.actor.staffSubRole);
    }

    if (!hasSystemRole || !hasStaffSubRole) {
      return next(new AppError(403, 'Forbidden', 'AUTHORIZATION_ERROR', 'You do not have the required permissions'));
    }

    next();
  };
};

export default {
  authenticate,
  optionalAuth,
  requireRole,
};
