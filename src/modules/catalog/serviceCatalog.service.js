import mongoose from 'mongoose';
import Service from './models/Service';
import BranchServiceConfig from '../branch/models/BranchServiceConfig';
import Branch from '../branch/models/Branch';
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

export const formatServiceResponse = (service, branchOpts = {}) => {
  let opts = {};
  if (typeof branchOpts === 'number' || typeof branchOpts === 'undefined') {
    opts = { enabledBranchCount: branchOpts };
  } else {
    opts = branchOpts;
  }
  const {
    enabledBranchCount = undefined,
    totalBranchCount = undefined,
    branchConfig = undefined,
    branchId = undefined,
  } = opts;

  const obj = service.toObject ? service.toObject() : service;
  const status = obj.status || 'ACTIVE';
  const res = {
    id: (obj._id || obj.id).toString(),
    name: obj.name,
    serviceType: obj.serviceType,
    basePrice: Number(obj.basePrice),
    durationMinutes: Number(obj.durationMinutes),
    requiredStaffRole: obj.requiredStaffRole,
    bookingMode: obj.bookingMode,
    status,
  };

  if (obj.code) res.code = obj.code;
  if (obj.category) res.category = obj.category;
  if (obj.description) res.description = obj.description;

  if (obj.priceVariants && Array.isArray(obj.priceVariants) && obj.priceVariants.length > 0) {
    res.priceVariants = obj.priceVariants.map((v) => {
      const mode = v.mode || 'FIXED';
      const variant = {
        label: v.label,
        mode,
        price: mode === 'QUOTE' ? null : (v.price !== null && v.price !== undefined ? Number(v.price) : null)
      };
      if (v.tier) variant.tier = v.tier;
      if (v.minWeightKg !== undefined && v.minWeightKg !== null) variant.minWeightKg = Number(v.minWeightKg);
      if (v.maxWeightKg !== undefined && v.maxWeightKg !== null) variant.maxWeightKg = Number(v.maxWeightKg);
      return variant;
    });
  }

  if (obj.defaultMaterials && Array.isArray(obj.defaultMaterials) && obj.defaultMaterials.length > 0) {
    res.defaultMaterials = obj.defaultMaterials.map((m) => ({
      materialId: (m.materialId?._id || m.materialId)?.toString() || m.materialId,
      defaultQuantity: Number(m.defaultQuantity) || 1,
      unit: m.unit || '',
    }));
  }

  if (obj.contactInfo && (obj.contactInfo.hotline || obj.contactInfo.instruction)) {
    const ci = {};
    if (obj.contactInfo.hotline) ci.hotline = obj.contactInfo.hotline;
    if (obj.contactInfo.instruction) ci.instruction = obj.contactInfo.instruction;
    res.contactInfo = ci;
  }

  if (enabledBranchCount !== undefined) {
    res.enabledBranchCount = Number(enabledBranchCount);
  }
  if (totalBranchCount !== undefined) {
    res.totalBranchCount = Number(totalBranchCount);
  }

  // Calculate "Khả dụng" (Availability)
  if (branchId) {
    // Specific branch context
    if (status !== 'ACTIVE') {
      res.isAvailable = false;
      res.availabilityStatus = 'INACTIVE';
      res.availabilityText = 'Tạm ngưng';
    } else if (branchConfig && branchConfig.enabled) {
      res.isAvailable = true;
      res.availabilityStatus = 'AVAILABLE';
      res.availabilityText = 'Khả dụng';
      res.branchConfig = {
        enabled: true,
        capacity: Number(branchConfig.capacity) || 1,
      };
    } else {
      res.isAvailable = false;
      res.availabilityStatus = 'BRANCH_DISABLED';
      res.availabilityText = 'Tắt tại chi nhánh';
      res.branchConfig = {
        enabled: false,
        capacity: branchConfig ? Number(branchConfig.capacity) || 1 : 1,
      };
    }
  } else {
    // Global context
    if (status !== 'ACTIVE') {
      res.isAvailable = false;
      res.availabilityStatus = 'INACTIVE';
      res.availabilityText = 'Tạm ngưng';
    } else if (enabledBranchCount !== undefined && enabledBranchCount > 0) {
      res.isAvailable = true;
      res.availabilityStatus = 'AVAILABLE';
      res.availabilityText = 'Khả dụng';
    } else {
      res.isAvailable = false;
      res.availabilityStatus = 'UNAVAILABLE';
      res.availabilityText = 'Chưa có CN bật';
    }
  }

  return res;
};

export const validateServiceGuardrails = (data, existing = null) => {
  const nameLower = ((data.name !== undefined ? data.name : existing?.name) || '').toLowerCase();
  const catLower = ((data.category !== undefined ? data.category : existing?.category) || '').toLowerCase();

  const isSurgery =
    catLower.includes('surgery') ||
    catLower.includes('phẫu thuật') ||
    catLower.includes('mổ') ||
    catLower.includes('triệt sản') ||
    nameLower.includes('surgery') ||
    nameLower.includes('phẫu thuật') ||
    nameLower.includes('mổ') ||
    nameLower.includes('triệt sản');

  const isEmergency =
    catLower.includes('emergency') ||
    catLower.includes('cấp cứu') ||
    nameLower.includes('emergency') ||
    nameLower.includes('cấp cứu');

  if (isSurgery) {
    if (data.bookingMode && data.bookingMode !== 'REQUEST_ONLY') {
      throw new AppError(
        422,
        'Unprocessable',
        'SURGERY_REQUIRES_REQUEST_ONLY',
        'Dịch vụ phẫu thuật bắt buộc có chế độ đặt lịch là REQUEST_ONLY'
      );
    }
    data.bookingMode = 'REQUEST_ONLY';
  }

  if (isEmergency) {
    if (data.bookingMode && data.bookingMode !== 'CONTACT_ONLY') {
      throw new AppError(
        422,
        'Unprocessable',
        'EMERGENCY_REQUIRES_CONTACT_ONLY',
        'Dịch vụ cấp cứu bắt buộc có chế độ đặt lịch là CONTACT_ONLY'
      );
    }
    data.bookingMode = 'CONTACT_ONLY';
  }

  // Guardrail: No deposit config allowed on Service
  if (data.deposit !== undefined || data.depositPercentage !== undefined || data.depositConfig !== undefined) {
    throw new AppError(
      422,
      'Unprocessable',
      'NO_DEPOSIT_CONFIG_ALLOWED',
      'Service Catalog không cho phép cấu hình deposit'
    );
  }
};

export const listServices = async ({
  bookingMode,
  requiredStaffRole,
  category,
  status,
  search,
  branchId = null,
  isAvailable = null,
  limit = 20,
  cursor = null,
  page = null,
  actor = null,
}) => {
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const parsedPage = page !== undefined && page !== null && page !== '' ? Math.max(parseInt(page, 10) || 1, 1) : null;
  const filter = {};

  const isInternal = actor && ['ADMIN', 'MANAGER', 'STAFF'].includes(actor.systemRole);
  if (!isInternal) {
    filter.status = 'ACTIVE';
  } else if (status) {
    filter.status = status;
  }

  if (bookingMode) filter.bookingMode = bookingMode;
  if (requiredStaffRole) filter.requiredStaffRole = requiredStaffRole;
  if (category) filter.category = category;

  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { code: { $regex: escaped, $options: 'i' } },
      { description: { $regex: escaped, $options: 'i' } },
    ];
  }

  let totalItems = 0;
  if (mongoose.connection.readyState === 1 || Service.countDocuments?._isMockFunction) {
    try {
      totalItems = await Service.countDocuments(filter);
    } catch (e) {
      totalItems = 0;
    }
  }
  const totalPages = Math.ceil(totalItems / parsedLimit) || 1;

  let serviceQuery = Service.find(filter).sort({ _id: 1 });

  if (parsedPage && typeof serviceQuery.skip === 'function') {
    serviceQuery = serviceQuery.skip((parsedPage - 1) * parsedLimit);
  } else if (!parsedPage && cursor) {
    const decodedId = decodeCursor(cursor);
    if (decodedId && mongoose.Types.ObjectId.isValid(decodedId)) {
      filter._id = { $gt: new mongoose.Types.ObjectId(decodedId) };
      serviceQuery = Service.find(filter).sort({ _id: 1 });
    }
  }

  if (typeof serviceQuery.limit === 'function') {
    serviceQuery = serviceQuery.limit(parsedLimit + 1);
  }

  const [services, totalBranchCount] = await Promise.all([
    serviceQuery,
    Branch.countDocuments({ status: 'ACTIVE' }),
  ]);

  let nextCursor = null;
  let items = services;
  if (services.length > parsedLimit) {
    items = services.slice(0, parsedLimit);
    nextCursor = encodeCursor(items[items.length - 1]._id);
  }

  // Calculate enabledBranchCount for the returned services
  const serviceIds = items.map((s) => s._id);
  const branchCounts = await BranchServiceConfig.aggregate([
    {
      $match: {
        serviceId: { $in: serviceIds },
        enabled: true,
      },
    },
    {
      $group: {
        _id: '$serviceId',
        count: { $sum: 1 },
      },
    },
  ]);

  const countMap = new Map();
  branchCounts.forEach((bc) => countMap.set(bc._id.toString(), bc.count));

  // If branchId is specified, fetch branch-specific configurations
  const branchConfigMap = new Map();
  let validBranchId = null;
  if (branchId && mongoose.Types.ObjectId.isValid(branchId)) {
    validBranchId = branchId;
    const branchConfigs = await BranchServiceConfig.find({
      branchId,
      serviceId: { $in: serviceIds },
    });
    branchConfigs.forEach((cfg) => branchConfigMap.set(cfg.serviceId.toString(), cfg));
  }

  let formattedItems = items.map((s) => {
    const sIdStr = s._id.toString();
    const enabledBranchCount = countMap.get(sIdStr) || 0;
    const branchConfig = validBranchId ? branchConfigMap.get(sIdStr) : undefined;
    return formatServiceResponse(s, {
      enabledBranchCount,
      totalBranchCount,
      branchConfig,
      branchId: validBranchId,
    });
  });

  // Filter by isAvailable if requested
  if (isAvailable !== undefined && isAvailable !== null && isAvailable !== '') {
    const targetAvailable = isAvailable === true || isAvailable === 'true';
    formattedItems = formattedItems.filter((item) => item.isAvailable === targetAvailable);
  }

  return {
    items: formattedItems,
    total: totalItems,
    totalItems,
    page: parsedPage || 1,
    totalPages,
    limit: parsedLimit,
    nextCursor,
  };
};

export const getServiceById = async (id, actor = null, branchId = null) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(404, 'NotFound', 'RESOURCE_NOT_FOUND', 'Service not found');
  }

  const service = await Service.findById(id);
  if (!service) {
    throw new AppError(404, 'NotFound', 'RESOURCE_NOT_FOUND', 'Service not found');
  }

  const isInternal = actor && ['ADMIN', 'MANAGER', 'STAFF'].includes(actor.systemRole);
  if (!isInternal && service.status !== 'ACTIVE') {
    throw new AppError(404, 'NotFound', 'RESOURCE_NOT_FOUND', 'Service not found');
  }

  const [enabledBranchCount, totalBranchCount] = await Promise.all([
    BranchServiceConfig.countDocuments({
      serviceId: service._id,
      enabled: true,
    }),
    Branch.countDocuments({ status: 'ACTIVE' }),
  ]);

  let branchConfig = null;
  let validBranchId = null;
  if (branchId && mongoose.Types.ObjectId.isValid(branchId)) {
    validBranchId = branchId;
    branchConfig = await BranchServiceConfig.findOne({ branchId, serviceId: service._id });
  }

  return formatServiceResponse(service, {
    enabledBranchCount,
    totalBranchCount,
    branchConfig,
    branchId: validBranchId,
  });
};

export const createService = async (data, actor = null) => {
  validateServiceGuardrails(data);

  let code = data.code;
  if (!code) {
    const seq = await getNextSequence('serviceCode');
    const prefix = data.serviceType === 'GROOMING' ? 'GRM' : 'MED';
    code = `${prefix}-${String(seq).padStart(6, '0')}`;
  }

  const { autoEnableActiveBranches = true, branchConfigs = [], ...servicePayload } = data;

  const service = new Service({
    ...servicePayload,
    code,
    status: data.status || 'ACTIVE',
  });

  const runWork = async (session) => {
    if (session) {
      await service.save({ session });
    } else {
      await service.save();
    }

    let enabledBranchCount = 0;
    const shouldAutoEnable = service.status === 'ACTIVE' && autoEnableActiveBranches !== false;

    if (shouldAutoEnable || (Array.isArray(branchConfigs) && branchConfigs.length > 0)) {
      const activeBranches = await Branch.find({ status: 'ACTIVE' }).select('_id').session(session).lean();
      const overrideMap = new Map();
      if (Array.isArray(branchConfigs)) {
        for (const cfg of branchConfigs) {
          if (cfg && cfg.branchId) {
            overrideMap.set(cfg.branchId.toString(), cfg);
          }
        }
      }

      const branchIdsToConfigure = new Set();
      if (shouldAutoEnable) {
        for (const b of activeBranches) {
          branchIdsToConfigure.add(b._id.toString());
        }
      }
      for (const [bId] of overrideMap.entries()) {
        branchIdsToConfigure.add(bId);
      }

      for (const bId of branchIdsToConfigure) {
        const override = overrideMap.get(bId);
        const isEnabled = override?.enabled !== undefined ? Boolean(override.enabled) : true;
        const capacity = override?.capacity !== undefined && Number.isInteger(Number(override.capacity)) && Number(override.capacity) >= 1
          ? Number(override.capacity)
          : 1;
        const availability = Array.isArray(override?.availability) ? override.availability : [];

        await BranchServiceConfig.findOneAndUpdate(
          { branchId: bId, serviceId: service._id },
          {
            $set: {
              enabled: isEnabled,
              capacity,
              availability,
            },
            $setOnInsert: {
              blockedWindows: [],
              version: 1,
            }
          },
          { upsert: true, new: true, session, runValidators: true }
        );

        if (isEnabled) enabledBranchCount += 1;
      }
    }

    return formatServiceResponse(service, enabledBranchCount);
  };

  if (mongoose.connection.readyState === 1 && typeof mongoose.startSession === 'function') {
    try {
      const session = await mongoose.startSession();
      try {
        let result;
        await session.withTransaction(async () => {
          result = await runWork(session);
        });
        return result;
      } catch (err) {
        if (err.message && (err.message.includes('replica set') || err.message.includes('Transaction numbers'))) {
          return await runWork(null);
        }
        throw err;
      } finally {
        await session.endSession();
      }
    } catch (err) {
      if (err.message && (err.message.includes('replica set') || err.message.includes('Transaction numbers'))) {
        return await runWork(null);
      }
      throw err;
    }
  }

  return runWork(null);
};

export const listServiceBranchConfigs = async (serviceId, actor = null) => {
  if (!mongoose.Types.ObjectId.isValid(serviceId)) {
    throw new AppError(404, 'NotFound', 'RESOURCE_NOT_FOUND', 'Service not found');
  }
  const service = await Service.findById(serviceId).lean();
  if (!service) {
    throw new AppError(404, 'NotFound', 'RESOURCE_NOT_FOUND', 'Service not found');
  }

  const branches = await Branch.find({}).sort({ name: 1 }).lean();
  const configs = await BranchServiceConfig.find({ serviceId }).lean();
  const configMap = new Map(configs.map((c) => [c.branchId.toString(), c]));

  const result = branches.map((b) => {
    const cfg = configMap.get(b._id.toString());
    return {
      branchId: b._id.toString(),
      branchName: b.name,
      branchCode: b.code,
      branchStatus: b.status,
      enabled: cfg ? Boolean(cfg.enabled) : false,
      capacity: cfg ? (cfg.capacity || 1) : 1,
      availability: cfg ? (cfg.availability || []) : [],
      blockedWindows: cfg ? (cfg.blockedWindows || []) : [],
      version: cfg ? cfg.version : 0
    };
  });

  return {
    serviceId: service._id.toString(),
    serviceName: service.name,
    configs: result
  };
};

export const updateService = async (id, data, actor = null) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(404, 'NotFound', 'RESOURCE_NOT_FOUND', 'Service not found');
  }

  const service = await Service.findById(id);
  if (!service) {
    throw new AppError(404, 'NotFound', 'RESOURCE_NOT_FOUND', 'Service not found');
  }

  validateServiceGuardrails(data, service);

  if (data.name !== undefined) service.name = data.name;
  if (data.serviceType !== undefined) service.serviceType = data.serviceType;
  if (data.category !== undefined) service.category = data.category;
  if (data.description !== undefined) service.description = data.description;
  if (data.basePrice !== undefined) service.basePrice = data.basePrice;
  if (data.priceVariants !== undefined) service.priceVariants = data.priceVariants;
  if (data.durationMinutes !== undefined) service.durationMinutes = data.durationMinutes;
  if (data.requiredStaffRole !== undefined) service.requiredStaffRole = data.requiredStaffRole;
  if (data.bookingMode !== undefined) service.bookingMode = data.bookingMode;
  if (data.defaultMaterials !== undefined) service.defaultMaterials = data.defaultMaterials;
  if (data.contactInfo !== undefined) service.contactInfo = data.contactInfo;
  if (data.status !== undefined) service.status = data.status;

  await service.save();

  const enabledBranchCount = await BranchServiceConfig.countDocuments({
    serviceId: service._id,
    enabled: true,
  });

  return formatServiceResponse(service, enabledBranchCount);
};

export const archiveService = async (id, actor = null) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(404, 'NotFound', 'RESOURCE_NOT_FOUND', 'Service not found');
  }

  const service = await Service.findById(id);
  if (!service) {
    throw new AppError(404, 'NotFound', 'RESOURCE_NOT_FOUND', 'Service not found');
  }

  service.status = 'INACTIVE';
  await service.save();

  // Side-effect: Deactivate all related BranchServiceConfigs
  await BranchServiceConfig.updateMany(
    { serviceId: service._id },
    { $set: { enabled: false } }
  );

  return formatServiceResponse(service, 0);
};

export const getServiceBranches = async (id, actor = null) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(404, 'NotFound', 'RESOURCE_NOT_FOUND', 'Service not found');
  }

  const service = await Service.findById(id);
  if (!service) {
    throw new AppError(404, 'NotFound', 'RESOURCE_NOT_FOUND', 'Service not found');
  }

  // Find all ACTIVE branches
  const branches = await Branch.find({ status: 'ACTIVE' }).sort({ name: 1 });
  const configs = await BranchServiceConfig.find({ serviceId: service._id });
  const configMap = new Map();
  configs.forEach((c) => configMap.set(c.branchId.toString(), c));

  const branchItems = branches.map((b) => {
    const config = configMap.get(b._id.toString());
    return {
      branchId: b._id.toString(),
      code: b.code,
      name: b.name,
      address: b.address,
      enabled: config ? Boolean(config.enabled) : false,
      capacity: config ? Number(config.capacity) : 1,
    };
  });

  const enabledBranchCount = branchItems.filter((b) => b.enabled).length;

  return {
    serviceId: service._id.toString(),
    enabledBranchCount,
    branches: branchItems,
  };
};
