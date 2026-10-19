import mongoose from 'mongoose';
import Voucher from './models/Voucher';
import VoucherUsage from './models/VoucherUsage';
import AppError from '../../utils/AppError';
import { ErrorCodes } from '../../shared/errorCodes';

/**
 * Format a Voucher Mongoose document to strictly match OpenAPI 3.1 Voucher schema
 * (Enforces additionalProperties: false compatibility)
 */
export const formatVoucherResponse = (voucher) => {
  if (!voucher) return null;
  const doc = voucher.toObject ? voucher.toObject() : voucher;
  return {
    id: (doc._id || doc.id).toString(),
    code: doc.code,
    name: doc.name,
    discountType: doc.discountType,
    discountValue: Number(doc.discountValue),
    scope: doc.scope,
    effectiveFrom: new Date(doc.effectiveFrom).toISOString(),
    effectiveTo: new Date(doc.effectiveTo).toISOString(),
    quota: Number(doc.quota),
    usedCount: Number(doc.usedCount || 0),
    status: doc.status
  };
};

/**
 * Pure calculation helper for voucher discount
 */
export const calculateDiscount = ({ voucher, subtotal }) => {
  if (!voucher || !subtotal || subtotal <= 0) return 0;

  let discount = 0;
  if (voucher.discountType === 'PERCENTAGE') {
    discount = Math.round((subtotal * voucher.discountValue) / 100);
    if (voucher.maxDiscountAmount && discount > voucher.maxDiscountAmount) {
      discount = voucher.maxDiscountAmount;
    }
  } else if (voucher.discountType === 'FIXED') {
    discount = Math.min(voucher.discountValue, subtotal);
  }

  return Math.max(0, Math.min(discount, subtotal));
};

/**
 * Validate voucher eligibility without consuming quota
 */
export const validateVoucherEligibility = async ({
  code,
  scope,
  subtotal = 0,
  cartId,
  serviceIds,
  branchId,
  customerId
}) => {
  if (!code || typeof code !== 'string') {
    return {
      code: code || '',
      valid: false,
      reason: 'NOT_FOUND',
      discount: 0,
      voucher: null
    };
  }

  const cleanCode = code.trim().toUpperCase();
  const voucher = await Voucher.findOne({ code: cleanCode });

  if (!voucher) {
    return {
      code: cleanCode,
      valid: false,
      reason: 'NOT_FOUND',
      discount: 0,
      voucher: null
    };
  }

  if (voucher.status !== 'ACTIVE') {
    return {
      code: cleanCode,
      valid: false,
      reason: 'INACTIVE',
      discount: 0,
      voucher
    };
  }

  const now = new Date();
  if (now < new Date(voucher.effectiveFrom)) {
    return {
      code: cleanCode,
      valid: false,
      reason: 'NOT_STARTED',
      discount: 0,
      voucher
    };
  }

  if (now > new Date(voucher.effectiveTo)) {
    return {
      code: cleanCode,
      valid: false,
      reason: 'EXPIRED',
      discount: 0,
      voucher
    };
  }

  if (voucher.usedCount >= voucher.quota) {
    return {
      code: cleanCode,
      valid: false,
      reason: 'QUOTA_EXCEEDED',
      discount: 0,
      voucher
    };
  }

  // Scope check:
  // - ORDER scope can apply to orders
  // - SERVICE scope can apply to appointments
  // - If voucher is PRODUCT, it applies only to orders with products
  if (scope) {
    const isOrderScope = scope === 'ORDER' && (voucher.scope === 'ORDER' || voucher.scope === 'PRODUCT');
    const isServiceScope = scope === 'SERVICE' && (voucher.scope === 'SERVICE' || voucher.scope === 'ORDER');
    if (!isOrderScope && !isServiceScope) {
      return {
        code: cleanCode,
        valid: false,
        reason: 'SCOPE_MISMATCH',
        discount: 0,
        voucher
      };
    }
  }

  // Minimum spending condition check
  if (voucher.minOrderAmount && subtotal < voucher.minOrderAmount) {
    return {
      code: cleanCode,
      valid: false,
      reason: 'MIN_CONDITION_NOT_MET',
      discount: 0,
      voucher
    };
  }

  const discount = calculateDiscount({ voucher, subtotal });

  return {
    code: cleanCode,
    valid: true,
    reason: null,
    discount,
    voucher
  };
};

/**
 * Atomically consume voucher quota within a Mongoose transaction session
 */
export const consumeQuotaInSession = async ({
  voucherId,
  targetType,
  targetId,
  discountApplied = 0,
  session
}) => {
  if (!voucherId || !targetType || !targetId || !session) {
    throw new AppError(400, 'Bad Request', ErrorCodes.VALIDATION_ERROR, 'Invalid parameters for quota consumption');
  }

  // Atomic condition: must be ACTIVE and usedCount must be strictly less than quota
  const filter = {
    _id: voucherId,
    status: 'ACTIVE',
    $expr: { $lt: ['$usedCount', '$quota'] }
  };

  const update = {
    $inc: { usedCount: 1 }
  };

  const updatedVoucher = await Voucher.findOneAndUpdate(filter, update, { session, new: true });
  if (!updatedVoucher) {
    throw new AppError(
      422,
      'Unprocessable Entity',
      ErrorCodes.VOUCHER_INVALID,
      'QUOTA_EXCEEDED'
    );
  }

  const usage = new VoucherUsage({
    voucherId,
    targetType,
    targetId,
    discountApplied,
    consumedAt: new Date(),
    restoredAt: null
  });

  await usage.save({ session });
  return usage;
};

/**
 * Atomically and idempotently restore voucher quota within a Mongoose transaction session
 */
export const restoreQuotaInSession = async ({
  voucherId,
  targetType,
  targetId,
  session
}) => {
  if (!voucherId || !targetType || !targetId || !session) {
    return null;
  }

  // Idempotent search: must not have been restored yet
  const usage = await VoucherUsage.findOne({
    voucherId,
    targetType,
    targetId,
    restoredAt: null
  }).session(session);

  if (!usage) {
    return null; // Already restored or usage never recorded
  }

  usage.restoredAt = new Date();
  await usage.save({ session });

  await Voucher.findByIdAndUpdate(
    voucherId,
    { $inc: { usedCount: -1 } },
    { session }
  );

  return usage;
};

/**
 * Admin: Create a new voucher
 */
export const createVoucher = async (data) => {
  const code = (data.code || '').trim().toUpperCase();
  if (!code) {
    throw new AppError(400, 'Bad Request', ErrorCodes.VALIDATION_ERROR, 'Voucher code is required');
  }

  const existing = await Voucher.findOne({ code });
  if (existing) {
    throw new AppError(409, 'Conflict', ErrorCodes.CONFLICT, `Voucher code ${code} already exists`);
  }

  const effectiveFrom = new Date(data.effectiveFrom);
  const effectiveTo = new Date(data.effectiveTo);
  if (isNaN(effectiveFrom.getTime()) || isNaN(effectiveTo.getTime()) || effectiveTo <= effectiveFrom) {
    throw new AppError(422, 'Unprocessable Entity', ErrorCodes.VALIDATION_ERROR, 'effectiveTo must be strictly greater than effectiveFrom');
  }

  if (Number(data.quota) < 1) {
    throw new AppError(400, 'Bad Request', ErrorCodes.VALIDATION_ERROR, 'Quota must be at least 1');
  }

  if (Number(data.discountValue) < 0) {
    throw new AppError(400, 'Bad Request', ErrorCodes.VALIDATION_ERROR, 'discountValue must be non-negative');
  }

  const voucher = new Voucher({
    code,
    name: data.name.trim(),
    discountType: data.discountType,
    discountValue: Number(data.discountValue),
    scope: data.scope,
    scopeRefs: data.scopeRefs || [],
    effectiveFrom,
    effectiveTo,
    quota: Number(data.quota),
    usedCount: 0,
    status: data.status || 'ACTIVE',
    minOrderAmount: data.minOrderAmount || 0,
    maxDiscountAmount: data.maxDiscountAmount
  });

  await voucher.save();
  return formatVoucherResponse(voucher);
};

/**
 * Admin: Update an existing voucher
 */
export const updateVoucher = async (id, data) => {
  const voucher = await Voucher.findById(id);
  if (!voucher) {
    throw new AppError(404, 'Not Found', ErrorCodes.NOT_FOUND, 'Voucher not found');
  }

  // Rule Option A: Cannot reduce quota below current usedCount
  if (data.quota !== undefined) {
    const newQuota = Number(data.quota);
    if (newQuota < voucher.usedCount) {
      throw new AppError(
        422,
        'Unprocessable Entity',
        ErrorCodes.VALIDATION_ERROR,
        `Cannot reduce quota to ${newQuota} because ${voucher.usedCount} vouchers have already been used`
      );
    }
    voucher.quota = newQuota;
  }

  if (data.code !== undefined) {
    const newCode = data.code.trim().toUpperCase();
    if (newCode !== voucher.code) {
      const existing = await Voucher.findOne({ code: newCode, _id: { $ne: voucher._id } });
      if (existing) {
        throw new AppError(409, 'Conflict', ErrorCodes.CONFLICT, `Voucher code ${newCode} already exists`);
      }
      voucher.code = newCode;
    }
  }

  if (data.name !== undefined) voucher.name = data.name.trim();
  if (data.discountType !== undefined) voucher.discountType = data.discountType;
  if (data.discountValue !== undefined) voucher.discountValue = Number(data.discountValue);
  if (data.scope !== undefined) voucher.scope = data.scope;
  if (data.status !== undefined) voucher.status = data.status;
  if (data.minOrderAmount !== undefined) voucher.minOrderAmount = Number(data.minOrderAmount);
  if (data.maxDiscountAmount !== undefined) voucher.maxDiscountAmount = Number(data.maxDiscountAmount);

  if (data.effectiveFrom !== undefined) voucher.effectiveFrom = new Date(data.effectiveFrom);
  if (data.effectiveTo !== undefined) voucher.effectiveTo = new Date(data.effectiveTo);

  if (voucher.effectiveTo <= voucher.effectiveFrom) {
    throw new AppError(422, 'Unprocessable Entity', ErrorCodes.VALIDATION_ERROR, 'effectiveTo must be strictly greater than effectiveFrom');
  }

  await voucher.save();
  return formatVoucherResponse(voucher);
};

/**
 * Admin / Manager: List vouchers
 */
export const listVouchers = async ({ status, scope, limit = 20, cursor }) => {
  const query = {};
  if (status) query.status = status;
  if (scope) query.scope = scope;
  if (cursor) {
    try {
      query._id = { $gt: new mongoose.Types.ObjectId(cursor) };
    } catch (e) {
      // Ignore invalid cursor
    }
  }

  const parsedLimit = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
  const items = await Voucher.find(query).sort({ _id: 1 }).limit(parsedLimit + 1);

  let nextCursor = null;
  if (items.length > parsedLimit) {
    const nextItem = items.pop();
    nextCursor = items[items.length - 1]._id.toString();
  }

  return {
    items: items.map(formatVoucherResponse),
    nextCursor
  };
};

/**
 * Admin / Manager: Get voucher details by ID
 */
export const getVoucherById = async (id) => {
  const voucher = await Voucher.findById(id);
  if (!voucher) {
    throw new AppError(404, 'Not Found', ErrorCodes.NOT_FOUND, 'Voucher not found');
  }
  return formatVoucherResponse(voucher);
};
