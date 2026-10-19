import mongoose from 'mongoose';
import User from '../../models/User';
import StaffProfile from '../staff/models/StaffProfile';
import AppError from '../../utils/AppError';
import { ErrorCodes } from '../../shared/errorCodes';

const asStrings = (values = []) => values.map((value) => value.toString());

export const requireObjectId = (value, fieldName) => {
  if (!mongoose.isValidObjectId(value)) {
    throw new AppError(400, 'Validation Error', ErrorCodes.VALIDATION_ERROR, `${fieldName} must be a valid ObjectId`);
  }
  return value.toString();
};

export const resolveInventoryActor = async (actor, allowedRoles = ['ADMIN', 'MANAGER', 'STAFF']) => {
  if (!actor || !actor.id || !mongoose.isValidObjectId(actor.id)) {
    throw new AppError(401, 'Unauthenticated', ErrorCodes.AUTHENTICATION_ERROR, 'A valid authenticated actor is required');
  }

  const user = await User.findById(actor.id)
    .select('_id systemRole staffSubRole assignedBranchIds accountStatus')
    .lean();

  if (!user || user.accountStatus !== 'ACTIVE') {
    throw new AppError(401, 'Unauthenticated', ErrorCodes.AUTHENTICATION_ERROR, 'Account is not active');
  }
  if (!allowedRoles.includes(user.systemRole)) {
    throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'You do not have permission to access inventory');
  }

  const staffProfile = user.systemRole === 'STAFF'
    ? await StaffProfile.findOne({ userId: user._id, status: 'ACTIVE' })
      .select('staffSubRole authorizedBranchIds')
      .lean()
    : null;
  if (user.systemRole === 'STAFF' && !staffProfile) {
    throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Active staff profile is required');
  }

  return {
    id: user._id.toString(),
    systemRole: user.systemRole,
    staffSubRole: staffProfile ? staffProfile.staffSubRole : (user.staffSubRole || null),
    assignedBranchIds: asStrings(user.assignedBranchIds),
    authorizedBranchIds: staffProfile ? asStrings(staffProfile.authorizedBranchIds) : []
  };
};

export const inventoryBranchIdsForActor = (actor) => {
  if (actor.systemRole === 'ADMIN') return null;
  if (actor.systemRole === 'MANAGER') return actor.assignedBranchIds || [];
  return actor.authorizedBranchIds || [];
};

export const assertInventoryBranchScope = (actor, branchId, { hideExistence = true } = {}) => {
  const normalized = requireObjectId(branchId, 'branchId');
  if (actor.systemRole === 'ADMIN') return normalized;

  const allowed = inventoryBranchIdsForActor(actor);
  if (!allowed.includes(normalized)) {
    throw new AppError(
      hideExistence ? 404 : 403,
      hideExistence ? 'Not Found' : 'Forbidden',
      hideExistence ? ErrorCodes.NOT_FOUND : ErrorCodes.BRANCH_SCOPE_ERROR,
      hideExistence ? 'Inventory resource not found' : 'Branch is outside your assigned scope'
    );
  }
  return normalized;
};

export const assertTransferScope = (actor, fromBranchId, toBranchId) => {
  const from = assertInventoryBranchScope(actor, fromBranchId, { hideExistence: false });
  const to = assertInventoryBranchScope(actor, toBranchId, { hideExistence: false });
  if (from === to) {
    throw new AppError(400, 'Validation Error', ErrorCodes.VALIDATION_ERROR, 'Transfer source and destination must be different branches');
  }
  return { fromBranchId: from, toBranchId: to };
};
