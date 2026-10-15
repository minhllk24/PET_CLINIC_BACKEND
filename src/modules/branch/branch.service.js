import mongoose from 'mongoose';
import Branch from './models/Branch';
import { getNextSequence } from '../../models/Counter';
import AppError from '../../utils/AppError';

const encodeCursor = (id) => Buffer.from(id.toString()).toString('base64');
const decodeCursor = (cursor) => {
  try {
    return Buffer.from(cursor, 'base64').toString('ascii');
  } catch (e) {
    return null;
  }
};

export const formatBranchResponse = (branch) => {
  const obj = branch.toObject ? branch.toObject() : branch;
  const res = {
    id: (obj._id || obj.id).toString(),
    code: obj.code || '',
    name: obj.name,
    address: obj.address,
    status: obj.status || 'ACTIVE',
  };
  if (obj.phone) res.phone = obj.phone;
  if (obj.openingHours && Array.isArray(obj.openingHours)) {
    res.openingHours = obj.openingHours.map((h) => ({
      dayOfWeek: h.dayOfWeek,
      open: h.open,
      close: h.close,
    }));
  } else {
    res.openingHours = [];
  }
  if (obj.holidays && Array.isArray(obj.holidays)) {
    res.holidays = obj.holidays.map((h) => {
      const holidayItem = { date: h.date };
      if (h.note) holidayItem.note = h.note;
      return holidayItem;
    });
  } else {
    res.holidays = [];
  }
  return res;
};

export const listBranches = async ({ limit = 20, cursor = null, actor = null }) => {
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const filter = {};

  // Public & Customer only view ACTIVE branches
  const isInternal = actor && ['ADMIN', 'MANAGER', 'STAFF'].includes(actor.systemRole);
  if (!isInternal) {
    filter.status = 'ACTIVE';
  }

  if (cursor) {
    const decodedId = decodeCursor(cursor);
    if (decodedId && mongoose.Types.ObjectId.isValid(decodedId)) {
      filter._id = { $gt: new mongoose.Types.ObjectId(decodedId) };
    }
  }

  const branches = await Branch.find(filter)
    .sort({ _id: 1 })
    .limit(parsedLimit + 1);

  let nextCursor = null;
  let items = branches;
  if (branches.length > parsedLimit) {
    items = branches.slice(0, parsedLimit);
    nextCursor = encodeCursor(items[items.length - 1]._id);
  }

  return {
    items: items.map(formatBranchResponse),
    nextCursor,
  };
};

export const getBranchById = async (id, actor = null) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(404, 'NotFound', 'RESOURCE_NOT_FOUND', 'Branch not found');
  }

  const branch = await Branch.findById(id);
  if (!branch) {
    throw new AppError(404, 'NotFound', 'RESOURCE_NOT_FOUND', 'Branch not found');
  }

  const isInternal = actor && ['ADMIN', 'MANAGER', 'STAFF'].includes(actor.systemRole);
  if (!isInternal && branch.status !== 'ACTIVE') {
    throw new AppError(404, 'NotFound', 'RESOURCE_NOT_FOUND', 'Branch not found');
  }

  return formatBranchResponse(branch);
};

export const createBranch = async (data, actor = null) => {
  let code = data.code;
  if (!code) {
    const seq = await getNextSequence('branchCode');
    code = `BR-${String(seq).padStart(6, '0')}`;
  }

  const branch = new Branch({
    ...data,
    code,
    status: data.status || 'ACTIVE',
  });

  await branch.save();
  return formatBranchResponse(branch);
};

export const updateBranch = async (id, data, actor = null) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(404, 'NotFound', 'RESOURCE_NOT_FOUND', 'Branch not found');
  }

  const branch = await Branch.findById(id);
  if (!branch) {
    throw new AppError(404, 'NotFound', 'RESOURCE_NOT_FOUND', 'Branch not found');
  }

  // Manager scope check: can only update branches within assignedBranchIds
  if (actor && actor.systemRole === 'MANAGER') {
    const assignedIds = (actor.assignedBranchIds || []).map((b) => b.toString());
    if (!assignedIds.includes(id.toString())) {
      throw new AppError(403, 'Forbidden', 'AUTHORIZATION_ERROR', 'You are not assigned to manage this branch');
    }
  }

  // Apply updates
  if (data.name !== undefined) branch.name = data.name;
  if (data.address !== undefined) branch.address = data.address;
  if (data.phone !== undefined) branch.phone = data.phone;
  if (data.status !== undefined) branch.status = data.status;
  if (data.openingHours !== undefined) branch.openingHours = data.openingHours;
  if (data.holidays !== undefined) branch.holidays = data.holidays;

  await branch.save();
  return formatBranchResponse(branch);
};

export const deactivateBranch = async (id, reason, actor = null) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(404, 'NotFound', 'RESOURCE_NOT_FOUND', 'Branch not found');
  }

  const branch = await Branch.findById(id);
  if (!branch) {
    throw new AppError(404, 'NotFound', 'RESOURCE_NOT_FOUND', 'Branch not found');
  }

  branch.status = 'INACTIVE';
  await branch.save();
  return formatBranchResponse(branch);
};

export const activateBranch = async (id, actor = null) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(404, 'NotFound', 'RESOURCE_NOT_FOUND', 'Branch not found');
  }

  const branch = await Branch.findById(id);
  if (!branch) {
    throw new AppError(404, 'NotFound', 'RESOURCE_NOT_FOUND', 'Branch not found');
  }

  branch.status = 'ACTIVE';
  await branch.save();
  return formatBranchResponse(branch);
};
