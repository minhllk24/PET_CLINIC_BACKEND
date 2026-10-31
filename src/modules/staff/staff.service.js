import mongoose from 'mongoose';
import StaffProfile from './models/StaffProfile';
import User from '../../models/User';
import AppError from '../../utils/AppError';
import { ErrorCodes } from '../../shared/errorCodes';
import { hashPassword } from '../../utils/passwordHelpers';

/**
 * Format pure DTO for Staff Response (strictly adhering to OpenAPI StaffProfile schema)
 */
export const formatStaff = (profile, user = null) => {
  const u = user || profile.userId;
  const dto = {
    id: profile._id.toString(),
    staffCode: profile.staffCode || null,
    joinedAt: profile.createdAt ? profile.createdAt.toISOString() : null,
    staffSubRole: profile.staffSubRole,
    authorizedBranchIds: (profile.authorizedBranchIds || []).map((b) => (b?._id || b).toString()),
    status: profile.status || 'ACTIVE',
  };

  const userIdStr = (u?._id || u || '').toString();
  if (userIdStr && mongoose.Types.ObjectId.isValid(userIdStr)) {
    dto.userId = userIdStr;
  }
  if (u?.fullName) {
    dto.fullName = u.fullName;
  }
  if (u?.phone) {
    dto.phone = u.phone;
  }
  if (u?.email) {
    dto.email = u.email;
  }
  if (u?.username) {
    dto.username = u.username;
  }
  if (u?.accountStatus) {
    dto.accountStatus = u.accountStatus;
  }
  if (profile.homeBranchId) {
    dto.homeBranchId = (profile.homeBranchId?._id || profile.homeBranchId).toString();
  } else {
    dto.homeBranchId = null;
  }
  if (profile.staffCode || u?.staffCode) {
    dto.staffCode = profile.staffCode || u?.staffCode;
  }
  const createdDate = u?.createdAt || profile.createdAt;
  if (createdDate) {
    dto.createdAt = new Date(createdDate).toISOString();
    dto.startDate = dto.createdAt;
  }

  return dto;
};

/**
 * List Staff with server-side filtering, cursor/pagination, and RBAC (OpenAPI StaffPage)
 */
export const listStaff = async (query = {}, actor = null) => {
  const { branchId, staffSubRole, role, limit = 20, cursor } = query;
  const effectiveRole = staffSubRole || role;
  const filter = {};

  if (actor) {
    if (actor.systemRole === 'STAFF') {
      filter.userId = new mongoose.Types.ObjectId(actor.id);
    } else if (actor.systemRole === 'MANAGER') {
      const assignedIds = (actor.assignedBranchIds || []).map((b) => b.toString());
      if (branchId) {
        if (!assignedIds.includes(branchId.toString())) {
          throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'You do not have access to staff of this branch');
        }
        filter.$or = [
          { authorizedBranchIds: new mongoose.Types.ObjectId(branchId) },
          { homeBranchId: new mongoose.Types.ObjectId(branchId) },
        ];
      } else {
        const assignedObjIds = assignedIds.map((id) => new mongoose.Types.ObjectId(id));
        filter.$or = [
          { authorizedBranchIds: { $in: assignedObjIds } },
          { homeBranchId: { $in: assignedObjIds } },
        ];
      }
    }
  }

  if (branchId && !filter.$or) {
    filter.$or = [
      { authorizedBranchIds: new mongoose.Types.ObjectId(branchId) },
      { homeBranchId: new mongoose.Types.ObjectId(branchId) },
    ];
  }

  if (effectiveRole) {
    filter.staffSubRole = effectiveRole;
  }

  if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
    filter._id = { $lt: new mongoose.Types.ObjectId(cursor) };
  }

  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const [profiles, totalCount] = await Promise.all([
    StaffProfile.find(filter)
      .populate('userId')
      .sort({ _id: -1 })
      .limit(parsedLimit + 1),
    StaffProfile.countDocuments(filter)
  ]);

  let nextCursor = null;
  if (profiles.length > parsedLimit) {
    const nextItem = profiles.pop();
    nextCursor = nextItem._id.toString();
  }

  return {
    items: profiles.map((item) => formatStaff(item, item.userId)),
    totalCount,
    nextCursor,
  };
};

/**
 * Get Staff Profile by ID
 */
export const getStaffById = async (id, actor = null) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Invalid staff ID');
  }

  let profile = await StaffProfile.findById(id).populate('userId');
  if (!profile) {
    profile = await StaffProfile.findOne({ userId: id }).populate('userId');
  }

  if (!profile) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Staff profile not found');
  }

  if (actor) {
    if (actor.systemRole === 'STAFF') {
      const uId = (profile.userId?._id || profile.userId).toString();
      if (uId !== actor.id) {
        throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Access denied');
      }
    } else if (actor.systemRole === 'MANAGER') {
      const assignedIds = (actor.assignedBranchIds || []).map((b) => b.toString());
      const staffBranchIds = [
        ...(profile.authorizedBranchIds || []).map((b) => (b._id || b).toString()),
        profile.homeBranchId ? (profile.homeBranchId._id || profile.homeBranchId).toString() : null,
      ].filter(Boolean);

      const hasSharedBranch = staffBranchIds.some((bId) => assignedIds.includes(bId));
      if (!hasSharedBranch) {
        throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Staff is not assigned to your managed branch');
      }
    }
  }

  return formatStaff(profile, profile.userId);
};

/**
 * Create Staff User + Profile Atomically (conforming to OpenAPI StaffCreate)
 */
export const createStaff = async (data, actor = null) => {
  const {
    fullName,
    email,
    phone,
    staffSubRole,
    authorizedBranchIds = [],
    homeBranchId,
  } = data;

  if (!fullName || !staffSubRole || !authorizedBranchIds || authorizedBranchIds.length === 0) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'fullName, staffSubRole, and authorizedBranchIds are required');
  }

  const validRoles = ['RECEPTIONIST', 'CARE_STAFF_GROOMER', 'VETERINARIAN', 'NURSE'];
  if (!validRoles.includes(staffSubRole)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, `Invalid staffSubRole: ${staffSubRole}`);
  }

  // Manager scope check
  if (actor && actor.systemRole === 'MANAGER') {
    const assignedIds = (actor.assignedBranchIds || []).map((b) => b.toString());
    if (homeBranchId && !assignedIds.includes(homeBranchId.toString())) {
      throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Cannot assign staff home branch outside managed branches');
    }
    for (const bId of authorizedBranchIds) {
      if (!assignedIds.includes(bId.toString())) {
        throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Cannot authorize staff to branches outside managed branches');
      }
    }
  }

  const normalizedAuthorized = authorizedBranchIds.map((id) => (typeof id === 'string' ? id.trim() : id)).filter(Boolean);
  if (homeBranchId && !normalizedAuthorized.includes(homeBranchId.toString())) {
    normalizedAuthorized.push(homeBranchId.toString());
  }

  // Check unique email / phone (if provided)
  const cleanEmail = email && typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null;
  const cleanPhone = phone && typeof phone === 'string' && phone.trim() ? phone.trim() : null;

  if (cleanEmail || cleanPhone) {
    const orConditions = [];
    if (cleanEmail) orConditions.push({ email: cleanEmail });
    if (cleanPhone) orConditions.push({ phone: cleanPhone });
    const existingUser = await User.findOne({ $or: orConditions });
    if (existingUser) {
      throw new AppError(409, 'Conflict', ErrorCodes.CONFLICT, 'User with this phone or email already exists');
    }
  }

  // Generate unique username & strong random password (16+ chars)
  const prefixMap = {
    RECEPTIONIST: 'rec',
    CARE_STAFF_GROOMER: 'gro',
    VETERINARIAN: 'vet',
    NURSE: 'nur',
  };
  const prefix = prefixMap[staffSubRole] || 'stf';
  const normalizedName = (fullName || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 15);
  const suffix = Math.floor(100 + Math.random() * 900);
  const username = `${prefix}_${normalizedName}${suffix}`;

  // Strong random password with uppercase, lowercase, numbers, special characters (16 chars)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  let generatedPassword = '';
  for (let i = 0; i < 16; i++) {
    generatedPassword += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const passwordHash = await hashPassword(generatedPassword);

  const user = new User({
    username,
    fullName,
    email: cleanEmail || undefined,
    phone: cleanPhone || undefined,
    passwordHash,
    systemRole: 'STAFF',
    staffSubRole,
    assignedBranchIds: normalizedAuthorized.map((id) => new mongoose.Types.ObjectId(id)),
    accountStatus: 'ACTIVE',
  });

  await user.save();

  const profile = new StaffProfile({
    userId: user._id,
    staffSubRole,
    homeBranchId: homeBranchId ? new mongoose.Types.ObjectId(homeBranchId) : undefined,
    authorizedBranchIds: normalizedAuthorized.map((id) => new mongoose.Types.ObjectId(id)),
    status: 'ACTIVE',
  });

  await profile.save();

  const formatted = formatStaff(profile, user);
  formatted.credentials = {
    username,
    password: generatedPassword,
  };
  return formatted;
};

/**
 * Update Staff Details (conforming to OpenAPI StaffUpdate)
 */
export const updateStaff = async (id, data, actor = null) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Invalid staff ID');
  }

  const profile = await StaffProfile.findById(id).populate('userId');
  if (!profile) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Staff profile not found');
  }

  const user = profile.userId;

  // Manager scope check
  if (actor && actor.systemRole === 'MANAGER') {
    const assignedIds = (actor.assignedBranchIds || []).map((b) => b.toString());
    const staffBranchIds = [
      ...(profile.authorizedBranchIds || []).map((b) => (b._id || b).toString()),
      profile.homeBranchId ? (profile.homeBranchId._id || profile.homeBranchId).toString() : null,
    ].filter(Boolean);

    if (!staffBranchIds.some((bId) => assignedIds.includes(bId))) {
      throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Cannot manage staff outside your branches');
    }
  }

  if (data.staffSubRole) {
    profile.staffSubRole = data.staffSubRole;
    if (user) user.staffSubRole = data.staffSubRole;
  }
  if (data.status) {
    profile.status = data.status;
  }

  if (user) await user.save();
  await profile.save();

  return formatStaff(profile, user);
};

/**
 * Update Staff Branch assignments (conforming to OpenAPI StaffBranchesWrite)
 */
export const updateStaffBranches = async (id, { homeBranchId, authorizedBranchIds = [] }, actor = null) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Invalid staff ID');
  }

  if (!authorizedBranchIds || authorizedBranchIds.length === 0) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'authorizedBranchIds must contain at least 1 branch');
  }

  const profile = await StaffProfile.findById(id).populate('userId');
  if (!profile) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Staff profile not found');
  }

  const user = profile.userId;

  // Manager scope check
  if (actor && actor.systemRole === 'MANAGER') {
    const assignedIds = (actor.assignedBranchIds || []).map((b) => b.toString());
    if (homeBranchId && !assignedIds.includes(homeBranchId.toString())) {
      throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Cannot assign home branch outside managed branches');
    }
    for (const bId of authorizedBranchIds) {
      if (!assignedIds.includes(bId.toString())) {
        throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Cannot authorize branch outside managed branches');
      }
    }
  }

  const normalizedAuthorized = authorizedBranchIds.map((b) => new mongoose.Types.ObjectId(b));
  profile.authorizedBranchIds = normalizedAuthorized;
  profile.homeBranchId = homeBranchId ? new mongoose.Types.ObjectId(homeBranchId) : null;

  if (profile.homeBranchId && !profile.authorizedBranchIds.some((b) => b.toString() === profile.homeBranchId.toString())) {
    profile.authorizedBranchIds.push(profile.homeBranchId);
  }

  if (user) {
    user.assignedBranchIds = profile.authorizedBranchIds;
    await user.save();
  }
  await profile.save();

  return formatStaff(profile, user);
};


export const resetStaffPassword = async (id, data = {}, actor) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Invalid staff ID');
  }

  let profile = await StaffProfile.findById(id).populate('userId');
  let user = profile ? profile.userId : await User.findById(id);

  if (!user && profile && profile.userId) {
    user = await User.findById(profile.userId);
  }

  if (!user) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Staff user account not found');
  }

  const newPassword = (data.newPassword || 'PetClinic@2026!').trim();
  if (newPassword.length < 8) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Password must be at least 8 characters');
  }

  user.passwordHash = await hashPassword(newPassword);
  user.failedLoginAttempts = 0;
  user.lockoutUntil = null;
  await user.save();

  return {
    success: true,
    message: 'Staff password reset successfully',
    temporaryPassword: newPassword,
    staffId: id,
    username: user.username || user.phone
  };
};
