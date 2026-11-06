import mongoose from 'mongoose';
import User from '../../models/User';
import StaffProfile from '../staff/models/StaffProfile';
import Customer from '../customer/models/Customer';
import RefreshSession from '../../models/RefreshSession';
import AppError from '../../utils/AppError';
import { hashPassword } from '../../utils/passwordHelpers';
import { recordAuditLog } from '../../utils/auditLogger';

/**
 * Format a User document + optional StaffProfile into canonical Admin User DTO
 */
export const formatAdminUser = (userDoc, staffProfileDoc = null) => {
  if (!userDoc) return null;
  const u = userDoc.toObject ? userDoc.toObject() : userDoc;
  const sp = staffProfileDoc?.toObject ? staffProfileDoc.toObject() : staffProfileDoc;

  const dto = {
    id: (u._id || u.id).toString(),
    username: u.username || null,
    phone: u.phone || null,
    email: u.email || null,
    fullName: u.fullName,
    systemRole: u.systemRole,
    staffSubRole: u.staffSubRole || sp?.staffSubRole || null,
    staffCode: u.staffCode || sp?.staffCode || null,
    assignedBranchIds: (u.assignedBranchIds || sp?.authorizedBranchIds || []).map((b) => (b?._id || b).toString()),
    accountStatus: u.accountStatus || 'PENDING_ACTIVATION',
    avatarUrl: u.avatarUrl || null,
    isLocked: Boolean(u.lockedUntil && new Date(u.lockedUntil) > new Date()),
    lockedUntil: u.lockedUntil ? new Date(u.lockedUntil).toISOString() : null,
    lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : null,
    createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
    updatedAt: u.updatedAt ? new Date(u.updatedAt).toISOString() : null,
  };

  if (sp || u.systemRole === 'STAFF' || u.systemRole === 'MANAGER') {
    dto.staffProfile = {
      id: sp?._id ? sp._id.toString() : null,
      staffCode: sp?.staffCode || u.staffCode || null,
      staffSubRole: sp?.staffSubRole || u.staffSubRole || null,
      homeBranchId: sp?.homeBranchId ? (sp.homeBranchId?._id || sp.homeBranchId).toString() : null,
      authorizedBranchIds: (sp?.authorizedBranchIds || u.assignedBranchIds || []).map((b) => (b?._id || b).toString()),
      status: sp?.status || 'ACTIVE',
      hireDate: sp?.hireDate ? new Date(sp.hireDate).toISOString() : null,
    };
  }

  return dto;
};

/**
 * List users with filtering, searching, and pagination
 */
export const listUsers = async (query = {}, actor = null) => {
  const {
    role,
    systemRole,
    staffSubRole,
    branchId,
    status,
    accountStatus,
    search,
    limit = 20,
    page = 1,
    cursor,
  } = query;

  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const filter = {};

  const effectiveRole = systemRole || role;
  if (effectiveRole) {
    filter.systemRole = effectiveRole.toUpperCase();
  }

  const effectiveSubRole = staffSubRole;
  if (effectiveSubRole) {
    filter.staffSubRole = effectiveSubRole.toUpperCase();
  }

  const effectiveStatus = accountStatus || status;
  if (effectiveStatus) {
    filter.accountStatus = effectiveStatus.toUpperCase();
  }

  if (branchId && mongoose.Types.ObjectId.isValid(branchId)) {
    filter.assignedBranchIds = new mongoose.Types.ObjectId(branchId);
  }

  if (search && typeof search === 'string' && search.trim().length > 0) {
    const s = search.trim();
    const regex = new RegExp(s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
    filter.$or = [
      { fullName: regex },
      { phone: regex },
      { email: regex },
      { username: regex },
      { staffCode: regex },
    ];
  }

  if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
    filter._id = { $lt: new mongoose.Types.ObjectId(cursor) };
  }

  const totalCount = await User.countDocuments(cursor ? {} : filter);

  let queryBuilder = User.find(filter)
    .sort({ _id: -1 })
    .limit(parsedLimit + 1);

  if (!cursor && parsedPage > 1) {
    queryBuilder = queryBuilder.skip((parsedPage - 1) * parsedLimit);
  }

  const users = await queryBuilder.exec();
  const hasMore = users.length > parsedLimit;
  const items = hasMore ? users.slice(0, parsedLimit) : users;
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]._id.toString() : null;

  // Batch load StaffProfiles for items
  const userIds = items.map((u) => u._id);
  const staffProfiles = await StaffProfile.find({ userId: { $in: userIds } });
  const profileMap = new Map();
  staffProfiles.forEach((sp) => profileMap.set(sp.userId.toString(), sp));

  const dtos = items.map((u) => formatAdminUser(u, profileMap.get(u._id.toString())));

  return {
    items: dtos,
    totalCount: cursor ? dtos.length : totalCount,
    page: parsedPage,
    limit: parsedLimit,
    nextCursor,
  };
};

/**
 * Get user by ID with full profile details
 */
export const getUserById = async (id) => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'Bad Request', 'INVALID_ID', 'Invalid User ID format');
  }

  const user = await User.findById(id);
  if (!user) {
    throw new AppError(404, 'Not Found', 'USER_NOT_FOUND', 'User not found');
  }

  const staffProfile = await StaffProfile.findOne({ userId: user._id });
  return formatAdminUser(user, staffProfile);
};

/**
 * Create an internal User (and corresponding StaffProfile / Customer)
 */
export const createUser = async (data = {}, actor = null) => {
  const {
    username,
    phone,
    email,
    fullName,
    password,
    systemRole = 'STAFF',
    staffSubRole,
    staffCode,
    branchIds = [],
    assignedBranchIds = [],
    homeBranchId,
    accountStatus = 'ACTIVE',
  } = data;

  if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
    throw new AppError(400, 'Bad Request', 'INVALID_FULLNAME', 'Full name is required (min 2 chars)');
  }

  if (!phone && !username) {
    throw new AppError(400, 'Bad Request', 'IDENTIFIER_REQUIRED', 'Either phone or username is required');
  }

  if (!password || password.length < 6) {
    throw new AppError(400, 'Bad Request', 'INVALID_PASSWORD', 'Password must be at least 6 characters');
  }

  // Check unique constraints
  if (phone) {
    const existingPhone = await User.findOne({ phone: phone.trim() });
    if (existingPhone) {
      throw new AppError(409, 'Conflict', 'PHONE_ALREADY_EXISTS', 'Phone number is already registered');
    }
  }

  if (username) {
    const existingUsername = await User.findOne({ username: username.toLowerCase().trim() });
    if (existingUsername) {
      throw new AppError(409, 'Conflict', 'USERNAME_ALREADY_EXISTS', 'Username is already taken');
    }
  }

  if (email) {
    const existingEmail = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingEmail) {
      throw new AppError(409, 'Conflict', 'EMAIL_ALREADY_EXISTS', 'Email is already registered');
    }
  }

  const effectiveBranches = Array.from(new Set([...(branchIds || []), ...(assignedBranchIds || [])]))
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  // Role validation
  if (systemRole === 'STAFF') {
    if (!staffSubRole) {
      throw new AppError(400, 'Bad Request', 'STAFF_SUB_ROLE_REQUIRED', 'staffSubRole is required for STAFF role');
    }
    if (effectiveBranches.length === 0) {
      throw new AppError(400, 'Bad Request', 'BRANCH_ASSIGNMENT_REQUIRED', 'At least one branch must be assigned for STAFF');
    }
  }

  if (systemRole === 'MANAGER' && effectiveBranches.length === 0) {
    throw new AppError(400, 'Bad Request', 'BRANCH_ASSIGNMENT_REQUIRED', 'At least one branch must be assigned for MANAGER');
  }

  // Generate staffCode if needed
  let finalStaffCode = staffCode ? staffCode.trim().toUpperCase() : null;
  if (!finalStaffCode && (systemRole === 'STAFF' || systemRole === 'MANAGER')) {
    const prefix = staffSubRole ? staffSubRole.slice(0, 3) : (systemRole === 'MANAGER' ? 'MGR' : 'STF');
    finalStaffCode = `${prefix}-${Date.now().toString().slice(-6)}`;
  }

  const passwordHash = await hashPassword(password);

  const newUser = new User({
    username: username ? username.toLowerCase().trim() : undefined,
    phone: phone ? phone.trim() : undefined,
    email: email ? email.toLowerCase().trim() : undefined,
    fullName: fullName.trim(),
    passwordHash,
    systemRole,
    staffSubRole: systemRole === 'STAFF' ? staffSubRole : null,
    staffCode: finalStaffCode,
    assignedBranchIds: effectiveBranches,
    accountStatus,
    activatedAt: accountStatus === 'ACTIVE' ? new Date() : null,
  });

  await newUser.save();

  let staffProfile = null;
  if (systemRole === 'STAFF' || systemRole === 'MANAGER') {
    staffProfile = new StaffProfile({
      userId: newUser._id,
      staffCode: finalStaffCode,
      staffSubRole: staffSubRole || (systemRole === 'MANAGER' ? 'RECEPTIONIST' : 'CARE_STAFF_GROOMER'),
      authorizedBranchIds: effectiveBranches,
      homeBranchId: homeBranchId && mongoose.Types.ObjectId.isValid(homeBranchId) ? new mongoose.Types.ObjectId(homeBranchId) : (effectiveBranches[0] || null),
      status: accountStatus === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
      hireDate: new Date(),
    });
    await staffProfile.save();
  } else if (systemRole === 'CUSTOMER') {
    const customer = new Customer({
      userId: newUser._id,
      fullName: newUser.fullName,
      phone: newUser.phone,
      email: newUser.email,
      activationStatus: accountStatus === 'ACTIVE' ? 'ACTIVATED' : 'PENDING',
    });
    await customer.save();
  }

  if (actor) {
    await recordAuditLog({
      actor: { userId: actor.id, systemRole: actor.systemRole },
      action: 'ADMIN_CREATE_USER',
      target: { type: 'User', id: newUser._id },
      metadata: { systemRole, phone: newUser.phone },
    });
  }

  return formatAdminUser(newUser, staffProfile);
};

/**
 * Update user details
 */
export const updateUser = async (id, data = {}, actor = null) => {
  const user = await User.findById(id);
  if (!user) {
    throw new AppError(404, 'Not Found', 'USER_NOT_FOUND', 'User not found');
  }

  const { fullName, phone, email, assignedBranchIds, branchIds, homeBranchId, staffSubRole } = data;

  if (fullName !== undefined) {
    if (typeof fullName !== 'string' || fullName.trim().length < 2) {
      throw new AppError(400, 'Bad Request', 'INVALID_FULLNAME', 'Full name must be at least 2 chars');
    }
    user.fullName = fullName.trim();
  }

  if (phone !== undefined && phone !== null && phone.trim() !== '') {
    const cleanPhone = phone.trim();
    const existing = await User.findOne({ phone: cleanPhone, _id: { $ne: user._id } });
    if (existing) {
      throw new AppError(409, 'Conflict', 'PHONE_ALREADY_EXISTS', 'Phone number already in use');
    }
    user.phone = cleanPhone;
  }

  if (email !== undefined) {
    if (email === null || email === '') {
      user.email = null;
    } else {
      const cleanEmail = email.toLowerCase().trim();
      if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
        throw new AppError(400, 'Bad Request', 'INVALID_EMAIL', 'Invalid email address format');
      }
      const existing = await User.findOne({ email: cleanEmail, _id: { $ne: user._id } });
      if (existing) {
        throw new AppError(409, 'Conflict', 'EMAIL_ALREADY_EXISTS', 'Email already in use');
      }
      user.email = cleanEmail;
    }
  }

  const branchList = branchIds || assignedBranchIds;
  if (branchList !== undefined && Array.isArray(branchList)) {
    user.assignedBranchIds = branchList
      .filter((b) => mongoose.Types.ObjectId.isValid(b))
      .map((b) => new mongoose.Types.ObjectId(b));
  }

  if (staffSubRole !== undefined && user.systemRole === 'STAFF') {
    user.staffSubRole = staffSubRole;
  }

  await user.save();

  // Sync StaffProfile if exists
  let staffProfile = await StaffProfile.findOne({ userId: user._id });
  if (staffProfile) {
    if (user.assignedBranchIds) {
      staffProfile.authorizedBranchIds = user.assignedBranchIds;
    }
    if (user.staffSubRole) {
      staffProfile.staffSubRole = user.staffSubRole;
    }
    if (homeBranchId && mongoose.Types.ObjectId.isValid(homeBranchId)) {
      staffProfile.homeBranchId = new mongoose.Types.ObjectId(homeBranchId);
    }
    await staffProfile.save();
  }

  return formatAdminUser(user, staffProfile);
};

/**
 * Update user account status (Lock / Unlock / Deactivate) and revoke active sessions
 */
export const updateUserStatus = async (id, { status, reason }, actor = null) => {
  const allowed = ['ACTIVE', 'BLOCKED', 'DEACTIVATED', 'PENDING_ACTIVATION'];
  if (!status || !allowed.includes(status.toUpperCase())) {
    throw new AppError(400, 'Bad Request', 'INVALID_STATUS', `Status must be one of: ${allowed.join(', ')}`);
  }

  const user = await User.findById(id);
  if (!user) {
    throw new AppError(404, 'Not Found', 'USER_NOT_FOUND', 'User not found');
  }

  const prevStatus = user.accountStatus;
  user.accountStatus = status.toUpperCase();

  if (user.accountStatus === 'BLOCKED' || user.accountStatus === 'DEACTIVATED') {
    // Revoke all refresh sessions immediately
    await RefreshSession.deleteMany({ userId: user._id });
  } else if (user.accountStatus === 'ACTIVE') {
    user.lockedUntil = null;
    user.failedLoginCount = 0;
    if (!user.activatedAt) {
      user.activatedAt = new Date();
    }
  }

  await user.save();

  // Sync StaffProfile status
  const staffProfile = await StaffProfile.findOne({ userId: user._id });
  if (staffProfile) {
    staffProfile.status = user.accountStatus === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE';
    await staffProfile.save();
  }

  if (actor) {
    await recordAuditLog({
      actor: { userId: actor.id, systemRole: actor.systemRole },
      action: user.accountStatus === 'BLOCKED' ? 'ACCOUNT_BLOCKED' : 'ACCOUNT_STATUS_CHANGED',
      target: { type: 'User', id: user._id },
      metadata: { prevStatus, newStatus: user.accountStatus, reason: reason || null },
    });
  }

  return formatAdminUser(user, staffProfile);
};

/**
 * Change user systemRole & staffSubRole
 */
export const updateUserRole = async (id, { systemRole, staffSubRole, assignedBranchIds = [] }, actor = null) => {
  const allowedRoles = ['ADMIN', 'MANAGER', 'STAFF', 'CUSTOMER'];
  if (!systemRole || !allowedRoles.includes(systemRole.toUpperCase())) {
    throw new AppError(400, 'Bad Request', 'INVALID_ROLE', `systemRole must be one of: ${allowedRoles.join(', ')}`);
  }

  const user = await User.findById(id);
  if (!user) {
    throw new AppError(404, 'Not Found', 'USER_NOT_FOUND', 'User not found');
  }

  user.systemRole = systemRole.toUpperCase();
  if (user.systemRole === 'STAFF') {
    if (!staffSubRole) {
      throw new AppError(400, 'Bad Request', 'STAFF_SUB_ROLE_REQUIRED', 'staffSubRole is required for STAFF');
    }
    user.staffSubRole = staffSubRole;
  } else {
    user.staffSubRole = null;
  }

  if (assignedBranchIds && Array.isArray(assignedBranchIds)) {
    user.assignedBranchIds = assignedBranchIds
      .filter((b) => mongoose.Types.ObjectId.isValid(b))
      .map((b) => new mongoose.Types.ObjectId(b));
  }

  await user.save();

  // Manage StaffProfile
  let staffProfile = await StaffProfile.findOne({ userId: user._id });
  if (user.systemRole === 'STAFF' || user.systemRole === 'MANAGER') {
    if (!staffProfile) {
      const prefix = user.staffSubRole ? user.staffSubRole.slice(0, 3) : 'STF';
      staffProfile = new StaffProfile({
        userId: user._id,
        staffCode: user.staffCode || `${prefix}-${Date.now().toString().slice(-6)}`,
        staffSubRole: user.staffSubRole || 'RECEPTIONIST',
        authorizedBranchIds: user.assignedBranchIds,
        homeBranchId: user.assignedBranchIds[0] || null,
        status: user.accountStatus === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
      });
    } else {
      staffProfile.staffSubRole = user.staffSubRole || staffProfile.staffSubRole;
      staffProfile.authorizedBranchIds = user.assignedBranchIds;
    }
    await staffProfile.save();
  }

  return formatAdminUser(user, staffProfile);
};

