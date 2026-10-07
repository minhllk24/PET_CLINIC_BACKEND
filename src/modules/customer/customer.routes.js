import express from 'express';
import Customer from './models/Customer';
import Pet from './models/Pet';

const router = express.Router();

// Customers
router.get('/', async (req, res, next) => {
  try {
    const customers = await Customer.find();
    res.json(customers);
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const customer = new Customer(req.body);
    await customer.save();
    res.status(201).json(customer);
  } catch (error) { next(error); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Not found' });
    res.json(customer);
  } catch (error) { next(error); }
});

// Pets
router.get('/:customerId/pets', async (req, res, next) => {
  try {
    const pets = await Pet.find({ customerId: req.params.customerId });
    res.json(pets);
  } catch (error) { next(error); }
});

router.post('/:customerId/pets', async (req, res, next) => {
  try {
    const pet = new Pet({ ...req.body, customerId: req.params.customerId });
    await pet.save();
    res.status(201).json(pet);
  } catch (error) { next(error); }
});

export default router;
