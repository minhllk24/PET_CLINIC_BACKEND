import adminUsersService from './adminUsers.service.js';
import { sendSuccess, sendCreated } from '../../../shared/responseHelpers.js';

const getMeta = (req) => ({
  ip: req.ip || req.connection?.remoteAddress || '',
  userAgent: req.headers['user-agent'] || '',
  correlationId: req.id || req.headers['x-correlation-id'] || null,
});

export const listUsers = async (req, res, next) => {
  try {
    const result = await adminUsersService.listUsers(req.actor, req.query);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const user = await adminUsersService.getUserById(req.actor, req.params.id);
    return sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
};

export const createInternalUser = async (req, res, next) => {
  try {
    const meta = getMeta(req);
    const user = await adminUsersService.createInternalUser(req.actor, req.body, meta);
    return sendCreated(res, user);
  } catch (err) {
    next(err);
  }
};

export const updateUserStatus = async (req, res, next) => {
  try {
    const meta = getMeta(req);
    const user = await adminUsersService.updateUserStatus(req.actor, req.params.id, req.body, meta);
    return sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
};

export const updateUserRole = async (req, res, next) => {
  try {
    const meta = getMeta(req);
    const user = await adminUsersService.updateUserRole(req.actor, req.params.id, req.body, meta);
    return sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
};

export default {
  listUsers,
  getUserById,
  createInternalUser,
  updateUserStatus,
  updateUserRole,
};
