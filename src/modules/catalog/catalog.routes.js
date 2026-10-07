import express from 'express';
import Service from './models/Service';
import Category from './models/Category';
import Product from './models/Product';

const router = express.Router();

// Services
router.get('/services', async (req, res, next) => {
  try {
    const items = await Service.find({ status: 'ACTIVE' });
    res.json(items);
  } catch (error) { next(error); }
});

router.post('/services', async (req, res, next) => {
  try {
    const item = new Service(req.body);
    await item.save();
    res.status(201).json(item);
  } catch (error) { next(error); }
});

// Categories
router.get('/categories', async (req, res, next) => {
  try {
    const items = await Category.find({ status: 'ACTIVE' });
    res.json(items);
  } catch (error) { next(error); }
});

// Products
router.get('/products', async (req, res, next) => {
  try {
    const items = await Product.find({ status: 'ACTIVE' });
    res.json(items);
  } catch (error) { next(error); }
});

export default router;
