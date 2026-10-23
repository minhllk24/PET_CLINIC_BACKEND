import express from 'express';
import * as catalogController from './catalog.controller';
import Service from './models/Service';
import { authenticate, optionalAuth, requireRole } from '../../shared/authMiddleware';
import { idempotency } from '../../middleware/idempotencyMiddleware';

const router = express.Router();

// ================= CATEGORIES =================
router.get('/categories', optionalAuth, catalogController.listCategories);
router.post('/categories', authenticate, requireRole(['ADMIN']), idempotency('categoriesCreate'), catalogController.createCategory);

router.get('/categories/:id', optionalAuth, catalogController.getCategoryById);
router.patch('/categories/:id', authenticate, requireRole(['ADMIN']), catalogController.updateCategory);
router.post('/categories/:id/archive', authenticate, requireRole(['ADMIN']), idempotency('categoriesArchive'), catalogController.archiveCategory);

// ================= PRODUCTS =================
router.get('/products', optionalAuth, catalogController.listProducts);
router.post('/products', authenticate, requireRole(['ADMIN']), idempotency('productsCreate'), catalogController.createProduct);

router.get('/products/:id', optionalAuth, catalogController.getProductById);
router.patch('/products/:id', authenticate, requireRole(['ADMIN']), catalogController.updateProduct);
router.post('/products/:id/archive', authenticate, requireRole(['ADMIN']), idempotency('productsArchive'), catalogController.archiveProduct);
router.post('/products/:id/restore', authenticate, requireRole(['ADMIN']), idempotency('productsRestore'), catalogController.restoreProduct);

// Variants
router.post('/products/:id/variants', authenticate, requireRole(['ADMIN']), idempotency('productVariantsCreate'), catalogController.addVariant);
router.patch('/products/:id/variants/:variantId', authenticate, requireRole(['ADMIN']), catalogController.updateVariant);
router.post('/products/:id/variants/:variantId/deactivate', authenticate, requireRole(['ADMIN']), idempotency('productVariantsDeactivate'), catalogController.deactivateVariant);
router.post('/products/:id/variants/:variantId/activate', authenticate, requireRole(['ADMIN']), idempotency('productVariantsActivate'), catalogController.activateVariant);

// ================= SERVICES (Global Master Catalog) =================
router.get('/services', optionalAuth, catalogController.listServices);
router.post('/services', authenticate, requireRole(['ADMIN']), idempotency('servicesCreate'), catalogController.createService);
router.get('/services/:id', optionalAuth, catalogController.getServiceById);
router.patch('/services/:id', authenticate, requireRole(['ADMIN']), catalogController.updateService);
router.post('/services/:id/archive', authenticate, requireRole(['ADMIN']), idempotency('servicesArchive'), catalogController.archiveService);
router.get('/services/:id/branches', optionalAuth, catalogController.getServiceBranches);
router.get('/services/:id/branch-configs', optionalAuth, catalogController.getServiceBranchConfigs);

export default router;
