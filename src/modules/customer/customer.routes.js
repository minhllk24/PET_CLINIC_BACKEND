import express from 'express';
import * as customerService from './customer.service';
import Pet from './models/Pet';
import { requireRole } from '../../shared/authMiddleware';
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

// Pets (Admin, Manager, Staff, Customer own)
const listPets = async (req, res, next) => {
  try {
    const customerId = req.params.customerId || req.params.id;
    const pets = await Pet.find({ customerId });
    res.json(pets);
  } catch (error) {
    next(error);
  }
};

const createPet = async (req, res, next) => {
  try {
    const customerId = req.params.customerId || req.params.id;
    const pet = new Pet({ ...req.body, customerId });
    await pet.save();
    res.status(201).json(pet);
  } catch (error) {
    next(error);
  }
};

router.get('/:customerId/pets', requireRole(['ADMIN', 'MANAGER', 'STAFF', 'CUSTOMER']), listPets);
router.get('/:id/pets', requireRole(['ADMIN', 'MANAGER', 'STAFF', 'CUSTOMER']), listPets);
router.post('/:customerId/pets', requireRole(['ADMIN', 'MANAGER', 'STAFF', 'CUSTOMER']), createPet);
router.post('/:id/pets', requireRole(['ADMIN', 'MANAGER', 'STAFF', 'CUSTOMER']), createPet);

export default router;
