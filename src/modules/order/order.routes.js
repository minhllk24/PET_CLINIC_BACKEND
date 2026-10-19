import express from 'express';
import * as orderController from './order.controller';
import { optionalAuth, requireRole } from '../../shared/authMiddleware';
import { idempotency } from '../../middleware/idempotencyMiddleware';

const router = express.Router();
const orderOperators = requireRole(['STAFF', 'MANAGER', 'ADMIN'], ['RECEPTIONIST']);

// Customer/Guest checkout
router.post('/checkout', optionalAuth, idempotency('checkoutCreateOrder', { required: true }), orderController.checkoutCreateOrder);

// Order management (Staff/Manager)
router.get('/', orderOperators, orderController.listOrders);
router.patch('/:id/confirm', orderOperators, orderController.confirmOrder);
router.patch('/:id/process', orderOperators, orderController.processOrder);
router.patch('/:id/ship', orderOperators, orderController.shipOrder);
router.patch('/:id/mark-delivered', orderOperators, orderController.markDelivered);
router.patch(
  '/:id/cancel',
  orderOperators,
  idempotency('ordersCancel', { required: true }),
  orderController.staffCancelOrder
);

// Customer cancel
router.patch(
  '/:id/customer-cancel',
  optionalAuth,
  idempotency('ordersCustomerCancel', { required: true }),
  orderController.customerCancelOrder
);

export default router;
