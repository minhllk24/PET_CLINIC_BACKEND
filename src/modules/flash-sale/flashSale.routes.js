import express from 'express';
import * as flashSaleController from './flashSale.controller';
import { authenticate, optionalAuth, requireRole } from '../../shared/authMiddleware';
import { idempotency } from '../../middleware/idempotencyMiddleware';

const router = express.Router();

// Public: Get currently active/running Flash Sale campaign
router.get('/active', optionalAuth, flashSaleController.getActiveFlashSale);

// Protected Admin/Manager routes
router.get('/', authenticate, requireRole(['ADMIN', 'MANAGER']), flashSaleController.listFlashSales);
router.post('/', authenticate, requireRole(['ADMIN']), idempotency('flashSaleCreate', { required: false }), flashSaleController.createFlashSale);
router.get('/:id', authenticate, requireRole(['ADMIN', 'MANAGER']), flashSaleController.getFlashSaleById);
router.patch('/:id', authenticate, requireRole(['ADMIN']), idempotency('flashSaleUpdate', { required: false }), flashSaleController.updateFlashSale);
router.put('/:id', authenticate, requireRole(['ADMIN']), idempotency('flashSaleUpdate', { required: false }), flashSaleController.updateFlashSale);
router.post('/:id/publish', authenticate, requireRole(['ADMIN']), idempotency('flashSalePublish', { required: false }), flashSaleController.publishFlashSale);
router.patch('/:id/publish', authenticate, requireRole(['ADMIN']), idempotency('flashSalePublish', { required: false }), flashSaleController.publishFlashSale);
router.post('/:id/pause', authenticate, requireRole(['ADMIN']), idempotency('flashSalePause', { required: false }), flashSaleController.togglePauseFlashSale);
router.patch('/:id/pause', authenticate, requireRole(['ADMIN']), idempotency('flashSalePause', { required: false }), flashSaleController.togglePauseFlashSale);

export default router;

