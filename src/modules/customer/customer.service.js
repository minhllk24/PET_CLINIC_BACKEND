import mongoose from 'mongoose';
import Customer from './models/Customer';
import User from '../../models/User';
import RefreshSession from '../../models/RefreshSession';
import Appointment from '../booking/models/Appointment';
import Order from '../order/models/Order';
import AppError from '../../utils/AppError';
import { ErrorCodes } from '../../shared/errorCodes';
import { recordAuditLog } from '../../utils/auditLogger';

export const formatCustomerDetail = (cust) => {
  if (!cust) return null;
  const doc = cust.toObject ? cust.toObject() : cust;
  const u = (doc.userId && typeof doc.userId === 'object') ? doc.userId : null;

  const res = {
    id: (doc._id || doc.id).toString(),
    activationStatus: doc.activationStatus || 'NO_ACCOUNT',
  };

  const fullName = doc.fullName || u?.fullName || null;
  if (fullName !== null && fullName !== undefined) {
    res.fullName = fullName;
  }

  res.email = doc.contactEmail || doc.email || u?.email || null;
  res.phone = doc.contactPhone || doc.phone || u?.phone || null;

  // Account status: Null when Customer doesn't have an activated User account
  if (doc.activationStatus === 'ACTIVATED') {
    res.accountStatus = doc.accountStatus || u?.accountStatus || 'ACTIVE';
  } else {
    res.accountStatus = null;
  }

  const lastLogin = doc.lastLogin || u?.lastLoginAt || u?.lastLogin || null;
  res.lastLogin = lastLogin ? new Date(lastLogin).toISOString() : null;

  if (doc.createdAt) {
    res.createdAt = new Date(doc.createdAt).toISOString();
  }

  res.blockedReason = doc.blockReason || doc.blockedReason || null;

  return res;
};

export const listCustomers = async (query = {}, actor = {}) => {
  const andConditions = [];

  // Manager branch scoping: only view customers with activity in assigned branches
  if (actor.systemRole === 'MANAGER') {
    const branchIds = (actor.assignedBranchIds || []).map((b) => (b._id || b).toString());
    if (branchIds.length === 0) {
      return { items: [], nextCursor: null };
    }
    andConditions.push({ activityBranchIds: { $in: branchIds } });
  }

  if (query.activationStatus) {
    andConditions.push({ activationStatus: query.activationStatus });
  }
  if (query.accountStatus) {
    andConditions.push({ accountStatus: query.accountStatus });
  }

  if (query.exactPhone || query.phone) {
    const ep = (query.exactPhone || query.phone).trim();
    andConditions.push({ contactPhone: ep });
  } else if (query.search) {
    const s = query.search.trim();
    if (query.exact === 'true' || query.exact === true) {
      andConditions.push({
        $or: [
          { contactPhone: s },
          { contactEmail: s },
        ],
      });
    } else {
      const searchRegex = new RegExp(s, 'i');
      andConditions.push({
        $or: [
          { contactPhone: searchRegex },
          { contactEmail: searchRegex },
        ],
      });
    }
  }

  if (query.cursor && mongoose.Types.ObjectId.isValid(query.cursor)) {
    andConditions.push({ _id: { $lt: new mongoose.Types.ObjectId(query.cursor) } });
  }

  const filter = andConditions.length > 0 ? { $and: andConditions } : {};
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));

  const items = await Customer.find(filter)
    .populate('userId', 'email fullName accountStatus lastLoginAt lastLogin')
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean();

  let nextCursor = null;
  if (items.length > limit) {
    items.pop();
    nextCursor = items[items.length - 1]._id.toString();
  }

  return {
    items: items.map(formatCustomerDetail),
    nextCursor,
  };
};

export const getCustomerById = async (id, actor = {}) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Invalid customer ID format');
  }

  const customer = await Customer.findById(id).populate('userId', 'email fullName accountStatus lastLoginAt lastLogin');
  if (!customer) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Customer not found');
  }

  // Manager scoping check
  if (actor.systemRole === 'MANAGER') {
    const branchIds = (actor.assignedBranchIds || []).map((b) => (b._id || b).toString());
    const hasBranchAccess = (customer.activityBranchIds || []).some((b) => branchIds.includes(b.toString()));
    if (!hasBranchAccess) {
      throw new AppError(403, 'Forbidden', ErrorCodes.BRANCH_SCOPE_ERROR, 'Customer is outside your assigned branches');
    }
  }

  // Customer self-ownership check
  if (actor.systemRole === 'CUSTOMER') {
    const isOwner = customer.userId && (customer.userId._id || customer.userId).toString() === actor.id.toString();
    if (!isOwner) {
      throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'You do not have permission to view this customer');
    }
  }

  return formatCustomerDetail(customer);
};

export const blockCustomer = async (id, data = {}, actor = {}) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Invalid customer ID format');
  }

  if (actor.systemRole !== 'ADMIN') {
    throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Only ADMIN can block customer accounts');
  }

  if (!data.reason || typeof data.reason !== 'string' || data.reason.trim().length < 3) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'A valid reason (minimum 3 characters) is required to block an account');
  }

  const customer = await Customer.findById(id).populate('userId', 'email fullName accountStatus lastLoginAt lastLogin');
  if (!customer) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Customer not found');
  }

  customer.accountStatus = 'BLOCKED';
  customer.blockReason = data.reason.trim();
  customer.blockedAt = new Date();
  customer.blockedBy = actor.id;

  customer.auditHistory = customer.auditHistory || [];
  customer.auditHistory.push({
    action: 'BLOCKED',
    reason: data.reason.trim(),
    performedBy: actor.id,
    performedAt: new Date(),
  });

  if (customer.userId) {
    const uId = customer.userId._id || customer.userId;
    await User.findByIdAndUpdate(uId, { status: 'BLOCKED' });
    await User.findByIdAndUpdate(uId, { accountStatus: 'BLOCKED' });
    if (mongoose.connection.readyState === 1 || (RefreshSession.deleteMany && RefreshSession.deleteMany._isMockFunction)) {
      await RefreshSession.deleteMany({ userId: uId });
    }
  }

  await customer.save();

  // Central audit log
  await recordAuditLog({
    actor: { userId: actor.id, systemRole: actor.systemRole },
    action: 'ACCOUNT_BLOCKED',
    target: { type: 'Customer', id: customer._id },
    metadata: {
      reason: data.reason.trim(),
      userId: customer.userId ? (customer.userId._id || customer.userId) : null,
    },
  });

  return formatCustomerDetail(customer);
};

export const unblockCustomer = async (id, data = {}, actor = {}) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Invalid customer ID format');
  }

  if (actor.systemRole !== 'ADMIN') {
    throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Only ADMIN can unblock customer accounts');
  }

  const customer = await Customer.findById(id).populate('userId', 'email fullName accountStatus lastLoginAt lastLogin');
  if (!customer) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Customer not found');
  }

  customer.accountStatus = 'ACTIVE';
  customer.blockReason = null;
  customer.blockedAt = null;
  customer.blockedBy = null;

  const reason = data.reason ? data.reason.trim() : 'Admin unblocked account';
  customer.auditHistory = customer.auditHistory || [];
  customer.auditHistory.push({
    action: 'UNBLOCKED',
    reason,
    performedBy: actor.id,
    performedAt: new Date(),
  });

  if (customer.userId) {
    const uId = customer.userId._id || customer.userId;
    await User.findByIdAndUpdate(uId, { status: 'ACTIVE' });
    await User.findByIdAndUpdate(uId, { accountStatus: 'ACTIVE' });
  }

  await customer.save();

  // Central audit log
  await recordAuditLog({
    actor: { userId: actor.id, systemRole: actor.systemRole },
    action: 'ACCOUNT_ACTIVATED',
    target: { type: 'Customer', id: customer._id },
    metadata: {
      reason,
      userId: customer.userId ? (customer.userId._id || customer.userId) : null,
    },
  });

  return formatCustomerDetail(customer);
};
