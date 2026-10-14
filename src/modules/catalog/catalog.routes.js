import express from 'express';
import * as catalogController from './catalog.controller';
import Service from './models/Service';
import { optionalAuth, requireRole } from '../../shared/authMiddleware';
import { idempotency } from '../../middleware/idempotencyMiddleware';

const router = express.Router();

// ================= CATEGORIES =================
router.get('/categories', optionalAuth, catalogController.listCategories);
router.post('/categories', requireRole(['ADMIN']), idempotency('categoriesCreate'), catalogController.createCategory);

router.get('/categories/:id', optionalAuth, catalogController.getCategoryById);
router.patch('/categories/:id', requireRole(['ADMIN']), catalogController.updateCategory);
router.post('/categories/:id/archive', requireRole(['ADMIN']), idempotency('categoriesArchive'), catalogController.archiveCategory);

// ================= PRODUCTS =================
router.get('/products', optionalAuth, catalogController.listProducts);
router.post('/products', requireRole(['ADMIN']), idempotency('productsCreate'), catalogController.createProduct);

router.get('/products/:id', optionalAuth, catalogController.getProductById);
router.patch('/products/:id', requireRole(['ADMIN']), catalogController.updateProduct);
router.post('/products/:id/archive', requireRole(['ADMIN']), idempotency('productsArchive'), catalogController.archiveProduct);
router.post('/products/:id/restore', requireRole(['ADMIN']), idempotency('productsRestore'), catalogController.restoreProduct);

// Variants
router.post('/products/:id/variants', requireRole(['ADMIN']), idempotency('productVariantsCreate'), catalogController.addVariant);
router.patch('/products/:id/variants/:variantId', requireRole(['ADMIN']), catalogController.updateVariant);
router.post('/products/:id/variants/:variantId/deactivate', requireRole(['ADMIN']), idempotency('productVariantsDeactivate'), catalogController.deactivateVariant);
router.post('/products/:id/variants/:variantId/activate', requireRole(['ADMIN']), idempotency('productVariantsActivate'), catalogController.activateVariant);

// ================= SERVICES (Existing) =================
router.get('/services', async (req, res, next) => {
  try {
    const items = await Service.find({ status: 'ACTIVE' });
    res.json(items);
  } catch (error) { next(error); }
});

router.post('/services', requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const item = new Service(req.body);
    await item.save();
    res.status(201).json(item);
  } catch (error) { next(error); }
});

export default router;
