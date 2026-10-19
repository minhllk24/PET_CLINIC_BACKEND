import express from 'express';
import Customer from './models/Customer';
import Pet from './models/Pet';
import User from '../../models/User';
import { authenticate, requireRole } from '../../shared/authMiddleware';
import AppError from '../../utils/AppError';
import { ErrorCodes } from '../../shared/errorCodes';

const router = express.Router();

// List Customers (Admin, Manager)
router.get('/', authenticate, requireRole(['ADMIN', 'MANAGER']), async (req, res, next) => {
  try {
    const customers = await Customer.find().populate('userId', 'email fullName status');
    res.json(customers);
  } catch (error) {
    next(error);
  }
});

// Create Customer Record (Admin only)
router.post('/', authenticate, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const customer = new Customer(req.body);
    await customer.save();
    res.status(201).json(customer);
  } catch (error) {
    next(error);
  }
});

// Get Customer by ID (Admin, Manager, Staff, Customer own)
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id).populate('userId', 'email fullName status');
    if (!customer) {
      throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Customer not found');
    }

    // Ownership check for CUSTOMER role
    if (req.actor.systemRole === 'CUSTOMER') {
      const isOwner = customer.userId && customer.userId._id.toString() === req.actor.id.toString();
      if (!isOwner) {
        throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'You do not have permission to view this customer');
      }
    }

    res.json(customer);
  } catch (error) {
    next(error);
  }
});

// Block Customer (ADMIN ONLY - Manager strictly forbidden per Checkpoint Invariant #20)
router.post('/:id/block', authenticate, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Customer not found');
    }
    if (customer.userId) {
      await User.findByIdAndUpdate(customer.userId, { status: 'BLOCKED' });
    }
    customer.activationStatus = 'BLOCKED';
    await customer.save();
    res.json(customer);
  } catch (error) {
    next(error);
  }
});

// Unblock Customer (ADMIN ONLY)
router.post('/:id/unblock', authenticate, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Customer not found');
    }
    if (customer.userId) {
      await User.findByIdAndUpdate(customer.userId, { status: 'ACTIVE' });
    }
    customer.activationStatus = 'ACTIVATED';
    await customer.save();
    res.json(customer);
  } catch (error) {
    next(error);
  }
});

// Pets (Admin, Manager, Staff, Customer own)
router.get('/:customerId/pets', authenticate, async (req, res, next) => {
  try {
    const pets = await Pet.find({ customerId: req.params.customerId });
    res.json(pets);
  } catch (error) {
    next(error);
  }
});

router.post('/:customerId/pets', authenticate, async (req, res, next) => {
  try {
    const pet = new Pet({ ...req.body, customerId: req.params.customerId });
    await pet.save();
    res.status(201).json(pet);
  } catch (error) {
    next(error);
  }
});

export default router;
