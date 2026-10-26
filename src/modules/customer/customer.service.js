import mongoose from 'mongoose';
import Customer from './models/Customer';
import User from '../../models/User';
import Appointment from '../booking/models/Appointment';
import Order from '../order/models/Order';
import AppError from '../../utils/AppError';
import { ErrorCodes } from '../../shared/errorCodes';

export const formatCustomerDetail = (cust) => {
  if (!cust) return null;
  const doc = cust.toObject ? cust.toObject() : cust;
  const u = (doc.userId && typeof doc.userId === 'object') ? doc.userId : null;

  const res = {
    id: (doc._id || doc.id).toString(),
    activationStatus: doc.activationStatus || 'NO_ACCOUNT',
  };

  const fullName = doc.fullName || u?.fullName || null;
  if (fullName) {
    res.fullName = fullName;
  }

  const email = doc.contactEmail || doc.email || u?.email || null;
  if (email !== undefined) {
    res.email = email;
  }

  const phone = doc.contactPhone || doc.phone || u?.phone || null;
  if (phone !== undefined) {
    res.phone = phone;
  }

  // Account status: Null when Customer doesn't have an activated User account
  if (doc.activationStatus === 'ACTIVATED') {
    res.accountStatus = doc.accountStatus || 'ACTIVE';
  } else {
    res.accountStatus = null;
  }

  const lastLogin = doc.lastLogin || u?.lastLogin || null;
  if (lastLogin !== undefined) {
    res.lastLogin = lastLogin ? new Date(lastLogin).toISOString() : null;
  }

  if (doc.createdAt) {
    res.createdAt = new Date(doc.createdAt).toISOString();
  }

  const blockedReason = doc.blockReason || doc.blockedReason || null;
  if (blockedReason !== undefined) {
    res.blockedReason = blockedReason;
  }

  return res;
};

export const listCustomers = async (query = {}, actor = {}) => {
  const filter = {};

  // Manager branch scoping
  if (actor.systemRole === 'MANAGER') {
    const branchIds = (actor.assignedBranchIds || []).map(b => b.toString());
    if (branchIds.length > 0) {
      filter.$or = [
        { activityBranchIds: { $in: branchIds } },
      ];
    }
  }

  if (query.activationStatus) {
    filter.activationStatus = query.activationStatus;
  }
  if (query.accountStatus) {
    filter.accountStatus = query.accountStatus;
  }

  if (query.search) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = filter.$or || [];
    filter.$or.push(
      { contactPhone: searchRegex },
      { contactEmail: searchRegex }
    );
  }

  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));

  const items = await Customer.find(filter)
    .populate('userId', 'email fullName status lastLogin')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return {
    items: items.map(formatCustomerDetail),
    nextCursor: null,
  };
};

export const getCustomerById = async (id, actor = {}) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Invalid customer ID format');
  }

  const customer = await Customer.findById(id).populate('userId', 'email fullName status lastLogin');
  if (!customer) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Customer not found');
  }

  // Manager scoping check
  if (actor.systemRole === 'MANAGER' && actor.assignedBranchIds && actor.assignedBranchIds.length > 0) {
    const branchIds = actor.assignedBranchIds.map(String);
    const hasBranchAccess = (customer.activityBranchIds || []).some(b => branchIds.includes(b.toString()));
    if (!hasBranchAccess && customer.activityBranchIds && customer.activityBranchIds.length > 0) {
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

  if (!data.reason || typeof data.reason !== 'string' || data.reason.trim().length === 0) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'A reason is required to block an account');
  }

  const customer = await Customer.findById(id).populate('userId', 'email fullName status lastLogin');
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
    await User.findByIdAndUpdate(customer.userId._id || customer.userId, { status: 'BLOCKED' });
  }

  await customer.save();
  return formatCustomerDetail(customer);
};

export const unblockCustomer = async (id, data = {}, actor = {}) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Invalid customer ID format');
  }

  if (actor.systemRole !== 'ADMIN') {
    throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Only ADMIN can unblock customer accounts');
  }

  const customer = await Customer.findById(id).populate('userId', 'email fullName status lastLogin');
  if (!customer) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Customer not found');
  }

  customer.accountStatus = 'ACTIVE';
  customer.blockReason = null;
  customer.blockedAt = null;
  customer.blockedBy = null;

  customer.auditHistory = customer.auditHistory || [];
  customer.auditHistory.push({
    action: 'UNBLOCKED',
    reason: data.reason ? data.reason.trim() : 'Admin unblocked account',
    performedBy: actor.id,
    performedAt: new Date(),
  });

  if (customer.userId) {
    await User.findByIdAndUpdate(customer.userId._id || customer.userId, { status: 'ACTIVE' });
  }

  await customer.save();
  return formatCustomerDetail(customer);
};
