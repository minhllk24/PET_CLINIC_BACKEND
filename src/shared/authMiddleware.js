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
  if (req.actor) {
    return next();
  }
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
      fullName: decoded.fullName || decoded.name || null,
      systemRole: decoded.systemRole,
      staffSubRole: decoded.staffSubRole,
      assignedBranchIds: decoded.assignedBranchIds || [],
      authorizedBranchIds: decoded.authorizedBranchIds || [],
    };
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new AppError(401, 'Token expired', 'TOKEN_EXPIRED', 'Access token has expired'));
    }
    return next(new AppError(401, 'Unauthenticated', 'AUTHENTICATION_ERROR', 'Token is invalid'));
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
      fullName: decoded.fullName || decoded.name || null,
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
    const checkRoles = () => {
      const actorSystemRole = req.actor.systemRole;
      const actorStaffSubRole = req.actor.staffSubRole;

      let hasRole = false;
      if (allowedSystemRoles.includes(actorSystemRole)) {
        hasRole = true;
      }
      if (actorSystemRole === 'STAFF' && actorStaffSubRole && allowedSystemRoles.includes(actorStaffSubRole)) {
        hasRole = true;
      }
      if (allowedStaffSubRoles.length > 0 && actorSystemRole === 'STAFF' && allowedStaffSubRoles.includes(actorStaffSubRole)) {
        hasRole = true;
      }

      if (!hasRole) {
        return next(new AppError(403, 'Forbidden', 'AUTHORIZATION_ERROR', 'You do not have the required permissions'));
      }

      next();
    };

    if (!req.actor) {
      authenticate(req, res, (err) => {
        if (err) return next(err);
        checkRoles();
      });
    } else {
      checkRoles();
    }
  };
};
