import express from 'express';
import * as orderController from './order.controller';
import { optionalAuth, requireRole } from '../../shared/authMiddleware';
import { idempotency } from '../../middleware/idempotencyMiddleware';

const router = express.Router();
const orderOperators = requireRole(['STAFF', 'MANAGER', 'ADMIN'], ['RECEPTIONIST']);

// Customer/Guest checkout (can be reached via /checkout or /orders/checkout)
router.post('/checkout', optionalAuth, idempotency('checkoutCreateOrder', { required: true }), orderController.checkoutCreateOrder);

// Order query & detail
router.get('/', optionalAuth, orderController.listOrders);
router.get('/stats', optionalAuth, orderController.getOrderStats);
router.get('/summary', optionalAuth, orderController.getOrderStats);
router.get('/:id', optionalAuth, orderController.getOrder);

// Order actions (OpenAPI POST + PATCH backwards-compat)
router.post('/:id/confirm', orderOperators, orderController.confirmOrder);
router.patch('/:id/confirm', orderOperators, orderController.confirmOrder);

router.post('/:id/process', orderOperators, orderController.processOrder);
router.patch('/:id/process', orderOperators, orderController.processOrder);

router.post('/:id/ship', orderOperators, orderController.shipOrder);
router.patch('/:id/ship', orderOperators, orderController.shipOrder);

router.post('/:id/mark-delivered', orderOperators, orderController.markDelivered);
router.patch('/:id/mark-delivered', orderOperators, orderController.markDelivered);

// Staff cancel
router.post('/:id/staff-cancel', orderOperators, idempotency('ordersStaffCancel', { required: true }), orderController.staffCancelOrder);
router.post('/:id/cancel', optionalAuth, idempotency('ordersCancel', { required: true }), (req, res, next) => {
  // If staff/admin with reason, or customer
  if (req.actor && ['STAFF', 'MANAGER', 'ADMIN'].includes(req.actor.systemRole) && req.body && req.body.reason) {
    return orderController.staffCancelOrder(req.body, res, next);
  }
  return orderController.customerCancelOrder(req, res, next);
});
router.patch('/:id/cancel', orderOperators, idempotency('ordersCancel', { required: true }), orderController.staffCancelOrder);
router.patch('/:id/customer-cancel', optionalAuth, idempotency('ordersCustomerCancel', { required: true }), orderController.customerCancelOrder);

// Return quote and returnable items
router.get('/:id/returnable-items', optionalAuth, orderController.getReturnableItems);
router.post('/:id/return-quote', optionalAuth, orderController.getReturnQuote);

// Admin Order Creation (Quote & Commit)
export const adminOrderRouter = express.Router();
adminOrderRouter.post('/quote', orderOperators, orderController.quoteAdminOrder);
adminOrderRouter.post('/', orderOperators, idempotency('adminCreateOrder', { required: false }), orderController.createAdminOrder);

router.post('/admin/orders/quote', orderOperators, orderController.quoteAdminOrder);
router.post('/admin/orders', orderOperators, idempotency('adminCreateOrder', { required: false }), orderController.createAdminOrder);

export default router;

