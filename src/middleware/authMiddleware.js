import Jwt from 'jsonwebtoken';
require('dotenv').config();
import { sendResponse } from '../utils/responseHelpers';

const extractToken = (req) => {
  if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
    return req.headers.authorization.split(' ')[1];
  }
  return null;
};

export const authMiddleware = (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return sendResponse(res, 401, 'Unauthenticated user', -999);
  }

  try {
    const decoded = Jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET);
    req.user = decoded; // { user_id, role_code, email, full_name }
    next();
  } catch (error) {
    return sendResponse(res, 401, 'Token is invalid or expired', -999);
  }
};

export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role_code)) {
      return sendResponse(res, 403, 'You don\'t have permission!', -1);
    }
    next();
  };
};

export const authUserOrAdmin = (req, res, next) => {
  const userIdParams = req.params.id;
  const userRole = req.user?.role_code;
  const currentUserId = req.user?.user_id;

  if (userRole === 'ADMIN' || currentUserId === userIdParams) {
    next();
  } else {
    return sendResponse(res, 403, 'You don\'t have permission!', -1);
  }
};
