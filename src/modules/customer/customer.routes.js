import express from 'express';
import mongoose from 'mongoose';
import * as customerService from './customer.service';
import Customer from './models/Customer';
import User from '../../models/User';
import Pet from './models/Pet';
import { requireRole, optionalAuth } from '../../shared/authMiddleware';
import { idempotency } from '../../middleware/idempotencyMiddleware';

const router = express.Router();

// List Customers (Admin, Manager)
router.get('/', requireRole(['ADMIN', 'MANAGER']), async (req, res, next) => {
  try {
    const result = await customerService.listCustomers(req.query, req.actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Update Customer / User profile (Self, Admin, Manager)
router.put('/:id', optionalAuth, async (req, res, next) => {
  try {
    const rawId = req.params.id;
    let customer = null;
    let user = null;
    if (mongoose.Types.ObjectId.isValid(rawId)) {
      customer = await Customer.findById(rawId);
      if (!customer) {
        user = await User.findById(rawId);
        if (user) customer = await Customer.findOne({ userId: user._id });
      } else if (customer.userId) {
        user = await User.findById(customer.userId);
      }
    }
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
      if (phone) customer.contactPhone = phone;
      if (email) customer.contactEmail = email;
      await customer.save();
    }

    res.json({
      success: true,
      data: {
        userId: user ? user._id.toString() : rawId,
        id: customer ? customer._id.toString() : rawId,
        fullName: fullName || user?.fullName || 'Khách hàng',
        phone: phone || user?.phone || customer?.contactPhone || '',
        email: email || user?.email || customer?.contactEmail || '',
        avatarUrl: avatarUrl || user?.avatarUrl || '',
      },
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', optionalAuth, async (req, res, next) => {
  try {
    const rawId = req.params.id;
    let customer = null;
    let user = null;
    if (mongoose.Types.ObjectId.isValid(rawId)) {
      customer = await Customer.findById(rawId);
      if (!customer) {
        user = await User.findById(rawId);
        if (user) customer = await Customer.findOne({ userId: user._id });
      } else if (customer.userId) {
        user = await User.findById(customer.userId);
      }
    }
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
      if (phone) customer.contactPhone = phone;
      if (email) customer.contactEmail = email;
      await customer.save();
    }

    res.json({
      success: true,
      data: {
        userId: user ? user._id.toString() : rawId,
        id: customer ? customer._id.toString() : rawId,
        fullName: fullName || user?.fullName || 'Khách hàng',
        phone: phone || user?.phone || customer?.contactPhone || '',
        email: email || user?.email || customer?.contactEmail || '',
        avatarUrl: avatarUrl || user?.avatarUrl || '',
      },
    });
  } catch (error) {
    next(error);
  }
});

// Addresses CRUD for customer
router.get('/:id/addresses', optionalAuth, async (req, res, next) => {
  try {
    const rawId = req.params.id;
    let user = null;
    if (mongoose.Types.ObjectId.isValid(rawId)) {
      user = await User.findById(rawId);
      if (!user) {
        const cust = await Customer.findById(rawId);
        if (cust && cust.userId) user = await User.findById(cust.userId);
      }
    }
    res.json({ success: true, data: user?.addresses || [] });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/addresses', optionalAuth, async (req, res, next) => {
  try {
    const rawId = req.params.id;
    let user = null;
    if (mongoose.Types.ObjectId.isValid(rawId)) {
      user = await User.findById(rawId);
      if (!user) {
        const cust = await Customer.findById(rawId);
        if (cust && cust.userId) user = await User.findById(cust.userId);
      }
    }
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

import { listPetsHandler, createPetHandler } from './pet.routes';

// Pets (Admin, Manager, Staff, Customer own)
router.get('/:customerId/pets', optionalAuth, listPetsHandler);
router.get('/:id/pets', optionalAuth, listPetsHandler);
router.post('/:customerId/pets', optionalAuth, createPetHandler);
router.post('/:id/pets', optionalAuth, createPetHandler);

export default router;
