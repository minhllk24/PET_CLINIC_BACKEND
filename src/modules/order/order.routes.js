import express from 'express';
import * as orderController from './order.controller';
import { optionalAuth, requireRole } from '../../shared/authMiddleware';

const router = express.Router();

// Customer/Guest checkout
router.post('/checkout', optionalAuth, orderController.checkoutCreateOrder);

// Order management (Staff/Manager)
router.get('/', requireRole(['RECEPTIONIST', 'MANAGER', 'ADMIN']), orderController.listOrders);
router.patch('/:id/confirm', requireRole(['RECEPTIONIST', 'MANAGER', 'ADMIN']), orderController.confirmOrder);
router.patch('/:id/process', requireRole(['RECEPTIONIST', 'MANAGER', 'ADMIN']), orderController.processOrder);
router.patch('/:id/ship', requireRole(['RECEPTIONIST', 'MANAGER', 'ADMIN']), orderController.shipOrder);
router.patch('/:id/mark-delivered', requireRole(['RECEPTIONIST', 'MANAGER', 'ADMIN']), orderController.markDelivered);
router.patch('/:id/cancel', requireRole(['RECEPTIONIST', 'MANAGER', 'ADMIN']), orderController.staffCancelOrder);

// Customer cancel
router.patch('/:id/customer-cancel', optionalAuth, orderController.customerCancelOrder);

export default router;
