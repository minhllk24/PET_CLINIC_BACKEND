import crypto from 'node:crypto';
import mongoose from 'mongoose';
import User from '../../models/User.js';
import Branch from '../branch/models/Branch.js';
import AppError from '../../utils/AppError.js';
import { ErrorCodes } from '../../shared/errorCodes.js';
import { hashPassword } from '../../utils/passwordHelpers.js';

/**
 * Generate cryptographically secure random password (CSPRNG)
 */
export const generateSecurePassword = (length = 16) => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%^&*';
  const allChars = upper + lower + numbers + symbols;

  const passwordChars = [
    upper[crypto.randomInt(0, upper.length)],
    lower[crypto.randomInt(0, lower.length)],
    numbers[crypto.randomInt(0, numbers.length)],
    symbols[crypto.randomInt(0, symbols.length)],
  ];

  for (let i = passwordChars.length; i < length; i++) {
    passwordChars.push(allChars[crypto.randomInt(0, allChars.length)]);
  }

  // Fisher-Yates shuffle with crypto.randomInt
  for (let i = passwordChars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [passwordChars[i], passwordChars[j]] = [passwordChars[j], passwordChars[i]];
  }

  return passwordChars.join('');
};

/**
 * Validate that all assignedBranchIds exist, are active, and are valid ObjectIds.
 * Does NOT silently filter out invalid branch IDs.
 */
export const validateActiveBranches = async (rawBranches) => {
  if (!rawBranches) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'assignedBranchIds is required');
  }

  const rawList = Array.isArray(rawBranches) ? rawBranches : [rawBranches];
  if (rawList.length === 0) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Manager must be assigned to at least 1 branch');
  }

  const normalizedIds = [];
  for (const item of rawList) {
    const idStr = (item?._id || item || '').toString().trim();
    if (!idStr || !mongoose.Types.ObjectId.isValid(idStr)) {
      throw new AppError(
        400,
        'ValidationError',
        ErrorCodes.VALIDATION_ERROR,
        `Invalid branch ID format: "${item}". All assignedBranchIds must be valid ObjectId strings.`
      );
    }
    normalizedIds.push(idStr);
  }

  const uniqueIds = Array.from(new Set(normalizedIds));

  // Check existence and active status in DB if connected or mocked
  if (mongoose.connection.readyState === 1 || Branch.find?._isMockFunction) {
    try {
      const activeBranches = await Branch.find({
        _id: { $in: uniqueIds },
      }).lean();

      const activeMap = new Map();
      (activeBranches || []).forEach((b) => {
        const isInactive = b.isActive === false || ['INACTIVE', 'CLOSED', 'DEACTIVATED'].includes(b.status);
        if (!isInactive) {
          activeMap.set(b._id.toString(), b);
        }
      });

      const missingOrInactive = uniqueIds.filter((id) => !activeMap.has(id));
      if (missingOrInactive.length > 0) {
        throw new AppError(
          400,
          'ValidationError',
          ErrorCodes.VALIDATION_ERROR,
          `One or more assigned branches do not exist or are inactive: ${missingOrInactive.join(', ')}`
        );
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      // In case of query failure, if connection was 1, throw error
      if (mongoose.connection.readyState === 1) {
        throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Unable to verify branch status');
      }
    }
  }

  return uniqueIds;
};

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

  const rawBranches = data.assignedBranchIds || data.authorizedBranchIds || data.branchIds || data.branches;
  if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'fullName is required');
  }

  const normalizedBranchIds = await validateActiveBranches(rawBranches);

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
    const suffix = crypto.randomInt(100, 1000);
    username = `mgr_${normalizedName}${suffix}`;
  }

  // Check unique username
  const existingUsername = await User.findOne({ username });
  if (existingUsername) {
    username = `${username}${crypto.randomInt(10, 100)}`;
  }

  // Password handling using CSPRNG
  let plainPassword = (password && typeof password === 'string' && password.trim().length >= 6)
    ? password.trim()
    : null;

  if (!plainPassword) {
    plainPassword = generateSecurePassword(16);
  }

  const passwordHash = await hashPassword(plainPassword);
  const staffCode = data.staffCode || `MGR-${crypto.randomInt(1000, 10000)}`;

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

  const formattedItems = items.map((u) => formatManager(u, branchMap));
  const effectiveTotal = cursor ? formattedItems.length : totalCount;
  const totalPages = Math.ceil(effectiveTotal / parsedLimit) || 1;

  return {
    success: true,
    data: {
      items: formattedItems,
      totalCount: effectiveTotal,
      total: effectiveTotal,
      page: parsedPage,
      limit: parsedLimit,
      totalPages,
      nextCursor,
    },
    items: formattedItems,
    totalCount: effectiveTotal,
    total: effectiveTotal,
    page: parsedPage,
    limit: parsedLimit,
    totalPages,
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
      const userAssigned = (user.assignedBranchIds || []).map((b) => (b?._id || b).toString());
      const hasOverlap = userAssigned.some((b) => actorAssigned.includes(b));
      if (!hasOverlap) {
        throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Access denied to manager of other branches');
      }
    }
  }

  const branchMap = await fetchBranchMap((user.assignedBranchIds || []).map((b) => (b?._id || b).toString()));
  const formatted = formatManager(user, branchMap);

  // If actor is MANAGER, scope visible branches to actor's assignedBranchIds only
  if (actor && actor.systemRole === 'MANAGER') {
    const actorAssigned = (actor.assignedBranchIds || []).map((b) => b.toString());
    formatted.assignedBranchIds = formatted.assignedBranchIds.filter((bId) => actorAssigned.includes(bId));
    formatted.authorizedBranchIds = formatted.assignedBranchIds;
    formatted.assignedBranches = formatted.assignedBranches.filter((br) => actorAssigned.includes(br.id));
  }

  return formatted;
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
    const normalized = await validateActiveBranches(rawBranches);
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

  const rawBranches = data.assignedBranchIds || data.authorizedBranchIds || data.branchIds;
  const normalized = await validateActiveBranches(rawBranches);

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

  const newPassword = (data.newPassword && typeof data.newPassword === 'string' && data.newPassword.trim().length >= 8)
    ? data.newPassword.trim()
    : generateSecurePassword(16);

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

