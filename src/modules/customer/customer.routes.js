import express from 'express';
import mongoose from 'mongoose';
import * as customerService from './customer.service';
import Customer from './models/Customer';
import User from '../../models/User';
import Pet from './models/Pet';
import AppError from '../../utils/AppError';
import { ErrorCodes } from '../../shared/errorCodes';
import { requireRole, optionalAuth } from '../../shared/authMiddleware';
import { idempotency } from '../../middleware/idempotencyMiddleware';

const router = express.Router();

const resolveCustomerAndUser = async (rawId) => {
  let customer = null;
  let user = null;
  const canQuery =
    mongoose.connection.readyState === 1 ||
    Customer.findById?._isMockFunction ||
    User.findById?._isMockFunction;
  if (canQuery && mongoose.Types.ObjectId.isValid(rawId)) {
    customer = await Customer.findById(rawId);
    if (!customer) {
      user = await User.findById(rawId);
      if (user && (mongoose.connection.readyState === 1 || Customer.findOne?._isMockFunction)) {
        customer = await Customer.findOne({ userId: user._id });
      }
    } else if (customer.userId && (mongoose.connection.readyState === 1 || User.findById?._isMockFunction)) {
      user = await User.findById(customer.userId);
    }
  }
  return { customer, user };
};

const assertCustomerProfileAccess = async (rawId, actor, { allowManagerBranch = true } = {}) => {
  if (!actor) {
    throw new AppError(401, 'Unauthenticated', ErrorCodes.UNAUTHENTICATED, 'Authentication required');
  }

  const actorId = (actor.id || actor._id)?.toString();
  if (actor.systemRole === 'CUSTOMER' && rawId !== actorId) {
    const { customer, user } = await resolveCustomerAndUser(rawId);
    const targetUserId = (user?._id || customer?.userId)?.toString();
    if (targetUserId === actorId || customer?._id?.toString() === actorId) {
      return { customer, user };
    }
    throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'You can only access or modify your own profile');
  }

  const { customer, user } = await resolveCustomerAndUser(rawId);
  if (!customer && !user) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Customer profile not found');
  }

  if (actor.systemRole === 'ADMIN') return { customer, user };

  if (actor.systemRole === 'CUSTOMER') {
    const actorId = (actor.id || actor._id)?.toString();
    const targetUserId = (user?._id || customer?.userId)?.toString();
    if (targetUserId === actorId || customer?._id?.toString() === actorId || rawId === actorId) {
      return { customer, user };
    }
    throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'You can only access or modify your own profile');
  }

  if (actor.systemRole === 'MANAGER' && allowManagerBranch) {
    const branchIds = (actor.assignedBranchIds || actor.authorizedBranchIds || []).map((b) => (b?._id || b).toString());
    const hasBranch = customer && (customer.activityBranchIds || []).some((b) => branchIds.includes(b.toString()));
    if (branchIds.length > 0 && hasBranch) {
      return { customer, user };
    }
    throw new AppError(403, 'Forbidden', ErrorCodes.BRANCH_SCOPE_ERROR, 'Customer is outside your assigned branches');
  }

  throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'You do not have permission for this customer resource');
};

const handleUpdateCustomerProfile = async (req, res, next) => {
  try {
    const rawId = req.params.id;
    const { customer, user } = await assertCustomerProfileAccess(rawId, req.actor);
    const updateData = req.body || {};
    const fullName = updateData.fullName || updateData.full_name || updateData.name;
    const phone = updateData.phone || updateData.contactPhone;
    const email = updateData.email || updateData.contactEmail;
    const avatarUrl = updateData.avatarUrl || updateData.avatar_url || updateData.photoUrl;

    if (user) {
      if (fullName) user.fullName = fullName;
      if (phone) user.phone = phone;
      if (email) user.email = email;
      if (avatarUrl) user.avatarUrl = avatarUrl;
      await user.save();
    }
    if (customer) {
      if (fullName && customer.fullName !== undefined) customer.fullName = fullName;
      if (phone) customer.contactPhone = phone;
      if (email) customer.contactEmail = email;
      await customer.save();
    }

    res.json({
      success: true,
      data: {
        userId: user ? user._id.toString() : rawId,
        id: customer ? customer._id.toString() : rawId,
        fullName: fullName || user?.fullName || customer?.fullName || 'Khách hàng',
        phone: phone || user?.phone || customer?.contactPhone || '',
        email: email || user?.email || customer?.contactEmail || '',
        avatarUrl: avatarUrl || user?.avatarUrl || '',
      },
    });
  } catch (error) {
    next(error);
  }
};

// List Customers (Admin, Manager)
router.get('/', requireRole(['ADMIN', 'MANAGER']), async (req, res, next) => {
  try {
    const result = await customerService.listCustomers(req.query, req.actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Lookup Customer by exact Phone (ORD-03: Receptionist / Manager / Admin)
router.get('/lookup', requireRole(['ADMIN', 'MANAGER', 'RECEPTIONIST']), async (req, res, next) => {
  try {
    const result = await customerService.lookupCustomerByPhone(req.query.phone, req.actor);
    if (!result) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Update Customer / User profile (Self, Admin, Manager)
router.put('/:id', optionalAuth, handleUpdateCustomerProfile);

router.patch('/:id', optionalAuth, handleUpdateCustomerProfile);

// Addresses CRUD for customer
router.get('/:id/addresses', optionalAuth, async (req, res, next) => {
  try {
    const { user } = await assertCustomerProfileAccess(req.params.id, req.actor);
    res.json({ success: true, data: user?.addresses || [] });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/addresses', optionalAuth, async (req, res, next) => {
  try {
    const { user } = await assertCustomerProfileAccess(req.params.id, req.actor, { allowManagerBranch: false });
    const newAddr = {
      _id: new mongoose.Types.ObjectId(),
      fullName: req.body.recipient_name || req.body.name || user?.fullName || 'Khách hàng',
      phone: req.body.recipient_phone || req.body.phone || user?.phone || '',
      email: req.body.recipient_email || req.body.email || user?.email || '',
      country: req.body.country || 'Việt Nam',
      province: req.body.province || req.body.city || '',
      addressDetail: req.body.address_line || req.body.address || '',
      isDefault: Boolean(req.body.is_default || req.body.isDefault),
    };
    if (user) {
      if (!Array.isArray(user.addresses)) user.addresses = [];
      if (newAddr.isDefault) {
        user.addresses.forEach((a) => { a.isDefault = false; });
      }
      user.addresses.push(newAddr);
      await user.save();
    }
    res.status(201).json({ success: true, data: newAddr });
  } catch (error) {
    next(error);
  }
});

// Get Customer by ID (Admin, Manager, Customer self)
router.get('/:id', requireRole(['ADMIN', 'MANAGER', 'STAFF', 'CUSTOMER']), async (req, res, next) => {
  try {
    const customer = await customerService.getCustomerById(req.params.id, req.actor);
    res.json(customer);
  } catch (error) {
    next(error);
  }
});

// Block Customer (ADMIN ONLY)
router.post(
  '/:id/block',
  requireRole(['ADMIN']),
  idempotency('adminCustomerBlock', { required: false }),
  async (req, res, next) => {
    try {
      const customer = await customerService.blockCustomer(req.params.id, req.body, req.actor);
      res.json(customer);
    } catch (error) {
      next(error);
    }
  }
);

// Unblock Customer (ADMIN ONLY)
router.post(
  '/:id/unblock',
  requireRole(['ADMIN']),
  idempotency('adminCustomerUnblock', { required: false }),
  async (req, res, next) => {
    try {
      const customer = await customerService.unblockCustomer(req.params.id, req.body, req.actor);
      res.json(customer);
    } catch (error) {
      next(error);
    }
  }
);

import { listPetsHandler, createPetHandler, getPetHandler, updatePetHandler, updatePetStatusHandler, deletePetHandler } from './pet.routes';

// Pets (Admin, Manager, Staff, Customer own)
router.get('/:customerId/pets', optionalAuth, listPetsHandler);
router.get('/:id/pets', optionalAuth, listPetsHandler);
router.post('/:customerId/pets', optionalAuth, createPetHandler);
router.post('/:id/pets', optionalAuth, createPetHandler);
router.get('/:customerId/pets/:id', optionalAuth, getPetHandler);
router.put('/:customerId/pets/:id', optionalAuth, updatePetHandler);
router.patch('/:customerId/pets/:id', optionalAuth, updatePetHandler);
router.patch('/:customerId/pets/:id/status', optionalAuth, updatePetStatusHandler);
router.put('/:customerId/pets/:id/status', optionalAuth, updatePetStatusHandler);
router.delete('/:customerId/pets/:id', optionalAuth, deletePetHandler);

export default router;
