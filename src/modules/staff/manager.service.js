import mongoose from 'mongoose';
import User from '../../models/User.js';
import Branch from '../branch/models/Branch.js';
import AppError from '../../utils/AppError.js';
import { ErrorCodes } from '../../shared/errorCodes.js';
import { hashPassword } from '../../utils/passwordHelpers.js';

/**
 * Format pure DTO for Manager Response (compatible with both Manager and Staff interfaces)
 */
export const formatManager = (userDoc, branchMap = null) => {
  if (!userDoc) return null;
  const u = userDoc.toObject ? userDoc.toObject() : userDoc;
  const idStr = (u._id || u.id).toString();

  const assignedIds = (u.assignedBranchIds || []).map((b) => (b?._id || b).toString());

  const assignedBranches = assignedIds.map((bId) => {
    if (branchMap && branchMap.has(bId)) {
      const br = branchMap.get(bId);
      return {
        id: bId,
        code: br.code || null,
        name: br.name || null,
      };
    }
    return { id: bId, code: null, name: null };
  });

  const isLocked = Boolean(u.lockedUntil && new Date(u.lockedUntil) > new Date());
  const status = u.accountStatus === 'ACTIVE' && !isLocked ? 'ACTIVE' : 'INACTIVE';

  const dto = {
    id: idStr,
    userId: idStr,
    staffCode: u.staffCode || `MGR-${idStr.slice(-4).toUpperCase()}`,
    fullName: u.fullName,
    email: u.email || null,
    phone: u.phone || null,
    username: u.username || null,
    systemRole: 'MANAGER',
    role: 'MANAGER',
    staffSubRole: 'MANAGER', // Canonical label for FE Personnel table
    assignedBranchIds: assignedIds,
    authorizedBranchIds: assignedIds, // Backwards-compatible alias for FE Staff tables
    assignedBranches,
    homeBranchId: null,
    homeBranch: null,
    status,
    accountStatus: u.accountStatus || 'ACTIVE',
    isLocked,
    lockedUntil: u.lockedUntil ? new Date(u.lockedUntil).toISOString() : null,
    lockReason: u.lockReason || null,
    createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: u.updatedAt ? new Date(u.updatedAt).toISOString() : null,
    joinedAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
  };

  return dto;
};

/**
 * Fetch branch map for given IDs
 */
const fetchBranchMap = async (branchIds = []) => {
  const map = new Map();
  if (!branchIds || branchIds.length === 0) return map;
  if (mongoose.connection.readyState !== 1) return map;

  try {
    const validIds = branchIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length === 0) return map;
    const branches = await Branch.find({ _id: { $in: validIds } }).lean();
    branches.forEach((b) => map.set(b._id.toString(), b));
  } catch (_e) {
    // fallback empty map
  }
  return map;
};

/**
 * Create Manager user account
 */
export const createManager = async (data, actor = null) => {
  if (actor && actor.systemRole !== 'ADMIN') {
    throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Only ADMIN can create managers');
  }

  const {
    fullName,
    email,
    phone,
    password,
    username: customUsername,
  } = data;

  const rawBranches = data.assignedBranchIds || data.authorizedBranchIds || data.branchIds || data.branches || [];
  if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'fullName is required');
  }

  const assignedBranchIds = Array.isArray(rawBranches) ? rawBranches : [rawBranches];
  const normalizedBranchIds = assignedBranchIds
    .map((b) => (b?._id || b || '').toString().trim())
    .filter((id) => mongoose.Types.ObjectId.isValid(id));

  if (normalizedBranchIds.length === 0) {
    throw new AppError(
      400,
      'ValidationError',
      ErrorCodes.VALIDATION_ERROR,
      'Manager must be assigned to at least 1 branch (assignedBranchIds is required)'
    );
  }

  // Verify branch existence if connected
  if (mongoose.connection.readyState === 1) {
    const branchCount = await Branch.countDocuments({ _id: { $in: normalizedBranchIds } });
    if (branchCount === 0) {
      throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Specified assignedBranchIds do not exist');
    }
  }

  // Unique email and phone check
  const cleanEmail = email && typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null;
  const cleanPhone = phone && typeof phone === 'string' && phone.trim() ? phone.trim() : null;

  if (cleanEmail || cleanPhone) {
    const orConditions = [];
    if (cleanEmail) orConditions.push({ email: cleanEmail });
    if (cleanPhone) orConditions.push({ phone: cleanPhone });
    const existing = await User.findOne({ $or: orConditions });
    if (existing) {
      throw new AppError(409, 'Conflict', ErrorCodes.CONFLICT, 'User with this phone or email already exists');
    }
  }

  // Auto-generate username if not given
  let username = customUsername ? String(customUsername).trim().toLowerCase() : null;
  if (!username) {
    const normalizedName = (fullName || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 15);
    const suffix = Math.floor(100 + Math.random() * 900);
    username = `mgr_${normalizedName}${suffix}`;
  }

  // Check unique username
  const existingUsername = await User.findOne({ username });
  if (existingUsername) {
    username = `${username}${Math.floor(10 + Math.random() * 90)}`;
  }

  // Password handling
  let plainPassword = (password && typeof password === 'string' && password.trim().length >= 6)
    ? password.trim()
    : null;

  if (!plainPassword) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
    plainPassword = '';
    for (let i = 0; i < 16; i++) {
      plainPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }

  const passwordHash = await hashPassword(plainPassword);
  const staffCode = data.staffCode || `MGR-${Math.floor(1000 + Math.random() * 9000)}`;

  const user = new User({
    fullName: fullName.trim(),
    username,
    staffCode,
    email: cleanEmail || undefined,
    phone: cleanPhone || undefined,
    passwordHash,
    systemRole: 'MANAGER',
    staffSubRole: null, // User model enum restriction
    assignedBranchIds: normalizedBranchIds.map((id) => new mongoose.Types.ObjectId(id)),
    accountStatus: 'ACTIVE',
    activatedAt: new Date(),
  });

  await user.save();

  const branchMap = await fetchBranchMap(normalizedBranchIds);
  const formatted = formatManager(user, branchMap);
  formatted.credentials = {
    username,
    password: plainPassword,
  };

  return formatted;
};

/**
 * List managers with branch scoping and filtering
 */
export const listManagers = async (query = {}, actor = null) => {
  if (actor && !['ADMIN', 'MANAGER'].includes(actor.systemRole)) {
    throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Access denied');
  }

  const { branchId, search, status, accountStatus, limit = 20, page = 1, cursor } = query;
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);

  const filter = { systemRole: 'MANAGER' };

  if (actor && actor.systemRole === 'MANAGER') {
    const actorAssigned = (actor.assignedBranchIds || []).map((b) => b.toString());
    const actorObjIds = actorAssigned.map((id) => new mongoose.Types.ObjectId(id));
    if (branchId) {
      if (!actorAssigned.includes(branchId.toString())) {
        throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Access to this branch is forbidden');
      }
      filter.assignedBranchIds = new mongoose.Types.ObjectId(branchId);
    } else {
      filter.assignedBranchIds = { $in: actorObjIds };
    }
  } else if (branchId && mongoose.Types.ObjectId.isValid(branchId)) {
    filter.assignedBranchIds = new mongoose.Types.ObjectId(branchId);
  }

  const effectiveStatus = accountStatus || status;
  if (effectiveStatus) {
    filter.accountStatus = effectiveStatus.toUpperCase();
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

  // Gather all unique branch IDs for batch loading
  const allBranchIds = [];
  items.forEach((u) => {
    (u.assignedBranchIds || []).forEach((b) => allBranchIds.push((b?._id || b).toString()));
  });
  const branchMap = await fetchBranchMap(allBranchIds);

  return {
    items: items.map((u) => formatManager(u, branchMap)),
    totalCount: cursor ? items.length : totalCount,
    page: parsedPage,
    limit: parsedLimit,
    nextCursor,
  };
};

/**
 * Get Manager by ID
 */
export const getManagerById = async (id, actor = null) => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Invalid Manager ID format');
  }

  const user = await User.findOne({ _id: id, systemRole: 'MANAGER' });
  if (!user) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Manager not found');
  }

  if (actor) {
    if (actor.systemRole === 'STAFF') {
      throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Access denied');
    }
    if (actor.systemRole === 'MANAGER' && actor.id !== user._id.toString()) {
      const actorAssigned = (actor.assignedBranchIds || []).map((b) => b.toString());
      const userAssigned = (user.assignedBranchIds || []).map((b) => b.toString());
      const hasOverlap = userAssigned.some((b) => actorAssigned.includes(b));
      if (!hasOverlap) {
        throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Access denied to manager of other branches');
      }
    }
  }

  const branchMap = await fetchBranchMap((user.assignedBranchIds || []).map((b) => (b?._id || b).toString()));
  return formatManager(user, branchMap);
};

/**
 * Update Manager profile and assigned branches
 */
export const updateManager = async (id, data = {}, actor = null) => {
  if (actor && actor.systemRole !== 'ADMIN') {
    throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Only ADMIN can update manager details');
  }

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Invalid Manager ID format');
  }

  const user = await User.findOne({ _id: id, systemRole: 'MANAGER' });
  if (!user) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Manager not found');
  }

  if (data.fullName && typeof data.fullName === 'string' && data.fullName.trim()) {
    user.fullName = data.fullName.trim();
  }

  if (data.email !== undefined) {
    const cleanEmail = data.email && typeof data.email === 'string' && data.email.trim()
      ? data.email.trim().toLowerCase()
      : null;
    if (cleanEmail && cleanEmail !== user.email) {
      const existing = await User.findOne({ email: cleanEmail, _id: { $ne: user._id } });
      if (existing) {
        throw new AppError(409, 'Conflict', ErrorCodes.CONFLICT, 'Email already in use');
      }
      user.email = cleanEmail;
    } else if (!cleanEmail) {
      user.email = undefined;
    }
  }

  if (data.phone !== undefined) {
    const cleanPhone = data.phone && typeof data.phone === 'string' && data.phone.trim()
      ? data.phone.trim()
      : null;
    if (cleanPhone && cleanPhone !== user.phone) {
      const existing = await User.findOne({ phone: cleanPhone, _id: { $ne: user._id } });
      if (existing) {
        throw new AppError(409, 'Conflict', ErrorCodes.CONFLICT, 'Phone already in use');
      }
      user.phone = cleanPhone;
    }
  }

  const rawBranches = data.assignedBranchIds || data.authorizedBranchIds || data.branchIds;
  if (rawBranches !== undefined) {
    const arr = Array.isArray(rawBranches) ? rawBranches : [rawBranches];
    const normalized = arr
      .map((b) => (b?._id || b || '').toString().trim())
      .filter((bId) => mongoose.Types.ObjectId.isValid(bId));
    if (normalized.length === 0) {
      throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Manager must be assigned to at least 1 branch');
    }
    user.assignedBranchIds = normalized.map((bId) => new mongoose.Types.ObjectId(bId));
  }

  if (data.status || data.accountStatus) {
    const st = (data.accountStatus || data.status).toUpperCase();
    if (['ACTIVE', 'BLOCKED', 'DEACTIVATED'].includes(st)) {
      user.accountStatus = st;
      if (st === 'ACTIVE') {
        user.lockedUntil = null;
        user.lockReason = null;
      }
    }
  }

  await user.save();

  const branchMap = await fetchBranchMap((user.assignedBranchIds || []).map((b) => (b?._id || b).toString()));
  return formatManager(user, branchMap);
};

/**
 * Update Manager Assigned Branches (OpenAPI PUT /managers/{id}/assigned-branches)
 */
export const updateManagerBranches = async (id, data = {}, actor = null) => {
  if (actor && actor.systemRole !== 'ADMIN') {
    throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Only ADMIN can assign manager branches');
  }

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Invalid Manager ID format');
  }

  const rawBranches = data.assignedBranchIds || data.authorizedBranchIds || data.branchIds || [];
  const arr = Array.isArray(rawBranches) ? rawBranches : [rawBranches];
  const normalized = arr
    .map((b) => (b?._id || b || '').toString().trim())
    .filter((bId) => mongoose.Types.ObjectId.isValid(bId));

  if (normalized.length === 0) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'assignedBranchIds must contain at least 1 branch');
  }

  const user = await User.findOne({ _id: id, systemRole: 'MANAGER' });
  if (!user) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Manager not found');
  }

  user.assignedBranchIds = normalized.map((bId) => new mongoose.Types.ObjectId(bId));
  await user.save();

  const branchMap = await fetchBranchMap(normalized);

  return {
    id: user._id.toString(),
    assignedBranchIds: normalized,
    assignedBranches: normalized.map((bId) => ({
      id: bId,
      code: branchMap.get(bId)?.code || null,
      name: branchMap.get(bId)?.name || null,
    })),
  };
};

/**
 * Reset Manager password
 */
export const resetManagerPassword = async (id, data = {}, actor = null) => {
  if (actor && actor.systemRole !== 'ADMIN') {
    throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Only ADMIN can reset manager password');
  }

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Invalid Manager ID format');
  }

  const user = await User.findOne({ _id: id, systemRole: 'MANAGER' });
  if (!user) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Manager not found');
  }

  const newPassword = (data.newPassword || 'PetClinic@2026!').trim();
  if (newPassword.length < 8) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Password must be at least 8 characters');
  }

  user.passwordHash = await hashPassword(newPassword);
  user.failedLoginCount = 0;
  user.lockedUntil = null;
  await user.save();

  return {
    success: true,
    message: 'Manager password reset successfully',
    temporaryPassword: newPassword,
    managerId: id,
    username: user.username || user.phone,
  };
};

export const managerService = {
  formatManager,
  createManager,
  listManagers,
  getManagerById,
  updateManager,
  updateManagerBranches,
  resetManagerPassword,
};

export default managerService;

