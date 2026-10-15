import mongoose from 'mongoose';
import BranchServiceConfig from './models/BranchServiceConfig';
import Branch from './models/Branch';
import Service from '../catalog/models/Service';
import AppError from '../../utils/AppError';

const encodeCursor = (id) => Buffer.from(id.toString()).toString('base64');
const decodeCursor = (cursor) => {
  try {
    return Buffer.from(cursor, 'base64').toString('ascii');
  } catch (e) {
    return null;
  }
};

export const formatBranchServiceConfigResponse = (config) => {
  const obj = config.toObject ? config.toObject() : config;
  const res = {
    branchId: (obj.branchId._id || obj.branchId).toString(),
    serviceId: (obj.serviceId._id || obj.serviceId).toString(),
    enabled: Boolean(obj.enabled),
    capacity: Number(obj.capacity) || 1,
  };

  if (obj.availability && Array.isArray(obj.availability)) {
    res.availability = obj.availability.map((a) => ({
      dayOfWeek: a.dayOfWeek,
      open: a.open,
      close: a.close,
    }));
  } else {
    res.availability = [];
  }

  if (obj.updatedAt) {
    res.updatedAt = new Date(obj.updatedAt).toISOString();
  } else {
    res.updatedAt = new Date().toISOString();
  }

  return res;
};

const verifyBranchScope = (branchId, actor) => {
  if (!actor) {
    throw new AppError(401, 'Unauthenticated', 'AUTHENTICATION_ERROR', 'You must be logged in');
  }

  if (actor.systemRole === 'ADMIN') {
    return true;
  }

  const branchIdStr = branchId.toString();

  if (actor.systemRole === 'MANAGER') {
    const assigned = (actor.assignedBranchIds || []).map((b) => b.toString());
    if (!assigned.includes(branchIdStr)) {
      throw new AppError(403, 'Forbidden', 'AUTHORIZATION_ERROR', 'You do not have access to this branch');
    }
    return true;
  }

  if (actor.systemRole === 'STAFF') {
    const authorized = (actor.authorizedBranchIds || []).map((b) => b.toString());
    if (!authorized.includes(branchIdStr)) {
      throw new AppError(403, 'Forbidden', 'AUTHORIZATION_ERROR', 'You do not have access to this branch');
    }
    return true;
  }

  throw new AppError(403, 'Forbidden', 'AUTHORIZATION_ERROR', 'Insufficient permissions for branch');
};

export const listBranchServiceConfigs = async ({
  branchId,
  enabled,
  serviceType,
  limit = 20,
  cursor = null,
  actor = null,
}) => {
  if (!mongoose.Types.ObjectId.isValid(branchId)) {
    throw new AppError(404, 'NotFound', 'RESOURCE_NOT_FOUND', 'Branch not found');
  }

  // Scope check
  verifyBranchScope(branchId, actor);

  const branch = await Branch.findById(branchId);
  if (!branch) {
    throw new AppError(404, 'NotFound', 'RESOURCE_NOT_FOUND', 'Branch not found');
  }

  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const filter = { branchId: new mongoose.Types.ObjectId(branchId) };

  if (enabled !== undefined) {
    filter.enabled = enabled === true || enabled === 'true';
  }

  if (cursor) {
    const decodedId = decodeCursor(cursor);
    if (decodedId && mongoose.Types.ObjectId.isValid(decodedId)) {
      filter._id = { $gt: new mongoose.Types.ObjectId(decodedId) };
    }
  }

  let query = BranchServiceConfig.find(filter).sort({ _id: 1 });

  if (serviceType) {
    query = query.populate({
      path: 'serviceId',
      match: { serviceType },
      select: '_id serviceType',
    });
  }

  const configs = await query.limit(parsedLimit + 1);

  // If serviceType filter applied via populate, filter out items where serviceId was not matched
  const filteredConfigs = serviceType ? configs.filter((c) => c.serviceId !== null) : configs;

  let nextCursor = null;
  let items = filteredConfigs;
  if (filteredConfigs.length > parsedLimit) {
    items = filteredConfigs.slice(0, parsedLimit);
    nextCursor = encodeCursor(items[items.length - 1]._id);
  }

  return {
    items: items.map(formatBranchServiceConfigResponse),
    nextCursor,
  };
};

export const upsertBranchServiceConfig = async ({
  branchId,
  serviceId,
  data,
  actor = null,
}) => {
  if (!mongoose.Types.ObjectId.isValid(branchId)) {
    throw new AppError(404, 'NotFound', 'RESOURCE_NOT_FOUND', 'Branch not found');
  }
  if (!mongoose.Types.ObjectId.isValid(serviceId)) {
    throw new AppError(404, 'NotFound', 'RESOURCE_NOT_FOUND', 'Service not found');
  }

  // Scope check (Manager can only upsert in assigned branches, Admin can do all)
  verifyBranchScope(branchId, actor);

  const [branch, service] = await Promise.all([
    Branch.findById(branchId),
    Service.findById(serviceId),
  ]);

  if (!branch) {
    throw new AppError(404, 'NotFound', 'RESOURCE_NOT_FOUND', 'Branch not found');
  }
  if (!service) {
    throw new AppError(404, 'NotFound', 'RESOURCE_NOT_FOUND', 'Service not found');
  }

  if (data.capacity !== undefined && (data.capacity < 1 || !Number.isInteger(Number(data.capacity)))) {
    throw new AppError(400, 'ValidationError', 'VALIDATION_ERROR', 'Capacity must be an integer >= 1');
  }

  const updateDoc = {
    branchId: new mongoose.Types.ObjectId(branchId),
    serviceId: new mongoose.Types.ObjectId(serviceId),
    enabled: Boolean(data.enabled),
    capacity: Number(data.capacity) || 1,
    availability: data.availability || [],
    updatedBy: actor?.id ? new mongoose.Types.ObjectId(actor.id) : undefined,
  };

  const config = await BranchServiceConfig.findOneAndUpdate(
    {
      branchId: new mongoose.Types.ObjectId(branchId),
      serviceId: new mongoose.Types.ObjectId(serviceId),
    },
    { $set: updateDoc },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

  return formatBranchServiceConfigResponse(config);
};
