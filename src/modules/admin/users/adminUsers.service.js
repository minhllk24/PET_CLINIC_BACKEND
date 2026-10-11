import User, { SYSTEM_ROLES, STAFF_SUB_ROLES, ACCOUNT_STATUSES } from '../../../models/User.js';
import RefreshSession from '../../../models/RefreshSession.js';
import AppError from '../../../utils/AppError.js';
import { hashPassword, validatePasswordPolicy } from '../../../utils/passwordHelpers.js';
import { recordAuditLog } from '../../../utils/auditLogger.js';

/**
 * List users with role and branch scoping
 */
export const listUsers = async (actor, query = {}) => {
  const { role, status, search, page = 1, limit = 20 } = query;
  const filter = {};

  // Scope constraint: MANAGER can only view users assigned to their branches
  if (actor.systemRole === 'MANAGER') {
    filter.assignedBranchIds = { $in: actor.assignedBranchIds };
  }

  if (role && SYSTEM_ROLES.includes(role)) {
    filter.systemRole = role;
  }

  if (status && ACCOUNT_STATUSES.includes(status)) {
    filter.accountStatus = status;
  }

  if (search) {
    const searchRegex = new RegExp(search.trim(), 'i');
    filter.$or = [{ fullName: searchRegex }, { phone: searchRegex }, { email: searchRegex }];
  }

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.max(1, parseInt(limit, 10));
  const take = Math.max(1, Math.min(100, parseInt(limit, 10)));

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('-passwordHash -__v')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(take),
    User.countDocuments(filter),
  ]);

  return {
    users,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: take,
      totalPages: Math.ceil(total / take),
    },
  };
};

/**
 * Get user by ID with branch scoping
 */
export const getUserById = async (actor, targetUserId) => {
  const user = await User.findById(targetUserId).select('-passwordHash -__v');
  if (!user) {
    throw new AppError(404, 'Not Found', 'USER_NOT_FOUND', 'User not found');
  }

  if (actor.systemRole === 'MANAGER') {
    const userBranches = (user.assignedBranchIds || []).map((b) => b.toString());
    const hasBranchOverlap = userBranches.some((b) => actor.assignedBranchIds.includes(b));
    if (!hasBranchOverlap) {
      throw new AppError(
        403,
        'Forbidden',
        'BRANCH_SCOPE_VIOLATION',
        'Cannot view users outside your assigned branches'
      );
    }
  }

  return user;
};

/**
 * Create an internal user account (ADMIN only)
 */
export const createInternalUser = async (actor, payload, meta = {}) => {
  const { phone, fullName, email, password, systemRole, staffSubRole, assignedBranchIds = [] } = payload;

  if (!phone || !fullName || !password || !systemRole) {
    throw new AppError(400, 'Bad Request', 'MISSING_FIELDS', 'Phone, fullName, password, and systemRole are required');
  }

  if (!SYSTEM_ROLES.includes(systemRole)) {
    throw new AppError(400, 'Bad Request', 'INVALID_ROLE', `${systemRole} is not a valid system role`);
  }

  if (systemRole === 'STAFF') {
    if (!staffSubRole || !STAFF_SUB_ROLES.includes(staffSubRole)) {
      throw new AppError(
        400,
        'Bad Request',
        'INVALID_STAFF_SUB_ROLE',
        'A valid staffSubRole is required when systemRole is STAFF'
      );
    }
  }

  if (!validatePasswordPolicy(password)) {
    throw new AppError(
      400,
      'Bad Request',
      'PASSWORD_TOO_WEAK',
      'Password must be at least 8 characters long and contain at least one uppercase letter and one digit'
    );
  }

  // Check unique phone
  const existingPhone = await User.findOne({ phone });
  if (existingPhone) {
    throw new AppError(409, 'Conflict', 'PHONE_ALREADY_EXISTS', 'This phone number is already registered');
  }

  if (email) {
    const existingEmail = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingEmail) {
      throw new AppError(409, 'Conflict', 'EMAIL_ALREADY_EXISTS', 'This email is already registered');
    }
  }

  const passwordHash = await hashPassword(password);

  const user = await User.create({
    phone,
    fullName: fullName.trim(),
    email: email ? email.toLowerCase().trim() : null,
    passwordHash,
    systemRole,
    staffSubRole: systemRole === 'STAFF' ? staffSubRole : null,
    assignedBranchIds,
    accountStatus: 'ACTIVE',
    activatedAt: new Date(),
  });

  await recordAuditLog({
    actor: { userId: actor.id, systemRole: actor.systemRole, ipAddress: meta.ip || '' },
    action: 'REGISTER',
    target: { type: 'User', id: user._id },
    metadata: { createdByAdmin: actor.id, systemRole, staffSubRole },
    correlationId: meta.correlationId || null,
  });

  return User.findById(user._id).select('-passwordHash -__v');
};

/**
 * Update user status (ADMIN only)
 */
export const updateUserStatus = async (actor, targetUserId, { accountStatus, reason }, meta = {}) => {
  if (!accountStatus || !ACCOUNT_STATUSES.includes(accountStatus)) {
    throw new AppError(400, 'Bad Request', 'INVALID_STATUS', 'Valid accountStatus is required');
  }

  const user = await User.findById(targetUserId);
  if (!user) {
    throw new AppError(404, 'Not Found', 'USER_NOT_FOUND', 'User not found');
  }

  // Prevent admin self-lockout
  if (user._id.toString() === actor.id.toString() && accountStatus !== 'ACTIVE') {
    throw new AppError(400, 'Bad Request', 'CANNOT_BLOCK_SELF', 'Cannot block or deactivate your own admin account');
  }

  user.accountStatus = accountStatus;

  if (accountStatus === 'BLOCKED' || accountStatus === 'DEACTIVATED') {
    // Revoke all active sessions immediately
    await RefreshSession.updateMany(
      { userId: user._id, revokedAt: null },
      { revokedAt: new Date() }
    );
  } else if (accountStatus === 'ACTIVE') {
    user.lockedUntil = null;
    user.failedLoginCount = 0;
    if (!user.activatedAt) user.activatedAt = new Date();
  }

  await user.save();

  await recordAuditLog({
    actor: { userId: actor.id, systemRole: actor.systemRole, ipAddress: meta.ip || '' },
    action: accountStatus === 'BLOCKED' ? 'ACCOUNT_BLOCKED' : 'ACCOUNT_ACTIVATED',
    target: { type: 'User', id: user._id },
    metadata: { newStatus: accountStatus, reason },
    correlationId: meta.correlationId || null,
  });

  return User.findById(user._id).select('-passwordHash -__v');
};

/**
 * Update user role and branch assignment (ADMIN only)
 */
export const updateUserRole = async (
  actor,
  targetUserId,
  { systemRole, staffSubRole, assignedBranchIds },
  meta = {}
) => {
  if (!systemRole || !SYSTEM_ROLES.includes(systemRole)) {
    throw new AppError(400, 'Bad Request', 'INVALID_ROLE', 'Valid systemRole is required');
  }

  if (systemRole === 'STAFF') {
    if (!staffSubRole || !STAFF_SUB_ROLES.includes(staffSubRole)) {
      throw new AppError(
        400,
        'Bad Request',
        'INVALID_STAFF_SUB_ROLE',
        'A valid staffSubRole is required when systemRole is STAFF'
      );
    }
  }

  const user = await User.findById(targetUserId);
  if (!user) {
    throw new AppError(404, 'Not Found', 'USER_NOT_FOUND', 'User not found');
  }

  // Prevent demoting the current admin if it's the last admin
  if (user._id.toString() === actor.id.toString() && systemRole !== 'ADMIN') {
    const adminCount = await User.countDocuments({ systemRole: 'ADMIN', accountStatus: 'ACTIVE' });
    if (adminCount <= 1) {
      throw new AppError(
        400,
        'Bad Request',
        'CANNOT_DEMOTE_LAST_ADMIN',
        'Cannot demote the last remaining active ADMIN'
      );
    }
  }

  user.systemRole = systemRole;
  user.staffSubRole = systemRole === 'STAFF' ? staffSubRole : null;
  if (Array.isArray(assignedBranchIds)) {
    user.assignedBranchIds = assignedBranchIds;
  }

  await user.save();

  // Force re-authentication so user receives fresh claims in their next JWT
  await RefreshSession.updateMany(
    { userId: user._id, revokedAt: null },
    { revokedAt: new Date() }
  );

  await recordAuditLog({
    actor: { userId: actor.id, systemRole: actor.systemRole, ipAddress: meta.ip || '' },
    action: 'ROLE_CHANGED',
    target: { type: 'User', id: user._id },
    metadata: { newRole: systemRole, newStaffSubRole: user.staffSubRole, assignedBranchIds },
    correlationId: meta.correlationId || null,
  });

  return User.findById(user._id).select('-passwordHash -__v');
};

export default {
  listUsers,
  getUserById,
  createInternalUser,
  updateUserStatus,
  updateUserRole,
};
