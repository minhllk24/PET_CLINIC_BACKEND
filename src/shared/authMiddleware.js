import jwt from 'jsonwebtoken';
import AppError from '../utils/AppError';
import config from './config';

const extractToken = (req) => {
  if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
    return req.headers.authorization.split(' ')[1];
  }
  return null;
};

export const authenticate = (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return next(new AppError(401, 'Unauthenticated', 'AUTHENTICATION_ERROR', 'Missing authentication token'));
  }

  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret);
    
    // According to docs, actor fields are resolved by server token+DB.
    // For skeleton, we just set decoded info onto req.actor
    req.actor = {
      id: decoded.id,
      systemRole: decoded.systemRole,
      staffSubRole: decoded.staffSubRole,
      assignedBranchIds: decoded.assignedBranchIds || [],
      authorizedBranchIds: decoded.authorizedBranchIds || [],
    };
    
    next();
  } catch (error) {
    return next(new AppError(401, 'Unauthenticated', 'AUTHENTICATION_ERROR', 'Token is invalid or expired'));
  }
};

export const optionalAuth = (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    req.actor = null;
    return next();
  }
  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret);
    req.actor = {
      id: decoded.id,
      systemRole: decoded.systemRole,
      staffSubRole: decoded.staffSubRole,
      assignedBranchIds: decoded.assignedBranchIds || [],
      authorizedBranchIds: decoded.authorizedBranchIds || [],
    };
  } catch (error) {
    req.actor = null;
  }
  next();
};

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
